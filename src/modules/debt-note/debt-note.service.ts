import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { CreateDebtNoteDto } from './dto/create-debt-note.dto';
import { UpdateDebtNoteDto } from './dto/update-debt-note.dto';
import { SearchDebtNoteDto } from './dto/search-debt-note.dto';
import { FilterConditionDto } from '../payment/dto/filter-condition.dto';
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

    this.buildSearchConditions(queryBuilder, searchDto, 'debt_note');

    const page = searchDto.page || 1;
    const limit = searchDto.limit || 20;
    const offset = (page - 1) * limit;

    queryBuilder.skip(offset).take(limit);
    queryBuilder.orderBy('debt_note.created_at', 'DESC');

    const [data, total] = await queryBuilder.getManyAndCount();

    // Tính toán các chỉso thống kê (Summary) dựa trên điều kiện lọc hiện tại
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

  private buildSearchConditions(
    queryBuilder: SelectQueryBuilder<DebtNote>,
    searchDto: SearchDebtNoteDto,
    alias: string,
  ): void {
    if (searchDto.filters && searchDto.filters.length > 0) {
      const operator = searchDto.operator || 'AND';
      const conditions: string[] = [];
      const parameters: { [key: string]: any } = {};

      searchDto.filters.forEach((filter, index) => {
        const condition = this.buildFilterCondition(
          filter,
          alias,
          index,
          parameters,
        );
        if (condition) {
          conditions.push(condition);
        }
      });

      if (conditions.length > 0) {
        const combinedCondition = conditions.join(` ${operator} `);
        queryBuilder.andWhere(`(${combinedCondition})`, parameters);
      }
    }
  }

  private buildFilterCondition(
    filter: FilterConditionDto,
    alias: string,
    index: number,
    parameters: { [key: string]: any },
  ): string | null {
    if (!filter.field || !filter.operator) return null;
    const paramName = `param_${index}`;
    let field = `${alias}.${filter.field}`;
    if (filter.field.includes('.')) {
        field = filter.field;
    }

    switch (filter.operator) {
      case 'eq': parameters[paramName] = filter.value; return `${field} = :${paramName}`;
      case 'ne': parameters[paramName] = filter.value; return `${field} != :${paramName}`;
      case 'gt': parameters[paramName] = filter.value; return `${field} > :${paramName}`;
      case 'lt': parameters[paramName] = filter.value; return `${field} < :${paramName}`;
      case 'gte': parameters[paramName] = filter.value; return `${field} >= :${paramName}`;
      case 'lte': parameters[paramName] = filter.value; return `${field} <= :${paramName}`;
      case 'like': parameters[paramName] = `%${filter.value}%`; return `${field} LIKE :${paramName}`;
      case 'ilike': parameters[paramName] = `%${filter.value}%`; return `LOWER(${field}) LIKE LOWER(:${paramName})`;
      case 'in':
        if (Array.isArray(filter.value)) {
          parameters[paramName] = filter.value;
          return `${field} IN (:...${paramName})`;
        }
        return null;
      case 'notin':
        if (Array.isArray(filter.value)) {
          parameters[paramName] = filter.value;
          return `${field} NOT IN (:...${paramName})`;
        }
        return null;
      case 'isnull': return `${field} IS NULL`;
      case 'isnotnull': return `${field} IS NOT NULL`;
      default: return null;
    }
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
