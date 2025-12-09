import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { CreateDebtNoteDto } from './dto/create-debt-note.dto';
import { UpdateDebtNoteDto } from './dto/update-debt-note.dto';
import { SearchDebtNoteDto } from './dto/search-debt-note.dto';
import { FilterConditionDto } from '../payment/dto/filter-condition.dto';
import { QueryHelper } from '../../common/helpers/query-helper';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';

@Injectable()
export class DebtNoteService {
  private readonly logger = new Logger(DebtNoteService.name);

  constructor(
    @InjectRepository(DebtNote)
    private debtNoteRepository: Repository<DebtNote>,
  ) {}

  async create(createDto: CreateDebtNoteDto, userId: number): Promise<DebtNote> {
    try {
      const debtNote = this.debtNoteRepository.create({
        ...createDto,
        remaining_amount: createDto.amount, // Initially remaining = amount
        paid_amount: 0,
        status: DebtNoteStatus.ACTIVE,
        created_by: userId, // Lấy từ JWT token
      });
      return await this.debtNoteRepository.save(debtNote);
    } catch (error) {
      ErrorHandler.handleCreateError(error, 'phiếu công nợ');
    }
  }



  async findOne(id: number): Promise<DebtNote | null> {
    return this.debtNoteRepository.findOne({
      where: { id },
      relations: ['customer', 'season'],
    });
  }

  async update(id: number, updateDto: UpdateDebtNoteDto): Promise<DebtNote | null> {
    try {
      await this.debtNoteRepository.update(id, updateDto);
      return this.findOne(id);
    } catch (error) {
      ErrorHandler.handleUpdateError(error, 'phiếu công nợ');
    }
  }

  async remove(id: number): Promise<void> {
    await this.debtNoteRepository.delete(id);
  }

  async search(searchDto: SearchDebtNoteDto): Promise<{
    data: DebtNote[];
    total: number;
    page: number;
    limit: number;
    summary: {
      total_debt: number;
      overdue_count: number;
      active_count: number;
      paid_count: number;
    };
  }> {
    const queryBuilder = this.debtNoteRepository.createQueryBuilder('debt_note');
    
    queryBuilder.leftJoinAndSelect('debt_note.customer', 'customer');
    queryBuilder.leftJoinAndSelect('debt_note.season', 'season');
    queryBuilder.leftJoin('debt_note.creator', 'creator')
      .addSelect(['creator.id', 'creator.account']);

    // 1. Base Search
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'debt_note',
      ['code', 'customer.name', 'customer.phone'] // Global search
    );

    // 2. Simple Filters
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'debt_note',
      ['filters', 'nested_filters', 'operator'],
      {
        customer_name: 'customer.name',
        customer_phone: 'customer.phone',
        season_name: 'season.name',
      }
    );

    const [data, total] = await queryBuilder.getManyAndCount();

    // Tính toán các chỉ số thống kê (Summary) dựa trên điều kiện lọc hiện tại
    const summaryQuery = queryBuilder.clone(); // Clone để không ảnh hưởng offset/limit
    
    // Xóa bỏ phân trang
    summaryQuery.skip(undefined).take(undefined);
    summaryQuery.orderBy(); // Bỏ order by cho nhẹ

    const { total_debt, overdue_count, active_count, paid_count } = await summaryQuery
      .select('SUM(debt_note.remaining_amount)', 'total_debt')
      .addSelect(`COUNT(CASE WHEN debt_note.status = '${DebtNoteStatus.OVERDUE}' THEN 1 END)`, 'overdue_count')
      .addSelect(`COUNT(CASE WHEN debt_note.status = '${DebtNoteStatus.ACTIVE}' THEN 1 END)`, 'active_count')
      .addSelect(`COUNT(CASE WHEN debt_note.status = '${DebtNoteStatus.PAID}' THEN 1 END)`, 'paid_count')
      .getRawOne();

    return {
      data,
      total,
      page,
      limit,
      summary: {
        total_debt: Number(total_debt || 0),
        overdue_count: Number(overdue_count || 0),
        active_count: Number(active_count || 0),
        paid_count: Number(paid_count || 0),
      },
    };
  }


  /**
   * Tìm hoặc tạo phiếu công nợ cho khách hàng trong mùa vụ
   * Nếu đã có phiếu nợ cho customer_id + season_id → Trả về phiếu đó
   * Nếu chưa có → Tạo phiếu mới
   */
  async findOrCreateForSeason(
    customer_id: number,
    season_id: number | undefined,
    created_by: number,
  ): Promise<DebtNote> {
    // Tìm phiếu nợ hiện có
    const queryBuilder = this.debtNoteRepository
      .createQueryBuilder('dn')
      .where('dn.customer_id = :customer_id', { customer_id })
      .andWhere('dn.status IN (:...statuses)', { statuses: ['active', 'overdue'] });

    if (season_id) {
      queryBuilder.andWhere('dn.season_id = :season_id', { season_id });
    } else {
      queryBuilder.andWhere('dn.season_id IS NULL');
    }

    let debtNote = await queryBuilder.getOne();

    // Nếu chưa có, tạo mới
    if (!debtNote) {
      const code = this.generateDebtNoteCode();
      debtNote = this.debtNoteRepository.create({
        code,
        customer_id,
        ...(season_id && { season_id }),
        amount: 0,
        paid_amount: 0,
        remaining_amount: 0,
        status: DebtNoteStatus.ACTIVE,
        source_invoices: [],
        created_by,
      });
      debtNote = await this.debtNoteRepository.save(debtNote);
      this.logger.log(`✅ Tạo phiếu công nợ mới: ${code} cho customer #${customer_id}`);
    }

    return debtNote;
  }

  /**
   * Thêm hóa đơn vào phiếu công nợ
   * Cập nhật amount và remaining_amount
   */
  async addInvoiceToDebtNote(
    debtNoteId: number,
    invoiceId: number,
    invoiceAmount: number,
  ): Promise<DebtNote> {
    const debtNote = await this.debtNoteRepository.findOne({
      where: { id: debtNoteId },
    });

    if (!debtNote) {
      throw new Error(`DebtNote #${debtNoteId} not found`);
    }

    // Khởi tạo source_invoices nếu chưa có
    if (!debtNote.source_invoices) {
      debtNote.source_invoices = [];
    }

    // Thêm invoice_id vào source_invoices nếu chưa có
    if (!debtNote.source_invoices.includes(invoiceId)) {
      debtNote.source_invoices.push(invoiceId);
    }

    // Cập nhật số tiền
    debtNote.amount = Number(debtNote.amount) + invoiceAmount;
    debtNote.remaining_amount = Number(debtNote.remaining_amount) + invoiceAmount;

    return await this.debtNoteRepository.save(debtNote);
  }

  /**
   * Sinh mã phiếu công nợ tự động
   */
  private generateDebtNoteCode(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `DN${year}${month}${day}${hours}${minutes}${seconds}${random}`;
  }
}
