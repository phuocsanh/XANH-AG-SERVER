import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, DataSource } from 'typeorm';
import {
  SalesInvoice,
  SalesInvoiceStatus,
} from '../../entities/sales-invoices.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { Product } from '../../entities/products.entity';
import { CreateSalesInvoiceDto } from './dto/create-sales-invoice.dto';
import { UpdateSalesInvoiceDto } from './dto/update-sales-invoice.dto';
import { SearchSalesDto } from './dto/search-sales.dto';
import { QueryHelper } from '../../common/helpers/query-helper';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';
import { DebtNoteService } from '../debt-note/debt-note.service';

/**
 * Service xử lý logic nghiệp vụ liên quan đến quản lý bán hàng
 * Bao gồm quản lý hóa đơn bán hàng và chi tiết hóa đơn
 */
@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  /**
   * Constructor injection các repository cần thiết
   * @param salesInvoiceRepository - Repository để thao tác với entity SalesInvoice
   * @param salesInvoiceItemRepository - Repository để thao tác với entity SalesInvoiceItem
   * @param debtNoteService - Service xử lý công nợ
   * @param dataSource - DataSource để tạo raw query builder
   */
  constructor(
    @InjectRepository(SalesInvoice)
    private salesInvoiceRepository: Repository<SalesInvoice>,
    @InjectRepository(SalesInvoiceItem)
    private salesInvoiceItemRepository: Repository<SalesInvoiceItem>,
    private debtNoteService: DebtNoteService,
    private dataSource: DataSource,
  ) {}

  /**
   * Tạo hóa đơn bán hàng mới
   * @param createSalesInvoiceDto - Dữ liệu tạo hóa đơn bán hàng mới
   * @param userId - ID của user đang tạo hóa đơn (từ JWT token)
   * @returns Thông tin hóa đơn bán hàng đã tạo
   */
  async create(
    createSalesInvoiceDto: CreateSalesInvoiceDto,
    userId: number,
  ): Promise<SalesInvoice> {
    this.logger.log(`Bắt đầu tạo hóa đơn bán hàng: ${createSalesInvoiceDto.invoice_code || 'AUTO-GEN'}`);
    
    const queryRunner = this.salesInvoiceRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Tính toán số tiền còn nợ
      const partialPayment = Number(createSalesInvoiceDto.partial_payment_amount || 0);
      const remainingAmount = Number(createSalesInvoiceDto.final_amount) - partialPayment;

      // Tự động sinh mã hóa đơn nếu không có
      const invoiceCode = createSalesInvoiceDto.invoice_code || this.generateInvoiceCode();

      // Tạo phiếu bán hàng với trạng thái mặc định là DRAFT
      const invoiceData: any = {
        code: invoiceCode,
        customer_id: createSalesInvoiceDto.customer_id, // ID khách hàng nếu có
        customer_name: createSalesInvoiceDto.customer_name,
        customer_phone: createSalesInvoiceDto.customer_phone,
        customer_email: createSalesInvoiceDto.customer_email,
        customer_address: createSalesInvoiceDto.customer_address,
        total_amount: createSalesInvoiceDto.total_amount,
        discount_amount: createSalesInvoiceDto.discount_amount || 0,
        final_amount: createSalesInvoiceDto.final_amount,
        payment_method: createSalesInvoiceDto.payment_method,
        notes: createSalesInvoiceDto.notes,
        warning: createSalesInvoiceDto.warning,
        created_by: userId, // Lấy từ JWT token
        status: createSalesInvoiceDto.status || SalesInvoiceStatus.DRAFT, // Trạng thái từ DTO hoặc mặc định là DRAFT
        partial_payment_amount: partialPayment,
        remaining_amount: remainingAmount,
        rice_crop_id: createSalesInvoiceDto.rice_crop_id,
        season_id: createSalesInvoiceDto.season_id,
      };
      
      const invoice = queryRunner.manager.create(SalesInvoice, invoiceData);
      const savedInvoice = await queryRunner.manager.save(invoice);
      
      this.logger.log(`Đã lưu hóa đơn với ID: ${savedInvoice.id}`);

      // Tạo các item trong phiếu với tính toán totalPrice
      if (createSalesInvoiceDto.items && Array.isArray(createSalesInvoiceDto.items) && createSalesInvoiceDto.items.length > 0) {
        const items = createSalesInvoiceDto.items.map((item) => {
          // Tính tổng giá tiền = (giá đơn vị * số lượng) - số tiền giảm giá
          const totalPrice =
            item.unit_price * item.quantity - (item.discount_amount || 0);

          return queryRunner.manager.create(SalesInvoiceItem, {
            ...item,
            invoice_id: savedInvoice.id,
            total_price: totalPrice,
          });
        });
        await queryRunner.manager.save(items);

        // 🆕 Tự động tính lợi nhuận ngay trong transaction
        try {
          let totalCOGS = 0;
          for (const item of items) {
             const product = await queryRunner.manager.findOne(Product, {
               where: { id: item.product_id },
             });
             
             if (product) {
               const avgCost = Number(product.average_cost_price || 0);
               totalCOGS += item.quantity * avgCost;
             }
          }

          const grossProfit = Number(savedInvoice.final_amount) - totalCOGS;
          const margin = savedInvoice.final_amount > 0 
            ? Math.round((grossProfit / savedInvoice.final_amount) * 10000) / 100
            : 0;

          savedInvoice.cost_of_goods_sold = totalCOGS;
          savedInvoice.gross_profit = grossProfit;
          savedInvoice.gross_profit_margin = margin;
          
          await queryRunner.manager.save(savedInvoice);
          
          this.logger.log(`✅ Đã tính lợi nhuận cho đơn #${savedInvoice.id}: ${grossProfit.toLocaleString()} đ (${margin}%)`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(`⚠️  Không thể tính lợi nhuận cho đơn #${savedInvoice.id}:`, errorMessage);
          // Không throw error để không làm gián đoạn luồng tạo đơn (nhưng vẫn nằm trong transaction)
        }
      }

      // 🆕 Tự động tạo/cập nhật phiếu công nợ nếu có remaining_amount > 0
      if (savedInvoice.remaining_amount > 0 && savedInvoice.customer_id) {
        try {
          // Tìm hoặc tạo phiếu công nợ cho mùa vụ (PASS MANAGER)
          const debtNote = await this.debtNoteService.findOrCreateForSeason(
            savedInvoice.customer_id,
            savedInvoice.season_id,
            savedInvoice.created_by,
            queryRunner.manager, // Pass transaction manager
          );

          // Thêm hóa đơn vào phiếu công nợ (PASS MANAGER)
          await this.debtNoteService.addInvoiceToDebtNote(
            debtNote.id,
            savedInvoice.id,
            savedInvoice.remaining_amount,
            queryRunner.manager, // Pass transaction manager
          );

          this.logger.log(
            `✅ Đã cập nhật phiếu công nợ #${debtNote.code} cho hóa đơn #${savedInvoice.code}`,
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          // Nếu lỗi cập nhật công nợ, đây là lỗi NGHIÊM TRỌNG liên quan tiền bạc -> NÊN ROLLBACK
          // Khác với tính lợi nhuận (chỉ là report), công nợ sai là vấn đề lớn.
          throw new Error(`Lỗi cập nhật công nợ: ${errorMessage}`);
        }
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Đã commit transaction cho hóa đơn ${savedInvoice.id}`);

      return savedInvoice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
       const errorMessage = error instanceof Error ? error.message : 'Unknown error';
       const errorStack = error instanceof Error ? error.stack : '';
       this.logger.error(`Lỗi khi tạo hóa đơn bán hàng: ${errorMessage}`, errorStack);
       // Re-throw để Global Filter bắt được hoặc trả về error
       ErrorHandler.handleCreateError(error, 'hóa đơn bán hàng');
       throw error; // Make sure to throw after handling/logging
    } finally {
      await queryRunner.release();
    }
  }



  /**
   * Lấy danh sách tất cả hóa đơn bán hàng (không bao gồm đã xóa mềm)
   * @returns Danh sách hóa đơn bán hàng
   */
  async findAll(): Promise<SalesInvoice[]> {
    return this.salesInvoiceRepository.find({
      where: { deleted_at: IsNull() },
      order: { created_at: 'DESC' }, // Sắp xếp theo thời gian tạo giảm dần
    });
  }

  /**
   * Lấy danh sách hóa đơn bán hàng theo trạng thái
   * @param status - Trạng thái cần lọc
   * @returns Danh sách hóa đơn bán hàng theo trạng thái
   */
  async findByStatus(status: SalesInvoiceStatus): Promise<SalesInvoice[]> {
    return this.salesInvoiceRepository.createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.season', 'season')
      .leftJoinAndSelect('invoice.rice_crop', 'rice_crop')
      .leftJoinAndSelect('invoice.customer', 'customer')
      .leftJoin('invoice.creator', 'creator')
      .addSelect(['creator.id', 'creator.account'])
      .where('invoice.status = :status', { status })
      .andWhere('invoice.deleted_at IS NULL')
      .orderBy('invoice.created_at', 'DESC')
      .getMany();
  }

  /**
   * Lấy danh sách hóa đơn bán hàng đã xóa mềm
   * @returns Danh sách hóa đơn bán hàng đã xóa mềm
   */
  async findDeleted(): Promise<SalesInvoice[]> {
    return this.salesInvoiceRepository.createQueryBuilder('invoice')
      .withDeleted()
      // .leftJoinAndSelect('invoice.items', 'items') // Commented out items for list view performance, similar to search
      .leftJoinAndSelect('invoice.season', 'season')
      .leftJoinAndSelect('invoice.rice_crop', 'rice_crop')
      .leftJoinAndSelect('invoice.customer', 'customer')
      .leftJoin('invoice.creator', 'creator')
      .addSelect(['creator.id', 'creator.account'])
      .where('invoice.deleted_at IS NOT NULL')
      .orderBy('invoice.deleted_at', 'DESC')
      .getMany();
  }

  /**
   * Tìm hóa đơn bán hàng theo ID
   * @param id - ID của hóa đơn bán hàng cần tìm
   * @returns Thông tin hóa đơn bán hàng với thông tin số lượng đã trả và có thể trả
   */
  async findOne(id: number): Promise<SalesInvoice | null> {
    // Lấy hóa đơn với các relations
    const invoice = await this.salesInvoiceRepository.createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('invoice.customer', 'customer')
      .leftJoinAndSelect('invoice.season', 'season')
      .leftJoinAndSelect('invoice.rice_crop', 'rice_crop')
      .leftJoin('invoice.creator', 'creator')
      .addSelect(['creator.id', 'creator.account'])
      .where('invoice.id = :id', { id })
      .andWhere('invoice.deleted_at IS NULL')
      .getOne();

    if (!invoice) {
      return null;
    }

    // ✅ Tính số lượng đã trả cho mỗi item
    if (invoice.items && invoice.items.length > 0) {
      for (const item of invoice.items) {
        // Query tổng số lượng đã trả của sản phẩm này trong hóa đơn
        const returnedData = await this.dataSource
          .createQueryBuilder()
          .select('COALESCE(SUM(return_item.quantity), 0)', 'total_returned')
          .from('sales_return_items', 'return_item')
          .innerJoin('sales_returns', 'sales_return', 'sales_return.id = return_item.sales_return_id')
          .where('sales_return.invoice_id = :invoiceId', { invoiceId: id })
          .andWhere('sales_return.status = :status', { status: 'completed' })
          .andWhere('return_item.product_id = :productId', { productId: item.product_id })
          .getRawOne();

        // Gán vào item
        const returnedQty = parseFloat(returnedData?.total_returned || '0');
        (item as any).returned_quantity = returnedQty;
        (item as any).returnable_quantity = item.quantity - returnedQty;
      }
    }

    return invoice;
  }

  /**
   * Tìm hóa đơn bán hàng theo mã
   * @param code - Mã của hóa đơn bán hàng cần tìm
   * @returns Thông tin hóa đơn bán hàng với thông tin số lượng đã trả và có thể trả
   */
  async findByCode(code: string): Promise<SalesInvoice | null> {
    // Lấy hóa đơn với các relations
    const invoice = await this.salesInvoiceRepository.createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('invoice.customer', 'customer')
      .leftJoinAndSelect('invoice.season', 'season')
      .leftJoinAndSelect('invoice.rice_crop', 'rice_crop')
      .leftJoin('invoice.creator', 'creator')
      .addSelect(['creator.id', 'creator.account'])
      .where('invoice.code = :code', { code })
      .andWhere('invoice.deleted_at IS NULL')
      .getOne();

    if (!invoice) {
      return null;
    }

    // ✅ Tính số lượng đã trả cho mỗi item
    if (invoice.items && invoice.items.length > 0) {
      for (const item of invoice.items) {
        // Query tổng số lượng đã trả của sản phẩm này trong hóa đơn
        const returnedData = await this.dataSource
          .createQueryBuilder()
          .select('COALESCE(SUM(return_item.quantity), 0)', 'total_returned')
          .from('sales_return_items', 'return_item')
          .innerJoin('sales_returns', 'sales_return', 'sales_return.id = return_item.sales_return_id')
          .where('sales_return.invoice_id = :invoiceId', { invoiceId: invoice.id })
          .andWhere('sales_return.status = :status', { status: 'completed' })
          .andWhere('return_item.product_id = :productId', { productId: item.product_id })
          .getRawOne();

        // Gán vào item
        const returnedQty = parseFloat(returnedData?.total_returned || '0');
        (item as any).returned_quantity = returnedQty;
        (item as any).returnable_quantity = item.quantity - returnedQty;
      }
    }

    return invoice;
  }

  /**
   * Tìm hóa đơn bán hàng gần nhất của một khách hàng
   * @param customer_id - ID của khách hàng cần tìm đơn hàng gần nhất
   * @returns Thông tin hóa đơn bán hàng gần nhất của khách hàng
   */
  async findLatestByCustomer(customer_id: number): Promise<SalesInvoice | null> {
    this.logger.log(`[findLatestByCustomer] Searching for customer_id: ${customer_id}`);
    
    // Tìm tất cả hóa đơn của khách hàng để debug
    const allInvoices = await this.salesInvoiceRepository.find({
      where: { 
        customer_id, 
        deleted_at: IsNull() 
      },
      order: { created_at: 'DESC' },
      take: 5,
    });
    
    this.logger.log(`[findLatestByCustomer] Found ${allInvoices.length} invoices for customer_id ${customer_id}`);
    if (allInvoices.length > 0) {
      this.logger.log('[findLatestByCustomer] Sample invoice:', {
        id: allInvoices[0]?.id,
        code: allInvoices[0]?.code,
        customer_id: allInvoices[0]?.customer_id,
        customer_name: allInvoices[0]?.customer_name,
        created_at: allInvoices[0]?.created_at,
      });
    }
    
    // Trả về hóa đơn gần nhất với đầy đủ relations
    const latestInvoice = await this.salesInvoiceRepository.findOne({
      where: { 
        customer_id, 
        deleted_at: IsNull() 
      },
      relations: ['items', 'customer', 'season'], // Bao gồm cả các item, thông tin khách hàng và mùa vụ
      order: { created_at: 'DESC' }, // Sắp xếp theo thời gian tạo giảm dần để lấy đơn gần nhất
    });
    
    this.logger.log('[findLatestByCustomer] Latest invoice with relations:', latestInvoice ? 'Found' : 'Not found');
    
    return latestInvoice;
  }

  /**
   * Cập nhật thông tin hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần cập nhật
   * @param updateSalesInvoiceDto - Dữ liệu cập nhật hóa đơn bán hàng
   * @returns Thông tin hóa đơn bán hàng đã cập nhật
   */
  async update(
    id: number,
    updateSalesInvoiceDto: UpdateSalesInvoiceDto,
  ): Promise<SalesInvoice | null> {
    try {
      await this.salesInvoiceRepository.update(id, updateSalesInvoiceDto);
      return this.findOne(id);
    } catch (error) {
      ErrorHandler.handleUpdateError(error, 'hóa đơn bán hàng');
    }
  }

  /**
   * Cập nhật trạng thái hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần cập nhật
   * @param status - Trạng thái mới
   * @returns Thông tin hóa đơn bán hàng đã cập nhật
   */
  async updateStatus(
    id: number,
    status: SalesInvoiceStatus,
  ): Promise<SalesInvoice | null> {
    const invoice = await this.findOne(id);
    if (!invoice) {
      return null;
    }

    await this.salesInvoiceRepository.update(id, {
      status,
      updated_at: new Date(),
    });

    return this.findOne(id);
  }

  /**
   * Xác nhận hóa đơn bán hàng (chuyển từ DRAFT sang CONFIRMED)
   * @param id - ID của hóa đơn bán hàng cần xác nhận
   * @returns Thông tin hóa đơn bán hàng đã xác nhận
   */
  async confirmInvoice(id: number): Promise<SalesInvoice | null> {
    return this.updateStatus(id, SalesInvoiceStatus.CONFIRMED);
  }

  /**
   * Đánh dấu hóa đơn bán hàng đã thanh toán
   * @param id - ID của hóa đơn bán hàng cần đánh dấu đã thanh toán
   * @returns Thông tin hóa đơn bán hàng đã thanh toán
   */
  async markAsPaid(id: number): Promise<SalesInvoice | null> {
    return this.updateStatus(id, SalesInvoiceStatus.PAID);
  }

  /**
   * Hủy hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần hủy
   * @returns Thông tin hóa đơn bán hàng đã hủy
   */
  async cancelInvoice(id: number): Promise<SalesInvoice | null> {
    return this.updateStatus(id, SalesInvoiceStatus.CANCELLED);
  }

  /**
   * Hoàn tiền hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần hoàn tiền
   * @returns Thông tin hóa đơn bán hàng đã hoàn tiền
   */
  async refundInvoice(id: number): Promise<SalesInvoice | null> {
    return this.updateStatus(id, SalesInvoiceStatus.REFUNDED);
  }

  /**
   * Xóa mềm hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần xóa mềm
   * @returns Thông tin hóa đơn bán hàng đã xóa mềm
   */
  async softDelete(id: number): Promise<SalesInvoice | null> {
    const invoice = await this.findOne(id);
    if (!invoice) {
      return null;
    }

    await this.salesInvoiceRepository.softDelete(id);

    return this.salesInvoiceRepository.findOne({
      where: { id },
      withDeleted: true,
      relations: ['items'],
    });
  }

  /**
   * Khôi phục hóa đơn bán hàng đã xóa mềm
   * @param id - ID của hóa đơn bán hàng cần khôi phục
   * @returns Thông tin hóa đơn bán hàng đã khôi phục
   */
  async restore(id: number): Promise<SalesInvoice | null> {
    const invoice = await this.salesInvoiceRepository.findOne({
      where: { id, deleted_at: Not(IsNull()) },
      withDeleted: true,
    });

    if (!invoice) {
      return null;
    }

    await this.salesInvoiceRepository.restore(id);

    return this.findOne(id);
  }

  /**
   * Xóa hóa đơn bán hàng theo ID (xóa cứng)
   * @param id - ID của hóa đơn bán hàng cần xóa
   */
  async remove(id: number): Promise<void> {
    await this.salesInvoiceRepository.delete(id);
  }

  /**
   * Cập nhật trạng thái thanh toán của hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần cập nhật
   * @param payment_status - Trạng thái thanh toán mới
   * @returns Thông tin hóa đơn bán hàng đã cập nhật
   */
  async updatePaymentStatus(
    id: number,
    payment_status: string,
  ): Promise<SalesInvoice | null> {
    const invoice = await this.findOne(id);
    if (!invoice) {
      return null;
    }
    invoice.payment_status = payment_status; // Cập nhật trạng thái thanh toán
    return this.salesInvoiceRepository.save(invoice);
  }

  /**
   * Thanh toán thêm cho hóa đơn (bán thiếu)
   * @param id - ID của hóa đơn bán hàng
   * @param amount - Số tiền thanh toán thêm
   * @returns Thông tin hóa đơn bán hàng đã cập nhật
   */
  async addPartialPayment(
    id: number,
    amount: number,
  ): Promise<SalesInvoice | null> {
    const invoice = await this.findOne(id);
    if (!invoice) {
      return null;
    }

    // Cập nhật số tiền đã thanh toán và số tiền còn nợ
    // Convert decimal strings to numbers for calculation
    const currentPartialPayment = parseFloat(invoice.partial_payment_amount?.toString() || '0');
    const finalAmount = parseFloat(invoice.final_amount?.toString() || '0');
    
    const newPartialPayment = currentPartialPayment + amount;
    const newRemainingAmount = finalAmount - newPartialPayment;

    // Nếu thanh toán đủ, cập nhật trạng thái
    if (newRemainingAmount <= 0) {
      invoice.status = SalesInvoiceStatus.PAID;
      invoice.payment_status = 'paid';
      invoice.partial_payment_amount = finalAmount;
      invoice.remaining_amount = 0;
    } else {
      invoice.partial_payment_amount = newPartialPayment;
      invoice.remaining_amount = newRemainingAmount;
      invoice.payment_status = 'partial';
    }

    return this.salesInvoiceRepository.save(invoice);
  }


  /**
   * Lấy danh sách các item trong hóa đơn bán hàng
   * @param invoice_id - ID của hóa đơn bán hàng
   * @returns Danh sách các item trong hóa đơn bán hàng
   */
  async getInvoiceItems(invoice_id: number): Promise<SalesInvoiceItem[]> {
    return this.salesInvoiceItemRepository.find({
      where: { invoice_id },
    });
  }

  /**
   * Cập nhật thông tin chi tiết hóa đơn bán hàng
   * @param id - ID của chi tiết hóa đơn bán hàng cần cập nhật
   * @param updateData - Dữ liệu cập nhật chi tiết hóa đơn bán hàng
   * @returns Thông tin chi tiết hóa đơn bán hàng đã cập nhật
   */
  async updateInvoiceItem(
    id: number,
    updateData: Partial<SalesInvoiceItem>,
  ): Promise<SalesInvoiceItem | null> {
    await this.salesInvoiceItemRepository.update(id, updateData);
    return this.salesInvoiceItemRepository.findOne({ where: { id } });
  }

  /**
   * Xóa chi tiết hóa đơn bán hàng theo ID
   * @param id - ID của chi tiết hóa đơn bán hàng cần xóa
   */
  async removeInvoiceItem(id: number): Promise<void> {
    await this.salesInvoiceItemRepository.delete(id);
  }

  /**
   * Tìm kiếm nâng cao hóa đơn bán hàng
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách hóa đơn bán hàng phù hợp với thông tin phân trang
   */
  async searchSalesInvoices(searchDto: SearchSalesDto): Promise<{
    data: SalesInvoice[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder =
      this.salesInvoiceRepository.createQueryBuilder('invoice');

    // Join các bảng liên quan để lấy tên hiển thị
    queryBuilder
      .leftJoin('invoice.season', 'season')
      .leftJoin('invoice.rice_crop', 'rice_crop')
      .leftJoin('invoice.customer', 'customer') // Thêm join customer
      .leftJoin('invoice.creator', 'creator')
      .addSelect(['season.id', 'season.name', 'season.code'])
      .addSelect(['rice_crop.id', 'rice_crop.field_name'])
      .addSelect(['customer.id', 'customer.name', 'customer.code', 'customer.phone']) // Select customer info
      .addSelect(['creator.id', 'creator.account']);

    // Thêm điều kiện mặc định
    queryBuilder.where('invoice.deleted_at IS NULL');

    // 1. Base Search & Pagination
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'invoice',
      ['code', 'customer.name', 'customer.phone', 'notes'] // Global search fields
    );

    // 2. Simple Filters (code, customer_id, season_id, payment_status...)
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'invoice',
      ['filters', 'nested_filters', 'operator'], // Ignore complex fields
      {
        customer_name: 'customer.name',
        customer_phone: 'customer.phone',
        season_name: 'season.name',
        rice_crop_name: 'rice_crop.field_name',
      }
    );

    // Thực hiện truy vấn
    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }


  /**
   * Sinh mã hóa đơn tự động dựa trên thời gian hiện tại
   * Định dạng: HD{YYYYMMDD}{HHMMSS}{RANDOM}
   * Ví dụ: HD20231127103045123
   */
  private generateInvoiceCode(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `HD${year}${month}${day}${hours}${minutes}${seconds}${random}`;
  }
}
