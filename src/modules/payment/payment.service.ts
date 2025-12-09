import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../../entities/payment.entity';
import { PaymentAllocation } from '../../entities/payment-allocation.entity';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { SalesInvoice } from '../../entities/sales-invoices.entity';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { SearchPaymentDto } from './dto/search-payment.dto';
import { SettleDebtDto } from './dto/settle-debt.dto';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';
import { QueryHelper } from '../../common/helpers/query-helper';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentAllocation)
    private paymentAllocationRepository: Repository<PaymentAllocation>,
    @InjectRepository(DebtNote)
    private debtNoteRepository: Repository<DebtNote>,
    @InjectRepository(SalesInvoice)
    private salesInvoiceRepository: Repository<SalesInvoice>,
  ) {}




  async findOne(id: number): Promise<Payment | null> {
    return this.paymentRepository.findOne({
      where: { id },
      relations: ['customer', 'allocations'],
    });
  }

  async update(id: number, updatePaymentDto: UpdatePaymentDto): Promise<Payment | null> {
    try {
      await this.paymentRepository.update(id, updatePaymentDto);
      return this.findOne(id);
    } catch (error) {
      ErrorHandler.handleUpdateError(error, 'phiếu thu');
    }
  }

  async remove(id: number): Promise<void> {
    await this.paymentRepository.delete(id);
  }

  async search(searchDto: SearchPaymentDto): Promise<{
    data: Payment[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.paymentRepository.createQueryBuilder('payment');
    
    // Join customer for searching
    queryBuilder.leftJoinAndSelect('payment.customer', 'customer');
    queryBuilder.leftJoin('payment.creator', 'creator')
      .addSelect(['creator.id', 'creator.account']);

    // 1. Áp dụng Base Search (Sort, Page, Keyword)
    // Cho phép search keyword trên các field: code, debt_note_code, customer name/phone
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'payment',
      ['code', 'debt_note_code', 'customer.name', 'customer.phone']
    );

    // 2. Simple Filters
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'payment',
      ['filters', 'nested_filters', 'operator'],
      {
        customer_name: 'customer.name',
        customer_phone: 'customer.phone',
      }
    );

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }


  /**
   * Chốt sổ công nợ
   * @param dto - Dữ liệu chốt sổ
   * @param userId - ID của user đang thực hiện (từ JWT token)
   */
  async settleDebt(dto: SettleDebtDto, userId: number): Promise<{
    payment: Payment;
    settled_invoices: SalesInvoice[];
    total_debt: number;
    remaining_debt: number;
    breakdown_by_rice_crop: Array<{
      rice_crop_id: number | null;
      field_name: string;
      invoice_count: number;
      total_debt: number;
      invoices: Array<{
        id: number;
        code: string;
        amount: number;
        remaining_amount: number;
      }>;
    }>;
    gift_description?: string | undefined;
    gift_value: number;
  }> {
    try {
      // 1. Lấy tất cả hóa đơn chưa thanh toán của khách hàng trong mùa vụ
      const unpaidInvoices = await this.salesInvoiceRepository
        .createQueryBuilder('si')
        .leftJoinAndSelect('si.rice_crop', 'rice_crop')
        .where('si.customer_id = :customerId', { customerId: dto.customer_id })
        .andWhere('si.season_id = :seasonId', { seasonId: dto.season_id })
        .andWhere('si.remaining_amount > 0')
        .orderBy('si.created_at', 'ASC') // Trả hóa đơn cũ trước
        .getMany();

      if (unpaidInvoices.length === 0) {
        throw new Error('Không có hóa đơn nợ nào để chốt sổ');
      }

      // 2. Tính tổng nợ
      const totalDebt = unpaidInvoices.reduce(
        (sum, inv) => sum + Number(inv.remaining_amount),
        0,
      );

      // 3. Tạo breakdown theo rice_crop
      const riceCropMap = new Map<number | null, {
        rice_crop_id: number | null;
        field_name: string;
        invoice_count: number;
        total_debt: number;
        invoices: Array<{
          id: number;
          code: string;
          amount: number;
          remaining_amount: number;
        }>;
      }>();

      unpaidInvoices.forEach(invoice => {
        const riceCropId = invoice.rice_crop_id || null;
        const fieldName = invoice.rice_crop?.field_name || 'Không thuộc vụ lúa nào';

        if (!riceCropMap.has(riceCropId)) {
          riceCropMap.set(riceCropId, {
            rice_crop_id: riceCropId,
            field_name: fieldName,
            invoice_count: 0,
            total_debt: 0,
            invoices: [],
          });
        }

        const cropData = riceCropMap.get(riceCropId)!;
        cropData.invoice_count++;
        cropData.total_debt += Number(invoice.remaining_amount);
        cropData.invoices.push({
          id: invoice.id,
          code: invoice.code,
          amount: invoice.final_amount,
          remaining_amount: Number(invoice.remaining_amount),
        });
      });

      const breakdownByRiceCrop = Array.from(riceCropMap.values());

      // 4. Tìm phiếu công nợ trước
      const oldDebtNote = await this.debtNoteRepository
        .createQueryBuilder('dn')
        .where('dn.customer_id = :customer_id', { customer_id: dto.customer_id })
        .andWhere('dn.season_id = :season_id', { season_id: dto.season_id })
        .andWhere('dn.status IN (:...statuses)', { statuses: [DebtNoteStatus.ACTIVE, DebtNoteStatus.OVERDUE] })
        .getOne();

      if (!oldDebtNote) {
        throw new Error('Không tìm thấy phiếu công nợ cho mùa vụ này');
      }

      // 5. Tạo Payment record với debt_note_code
      const paymentCode = this.generatePaymentCode();
      const payment = this.paymentRepository.create({
        code: paymentCode,
        customer_id: dto.customer_id,
        amount: dto.amount,
        payment_date: dto.payment_date || new Date().toISOString(),
        payment_method: dto.payment_method,
        notes: dto.notes || `Chốt sổ công nợ mùa vụ #${dto.season_id}`,
        created_by: userId,
        debt_note_code: oldDebtNote.code, // ✅ Lưu mã phiếu công nợ
      });
      const savedPayment = await this.paymentRepository.save(payment);

      // 6. Phân bổ thanh toán cho các hóa đơn
      let remainingPayment = dto.amount;
      const settledInvoices: SalesInvoice[] = [];

      for (const invoice of unpaidInvoices) {
        if (remainingPayment <= 0) break;

        const invoiceDebt = Number(invoice.remaining_amount);
        const amountToAllocate = Math.min(remainingPayment, invoiceDebt);

        // Tạo PaymentAllocation
        await this.paymentAllocationRepository.save({
          payment_id: savedPayment.id,
          invoice_id: invoice.id,
          amount: amountToAllocate,
        });

        // Cập nhật hóa đơn
        invoice.partial_payment_amount = Number(invoice.partial_payment_amount || 0) + amountToAllocate;
        invoice.remaining_amount = invoiceDebt - amountToAllocate;
        
        if (invoice.remaining_amount <= 0) {
          invoice.payment_status = 'paid';
        }

        await this.salesInvoiceRepository.save(invoice);
        settledInvoices.push(invoice);
        remainingPayment -= amountToAllocate;
      }

      // 7. Cập nhật phiếu công nợ cũ + Lưu gift
      oldDebtNote.paid_amount = Number(oldDebtNote.paid_amount || 0) + dto.amount;
      oldDebtNote.remaining_amount = totalDebt - dto.amount;
      
      // Lưu thông tin quà tặng
      if (dto.gift_description) {
        oldDebtNote.gift_description = dto.gift_description;
      }
      if (dto.gift_value !== undefined) {
        oldDebtNote.gift_value = dto.gift_value;
      }

      // 8. Cập nhật trạng thái
      if (oldDebtNote.remaining_amount <= 0) {
        // Trả hết nợ
        oldDebtNote.status = DebtNoteStatus.PAID;
      } else {
        // Còn nợ → Vẫn cho phép trả tiếp (ACTIVE) thay vì chốt sổ cứng (SETTLED)
        oldDebtNote.status = DebtNoteStatus.ACTIVE;
      }

      await this.debtNoteRepository.save(oldDebtNote);

      this.logger.log(
        `✅ Chốt sổ công nợ thành công: ${settledInvoices.length} hóa đơn, số tiền: ${dto.amount}, Quà tặng: ${dto.gift_value || 0}`,
      );

      return {
        payment: savedPayment,
        settled_invoices: settledInvoices,
        total_debt: totalDebt,
        remaining_debt: totalDebt - dto.amount,
        breakdown_by_rice_crop: breakdownByRiceCrop,
        gift_description: dto.gift_description,
        gift_value: dto.gift_value || 0,
      };
    } catch (error) {
      this.logger.error('Lỗi khi chốt sổ công nợ:', error);
      throw error;
    }
  }

  /**
   * Sinh mã phiếu thu tự động
   */
  private generatePaymentCode(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `PT${year}${month}${day}${hours}${minutes}${seconds}${random}`;
  }

  /**
   * Rollback payment (hoàn tác thanh toán)
   * Dùng khi nhập sai, cần sửa lại
   * 
   * @param paymentId - ID của payment cần rollback
   * @returns Thông tin rollback
   */
  async rollbackPayment(paymentId: number): Promise<{
    success: boolean;
    message: string;
    payment: Payment;
    affected_invoices: number;
    affected_debt_note: DebtNote | null;
  }> {
    try {
      // 1. Lấy thông tin payment và allocations
      const payment = await this.paymentRepository.findOne({
        where: { id: paymentId },
        relations: ['allocations', 'customer'],
      });

      if (!payment) {
        throw new Error(`Payment #${paymentId} không tồn tại`);
      }

      const allocations = await this.paymentAllocationRepository.find({
        where: { payment_id: paymentId },
        relations: ['invoice'],
      });

      this.logger.log(`🔄 Bắt đầu rollback payment #${payment.code}...`);

      // 2. Hoàn tác từng invoice
      let affectedInvoiceCount = 0;
      for (const allocation of allocations) {
        const invoice = allocation.invoice;
        if (!invoice) continue;

        // Trả lại số tiền đã thanh toán
        invoice.partial_payment_amount = Number(invoice.partial_payment_amount || 0) - allocation.amount;
        invoice.remaining_amount = Number(invoice.remaining_amount) + allocation.amount;

        // Cập nhật trạng thái
        if (invoice.remaining_amount > 0) {
          invoice.payment_status = invoice.partial_payment_amount > 0 ? 'partial' : 'unpaid';
        }

        await this.salesInvoiceRepository.save(invoice);
        affectedInvoiceCount++;

        this.logger.log(`  ↩️  Invoice #${invoice.code}: +${allocation.amount.toLocaleString()} đ`);
      }

      // 3. Tìm và cập nhật debt_note
      let affectedDebtNote: DebtNote | null = null;
      
      // Lấy customer_id và season_id từ invoice đầu tiên
      const firstInvoice = allocations[0]?.invoice;
      if (firstInvoice) {
        const debtNote = await this.debtNoteRepository
          .createQueryBuilder('dn')
          .where('dn.customer_id = :customer_id', { customer_id: firstInvoice.customer_id })
          .andWhere('dn.season_id = :season_id', { season_id: firstInvoice.season_id })
          .getOne();

        if (debtNote) {
          // Trả lại số tiền vào nợ
          debtNote.paid_amount = Number(debtNote.paid_amount || 0) - payment.amount;
          debtNote.remaining_amount = Number(debtNote.remaining_amount) + payment.amount;

          // Cập nhật trạng thái
          if (debtNote.remaining_amount > 0) {
            debtNote.status = DebtNoteStatus.ACTIVE;
          }

          await this.debtNoteRepository.save(debtNote);
          affectedDebtNote = debtNote;

          this.logger.log(`  ↩️  DebtNote #${debtNote.code}: +${payment.amount.toLocaleString()} đ`);
        }
      }

      // 4. Xóa payment allocations
      await this.paymentAllocationRepository.delete({ payment_id: paymentId });
      this.logger.log(`  🗑️  Đã xóa ${allocations.length} payment allocations`);

      // 5. Xóa payment
      await this.paymentRepository.delete(paymentId);
      this.logger.log(`  🗑️  Đã xóa payment #${payment.code}`);

      this.logger.log(`✅ Rollback thành công payment #${payment.code}`);

      return {
        success: true,
        message: `Đã rollback payment #${payment.code}. Hoàn trả ${payment.amount.toLocaleString()} đ vào công nợ.`,
        payment,
        affected_invoices: affectedInvoiceCount,
        affected_debt_note: affectedDebtNote,
      };
    } catch (error) {
      this.logger.error(`❌ Lỗi khi rollback payment #${paymentId}:`, error);
      throw error;
    }
  }
}
