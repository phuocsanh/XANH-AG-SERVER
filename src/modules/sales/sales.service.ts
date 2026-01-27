import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, DataSource, QueryRunner } from 'typeorm';
import {
  SalesInvoice,
  SalesInvoiceStatus,
  SalesPaymentStatus,
} from '../../entities/sales-invoices.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { Product } from '../../entities/products.entity';
import { DeliveryLog } from '../../entities/delivery-log.entity';
import { DeliveryLogItem } from '../../entities/delivery-log-item.entity';
import { CreateSalesInvoiceDto } from './dto/create-sales-invoice.dto';
import { UpdateSalesInvoiceDto } from './dto/update-sales-invoice.dto';
import { SearchSalesDto } from './dto/search-sales.dto';
import { CreateDeliveryLogDto } from './dto/delivery-log.dto';
import { QueryHelper } from '../../common/helpers/query-helper';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { Payment } from '../../entities/payment.entity';
import { PaymentAllocation } from '../../entities/payment-allocation.entity';
import { DebtNoteService } from '../debt-note/debt-note.service';
import { DeliveryStatus } from './enums/delivery-status.enum';
import { DeliveryNotificationService } from './delivery-notification.service';
import { FarmServiceCostService } from '../farm-service-cost/farm-service-cost.service';
import { CodeGeneratorHelper } from '../../common/helpers/code-generator.helper';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryTransaction } from '../../entities/inventory-transactions.entity';

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
   * @param deliveryLogRepository - Repository để thao tác với entity DeliveryLog
   * @param deliveryLogItemRepository - Repository để thao tác với entity DeliveryLogItem
   * @param debtNoteService - Service xử lý công nợ
   * @param dataSource - DataSource để tạo raw query builder
   */
  constructor(
    @InjectRepository(SalesInvoice)
    private salesInvoiceRepository: Repository<SalesInvoice>,
    @InjectRepository(SalesInvoiceItem)
    private salesInvoiceItemRepository: Repository<SalesInvoiceItem>,
    @InjectRepository(DeliveryLog)
    private deliveryLogRepository: Repository<DeliveryLog>,
    @InjectRepository(DeliveryLogItem)
    private deliveryLogItemRepository: Repository<DeliveryLogItem>,
    private debtNoteService: DebtNoteService,
    private dataSource: DataSource,
    private deliveryNotificationService: DeliveryNotificationService,
    private farmServiceCostService: FarmServiceCostService,
    private inventoryService: InventoryService,
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
      // ✅ Tính toán số tiền còn nợ
      // Sử dụng giá trị partial_payment_amount từ form (người dùng nhập)
      const partialPayment = Number(createSalesInvoiceDto.partial_payment_amount || 0);
      const finalAmount = Number(createSalesInvoiceDto.final_amount);
      const remainingAmount = finalAmount - partialPayment;

      // Tự động sinh mã hóa đơn nếu không có
      const invoiceCode = createSalesInvoiceDto.invoice_code || CodeGeneratorHelper.generateUniqueCode('HD');

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
        payment_status: remainingAmount <= 0 ? SalesPaymentStatus.PAID : (partialPayment > 0 ? SalesPaymentStatus.PARTIAL : SalesPaymentStatus.PENDING),
        rice_crop_id: createSalesInvoiceDto.rice_crop_id,
        season_id: createSalesInvoiceDto.season_id,
        sale_date: createSalesInvoiceDto.sale_date ? new Date(createSalesInvoiceDto.sale_date) : new Date(),
      };
      
      const invoice = queryRunner.manager.create(SalesInvoice, invoiceData);
      const savedInvoice = await queryRunner.manager.save(invoice);
      
      this.logger.log(`Đã lưu hóa đơn với ID: ${savedInvoice.id}`);

      // Khai báo items ở ngoài để dùng cho delivery log
      let items: SalesInvoiceItem[] = [];

      // Tạo các item trong phiếu với tính toán totalPrice và lưu product_name snapshot
      if (createSalesInvoiceDto.items && Array.isArray(createSalesInvoiceDto.items) && createSalesInvoiceDto.items.length > 0) {
        items = await Promise.all(
          createSalesInvoiceDto.items.map(async (item) => {
          // Tính tổng giá tiền = (giá đơn vị * số lượng) - số tiền giảm giá
          const totalPrice =
            item.unit_price * item.quantity - (item.discount_amount || 0);

            // Lấy tên sản phẩm và đơn vị tính từ DB nếu không có trong DTO
            let productName = item.product_name;
            let unitName = item.unit_name;
            
            if (!productName || !unitName) {
              const product = await queryRunner.manager.findOne(Product, {
                where: { id: item.product_id },
                relations: ['unit'],
              });
              
              if (!productName) {
                productName = product?.trade_name || product?.name;
              }
              
              if (!unitName) {
                unitName = product?.unit?.name;
              }
            }

            return queryRunner.manager.create(SalesInvoiceItem, {
              ...item,
              invoice_id: savedInvoice.id,
              total_price: totalPrice,
              ...(productName && { product_name: productName }),
              ...(unitName && { unit_name: unitName }),
            });
          })
        );

        await queryRunner.manager.save(items);
        savedInvoice.items = items;

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

      // 🆕 Tạo phiếu giao hàng nếu có thông tin giao hàng
      if (createSalesInvoiceDto.delivery_log) {
        try {
          const createdLog = await this.createDeliveryLog(
            createSalesInvoiceDto.delivery_log,
            savedInvoice.id,
            items, // Truyền danh sách items đã lưu
            userId,
            queryRunner.manager,
          );
          
          if (createdLog) {
            savedInvoice.delivery_logs = [createdLog];
          }

          this.logger.log(`✅ Đã tạo phiếu giao hàng cho hóa đơn #${savedInvoice.id}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : '';
          this.logger.error(`❌ Lỗi khi tạo phiếu giao hàng: ${errorMessage}`, errorStack);
          // Throw error để rollback transaction
          throw new Error(`Không thể tạo phiếu giao hàng: ${errorMessage}`);
        }
      }

      // 🆕 Tự động tạo Chi phí Dịch vụ nếu có quà tặng
      if (createSalesInvoiceDto.gift_value && createSalesInvoiceDto.gift_value > 0) {
        try {
          await this.farmServiceCostService.createFromInvoiceGift(
            savedInvoice.id,
            savedInvoice.customer_id!,
            savedInvoice.season_id!,
            savedInvoice.rice_crop_id,
            createSalesInvoiceDto.gift_description || 'Quà tặng hóa đơn',
            createSalesInvoiceDto.gift_value,
            savedInvoice.created_at || new Date(),
          );

          this.logger.log(
            `✅ Đã tạo Chi phí dịch vụ cho quà tặng: ${createSalesInvoiceDto.gift_value.toLocaleString()} đ`,
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`❌ Lỗi khi tạo Chi phí dịch vụ cho quà tặng: ${errorMessage}`);
          // Không throw error để không làm gián đoạn transaction nếu quà tặng gặp lỗi nhẹ
        }
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Đã commit transaction cho hóa đơn ${savedInvoice.id}`);

      // 🆕 Trừ tồn kho nếu trạng thái là CONFIRMED hoặc PAID
      if (savedInvoice.status === SalesInvoiceStatus.CONFIRMED || savedInvoice.status === SalesInvoiceStatus.PAID) {
        await this.handleInventoryDeduction(savedInvoice.id, userId);
      }

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
       relations: ['items', 'items.product', 'season', 'rice_crop', 'customer'],
       order: { sale_date: 'DESC', created_at: 'DESC' }, // Ưu tiên ngày bán, sau đó đến ngày tạo
     });
   }

  /**
   * Lấy danh sách hóa đơn bán hàng theo trạng thái
   * @param status - Trạng thái cần lọc
   * @returns Danh sách hóa đơn bán hàng theo trạng thái
   */
   async findByStatus(status: SalesInvoiceStatus): Promise<SalesInvoice[]> {
     return this.salesInvoiceRepository.createQueryBuilder('invoice')
       .leftJoinAndSelect('invoice.items', 'items')
       .leftJoinAndSelect('items.product', 'product')
       .leftJoinAndSelect('invoice.season', 'season')
       .leftJoinAndSelect('invoice.rice_crop', 'rice_crop')
       .leftJoinAndSelect('invoice.customer', 'customer')
       .leftJoin('invoice.creator', 'creator')
       .addSelect(['creator.id', 'creator.account'])
       .where('invoice.status = :status', { status })
       .andWhere('invoice.deleted_at IS NULL')
       .orderBy('invoice.sale_date', 'DESC')
       .addOrderBy('invoice.created_at', 'DESC')
       .addOrderBy('items.id', 'ASC')
       .getMany();
   }

  /**
   * Lấy danh sách hóa đơn bán hàng đã xóa mềm
   * @returns Danh sách hóa đơn bán hàng đã xóa mềm
   */
   async findDeleted(): Promise<SalesInvoice[]> {
     return this.salesInvoiceRepository.createQueryBuilder('invoice')
       .withDeleted()
       .leftJoinAndSelect('invoice.items', 'items')
       .leftJoinAndSelect('items.product', 'product')
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
  async findOne(id: number, queryRunner?: QueryRunner): Promise<SalesInvoice | null> {
    // Lấy hóa đơn với các relations
    const qb = queryRunner 
      ? queryRunner.manager.createQueryBuilder(SalesInvoice, 'invoice')
      : this.salesInvoiceRepository.createQueryBuilder('invoice');

    const invoice = await qb
      .leftJoinAndSelect('invoice.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('invoice.customer', 'customer')
      .leftJoinAndSelect('invoice.season', 'season')
      .leftJoinAndSelect('invoice.rice_crop', 'rice_crop')
      .leftJoinAndSelect('invoice.delivery_logs', 'delivery_logs')
      .leftJoin('invoice.creator', 'creator')
      .addSelect(['creator.id', 'creator.account'])
      .where('invoice.id = :id', { id })
      .andWhere('invoice.deleted_at IS NULL')
      .addOrderBy('items.id', 'ASC')
      .getOne();

    if (!invoice) {
      return null;
    }

    // ✅ Tính số lượng đã trả cho mỗi item
    if (invoice.items && invoice.items.length > 0) {
      const manager = queryRunner ? queryRunner.manager : this.dataSource.manager;
      for (const item of invoice.items) {
        // Query tổng số lượng đã trả của sản phẩm này trong hóa đơn
        const returnedData = await manager
          .createQueryBuilder()
          .select('COALESCE(SUM(return_item.quantity), 0)', 'total_returned')
          .from('sales_return_items', 'return_item')
          .innerJoin('sales_returns', 'sales_return', 'sales_return.id = return_item.sales_return_id')
          .where('sales_return.invoice_id = :invoiceId', { invoiceId: id })
          .andWhere('sales_return.status = :status', { status: 'approved' })
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
      .addOrderBy('items.id', 'ASC')
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
          .andWhere('sales_return.status = :status', { status: 'approved' })
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
      order: { sale_date: 'DESC', created_at: 'DESC' },
      take: 5,
    });
    
    this.logger.log(`[findLatestByCustomer] Found ${allInvoices.length} invoices for customer_id ${customer_id}`);
    if (allInvoices.length > 0) {
      this.logger.log('[findLatestByCustomer] Sample invoice:', {
        id: allInvoices[0]?.id,
        code: allInvoices[0]?.code,
        customer_id: allInvoices[0]?.customer_id,
        customer_name: allInvoices[0]?.customer_name,
        date: allInvoices[0]?.sale_date || allInvoices[0]?.created_at,
      });
    }
    
    // Trả về hóa đơn gần nhất với đầy đủ relations
    const latestInvoice = await this.salesInvoiceRepository.findOne({
      where: { 
        customer_id, 
        deleted_at: IsNull() 
      },
      relations: ['items', 'customer', 'season'], // Bao gồm cả các item, thông tin khách hàng và mùa vụ
      order: { sale_date: 'DESC', created_at: 'DESC' }, // Ưu tiên ngày bán gần nhất
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
    userId?: number,
  ): Promise<SalesInvoice | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(SalesInvoice, id, updateSalesInvoiceDto);
      const updatedInvoice = await this.findOne(id, queryRunner);
      
      if (updatedInvoice && userId) {
        // 🆕 Nếu cập nhật trạng thái sang CONFIRMED hoặc PAID, thực hiện trừ kho
        if (updatedInvoice.status === SalesInvoiceStatus.CONFIRMED || updatedInvoice.status === SalesInvoiceStatus.PAID) {
          await this.handleInventoryDeduction(id, userId, queryRunner);
        }
        
        // 🆕 Nếu cập nhật trạng thái sang CANCELLED hoặc REFUNDED, thực hiện hoàn kho
        if (updatedInvoice.status === SalesInvoiceStatus.CANCELLED || updatedInvoice.status === SalesInvoiceStatus.REFUNDED) {
          await this.handleInventoryRestoration(id, userId, queryRunner);
        }
      }
      
      await queryRunner.commitTransaction();
      return updatedInvoice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      ErrorHandler.handleUpdateError(error, 'hóa đơn bán hàng');
      throw error;
    } finally {
      await queryRunner.release();
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
  async confirmInvoice(id: number, userId?: number): Promise<SalesInvoice | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const invoice = await queryRunner.manager.findOne(SalesInvoice, { where: { id } });
      if (!invoice) {
        await queryRunner.release();
        return null;
      }

      invoice.status = SalesInvoiceStatus.CONFIRMED;
      invoice.updated_at = new Date();
      const savedInvoice = await queryRunner.manager.save(invoice);

      if (userId) {
        await this.handleInventoryDeduction(savedInvoice.id, userId, queryRunner);
      }

      await queryRunner.commitTransaction();
      return savedInvoice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Lỗi khi xác nhận hóa đơn #${id}: ${(error as any).message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Đánh dấu hóa đơn bán hàng đã thanh toán
   * @param id - ID của hóa đơn bán hàng cần đánh dấu đã thanh toán
   * @returns Thông tin hóa đơn bán hàng đã thanh toán
   */
  async markAsPaid(id: number, userId?: number): Promise<SalesInvoice | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const invoice = await queryRunner.manager.findOne(SalesInvoice, { where: { id } });
      if (!invoice) {
        await queryRunner.release();
        return null;
      }

      invoice.status = SalesInvoiceStatus.PAID;
      invoice.payment_status = SalesPaymentStatus.PAID; // Đã thanh toán thì payment_status cũng phải là PAID
      invoice.updated_at = new Date();
      const savedInvoice = await queryRunner.manager.save(invoice);

      if (userId) {
        await this.handleInventoryDeduction(savedInvoice.id, userId, queryRunner);
      }

      await queryRunner.commitTransaction();
      return savedInvoice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Lỗi khi đánh dấu đã thanh toán hóa đơn #${id}: ${(error as any).message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Hủy hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần hủy
   * @returns Thông tin hóa đơn bán hàng đã hủy
   */
  async cancelInvoice(id: number, userId?: number): Promise<SalesInvoice | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const invoice = await queryRunner.manager.findOne(SalesInvoice, { where: { id } });
      if (!invoice) {
        await queryRunner.release();
        return null;
      }

      invoice.status = SalesInvoiceStatus.CANCELLED;
      invoice.payment_status = SalesPaymentStatus.CANCELLED; // Đồng bộ trạng thái thanh toán
      invoice.updated_at = new Date();
      const savedInvoice = await queryRunner.manager.save(invoice);

      if (userId) {
        await this.handleInventoryRestoration(savedInvoice.id, userId, queryRunner);
      }

      // 🆕 Trừ nợ trong công nợ (nếu có)
      if (savedInvoice.remaining_amount > 0 && savedInvoice.customer_id) {
        await this.debtNoteService.removeInvoiceFromDebtNote(
          savedInvoice.id,
          savedInvoice.remaining_amount,
          queryRunner.manager,
        );
      }

      await queryRunner.commitTransaction();
      return savedInvoice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Lỗi khi hủy hóa đơn #${id}: ${(error as any).message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Hoàn tiền hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần hoàn tiền
   * @returns Thông tin hóa đơn bán hàng đã hoàn tiền
   */
  async refundInvoice(id: number, userId?: number): Promise<SalesInvoice | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const invoice = await queryRunner.manager.findOne(SalesInvoice, { where: { id } });
      if (!invoice) {
        await queryRunner.release();
        return null;
      }

      invoice.status = SalesInvoiceStatus.REFUNDED;
      invoice.payment_status = SalesPaymentStatus.REFUNDED; // Đồng bộ trạng thái thanh toán
      invoice.updated_at = new Date();
      const savedInvoice = await queryRunner.manager.save(invoice);

      if (userId) {
        await this.handleInventoryRestoration(savedInvoice.id, userId, queryRunner);
      }

      // 🆕 Trừ nợ trong công nợ (nếu có)
      if (savedInvoice.remaining_amount > 0 && savedInvoice.customer_id) {
        await this.debtNoteService.removeInvoiceFromDebtNote(
          savedInvoice.id,
          savedInvoice.remaining_amount,
          queryRunner.manager,
        );
      }

      await queryRunner.commitTransaction();
      return savedInvoice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Lỗi khi hoàn tiền hóa đơn #${id}: ${(error as any).message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
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
    const invoice = await this.salesInvoiceRepository.findOne({ where: { id } });
    if (!invoice) return;

    // CHỈ cho phép xóa nếu là bản nháp (DRAFT)
    if (invoice.status !== SalesInvoiceStatus.DRAFT) {
      throw new BadRequestException(
        `Không thể xóa hóa đơn đã ${invoice.status === SalesInvoiceStatus.PAID ? 'thanh toán' : 'xác nhận'}. Hãy dùng chức năng Hủy hoặc Hoàn tiền để đảm bảo tồn kho và công nợ.`
      );
    }
    
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
    payment_status: SalesPaymentStatus,
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
    userId?: number,
  ): Promise<SalesInvoice | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const invoice = await queryRunner.manager.findOne(SalesInvoice, {
        where: { id },
        relations: ['customer', 'season'],
      });

      if (!invoice) {
        throw new Error('Hóa đơn không tồn tại');
      }

      // 1. Cập nhật số tiền trên hóa đơn
      const currentPartialPayment = parseFloat(invoice.partial_payment_amount?.toString() || '0');
      const finalAmount = parseFloat(invoice.final_amount?.toString() || '0');
      const newPartialPayment = currentPartialPayment + amount;
      const newRemainingAmount = finalAmount - newPartialPayment;

      if (newRemainingAmount <= 0) {
        invoice.status = SalesInvoiceStatus.PAID;
        invoice.payment_status = SalesPaymentStatus.PAID;
        invoice.partial_payment_amount = finalAmount;
        invoice.remaining_amount = 0;
      } else {
        invoice.partial_payment_amount = newPartialPayment;
        invoice.remaining_amount = newRemainingAmount;
        invoice.payment_status = SalesPaymentStatus.PARTIAL;
      }

      const savedInvoice = await queryRunner.manager.save(invoice);

      // 2. Tạo phiếu thu (Payment)
      if (invoice.customer_id) {
        const paymentCode = CodeGeneratorHelper.generateUniqueCode('PAY');
        const paymentData: any = {
          code: paymentCode,
          customer_id: invoice.customer_id,
          amount: amount,
          payment_date: new Date(),
          payment_method: invoice.payment_method || 'cash',
          notes: `Thanh toán cho hóa đơn #${invoice.code}`,
          created_by: userId,
        };
        const payment = queryRunner.manager.create(Payment, paymentData);
        const savedPayment = await queryRunner.manager.save(payment);

        // 3. Tạo phân bổ thanh toán (PaymentAllocation)
        const allocation = queryRunner.manager.create(PaymentAllocation, {
          payment_id: savedPayment.id,
          invoice_id: invoice.id,
          allocation_type: 'invoice',
          amount: amount,
        });
        await queryRunner.manager.save(allocation);

        // 4. Cập nhật phiếu công nợ (DebtNote) nếu có
        if (invoice.season_id) {
          const debtNote = await queryRunner.manager.findOne(DebtNote, {
            where: {
              customer_id: invoice.customer_id,
              season_id: invoice.season_id,
            },
          });

          if (debtNote) {
            const currentPaid = parseFloat(debtNote.paid_amount?.toString() || '0');
            const currentRemaining = parseFloat(debtNote.remaining_amount?.toString() || '0');
            
            debtNote.paid_amount = currentPaid + amount;
            debtNote.remaining_amount = currentRemaining - amount;

            if (debtNote.remaining_amount <= 0) {
              debtNote.status = DebtNoteStatus.PAID;
              debtNote.remaining_amount = 0;
            }

            await queryRunner.manager.save(debtNote);
            this.logger.log(`✅ Đã cập nhật phiếu nợ #${debtNote.code}: -${amount.toLocaleString()} đ`);

            // Liên kết phiếu thu với mã phiếu nợ
            savedPayment.debt_note_code = debtNote.code;
            await queryRunner.manager.save(savedPayment);
          }
        }
      }

      await queryRunner.commitTransaction();
      this.logger.log(`✅ Thanh toán thành công cho hóa đơn #${invoice.code}: ${amount.toLocaleString()} đ`);
      
      return savedInvoice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Lỗi khi thanh toán hóa đơn: ${(error as any).message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Lấy danh sách các item trong hóa đơn bán hàng
   * @param invoice_id - ID của hóa đơn bán hàng
   * @returns Danh sách các item trong hóa đơn bán hàng
   */
  async getInvoiceItems(invoice_id: number): Promise<SalesInvoiceItem[]> {
    return this.salesInvoiceItemRepository.find({
      where: { invoice_id },
      order: { id: 'ASC' },
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
      .leftJoinAndSelect('invoice.items', 'items') // Thêm join items
      .leftJoinAndSelect('items.product', 'product') // Thêm join product chi tiết
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

    // Mặc định sắp xếp theo sale_date giảm dần nếu không có sort tùy chỉnh
    if (!searchDto.sort && !searchDto.sort_by) {
      queryBuilder.orderBy('invoice.sale_date', 'DESC')
                  .addOrderBy('invoice.created_at', 'DESC');
    }

    // 2. Lọc theo ngày bán (Sale Date Range)
    if (searchDto.sale_date_start) {
      queryBuilder.andWhere('invoice.sale_date >= :saleStartDate', {
        saleStartDate: searchDto.sale_date_start,
      });
    }
    if (searchDto.sale_date_end) {
      queryBuilder.andWhere('invoice.sale_date <= :saleEndDate', {
        saleEndDate: searchDto.sale_date_end,
      });
    }

    // 2.1 Special handling for rice_crop_id (has_crop/no_crop/id)
    if (searchDto.rice_crop_id) {
       if (searchDto.rice_crop_id === 'has_crop' as any) {
         queryBuilder.andWhere('invoice.rice_crop_id IS NOT NULL');
         delete searchDto.rice_crop_id;
       } else if (searchDto.rice_crop_id === 'no_crop' as any) {
         queryBuilder.andWhere('invoice.rice_crop_id IS NULL');
         delete searchDto.rice_crop_id;
       }
    }

    // 3. Simple Filters (code, customer_id, season_id, payment_status...)
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'invoice',
      ['filters', 'nested_filters', 'operator', 'sale_date_start', 'sale_date_end', 'start_date', 'end_date'], // Ignore complex fields
      {
        customer_name: 'customer.name',
        customer_phone: 'customer.phone',
        season_name: 'season.name',
        rice_crop_name: 'rice_crop.field_name',
      }
    );

    // Sắp xếp items trong mỗi hóa đơn theo thứ tự insert
    queryBuilder.addOrderBy('items.id', 'ASC');

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

  /**
   * Tạo phiếu giao hàng cho hóa đơn
   * @param deliveryData - Dữ liệu phiếu giao hàng từ DTO
   * @param invoiceId - ID hóa đơn
   * @param savedItems - Danh sách items đã lưu trong hóa đơn
   * @param userId - ID người tạo
   * @param manager - Transaction manager
   */
  private async createDeliveryLog(
    deliveryData: any,
    invoiceId: number,
    savedItems: SalesInvoiceItem[],
    userId: number,
    manager: any,
  ): Promise<DeliveryLog> {
    try {
      // Tính tổng chi phí nếu không có
      const totalCost = deliveryData.total_cost || 
        (Number(deliveryData.fuel_cost || 0) + 
         Number(deliveryData.driver_cost || 0) + 
         Number(deliveryData.other_costs || 0));

      // Tạo delivery log
      const deliveryLog = manager.create(DeliveryLog, {
        invoice_id: invoiceId,
        delivery_date: deliveryData.delivery_date,
        delivery_start_time: deliveryData.delivery_start_time,
        distance_km: deliveryData.distance_km,
        fuel_cost: deliveryData.fuel_cost || 0,
        driver_cost: deliveryData.driver_cost || 0,
        other_costs: deliveryData.other_costs || 0,
        total_cost: totalCost,
        driver_name: deliveryData.driver_name,
        vehicle_plate: deliveryData.vehicle_plate,
        delivery_address: deliveryData.delivery_address,
        receiver_name: deliveryData.receiver_name, // Thêm tên người nhận
        receiver_phone: deliveryData.receiver_phone, // Thêm SĐT người nhận
        delivery_notes: deliveryData.delivery_notes, // Thêm ghi chú giao hàng
        status: deliveryData.status || DeliveryStatus.PENDING,
        notes: deliveryData.notes,
        created_by: userId,
      });

      const savedDeliveryLog = await manager.save(deliveryLog);
      this.logger.log(`✅ Đã tạo phiếu giao hàng #${savedDeliveryLog.id} cho hóa đơn #${invoiceId}`);

      // Tạo delivery log items nếu có danh sách sản phẩm cần giao
      if (deliveryData.items && Array.isArray(deliveryData.items) && deliveryData.items.length > 0) {
        const deliveryItems = await Promise.all(
          deliveryData.items.map(async (item: any) => {
            // Frontend gửi sales_invoice_item_id là INDEX (0, 1, 2...)
            // Cần map sang item thực tế trong savedItems
            const itemIndex = item.sales_invoice_item_id;
            const invoiceItem = savedItems[itemIndex];

            if (!invoiceItem) {
              this.logger.warn(`⚠️ Không tìm thấy item tại index ${itemIndex} trong hóa đơn`);
              return null;
            }

            // Lấy thông tin sản phẩm
            const product = await manager.findOne(Product, {
              where: { id: invoiceItem.product_id },
            });

            return manager.create(DeliveryLogItem, {
              delivery_log_id: savedDeliveryLog.id,
              sales_invoice_item_id: invoiceItem.id, // Dùng ID thực tế của item đã lưu
              product_id: invoiceItem.product_id,
              product_name: invoiceItem.product_name || product?.name || 'Unknown',
              quantity_delivered: item.quantity,
              unit: product?.unit,
              notes: item.notes,
            });
          })
        );

        // Lọc bỏ null và lưu
        const validItems = deliveryItems.filter((item) => item !== null);
        if (validItems.length > 0) {
          await manager.save(validItems);
          this.logger.log(`✅ Đã tạo ${validItems.length} sản phẩm trong phiếu giao hàng`);
        }
      }

      return savedDeliveryLog;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Lỗi khi tạo phiếu giao hàng: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Tạo phiếu giao hàng standalone (không kèm tạo hóa đơn)
   * @param createDeliveryLogDto - Dữ liệu tạo phiếu giao hàng
   * @param userId - ID người tạo
   * @returns Phiếu giao hàng đã tạo
   */
  async createStandaloneDeliveryLog(
    createDeliveryLogDto: CreateDeliveryLogDto,
    userId: number,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Tạo object delivery log
      const deliveryLogData: any = {
        delivery_date: createDeliveryLogDto.delivery_date,
        total_cost: createDeliveryLogDto.total_cost || 0,
        status: createDeliveryLogDto.status || DeliveryStatus.PENDING,
        created_by: userId,
        season_id: createDeliveryLogDto.season_id,
        // Bổ sung các trường chi phí
        distance_km: createDeliveryLogDto.distance_km,
        fuel_cost: createDeliveryLogDto.fuel_cost || 0,
        driver_cost: createDeliveryLogDto.driver_cost || 0,
        other_costs: createDeliveryLogDto.other_costs || 0,
      };

      // Thêm các fields optional
      if (createDeliveryLogDto.invoice_id) {
        deliveryLogData.invoice_id = createDeliveryLogDto.invoice_id;
      }
      if (createDeliveryLogDto.delivery_start_time) {
        deliveryLogData.delivery_start_time = createDeliveryLogDto.delivery_start_time;
      }
      if (createDeliveryLogDto.delivery_address) {
        deliveryLogData.delivery_address = createDeliveryLogDto.delivery_address;
      }
      if (createDeliveryLogDto.receiver_name) {
        deliveryLogData.receiver_name = createDeliveryLogDto.receiver_name;
      }
      if (createDeliveryLogDto.receiver_phone) {
        deliveryLogData.receiver_phone = createDeliveryLogDto.receiver_phone;
      }
      if (createDeliveryLogDto.delivery_notes) {
        deliveryLogData.delivery_notes = createDeliveryLogDto.delivery_notes;
      }
      if (createDeliveryLogDto.driver_name) {
        deliveryLogData.driver_name = createDeliveryLogDto.driver_name;
      }
      if (createDeliveryLogDto.vehicle_number) {
        deliveryLogData.vehicle_number = createDeliveryLogDto.vehicle_number;
        deliveryLogData.vehicle_plate = createDeliveryLogDto.vehicle_number; // Map cả hai để tương thích
      }

      const deliveryLog = this.deliveryLogRepository.create(deliveryLogData);
      const savedDeliveryLog: any = await queryRunner.manager.save(deliveryLog);

      // Đặt lịch thông báo cho phiếu giao hàng
      if (savedDeliveryLog.status === DeliveryStatus.PENDING) {
        this.deliveryNotificationService.scheduleNotification(savedDeliveryLog);
      }

      // Tạo delivery items nếu có
      if (createDeliveryLogDto.items && createDeliveryLogDto.items.length > 0) {
        const deliveryItems = await Promise.all(
          createDeliveryLogDto.items.map(async (item) => {
            const itemData: any = {
              delivery_log_id: savedDeliveryLog.id,
              quantity_delivered: item.quantity,
            };
            
            if (item.sales_invoice_item_id) {
              itemData.sales_invoice_item_id = item.sales_invoice_item_id;
            }
            if (item.product_id) {
              itemData.product_id = item.product_id;
              
              // Lấy tên sản phẩm nếu thiếu (để tránh lỗi NOT NULL)
              if (!item.product_name) {
                const product = await queryRunner.manager.findOne(Product, {
                  where: { id: item.product_id },
                });
                itemData.product_name = product?.trade_name || product?.name || 'Unknown';
              } else {
                itemData.product_name = item.product_name;
              }
            }
            if (item.unit) {
              itemData.unit = item.unit;
            }
            if (item.notes) {
              itemData.notes = item.notes;
            }
            
            return this.deliveryLogItemRepository.create(itemData);
          })
        );

        await queryRunner.manager.save(deliveryItems);
      }

      await queryRunner.commitTransaction();

      // Load lại với relations
      return this.deliveryLogRepository.findOne({
        where: { id: savedDeliveryLog.id },
        relations: ['invoice', 'items', 'items.product'],
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Lỗi khi tạo phiếu giao hàng standalone: ${errorMessage}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Lấy danh sách phiếu giao hàng với phân trang và filter
   */
  async findAllDeliveryLogs(params: {
    page: number;
    limit: number;
    invoiceId?: number;
    invoice_id?: number;
    status?: string;
  }) {
    const { page, limit, status } = params;
    const invoiceId = params.invoiceId || params.invoice_id;
    const skip = (page - 1) * limit;

    const queryBuilder = this.deliveryLogRepository
      .createQueryBuilder('delivery_log')
      .leftJoinAndSelect('delivery_log.invoice', 'invoice')
      .leftJoinAndSelect('invoice.customer', 'customer')
      .leftJoinAndSelect('delivery_log.season', 'season')
      .leftJoinAndSelect('delivery_log.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .orderBy('delivery_log.created_at', 'DESC');

    // Filter theo invoice
    if (invoiceId) {
      queryBuilder.andWhere('delivery_log.invoice_id = :invoiceId', { invoiceId });
    }

    // Filter theo status
    if (status) {
      queryBuilder.andWhere('delivery_log.status = :status', { status });
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Lấy chi tiết phiếu giao hàng theo ID
   */
  async findOneDeliveryLog(id: number) {
    const deliveryLog = await this.deliveryLogRepository.findOne({
      where: { id },
      relations: [
        'invoice',
        'invoice.customer',
        'season',
        'items',
        'items.product',
        'items.sales_invoice_item',
      ],
    });

    if (!deliveryLog) {
      throw new Error(`Không tìm thấy phiếu giao hàng với ID ${id}`);
    }

    return deliveryLog;
  }

  /**
   * Cập nhật phiếu giao hàng
   */
  async updateDeliveryLog(
    id: number,
    updateData: Partial<CreateDeliveryLogDto>,
  ) {
    const deliveryLog = await this.findOneDeliveryLog(id);

    // Cập nhật thông tin cơ bản
    Object.assign(deliveryLog, {
      delivery_date: updateData.delivery_date || deliveryLog.delivery_date,
      delivery_start_time: updateData.delivery_start_time || deliveryLog.delivery_start_time,
      delivery_address: updateData.delivery_address || deliveryLog.delivery_address,
      receiver_name: updateData.receiver_name || deliveryLog.receiver_name,
      receiver_phone: updateData.receiver_phone || deliveryLog.receiver_phone,
      delivery_notes: updateData.delivery_notes || deliveryLog.delivery_notes,
      driver_name: updateData.driver_name || deliveryLog.driver_name,
      vehicle_number: updateData.vehicle_number || deliveryLog.vehicle_number,
      vehicle_plate: updateData.vehicle_number || deliveryLog.vehicle_number || deliveryLog.vehicle_plate,
      total_cost: updateData.total_cost !== undefined ? updateData.total_cost : deliveryLog.total_cost,
      distance_km: updateData.distance_km !== undefined ? updateData.distance_km : deliveryLog.distance_km,
      fuel_cost: updateData.fuel_cost !== undefined ? updateData.fuel_cost : deliveryLog.fuel_cost,
      driver_cost: updateData.driver_cost !== undefined ? updateData.driver_cost : deliveryLog.driver_cost,
      other_costs: updateData.other_costs !== undefined ? updateData.other_costs : deliveryLog.other_costs,
      status: updateData.status || deliveryLog.status,
      season_id: updateData.season_id !== undefined ? updateData.season_id : deliveryLog.season_id,
    });

    await this.deliveryLogRepository.save(deliveryLog);

    // Cập nhật lịch thông báo
    await this.deliveryNotificationService.onDeliveryLogUpdated(deliveryLog);

    // Cập nhật items nếu có
    if (updateData.items) {
      // Xóa items cũ
      await this.deliveryLogItemRepository.delete({ delivery_log_id: id });

      // Tạo items mới
      const newItems = await Promise.all(
        updateData.items.map(async (item) => {
          const itemData: any = {
            delivery_log_id: id,
            quantity_delivered: item.quantity,
          };
          
          if (item.sales_invoice_item_id) {
            itemData.sales_invoice_item_id = item.sales_invoice_item_id;
          }
          if (item.product_id) {
            itemData.product_id = item.product_id;
            
            // Lấy tên sản phẩm nếu thiếu
            if (!item.product_name) {
              const product = await this.dataSource.manager.findOne(Product, {
                where: { id: item.product_id },
              });
              itemData.product_name = product?.trade_name || product?.name || 'Unknown';
            } else {
              itemData.product_name = item.product_name;
            }
          }
          if (item.unit) {
            itemData.unit = item.unit;
          }
          if (item.notes) {
            itemData.notes = item.notes;
          }
          
          return this.deliveryLogItemRepository.create(itemData);
        })
      );

      await this.deliveryLogItemRepository.save(newItems as any);
    }

    return this.findOneDeliveryLog(id);
  }

  /**
   * Xóa phiếu giao hàng
   */
  async removeDeliveryLog(id: number) {
    const deliveryLog = await this.findOneDeliveryLog(id);

    // Hủy lịch thông báo
    await this.deliveryNotificationService.onDeliveryLogDeleted(id);

    // Xóa items trước
    await this.deliveryLogItemRepository.delete({ delivery_log_id: id });

    // Xóa delivery log
    await this.deliveryLogRepository.remove(deliveryLog);

    return { message: 'Đã xóa phiếu giao hàng thành công' };
  }

  /**
   * Cập nhật trạng thái phiếu giao hàng
   */
  async updateDeliveryStatus(id: number, status: string) {
    const deliveryLog = await this.findOneDeliveryLog(id);
    deliveryLog.status = status as DeliveryStatus;
    await this.deliveryLogRepository.save(deliveryLog);
    
    // Cập nhật lịch thông báo
    await this.deliveryNotificationService.onDeliveryLogUpdated(deliveryLog);
    
    return deliveryLog;
  }

  /**
   * Lấy lịch sử mua hàng của một khách hàng theo mùa vụ (Tổng hợp tất cả items)
   */
  async getCustomerPurchaseHistory(customerId: number, seasonId?: number) {
    const queryBuilder = this.salesInvoiceItemRepository.createQueryBuilder('item')
      .innerJoinAndSelect('item.invoice', 'invoice')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('product.unit', 'unit')
      .where('invoice.customer_id = :customerId', { customerId })
      .andWhere('invoice.deleted_at IS NULL');

    if (seasonId) {
      queryBuilder.andWhere('invoice.season_id = :seasonId', { seasonId });
    }

    queryBuilder.orderBy('invoice.sale_date', 'ASC')
                .addOrderBy('invoice.created_at', 'ASC');

    const items = await queryBuilder.getMany();

    // Chuẩn hóa dữ liệu trả về giống mẫu Excel
    return items.map(item => ({
      date: item.invoice.sale_date || item.invoice.created_at,
      product_name: item.product_name || item.product?.trade_name || item.product?.name || 'Sản phẩm không tên',
      unit: item.product?.unit?.name || 'Cái', 
      quantity: Number(item.quantity || 0),
      unit_price: Number(item.unit_price || 0),
      total_price: Number(item.total_price || 0),
      invoice_code: item.invoice.code,
      invoice_id: item.invoice.id,
    }));
  }
  /**
   * Xử lý trừ tồn kho cho hóa đơn
   * @param invoiceId - ID hóa đơn
   * @param userId - ID người thực hiện
   * @param queryRunner - Đối tượng QueryRunner để xử lý transaction
   */
  async handleInventoryDeduction(invoiceId: number, userId: number, queryRunner?: QueryRunner): Promise<void> {
    try {
      const repo = queryRunner ? queryRunner.manager.getRepository(InventoryTransaction) : this.dataSource.getRepository(InventoryTransaction);
      
      // 1. Kiểm tra xem hóa đơn đã được trừ tồn kho chưa
      const existingTransaction = await repo.findOne({
        where: {
          reference_type: 'SALE',
          reference_id: invoiceId,
        },
      });

      if (existingTransaction) {
        this.logger.log(`ℹ️ Hóa đơn #${invoiceId} đã được trừ tồn kho trước đó, bỏ qua.`);
        return;
      }

      // 2. Lấy thông tin hóa đơn và các item
      const invoice = await this.findOne(invoiceId, queryRunner);
      if (!invoice || !invoice.items || invoice.items.length === 0) {
        this.logger.warn(`⚠️ Hóa đơn #${invoiceId} không tồn tại hoặc không có sản phẩm để trừ kho.`);
        return;
      }

      this.logger.log(`🚀 Bắt đầu trừ tồn kho cho hóa đơn #${invoice.code} (${invoiceId})`);

      // 3. Trừ tồn kho cho từng sản phẩm theo phương pháp FIFO
      for (const item of invoice.items) {
        try {
          // Lưu ý: userId có thể truyền từ JWT, nếu không có lấy người tạo hóa đơn
          const performerId = userId || invoice.created_by;
          
          await this.inventoryService.processStockOut(
            item.product_id,
            item.quantity,
            'SALE',
            performerId,
            invoice.id,
            `Bán hàng theo hóa đơn #${invoice.code}`,
            queryRunner
          );
          this.logger.log(`✅ Đã trừ kho sản phẩm ID ${item.product_id}, SL: ${item.quantity}`);
        } catch (error) {
          this.logger.error(`❌ Lỗi khi trừ kho sản phẩm ID ${item.product_id}: ${(error as any).message}`);
          // Vẫn tiếp tục với các sản phẩm khác
        }
      }

      this.logger.log(`✅ Hoàn tất trừ tồn kho cho hóa đơn #${invoice.code}`);
    } catch (error) {
      this.logger.error(`❌ Lỗi nghiêm trọng khi xử lý trừ tồn kho cho hóa đơn #${invoiceId}: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Đồng bộ tồn kho cho tất cả các hóa đơn đã xác nhận hoặc đã thanh toán
   * Dùng để sửa dữ liệu cũ
   */
  async syncAllInventory(userId: number): Promise<{ processed: number; success: number; skipped: number }> {
    const invoices = await this.salesInvoiceRepository.find({
      where: [
        { status: SalesInvoiceStatus.CONFIRMED, deleted_at: IsNull() },
        { status: SalesInvoiceStatus.PAID, deleted_at: IsNull() },
      ],
    });

    this.logger.log(`🔍 Tìm thấy ${invoices.length} hóa đơn cần kiểm tra đồng bộ tồn kho.`);

    let success = 0;
    let skipped = 0;

    for (const invoice of invoices) {
      // Kiểm tra xem đã có transaction chưa
      const existing = await this.dataSource.getRepository(InventoryTransaction).findOne({
        where: {
          reference_type: 'SALE',
          reference_id: invoice.id,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await this.handleInventoryDeduction(invoice.id, userId);
      success++;
    }

    return {
      processed: invoices.length,
      success,
      skipped,
    };
  }
  /**
   * Hoàn tồn kho cho hóa đơn bị hủy/hoàn tiền
   * @param invoiceId - ID hóa đơn
   * @param userId - ID người thực hiện
   * @param queryRunner - Đối tượng QueryRunner để xử lý transaction
   */
  async handleInventoryRestoration(invoiceId: number, userId: number, queryRunner?: QueryRunner): Promise<void> {
    try {
      const transRepo = queryRunner ? queryRunner.manager.getRepository(InventoryTransaction) : this.dataSource.getRepository(InventoryTransaction);
      
      // 1. Kiểm tra xem hóa đơn đã được trừ tồn kho chưa
      const outTransactions = await transRepo.find({
        where: {
          reference_type: 'SALE',
          reference_id: invoiceId,
          type: 'OUT'
        },
      });

      if (outTransactions.length === 0) {
        this.logger.log(`ℹ️ Hóa đơn #${invoiceId} chưa được trừ tồn kho, không cần hoàn lại.`);
        return;
      }

      // Kiểm tra xem đã hoàn kho chưa (có giao dịch IN tham chiếu đến hóa đơn này)
      const inTransaction = await transRepo.findOne({
        where: {
          reference_type: 'STOCK_IN_CANCEL',
          reference_id: invoiceId,
          type: 'IN'
        }
      });

      if (inTransaction) {
        this.logger.log(`ℹ️ Hóa đơn #${invoiceId} đã được hoàn tồn kho trước đó, bỏ qua.`);
        return;
      }

      const invoice = await this.findOne(invoiceId, queryRunner);
      if (!invoice || !invoice.items) return;

      this.logger.log(`🚀 Bắt đầu hoàn tồn kho cho hóa đơn #${invoice.code}`);

      for (const item of invoice.items) {
        // Lấy giá vốn từ giao dịch xuất kho tương ứng để hoàn lại đúng giá
        const outTrans = outTransactions.find(t => t.product_id === item.product_id);
        const unitCostPrice = outTrans ? parseFloat(outTrans.unit_cost_price) : 0;

        await this.inventoryService.processStockIn(
          item.product_id,
          item.quantity,
          unitCostPrice,
          userId || invoice.created_by,
          undefined,
          `CANCEL_${invoice.code}_${item.product_id}`,
          undefined,
          queryRunner
        );

        // Cập nhật reference cho giao dịch vừa tạo
        const latestTrans = await transRepo.findOne({
          where: { product_id: item.product_id },
          order: { created_at: 'DESC' }
        });

        if (latestTrans && latestTrans.reference_type === 'STOCK_IN') {
           latestTrans.reference_type = 'STOCK_IN_CANCEL';
           latestTrans.reference_id = invoiceId;
           latestTrans.notes = `Hoàn kho từ hóa đơn hủy #${invoice.code}`;
           await transRepo.save(latestTrans);
        }
      }

      this.logger.log(`✅ Hoàn tất hoàn tồn kho cho hóa đơn #${invoice.code}`);
    } catch (error) {
      this.logger.error(`❌ Lỗi khi hoàn tồn kho hóa đơn #${invoiceId}: ${(error as any).message}`);
      throw error;
    }
  }
}


