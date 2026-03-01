import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Brackets } from 'typeorm';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { CreateDebtNoteDto } from './dto/create-debt-note.dto';
import { UpdateDebtNoteDto } from './dto/update-debt-note.dto';
import { SearchDebtNoteDto } from './dto/search-debt-note.dto';
import { CloseSeasonDebtNoteDto } from './dto/close-season-debt-note.dto';
import { QueryHelper } from '../../common/helpers/query-helper';
import { CodeGeneratorHelper } from '../../common/helpers/code-generator.helper';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';
import { CustomerRewardService } from '../customer-reward/customer-reward.service';

@Injectable()
export class DebtNoteService {
  private readonly logger = new Logger(DebtNoteService.name);

  constructor(
    @InjectRepository(DebtNote)
    private debtNoteRepository: Repository<DebtNote>,
    private dataSource: DataSource,
    private readonly customerRewardService: CustomerRewardService,
  ) {}

  async create(createDto: CreateDebtNoteDto, userId: number): Promise<DebtNote> {
    try {
      // Tự sinh mã nếu không có
      const code = createDto.code || CodeGeneratorHelper.generateUniqueCode('DN');
      
      const debtNote = this.debtNoteRepository.create({
        ...createDto,
        code,
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

    // 2. Simple Filters & Guest Search logic
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'debt_note',
      ['filters', 'nested_filters', 'operator', 'customer_name', 'customer_phone'], // Bỏ qua mapping mặc định cho name/phone
      {
        season_name: 'season.name',
      }
    );

    // ✅ Logic tìm kiếm khách hàng (chính thức & vãng lai)
    if (searchDto.customer_name || searchDto.customer_phone) {
      const nameKeyword = searchDto.customer_name ? `%${QueryHelper.sanitizeKeyword(searchDto.customer_name)}%` : null;
      const phoneKeyword = searchDto.customer_phone ? `%${QueryHelper.sanitizeKeyword(searchDto.customer_phone)}%` : null;
      
      queryBuilder.andWhere(new Brackets(qb => {
        if (nameKeyword) {
          // Tìm trong bảng Customer
          qb.orWhere(`regexp_replace(unaccent(customer.name), '[^a-zA-Z0-9\\s]', '', 'g') ILIKE unaccent(:nameKeyword)`, { nameKeyword });
          // Tìm trong các hóa đơn liên quan (Guest Name)
          qb.orWhere(`EXISTS (
            SELECT 1 FROM sales_invoices si 
            WHERE si.id IN (SELECT json_array_elements_text(debt_note.source_invoices)::int)
            AND regexp_replace(unaccent(si.customer_name), '[^a-zA-Z0-9\\s]', '', 'g') ILIKE unaccent(:nameKeyword)
          )`, { nameKeyword });
        }
        
        if (phoneKeyword) {
          qb.orWhere(`customer.phone ILIKE :phoneKeyword`, { phoneKeyword });
          qb.orWhere(`EXISTS (
            SELECT 1 FROM sales_invoices si 
            WHERE si.id IN (SELECT json_array_elements_text(debt_note.source_invoices)::int)
            AND si.customer_phone ILIKE :phoneKeyword
          )`, { phoneKeyword });
        }
      }));
    }

    const data = await queryBuilder.getMany();
    const total = await queryBuilder.clone().skip(undefined).take(undefined).getCount();

    const summaryQuery = queryBuilder.clone();
    summaryQuery.skip(undefined).take(undefined);
    summaryQuery.orderBy();

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

  async findOrCreateForSeason(
    customer_id: number,
    season_id: number | undefined,
    created_by: number,
    manager?: any,
  ): Promise<DebtNote> {
    const repo = manager ? manager.getRepository(DebtNote) : this.debtNoteRepository;

    const queryBuilder = repo
      .createQueryBuilder('dn')
      .where('dn.customer_id = :customer_id', { customer_id })
      .andWhere('dn.status IN (:...statuses)', { statuses: ['active', 'overdue', 'paid'] });

    if (season_id) {
      queryBuilder.andWhere('dn.season_id = :season_id', { season_id });
    } else {
      queryBuilder.andWhere('dn.season_id IS NULL');
    }

    let debtNote = await queryBuilder.getOne();

    if (!debtNote) {
      const code = CodeGeneratorHelper.generateUniqueCode('DN');
      const newDebtNote = repo.create({
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
      debtNote = await repo.save(newDebtNote);
      this.logger.log(`✅ Tạo phiếu công nợ mới: ${code} cho customer #${customer_id}`);
    }

    return debtNote;
  }

  async addInvoiceToDebtNote(
    debtNoteId: number,
    invoiceId: number,
    invoiceFinalAmount: number,
    invoicePaidAmount: number,
    manager?: any,
  ): Promise<DebtNote> {
    const repo = manager ? manager.getRepository(DebtNote) : this.debtNoteRepository;

    const debtNote = await repo.findOne({
      where: { id: debtNoteId },
    });

    if (!debtNote) {
      throw new Error(`DebtNote #${debtNoteId} not found`);
    }

    if (!debtNote.source_invoices) {
      debtNote.source_invoices = [];
    }

    if (!debtNote.source_invoices.includes(invoiceId)) {
      debtNote.source_invoices.push(invoiceId);
    }

    const currentAmount = Number(debtNote.amount) || 0;
    const currentPaid = Number(debtNote.paid_amount) || 0;
    const currentRemaining = Number(debtNote.remaining_amount) || 0;

    const addAmount = Number(invoiceFinalAmount) || 0;
    const addPaid = Number(invoicePaidAmount) || 0;
    const addRemaining = Math.max(0, addAmount - addPaid);
    
    debtNote.amount = currentAmount + addAmount;
    debtNote.paid_amount = currentPaid + addPaid;
    debtNote.remaining_amount = currentRemaining + addRemaining;

    if (debtNote.status !== DebtNoteStatus.SETTLED && debtNote.status !== DebtNoteStatus.CANCELLED) {
      if (debtNote.remaining_amount > 0) {
        debtNote.status = DebtNoteStatus.ACTIVE;
      } else {
        debtNote.status = DebtNoteStatus.PAID;
      }
    }

    return await repo.save(debtNote);
  }

  async removeInvoiceFromDebtNote(
    invoiceId: number,
    invoiceFinalAmount: number,
    invoicePaidAmount: number,
    manager?: any,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(DebtNote) : this.debtNoteRepository;

    const debtNotes = await repo.createQueryBuilder('dn')
      .where('dn.source_invoices::jsonb @> :invoiceIdJson::jsonb', { 
        invoiceIdJson: JSON.stringify([invoiceId]) 
      })
      .getMany();

    for (const debtNote of debtNotes) {
      if (debtNote.source_invoices) {
        debtNote.source_invoices = debtNote.source_invoices.filter(id => id !== invoiceId);
      }

      const currentAmount = Number(debtNote.amount) || 0;
      const currentPaid = Number(debtNote.paid_amount) || 0;
      const currentRemaining = Number(debtNote.remaining_amount) || 0;

      const removeAmount = Number(invoiceFinalAmount) || 0;
      const removePaid = Number(invoicePaidAmount) || 0;
      const removeRemaining = Math.max(0, removeAmount - removePaid);

      debtNote.amount = Math.max(0, currentAmount - removeAmount);
      debtNote.paid_amount = Math.max(0, currentPaid - removePaid);
      debtNote.remaining_amount = Math.max(0, currentRemaining - removeRemaining);

      if (debtNote.status !== DebtNoteStatus.SETTLED && debtNote.status !== DebtNoteStatus.CANCELLED) {
        if (debtNote.remaining_amount > 0) {
          debtNote.status = DebtNoteStatus.ACTIVE;
        } else {
          debtNote.status = DebtNoteStatus.PAID;
        }
      }

      await repo.save(debtNote);
      this.logger.log(`✅ Đã trừ công nợ hóa đơn #${invoiceId} khỏi phiếu nợ #${debtNote.code}`);
    }
  }

  /**
   * Chốt sổ công nợ cuối vụ
   */
  async closeSeasonDebtNote(debtNoteId: number, closeData: CloseSeasonDebtNoteDto, userId: number) {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Lấy thông tin phiếu công nợ
      const debtNote = await manager.findOne(DebtNote, {
        where: { id: debtNoteId },
        relations: ['customer', 'season'],
      });

      if (!debtNote) {
        throw new NotFoundException('Không tìm thấy phiếu công nợ');
      }

      if (debtNote.status === DebtNoteStatus.SETTLED) {
        throw new BadRequestException('Phiếu công nợ đã được chốt sổ');
      }

      // 2. Xử lý quà tặng và tích lũy thông qua CustomerRewardService
      // CHỈ CẦN GỌI DUY NHẤT 1 HÀM NÀY, không cần tính toán tại đây.
      const rewardSummary = await this.customerRewardService.handleDebtNoteSettlement(
        manager,
        debtNote,
        closeData,
        userId
      );

      // 3. Cập nhật phiếu công nợ (phần thuộc về DebtNote)
      debtNote.status = DebtNoteStatus.SETTLED;
      debtNote.closed_at = new Date();
      debtNote.reward_given = rewardSummary.reward_given;
      debtNote.reward_count = rewardSummary.reward_count;
      if (closeData.gift_description) {
        debtNote.gift_description = closeData.gift_description;
      }
      debtNote.gift_value = closeData.gift_value || 0;
      
      await manager.save(debtNote);

      // 4. Trả về kết quả tóm tắt cho FE
      return {
        success: true,
        debt_note_id: debtNote.id,
        customer_name: debtNote.customer?.name,
        season_name: debtNote.season?.name,
        ...rewardSummary, // Trộn các thông tin quà tặng từ summary vào response
      };
    });
  }
}
