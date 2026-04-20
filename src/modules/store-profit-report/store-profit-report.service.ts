import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, IsNull, Raw } from 'typeorm';
import { SalesInvoice, SalesInvoiceStatus } from '../../entities/sales-invoices.entity';
import { Season } from '../../entities/season.entity';
import { OperatingCost } from '../../entities/operating-costs.entity';
import { DeliveryLog } from '../../entities/delivery-log.entity';
import { RiceCrop } from '../../entities/rice-crop.entity';
import { Customer } from '../../entities/customer.entity';
import { FarmServiceCost } from '../../entities/farm-service-cost.entity';
import { FarmGiftCost } from '../../entities/farm-gift-cost.entity';
import { QueryHelper } from '../../common/helpers/query-helper';

import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { 
  InvoiceProfitDto, 
  InvoiceItemProfitDto 
} from './dto/invoice-profit.dto';
import {
  SeasonStoreProfitDto,
  ProfitSummaryDto,
  // OperatingCostBreakdownDto,  // Không dùng nữa
  DeliveryStatsDto,
  TopCustomerProfitDto,
  TopProductProfitDto,
} from './dto/season-store-profit.dto';
import {
  CustomerProfitReportDto,
  CustomerInvoiceDto,
  CustomerSeasonSummaryDto,
} from './dto/customer-profit-report.dto';
import { PeriodReportDto, PeriodSummaryDto, PeriodInvoiceDto, PeriodInvoiceItemDto } from './dto/period-report.dto';

/**
 * Service xử lý logic tính lợi nhuận cho cửa hàng
 */
@Injectable()
export class StoreProfitReportService {
  private readonly logger = new Logger(StoreProfitReportService.name);

  constructor(
    @InjectRepository(SalesInvoice)
    private salesInvoiceRepository: Repository<SalesInvoice>,
    @InjectRepository(Season)
    private seasonRepository: Repository<Season>,
    @InjectRepository(OperatingCost)
    private operatingCostRepository: Repository<OperatingCost>,
    @InjectRepository(DeliveryLog)
    private deliveryLogRepository: Repository<DeliveryLog>,
    @InjectRepository(RiceCrop)
    private riceCropRepository: Repository<RiceCrop>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(FarmServiceCost)
    private farmServiceCostRepository: Repository<FarmServiceCost>,
    @InjectRepository(FarmGiftCost)
    private farmGiftCostRepository: Repository<FarmGiftCost>,

  ) {}

  /**
   * Tính lợi nhuận chi tiết cho 1 đơn hàng
   */
  async calculateInvoiceProfit(invoiceId: number): Promise<InvoiceProfitDto> {
    try {
      // Lấy hóa đơn với items và product info
      const invoice = await this.salesInvoiceRepository.findOne({
        where: { id: invoiceId },
        relations: ['items', 'items.product'],
      });

      if (!invoice) {
        throw new NotFoundException(`Không tìm thấy hóa đơn với ID: ${invoiceId}`);
      }

      // Tính giá vốn và lợi nhuận cho từng sản phẩm
      let totalCOGS = 0;
      const itemDetails: InvoiceItemProfitDto[] = [];

      for (const item of invoice.items || []) {
        const avgCost = Number(item.product?.average_cost_price || 0);
        const itemCOGS = Number(item.base_quantity || item.quantity) * avgCost;
        const itemProfit = item.total_price - itemCOGS;
        const itemMargin = item.total_price > 0 
          ? (itemProfit / item.total_price) * 100 
          : 0;

        totalCOGS += itemCOGS;

        // Dùng trade_name nếu có (đã chứa sẵn volume), fallback về name
        const productName = item.product?.trade_name || item.product?.name || 'Unknown';

        itemDetails.push({
          product_name: productName,
          quantity: item.quantity,
          unit_price: item.unit_price,
          avg_cost: avgCost,
          cogs: itemCOGS,
          profit: itemProfit,
          margin: Math.round(itemMargin * 100) / 100,
        });
      }

      const grossProfit = Number(invoice.final_amount) - totalCOGS;
      const margin = invoice.final_amount > 0
        ? (grossProfit / invoice.final_amount) * 100
        : 0;

      // Lấy giá trị quà tặng và mô tả
      const giftDescription = invoice.gift_description || undefined;
      const giftValue = Number(invoice.gift_value || 0);
      
      // Tính lợi nhuận ròng (sau khi trừ quà tặng)
      const netProfit = grossProfit - giftValue;

      // Lấy chi phí giao hàng từ delivery_logs
      const deliveryLog = await this.deliveryLogRepository.findOne({
        where: { invoice_id: invoiceId },
      });
      
      const deliveryCost = deliveryLog ? Number(deliveryLog.total_cost || 0) : 0;

      this.logger.log(`✅ Tính toán lợi nhuận đơn hàng #${invoiceId}: Gross ${grossProfit.toLocaleString()} đ, Gift ${giftValue.toLocaleString()} đ${giftDescription ? ` (${giftDescription})` : ''}, Delivery ${deliveryCost.toLocaleString()} đ, Net ${netProfit.toLocaleString()} đ`);

      return {
        invoice_id: invoice.id,
        invoice_code: invoice.code,
        customer_name: invoice.customer_name,
        created_at: invoice.sale_date || invoice.created_at,
        total_amount: invoice.final_amount,
        cost_of_goods_sold: totalCOGS,
        gross_profit: grossProfit,
        gross_margin: Math.round(margin * 100) / 100,
        gift_description: giftDescription,
        gift_value: giftValue,
        ...(deliveryCost > 0 && { delivery_cost: deliveryCost }),
        net_profit: netProfit,
        item_details: itemDetails,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi tính toán lợi nhuận đơn hàng: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Tính lợi nhuận chi tiết cho 1 đơn hàng theo mã (code)
   */
  async calculateInvoiceProfitByCode(code: string): Promise<InvoiceProfitDto> {
    const invoice = await this.salesInvoiceRepository.findOne({
      where: { code },
    });

    if (!invoice) {
        throw new NotFoundException(`Không tìm thấy hóa đơn với mã: ${code}`);
    }

    return this.calculateInvoiceProfit(invoice.id);
  }

  /**
   * Báo cáo lợi nhuận tổng hợp theo Season
   */
  async getSeasonStoreProfitReport(seasonId: number): Promise<SeasonStoreProfitDto> {
    try {
      // Lấy thông tin season
      const season = await this.seasonRepository.findOne({
        where: { id: seasonId },
      });

      if (!season) {
        throw new NotFoundException(`Không tìm thấy mùa vụ với ID: ${seasonId}`);
      }

      this.logger.log(`📊 [DEBUG_REPORT] getSeasonStoreProfitReport called with seasonId: ${seasonId} (type: ${typeof seasonId})`);
      
      // Lấy tất cả hóa đơn trong season (chỉ lấy confirmed và paid, bỏ draft/cancelled/refunded)
      const invoices = await this.salesInvoiceRepository.find({
        where: [
          { season_id: seasonId, status: SalesInvoiceStatus.CONFIRMED },
          { season_id: seasonId, status: SalesInvoiceStatus.PAID },
        ],
        relations: ['items', 'items.product', 'customer'],
      });

      this.logger.log(`📊 [DEBUG_REPORT] Found ${invoices.length} invoices for seasonId ${seasonId}`);
      
      // Log chi tiết từng hóa đơn
      invoices.forEach(inv => {
        this.logger.log(
          `  📄 ${inv.code}: final_amount=${inv.final_amount}, ` +
          `cost_of_goods_sold=${inv.cost_of_goods_sold}, status=${inv.status}`
        );
      });

      // Tính tổng doanh thu, giá vốn, lợi nhuận
      let totalRevenue = 0;
      let totalCOGS = 0;
      const customerProfitMap = new Map<number, {
        id: number;
        name: string;
        invoiceCount: number;
        revenue: number;
        profit: number;
      }>();
      const productProfitMap = new Map<number, {
        id: number;
        name: string;
        quantity: number;
        revenue: number;
        profit: number;
      }>();

      for (const invoice of invoices) {
        // Explicitly cast to number to handle TypeORM decimal strings
        let finalAmount = Number(invoice.final_amount);
        totalRevenue += finalAmount;

        // Ưu tiên dùng cost_of_goods_sold đã lưu (chính xác tại thời điểm bán)
        let invoiceCOGS = 0;
        
        // Check for non-null/undefined. Note: cost_of_goods_sold can be "0.00" (string) or 0 (number) or null
        if (invoice.cost_of_goods_sold !== null && invoice.cost_of_goods_sold !== undefined) {
          // Dùng cost_of_goods_sold đã lưu (chắc chắn dùng cái này nếu có)
          invoiceCOGS = Number(invoice.cost_of_goods_sold);
          
          // Double check logic: if we just used the saved value, we DO NOT calculate from items
        } else if (invoice.items && invoice.items.length > 0) {
          // Fallback: Tính từ average_cost_price CHỈ KHI cost_of_goods_sold = null
          this.logger.warn(`⚠️ Invoice ${invoice.code} has no cost_of_goods_sold. Calculating from items.`);
          for (const item of invoice.items) {
            const avgCost = Number(item.product?.average_cost_price || 0);
            invoiceCOGS += Number(item.base_quantity || item.quantity) * avgCost;
          }
        }
        
        // Tính tổng giá vốn tạm tính (theo số lượng ban đầu) để làm trọng số phân bổ
        const invoiceOriginalCOGSTotal = (invoice.items || []).reduce((sum, item) => {
          const avgCost = Number(item.product?.average_cost_price || 0);
          return sum + (Number(item.base_quantity || item.quantity) * avgCost);
        }, 0);

        const invoiceItemsGross = (invoice.items || []).reduce((sum, item) => sum + Number(item.total_price), 0);

        // Track product profit (chỉ khi hóa đơn còn giá trị sau khi trừ trả hàng)
        if (finalAmount > 0 && invoice.items && invoice.items.length > 0) {
          for (const item of invoice.items) {
            const itemGrossPrice = Number(item.total_price);
            const avgCost = Number(item.product?.average_cost_price || 0);
            const itemOriginalCOGS = Number(item.base_quantity || item.quantity) * avgCost;

            // Phân bổ doanh thu/giá vốn thực tế (đã trừ trả hàng) cho item này
            const itemNetRevenue = invoiceItemsGross > 0 ? (itemGrossPrice / invoiceItemsGross) * finalAmount : 0;
            const itemActualCOGS = invoiceOriginalCOGSTotal > 0 ? (itemOriginalCOGS / invoiceOriginalCOGSTotal) * invoiceCOGS : 0;
            const itemProfit = itemNetRevenue - itemActualCOGS;

            // Tính số lượng thực bán (đã trừ trả hàng)
            const originalQty = Number(item.quantity) || 1;
            const currentQtySold = itemGrossPrice > 0 ? (itemNetRevenue / itemGrossPrice) * originalQty : 0;

            // Track product profit
            const productId = item.product_id;
            if (!productProfitMap.has(productId)) {
              const productName = item.product?.trade_name || item.product?.name || 'Unknown';
              productProfitMap.set(productId, {
                id: productId,
                name: productName,
                quantity: 0,
                revenue: 0,
                profit: 0,
              });
            }
            const productData = productProfitMap.get(productId)!;
            productData.quantity += currentQtySold; // Use currentQtySold for accurate quantity
            productData.revenue += itemNetRevenue; // Use itemNetRevenue for accurate revenue
            productData.profit += itemProfit; // Use itemProfit for accurate profit
          }
        }

        totalCOGS += invoiceCOGS;
        const invoiceProfit = finalAmount - invoiceCOGS;

        // Track customer profit (bao gồm cả khách vãng lai)
        const customerKey = invoice.customer_id || `guest_${invoice.customer_name}`;
        if (!customerProfitMap.has(customerKey as any)) {
          customerProfitMap.set(customerKey as any, {
            id: invoice.customer_id || 0,
            name: invoice.customer_name,
            invoiceCount: 0,
            revenue: 0,
            profit: 0,
          });
        }
        const customerData = customerProfitMap.get(customerKey as any)!;
        customerData.invoiceCount++;
        customerData.revenue += Number(invoice.final_amount);
        customerData.profit += invoiceProfit;
      }

      const grossProfit = totalRevenue - totalCOGS;
      const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

      // Lấy chi phí dịch vụ
      const serviceCostsResult = await this.farmServiceCostRepository.find({
        where: { season_id: seasonId },
      });
      
      // Lấy chi phí quà tặng
      const giftCostsResult = await this.farmGiftCostRepository.find({
        where: { season_id: seasonId },
      });

      const serviceBreakdown = serviceCostsResult.map(item => ({
        type: 'service',
        name: item.name,
        amount: Number(item.amount),
        date: item.expense_date,
        notes: item.notes,
      }));

      const giftBreakdown = giftCostsResult.map(item => ({
        type: item.source || 'gift',
        name: item.name,
        amount: Number(item.amount),
        date: item.gift_date,
        notes: item.notes,
      }));

      const farmServiceCostsBreakdown = [...serviceBreakdown, ...giftBreakdown];

      // Lấy chi phí vận hành cửa hàng (điện, nước, mặt bằng...)
      const operatingCostsResult = await this.operatingCostRepository
        .createQueryBuilder('oc')
        .leftJoinAndSelect('oc.category', 'category')
        .where('oc.season_id = :seasonId', { seasonId })
        .getMany();

      const operatingCostsBreakdown = operatingCostsResult.map(item => ({
        type: item.category?.code || 'other',
        name: item.name,
        amount: Number(item.value),
        date: item.expense_date,
        notes: item.description,
      }));

      // Lấy thống kê giao hàng
      const deliveryStats = await this.getSeasonDeliveryStats(
        season.start_date,
        season.end_date,
        seasonId,
      );

      const totalServiceCosts = serviceBreakdown.reduce((sum, c) => sum + c.amount, 0);
      const totalGiftCosts = giftBreakdown.reduce((sum, c) => sum + c.amount, 0);
      const totalFarmServiceCosts = totalServiceCosts + totalGiftCosts;
        
      const totalDeliveryCosts = deliveryStats?.total_delivery_cost || 0;
      const totalOperatingCosts = operatingCostsBreakdown.reduce((sum, c) => sum + Number(c.amount), 0);
      
      // Lợi nhuận ròng = Lợi nhuận gộp - Chi phí dịch vụ - Chi phí giao hàng - Chi phí vận hành
      const netProfit = grossProfit - totalFarmServiceCosts - totalDeliveryCosts - totalOperatingCosts;
      const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      // Top customers
      const topCustomers: TopCustomerProfitDto[] = Array.from(customerProfitMap.values())
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 10)
        .map(c => ({
          customer_id: c.id,
          customer_name: c.name,
          total_invoices: c.invoiceCount,
          total_revenue: c.revenue,
          total_profit: c.profit,
          avg_margin: c.revenue > 0 ? Math.round((c.profit / c.revenue) * 10000) / 100 : 0,
        }));

      // Top products
      const topProducts: TopProductProfitDto[] = Array.from(productProfitMap.values())
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 10)
        .map(p => ({
          product_id: p.id,
          product_name: p.name,
          quantity_sold: p.quantity,
          total_revenue: p.revenue,
          total_profit: p.profit,
          margin: p.revenue > 0 ? Math.round((p.profit / p.revenue) * 10000) / 100 : 0,
        }));

      const summary: ProfitSummaryDto = {
        total_invoices: invoices.length,
        total_customers: customerProfitMap.size,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        cost_of_goods_sold: Math.round(totalCOGS * 100) / 100,
        gross_profit: Math.round(grossProfit * 100) / 100,
        gross_margin: Math.round(grossMargin * 100) / 100,
        delivery_costs: Math.round(totalDeliveryCosts * 100) / 100,
        farm_service_costs: Math.round(totalFarmServiceCosts * 100) / 100,
        service_costs: Math.round(totalServiceCosts * 100) / 100,
        gift_costs: Math.round(totalGiftCosts * 100) / 100,
        operating_costs: Math.round(totalOperatingCosts * 100) / 100,
        net_profit: Math.round(netProfit * 100) / 100,
        net_margin: Math.round(netMargin * 100) / 100,
      };

      this.logger.log(`✅ Báo cáo mùa ${season.name}: Lợi nhuận ròng ${netProfit.toLocaleString()} đ`);

      return {
        season_id: season.id,
        season_name: season.name,
        period: {
          start_date: season.start_date,
          end_date: season.end_date,
        },
        summary,
        farm_service_costs_breakdown: farmServiceCostsBreakdown,
        operating_costs_breakdown: operatingCostsBreakdown,
        delivery_stats: deliveryStats,
        top_customers: topCustomers,

        top_products: topProducts,
        debug_version: 'v5_farm_service_costs',
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi báo cáo mùa vụ: ${err.message}`, err.stack);
      throw error;
    }
  }


  /**
   * Lấy chi phí vận hành trong khoảng thời gian hoặc theo seasonId
   * @deprecated Không dùng nữa, đã chuyển sang farm_service_costs
   */
  // private async getSeasonOperatingCosts(
  //   startDate?: Date,
  //   endDate?: Date,
  //   seasonId?: number,
  // ): Promise<OperatingCostBreakdownDto[]> {
  //   try {
  //     // Ưu tiên lấy theo season_id nếu có
  //     let where: any = [];
  //     
  //     if (seasonId) {
  //       where.push({ season_id: seasonId });
  //     }

  //     // Fallback: Lấy theo ngày tháng nếu chưa gán season_id (cho dữ liệu cũ)
  //     // VÀ phải chưa được gán cho season nào khác (season_id IS NULL) để tránh duplicate
  //     if (startDate && endDate) {
  //        where.push({ 
  //          created_at: Between(startDate, endDate),
  //          season_id: null // Chỉ lấy những cái chưa gán season cụ thể
  //        });
  //     }

  //     // Nếu không có điều kiện nào thì trả về rỗng
  //     if (where.length === 0) return [];

  //     const costs = await this.operatingCostRepository.find({ where });

  //     return costs.map(cost => ({
  //       type: cost.type || 'other', // Fallback nếu type không có (dữ liệu cũ)
  //       name: cost.name,
  //       amount: Number(cost.value),
  //     }));
  //   } catch (error) {
  //     this.logger.warn('Không thể lấy chi phí vận hành, trả về mảng rỗng');
  //     return [];
  //   }
  // }


  /**
   * Lấy thống kê giao hàng trong season
   */
  private async getSeasonDeliveryStats(
    startDate?: Date,
    endDate?: Date,
    seasonId?: number,
  ): Promise<DeliveryStatsDto | undefined> {
    try {
      // Lấy tất cả delivery logs trong khoảng thời gian
      let where: any = {};
      
      if (startDate && endDate) {
        where.delivery_date = Between(startDate, endDate);
      }

      // Nếu có seasonId, lấy logs từ hóa đơn trong season HOẶC logs gán trực tiếp cho season
      if (seasonId) {
        const invoices = await this.salesInvoiceRepository.find({
          where: { season_id: seasonId },
          select: ['id'],
        });
        const invoiceIds = invoices.map(inv => inv.id);
        
        const orConditions: any[] = [{ season_id: seasonId }];
        if (invoiceIds.length > 0) {
          orConditions.push({ invoice_id: In(invoiceIds) });
        }

        // Áp dụng bộ lọc cho từng nhánh OR
        const conditions = orConditions.map(cond => {
          const combined = { ...cond };
          if (startDate && endDate) {
            combined.delivery_date = Between(startDate, endDate);
          }
          return combined;
        });
        
        where = conditions;
      }

      const deliveries = await this.deliveryLogRepository.find({ where });

      if (deliveries.length === 0) {
        return undefined;
      }

      const totalCost = deliveries.reduce((sum, d) => sum + Number(d.total_cost), 0);
      const totalDistance = deliveries.reduce((sum, d) => sum + (Number(d.distance_km) || 0), 0);
      const avgCost = totalCost / deliveries.length;
      const costPerKm = totalDistance > 0 ? totalCost / totalDistance : 0;

      return {
        total_deliveries: deliveries.length,
        total_delivery_cost: Math.round(totalCost * 100) / 100,
        avg_cost_per_delivery: Math.round(avgCost * 100) / 100,
        total_distance: totalDistance > 0 ? Math.round(totalDistance * 100) / 100 : undefined,
        cost_per_km: costPerKm > 0 ? Math.round(costPerKm * 100) / 100 : undefined,
      };
    } catch (error) {
      this.logger.warn('Không thể lấy thống kê giao hàng');
      return undefined;
    }
  }

  /**
   * Báo cáo lợi nhuận cho 1 khách hàng cụ thể
   */
  async getCustomerProfitReport(
    customerId: number,
    customerNameParam?: string,
    seasonId?: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<CustomerProfitReportDto> {
    try {
      // 1. Lấy TOÀN BỘ hóa đơn của khách hàng (lifetime) - chỉ lấy confirmed và paid
      let customerWhere: any[] = [
        { status: SalesInvoiceStatus.CONFIRMED },
        { status: SalesInvoiceStatus.PAID },
      ];
      
      if (customerId && customerId > 0) {
        customerWhere = customerWhere.map((w: any) => ({ ...w, customer_id: customerId }));
      } else if (customerNameParam) {
        const sanitized = QueryHelper.sanitizeKeyword(customerNameParam);
        customerWhere = customerWhere.map((w: any) => ({
          ...w,
          customer_name: Raw(alias => `regexp_replace(unaccent(${alias}), '[^a-zA-Z0-9\\s]', '', 'g') ILIKE unaccent('%${sanitized}%')`)
        }));
      } else {
        throw new Error('Vui lòng cung cấp ID khách hàng hoặc Tên khách hàng');
      }

      const allInvoices = await this.salesInvoiceRepository.find({
        where: customerWhere,
        relations: ['items', 'items.product', 'season'],
        order: { sale_date: 'DESC', created_at: 'DESC' },
      });

      if (allInvoices.length === 0) {
        // Nếu không có hóa đơn, vẫn trả về thông tin khách hàng với các số liệu bằng 0
        const customer = await this.customerRepository.findOne({ where: { id: customerId } });
        if (!customer) {
          throw new NotFoundException(`Không tìm thấy khách hàng ID: ${customerId}`);
        }

        return {
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone,
          customer_email: customer.email,
          lifetime_summary: {
            total_invoices: 0,
            total_revenue: 0,
            total_cost: 0,
            total_profit: 0,
            avg_margin: 0,
            delivery_costs: 0,
            farm_service_costs: 0,
            service_costs: 0,
            gift_costs: 0,
            operating_costs: 0,
            net_profit: 0,
          },
          summary: {
            total_invoices: 0,
            total_revenue: 0,
            total_cost: 0,
            total_profit: 0,
            avg_margin: 0,
            delivery_costs: 0,
            farm_service_costs: 0,
            service_costs: 0,
            gift_costs: 0,
            operating_costs: 0,
            net_profit: 0,
          },
          invoices: [],
          by_season: [],
          farm_service_costs_breakdown: [],
          debug_version: 'v5_no_invoices',
        };
      }

      const firstInvoice = allInvoices[0]!;
      const customerName = firstInvoice.customer_name;
      const customerPhone = firstInvoice.customer_phone || undefined;
      const customerEmail = firstInvoice.customer_email || undefined;

      // 2. Tính toán LIFETIME summary
      let lifetimeRevenue = 0;
      let lifetimeCost = 0;
      let lifetimeProfit = 0;

      for (const invoice of allInvoices) {
        // Explicitly cast to number to handle TypeORM decimal strings
        let finalAmount = Number(invoice.final_amount);
        let invoiceCOGS = 0;
        
        // Check for non-null/undefined. Note: cost_of_goods_sold can be "0.00" (string) or 0 (number) or null
        if (invoice.cost_of_goods_sold !== null && invoice.cost_of_goods_sold !== undefined) {
          // Dùng cost_of_goods_sold đã lưu (chắc chắn dùng cái này nếu có)
          invoiceCOGS = Number(invoice.cost_of_goods_sold);
        } else if (invoice.items && invoice.items.length > 0) {
          // Fallback only if null/undefined
          for (const item of invoice.items) {
            const avgCost = Number(item.product?.average_cost_price || 0);
            invoiceCOGS += Number(item.base_quantity || item.quantity) * avgCost;
          }
        }
        
        lifetimeRevenue += finalAmount;
        lifetimeCost += invoiceCOGS;
        lifetimeProfit += (finalAmount - invoiceCOGS);
      }

      const lifetimeMargin = lifetimeRevenue > 0 
        ? (lifetimeProfit / lifetimeRevenue) * 100 
        : 0;

      // 3. Build where conditions cho filtered invoices (chỉ lấy confirmed và paid)
      let where: any[] = [
        { customer_id: customerId, status: SalesInvoiceStatus.CONFIRMED },
        { customer_id: customerId, status: SalesInvoiceStatus.PAID },
      ];

      if (seasonId) {
        where = where.map((w: any) => ({ ...w, season_id: seasonId }));
      }

      if (startDate && endDate) {
        where = [
          ...where.map((w: any) => ({ ...w, sale_date: Between(startDate, endDate) })),
          ...where.map((w: any) => ({ ...w, sale_date: IsNull(), created_at: Between(startDate, endDate) })),
        ];
      }

      // 4. Lấy hóa đơn theo filter (để hiển thị chi tiết)
      const invoices = await this.salesInvoiceRepository.find({
        where,
        relations: ['items', 'items.product', 'season'],
        order: { sale_date: 'DESC', created_at: 'DESC' },
      });

      // 5. Tính toán cho từng đơn hàng (filtered)
      let totalRevenue = 0;
      let totalCost = 0;
      let totalProfit = 0;
      const invoiceDetails: CustomerInvoiceDto[] = [];
      const seasonMap = new Map<number, {
        id: number;
        name: string;
        invoices: number;
        revenue: number;
        cost: number;
        profit: number;
      }>();

      for (const invoice of invoices) {
        // Explicitly cast to number to handle TypeORM decimal strings
        let finalAmount = Number(invoice.final_amount);
        let invoiceCOGS = 0;

        // Check for non-null/undefined. Note: cost_of_goods_sold can be "0.00" (string) or 0 (number) or null
        if (invoice.cost_of_goods_sold !== null && invoice.cost_of_goods_sold !== undefined) {
          // Dùng cost_of_goods_sold đã lưu (chắc chắn dùng cái này nếu có)
          invoiceCOGS = Number(invoice.cost_of_goods_sold);
        } else if (invoice.items && invoice.items.length > 0) {
          // Fallback only if null/undefined
          for (const item of invoice.items) {
            const avgCost = Number(item.product?.average_cost_price || 0);
            invoiceCOGS += Number(item.base_quantity || item.quantity) * avgCost;
          }
        }

        const invoiceProfit = Number(invoice.final_amount) - invoiceCOGS;
        const invoiceMargin = invoice.final_amount > 0 
          ? (invoiceProfit / invoice.final_amount) * 100 
          : 0;

        // Lấy chi phí giao hàng cho hóa đơn này
        const deliveryLog = await this.deliveryLogRepository.findOne({
          where: { invoice_id: invoice.id },
        });
        const deliveryCost = deliveryLog ? Number(deliveryLog.total_cost || 0) : 0;

        totalRevenue += Number(invoice.final_amount);
        totalCost += invoiceCOGS;
        totalProfit += invoiceProfit;

        invoiceDetails.push({
          invoice_id: invoice.id,
          invoice_code: invoice.code,
          date: invoice.sale_date || invoice.created_at,

          revenue: finalAmount,
          cost: invoiceCOGS,
          profit: invoiceProfit,
          margin: Math.round(invoiceMargin * 100) / 100,
          ...(deliveryCost > 0 && { delivery_cost: deliveryCost }),
          season_id: invoice.season_id,
          season_name: invoice.season?.name,
        });

        // Track by season
        if (invoice.season_id) {
          if (!seasonMap.has(invoice.season_id)) {
            seasonMap.set(invoice.season_id, {
              id: invoice.season_id,
              name: invoice.season?.name || 'Unknown',
              invoices: 0,
              revenue: 0,
              cost: 0,
              profit: 0,
            });
          }
          const seasonData = seasonMap.get(invoice.season_id)!;
          seasonData.invoices++;
          seasonData.revenue += Number(invoice.final_amount);
          seasonData.cost += Number(invoiceCOGS);
          seasonData.profit += invoiceProfit;
        }
      }

      const avgMargin = totalRevenue > 0 
        ? (totalProfit / totalRevenue) * 100 
        : 0;

      // 6. Season summary
      const seasonSummary: CustomerSeasonSummaryDto[] = Array.from(seasonMap.values())
        .sort((a, b) => b.profit - a.profit)
        .map(s => ({
          season_id: s.id,
          season_name: s.name,
          total_invoices: s.invoices,
          total_revenue: Math.round(s.revenue * 100) / 100,
          total_cost: Math.round(s.cost * 100) / 100,
          total_profit: Math.round(s.profit * 100) / 100,
          avg_margin: s.revenue > 0 
            ? Math.round((s.profit / s.revenue) * 10000) / 100 
            : 0,
        }));


      this.logger.log(`✅ Báo cáo khách hàng #${customerId}: Lifetime ${allInvoices.length} đơn, Filtered ${invoices.length} đơn`);

      // 7. Tính chi phí giao hàng, dịch vụ & vận hành cho khách hàng
      const farmServiceCosts = await this.farmServiceCostRepository.find({
        where: { customer_id: customerId }
      });
      const farmGiftCosts = await this.farmGiftCostRepository.find({
        where: { customer_id: customerId }
      });
      
      const lifetimeServiceCost = farmServiceCosts.reduce((sum, c) => sum + Number(c.amount), 0);
      const lifetimeGiftCost = farmGiftCosts.reduce((sum, c) => sum + Number(c.amount), 0);
      const lifetimeFarmServiceCost = lifetimeServiceCost + lifetimeGiftCost;

      const operatingCostsResult = await this.operatingCostRepository.find({
        where: { customer_id: customerId }
      });
      const lifetimeOperatingCost = operatingCostsResult.reduce((sum, c) => sum + Number(c.value), 0);

      const allInvoiceIds = allInvoices.map(inv => inv.id);
      const allDeliveryLogs = allInvoiceIds.length > 0 ? await this.deliveryLogRepository.find({
        where: { invoice_id: In(allInvoiceIds) },
      }) : [];
      const lifetimeDeliveryCost = allDeliveryLogs.reduce((sum, log) => sum + Number(log.total_cost || 0), 0);

      // Tính cho filtered invoices
      const filteredInvoiceIds = invoices.map(inv => inv.id);
      const filteredDeliveryLogs = allDeliveryLogs.filter(log => log.invoice_id && filteredInvoiceIds.includes(log.invoice_id));
      const filteredDeliveryCost = filteredDeliveryLogs.reduce((sum, log) => sum + Number(log.total_cost || 0), 0);

      // Tính cho filtered generic costs
      let filteredFarmServiceCost = 0;
      let filteredServiceCost = 0;
      let filteredGiftCost = 0;
      let filteredOperatingCost = 0;

      if (seasonId) {
        filteredServiceCost = farmServiceCosts
          .filter(c => c.season_id === seasonId)
          .reduce((sum, c) => sum + Number(c.amount), 0);
        filteredGiftCost = farmGiftCosts
          .filter(c => c.season_id === seasonId)
          .reduce((sum, c) => sum + Number(c.amount), 0);
        
        filteredFarmServiceCost = filteredServiceCost + filteredGiftCost;
        
        filteredOperatingCost = operatingCostsResult
          .filter(c => c.season_id === seasonId)
          .reduce((sum, c) => sum + Number(c.value), 0);
      } else if (startDate && endDate) {
        filteredServiceCost = farmServiceCosts
          .filter(c => c.expense_date >= startDate && c.expense_date <= endDate)
          .reduce((sum, c) => sum + Number(c.amount), 0);
        filteredGiftCost = farmGiftCosts
          .filter(c => c.gift_date >= startDate && c.gift_date <= endDate)
          .reduce((sum, c) => sum + Number(c.amount), 0);
        
        filteredFarmServiceCost = filteredServiceCost + filteredGiftCost;
        
        filteredOperatingCost = operatingCostsResult
          .filter(c => c.expense_date >= startDate && c.expense_date <= endDate)
          .reduce((sum, c) => sum + Number(c.value), 0);
      } else {
        filteredFarmServiceCost = lifetimeFarmServiceCost;
        filteredServiceCost = lifetimeServiceCost;
        filteredGiftCost = lifetimeGiftCost;
        filteredOperatingCost = lifetimeOperatingCost;
      }

      // Current season summary
      let currentSeasonSummary: any = undefined;
      if (seasonId && seasonMap.has(seasonId)) {
        const s = seasonMap.get(seasonId)!;
        currentSeasonSummary = {
          season_id: s.id,
          season_name: s.name,
          total_invoices: s.invoices,
          total_revenue: Math.round(s.revenue * 100) / 100,
          total_cost: Math.round(s.cost * 100) / 100,
          total_profit: Math.round(s.profit * 100) / 100,
          avg_margin: s.revenue > 0 ? Math.round((s.profit / s.revenue) * 10000) / 100 : 0,
          delivery_costs: Math.round(filteredDeliveryCost * 100) / 100,
          farm_service_costs: Math.round(filteredFarmServiceCost * 100) / 100,
          service_costs: Math.round(filteredServiceCost * 100) / 100,
          gift_costs: Math.round(filteredGiftCost * 100) / 100,
          operating_costs: Math.round(filteredOperatingCost * 100) / 100,
          net_profit: Math.round((s.profit - filteredDeliveryCost - filteredFarmServiceCost - filteredOperatingCost) * 100) / 100,
        };
      }

      const serviceBreakdown = (seasonId ? farmServiceCosts.filter(c => c.season_id === seasonId) : 
        (startDate && endDate ? farmServiceCosts.filter(c => c.expense_date >= startDate && c.expense_date <= endDate) : farmServiceCosts))
        .map(item => ({
          type: 'service',
          name: item.name,
          amount: Number(item.amount),
          date: item.expense_date,
          notes: item.notes,
        }));

      const giftBreakdown = (seasonId ? farmGiftCosts.filter(c => c.season_id === seasonId) : 
        (startDate && endDate ? farmGiftCosts.filter(c => c.gift_date >= startDate && c.gift_date <= endDate) : farmGiftCosts))
        .map(item => ({
          type: item.source || 'gift',
          name: item.name,
          amount: Number(item.amount),
          date: item.gift_date,
          notes: item.notes,
        }));

      const farmServiceCostsBreakdown = [...serviceBreakdown, ...giftBreakdown];

      return {
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        lifetime_summary: {
          total_invoices: allInvoices.length,
          total_revenue: Math.round(lifetimeRevenue * 100) / 100,
          total_cost: Math.round(lifetimeCost * 100) / 100,
          total_profit: Math.round(lifetimeProfit * 100) / 100,
          avg_margin: Math.round(lifetimeMargin * 100) / 100,
          delivery_costs: Math.round(lifetimeDeliveryCost * 100) / 100,
          farm_service_costs: Math.round(lifetimeFarmServiceCost * 100) / 100,
          service_costs: Math.round(lifetimeServiceCost * 100) / 100,
          gift_costs: Math.round(lifetimeGiftCost * 100) / 100,
          operating_costs: Math.round(lifetimeOperatingCost * 100) / 100,
          net_profit: Math.round((lifetimeProfit - lifetimeDeliveryCost - lifetimeFarmServiceCost - lifetimeOperatingCost) * 100) / 100,
        },
        current_season_summary: currentSeasonSummary,
        summary: {
          total_invoices: invoices.length,
          total_revenue: Math.round(totalRevenue * 100) / 100,
          total_cost: Math.round(totalCost * 100) / 100,
          total_profit: Math.round(totalProfit * 100) / 100,
          avg_margin: Math.round(avgMargin * 100) / 100,
          delivery_costs: Math.round(filteredDeliveryCost * 100) / 100,
          farm_service_costs: Math.round(filteredFarmServiceCost * 100) / 100,
          service_costs: Math.round(filteredServiceCost * 100) / 100,
          gift_costs: Math.round(filteredGiftCost * 100) / 100,
          operating_costs: Math.round(filteredOperatingCost * 100) / 100,
          net_profit: Math.round((totalProfit - filteredDeliveryCost - filteredFarmServiceCost - filteredOperatingCost) * 100) / 100,
        },
        invoices: invoiceDetails,
        by_season: seasonSummary,
        farm_service_costs_breakdown: farmServiceCostsBreakdown,
        debug_version: 'v5_filtered_customer',
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi báo cáo khách hàng: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Báo cáo lợi nhuận theo vụ lúa (rice_crop)
   */
  async getRiceCropProfitReport(riceCropId: number): Promise<any> {
    try {
      // 1. Lấy hóa đơn
      const invoices = await this.salesInvoiceRepository.find({
        where: [
          { rice_crop_id: riceCropId, status: SalesInvoiceStatus.CONFIRMED },
          { rice_crop_id: riceCropId, status: SalesInvoiceStatus.PAID },
        ],
        relations: ['items', 'items.product', 'customer', 'season', 'rice_crop'],
        order: { sale_date: 'DESC', created_at: 'DESC' },
      });

      if (invoices.length === 0) {
        // Nếu không có hóa đơn, vẫn trả về thông tin ruộng lúa với số liệu bằng 0
        const riceCrop = await this.riceCropRepository.findOne({
          where: { id: riceCropId },
          relations: ['customer', 'season'],
        });

        if (!riceCrop) {
          throw new NotFoundException(`Không tìm thấy mảnh ruộng ID: ${riceCropId}`);
        }

        // Lấy chi phí dịch vụ/quà tặng của cửa hàng dành cho ruộng lúa này (quà tặng tự động...)
        const farmServiceCosts = await this.farmServiceCostRepository.find({
          where: { rice_crop_id: riceCropId }
        });
        const totalFarmServiceCosts = farmServiceCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);

        // Lấy chi phí vận hành dành cho ruộng lúa này (nếu có gán trực tiếp)
        const operatingCosts = await this.operatingCostRepository.find({
          where: { rice_crop_id: riceCropId }
        });
        const totalOperatingCosts = operatingCosts.reduce((sum, cost) => sum + Number(cost.value), 0);

        return {
          rice_crop_id: riceCropId,
          field_name: riceCrop.field_name,
          customer_name: riceCrop.customer?.name,
          season_name: riceCrop.season?.name,
          summary: {
            total_invoices: 0,
            total_revenue: 0,
            cost_of_goods_sold: 0,
            gross_profit: 0,
            avg_margin: 0,
            gift_value_from_invoices: 0,
            farm_service_costs: totalFarmServiceCosts,
            operating_costs: totalOperatingCosts,
            net_profit: -(totalFarmServiceCosts + totalOperatingCosts),
            net_margin: 0,
          },
          farm_service_costs_breakdown: [
            ...farmServiceCosts.map(c => ({
              type: 'service',
              name: c.name,
              amount: Number(c.amount),
              date: c.expense_date,
              notes: c.notes,
              source: c.source,
            })),
            ...(await this.farmGiftCostRepository.find({ where: { rice_crop_id: riceCropId } })).map(c => ({
              type: c.source || 'gift',
              name: c.name,
              amount: Number(c.amount),
              date: c.gift_date,
              notes: c.notes,
              source: c.source,
            }))
          ],
          operating_costs_breakdown: operatingCosts.map(c => ({
            name: c.name,
            amount: Number(c.value),
            date: c.expense_date,
            notes: c.description,
          })),
          invoices: [],
          debug_version: 'v5_empty_data',
        };
      }

      const firstInvoice = invoices[0]!;
      const fieldName = firstInvoice.rice_crop?.field_name || 'Unknown';
      const customerName = firstInvoice.customer?.name || firstInvoice.customer_name;
      const seasonName = firstInvoice.season?.name;

      // 2. Tính toán doanh thu & COGS ban đầu
      let totalRevenue = 0;
      let totalCost = 0;
      let totalProfit = 0;
      let totalGiftFromInvoices = 0; 
      const invoiceDetails: any[] = [];

      for (const invoice of invoices) {
        // Ưu tiên dùng cost_of_goods_sold đã lưu trong invoice (chính xác tại thời điểm bán)
        // Nếu không có thì mới tính lại từ average_cost_price hiện tại
        let invoiceCOGS = 0;
        
        this.logger.log(
          `🔍 Invoice ${invoice.code}: ` +
          `cost_of_goods_sold = ${invoice.cost_of_goods_sold} ` +
          `(type: ${typeof invoice.cost_of_goods_sold}), ` +
          `final_amount = ${invoice.final_amount}`
        );
        
        if (invoice.cost_of_goods_sold !== null && invoice.cost_of_goods_sold !== undefined) {
          // Dùng cost_of_goods_sold đã lưu (có thể = 0 nếu đã trả hàng)
          invoiceCOGS = Number(invoice.cost_of_goods_sold);
          this.logger.log(`  ✅ Dùng cost_of_goods_sold: ${invoiceCOGS}`);
        } else if (invoice.items && invoice.items.length > 0) {
          // Fallback: Tính từ average_cost_price nếu cost_of_goods_sold = null
          for (const item of invoice.items) {
            const avgCost = Number(item.product?.average_cost_price || 0);
            invoiceCOGS += Number(item.base_quantity || item.quantity) * avgCost;
          }
          this.logger.log(`  ⚠️ Fallback tính lại: ${invoiceCOGS}`);
        }

        const invoiceProfit = Number(invoice.final_amount) - invoiceCOGS;
        const invoiceMargin = invoice.final_amount > 0 
          ? (invoiceProfit / invoice.final_amount) * 100 
          : 0;
        const invoiceGiftValue = Number(invoice.gift_value || 0);

        totalRevenue += Number(invoice.final_amount);
        totalCost += invoiceCOGS;
        totalProfit += invoiceProfit;
        totalGiftFromInvoices += invoiceGiftValue;

        invoiceDetails.push({
          invoice_id: invoice.id,
          invoice_code: invoice.code,
          date: invoice.sale_date || invoice.created_at,
          revenue: invoice.final_amount,
          cost: invoiceCOGS,
          profit: invoiceProfit,
          margin: Math.round(invoiceMargin * 100) / 100,
          customer_name: invoice.customer_name,
        });
      }

      // 3. Lấy Chi phí dịch vụ & Chi phí vận hành của cửa hàng dành cho ruộng lúa này
      const serviceCosts = await this.farmServiceCostRepository.find({
        where: { rice_crop_id: riceCropId }
      });
      const giftCosts = await this.farmGiftCostRepository.find({
        where: { rice_crop_id: riceCropId }
      });

      const totalServiceCosts = serviceCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);
      const totalGiftCosts = giftCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);
      const totalFarmServiceCosts = totalServiceCosts + totalGiftCosts;

      const farmServiceCostsBreakdown = [
        ...serviceCosts.map(item => ({
          type: 'service',
          source: 'manual', // Tương thích ngược với UI cũ dùng source làm loại
          name: item.name,
          amount: Number(item.amount),
          date: item.expense_date,
          notes: item.notes,
        })),
        ...giftCosts.map(item => ({
          type: item.source || 'gift',
          source: item.source || 'gift',
          name: item.name,
          amount: Number(item.amount),
          date: item.gift_date,
          notes: item.notes,
        }))
      ];

      const operatingCosts = await this.operatingCostRepository.find({
        where: { rice_crop_id: riceCropId }
      });
      const totalOperatingCosts = operatingCosts.reduce((sum, cost) => sum + Number(cost.value), 0);

      // Tính tổng chi phí giao hàng cho tất cả hóa đơn của ruộng lúa
      const invoiceIds = invoices.map(inv => inv.id);
      let totalDeliveryCost = 0;
      if (invoiceIds.length > 0) {
        const deliveryLogs = await this.deliveryLogRepository.find({
          where: { invoice_id: In(invoiceIds) },
        });
        totalDeliveryCost = deliveryLogs.reduce((sum, log) => sum + Number(log.total_cost || 0), 0);
      }

      // 4. Tính Net Profit của vụ lúa (bao gồm chi phí dịch vụ, vận hành và giao hàng)
      const calculatedNetProfit = totalProfit - totalFarmServiceCosts - totalOperatingCosts - totalDeliveryCost;

      const avgMargin = totalRevenue > 0 
        ? (totalProfit / totalRevenue) * 100 
        : 0; // Đây là Gross Margin trung bình

      this.logger.log(`✅ Báo cáo mảnh ruộng #${riceCropId}: Gross ${totalProfit}, Service Cost ${totalFarmServiceCosts}, Delivery ${totalDeliveryCost}, Net ${calculatedNetProfit}`);

      return {
        rice_crop_id: riceCropId,
        field_name: fieldName,
        customer_name: customerName,
        season_name: seasonName,
        summary: {
          total_invoices: invoices.length,
          total_revenue: Math.round(totalRevenue * 100) / 100,
          cost_of_goods_sold: Math.round(totalCost * 100) / 100,
          gross_profit: Math.round(totalProfit * 100) / 100, // Lợi nhuận gộp
          avg_margin: Math.round(avgMargin * 100) / 100, // Biên LN gộp
          gift_value_from_invoices: Math.round(totalGiftFromInvoices * 100) / 100,
          
          // Chi phí dịch vụ/quà tặng của cửa hàng
          farm_service_costs: Math.round(totalFarmServiceCosts * 100) / 100,
          service_costs: Math.round(totalServiceCosts * 100) / 100,
          gift_costs: Math.round(totalGiftCosts * 100) / 100,

          // Chi phí vận hành gán cho ruộng
          operating_costs: Math.round(totalOperatingCosts * 100) / 100,

          // Chi phí giao hàng
          delivery_costs: Math.round(totalDeliveryCost * 100) / 100,

          // Lợi nhuận ròng (Gross Profit - Farm Service Costs - Operating Costs - Delivery Costs)
          net_profit: Math.round(calculatedNetProfit * 100) / 100,
          net_margin: totalRevenue > 0 ? Math.round((calculatedNetProfit / totalRevenue) * 10000) / 100 : 0,
        },
        farm_service_costs_breakdown: farmServiceCostsBreakdown,
        operating_costs_breakdown: operatingCosts.map(c => ({
          name: c.name,
          amount: Number(c.value),
          date: c.expense_date,
          notes: c.description,
        })),
        invoices: invoiceDetails,
        debug_version: 'v4_fix_all',
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi báo cáo vụ lúa: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Báo cáo lợi nhuận cửa hàng theo khoảng thời gian
   */
  async getPeriodProfitReport(
    startDate: Date, 
    endDate: Date, 
    taxableFilter: 'all' | 'yes' | 'no' = 'all',
    filterByReceiptDate?: string,
    sortBy: string = 'sale_date',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<PeriodReportDto> {
    try {
      this.logger.log(`📊 Báo cáo lợi nhuận từ ${startDate.toISOString()} đến ${endDate.toISOString()}`);

      let allowedProductIds: Set<number> | null = null;
      if (filterByReceiptDate) {
        this.logger.log(`🔍 Chỉ lấy sản phẩm có hóa đơn nhập từ ${filterByReceiptDate}`);
        const receiptItemRepo = this.salesInvoiceRepository.manager.getRepository(InventoryReceiptItem);
        const productsWithReceipt = await receiptItemRepo
          .createQueryBuilder('item')
          .innerJoin('item.receipt', 'receipt')
          .select('DISTINCT item.product_id', 'product_id')
          .where('receipt.bill_date >= :filterDate', { filterDate: filterByReceiptDate })
          .andWhere('item.taxable_quantity > 0') // BẮT BUỘC: Phải có số lượng thuế trong năm 2026
          .andWhere("receipt.status IN ('approved', 'completed')")
          .getRawMany();
        
        allowedProductIds = new Set(productsWithReceipt.map(p => Number(p.product_id)));
        this.logger.log(`🔍 Tìm thấy ${allowedProductIds.size} sản phẩm thỏa mãn điều kiện nhập hàng.`);
      }

      // 1. Lấy tất cả hóa đơn trong khoảng thời gian (chỉ lấy confirmed và paid, bỏ draft/cancelled/refunded)
      const invoices = await this.salesInvoiceRepository.find({
        where: [
          { sale_date: Between(startDate, endDate), status: SalesInvoiceStatus.CONFIRMED },
          { sale_date: Between(startDate, endDate), status: SalesInvoiceStatus.PAID },
          { sale_date: IsNull(), created_at: Between(startDate, endDate), status: SalesInvoiceStatus.CONFIRMED },
          { sale_date: IsNull(), created_at: Between(startDate, endDate), status: SalesInvoiceStatus.PAID },
        ],
        relations: ['items', 'items.product'],
        order: { 
          [sortBy === 'total_amount' ? 'final_amount' : sortBy]: sortOrder, 
          created_at: 'DESC' 
        } as any,
      });

      const invoiceDtoList: PeriodInvoiceDto[] = [];

      // 2. Tính toán doanh thu và giá vốn (phân loại theo has_input_invoice)
      let totalRevenue = 0;
      let revenueWithInvoice = 0;
      let revenueNoInvoice = 0;
      let taxableRevenue = 0;
      
      let totalCOGS = 0;
      let cogsWithInvoice = 0;
      let cogsNoInvoice = 0;

      for (const invoice of invoices) {
        const invoiceFinalAmount = Number(invoice.final_amount);
        totalRevenue += invoiceFinalAmount;

        // Ưu tiên dùng giá vốn thực tế từ hóa đơn (đã được xử lý trả hàng chính xác)
        const invoiceActualCOGS = Number(invoice.cost_of_goods_sold || 0);
        totalCOGS += invoiceActualCOGS;
        
        // Tính tổng giá vốn tạm tính (theo số lượng ban đầu) để làm trọng số phân bổ
        const invoiceOriginalCOGSTotal = (invoice.items || []).reduce((sum, item) => {
          const avgCost = Number(item.product?.average_cost_price || 0);
          return sum + (Number(item.base_quantity || item.quantity) * avgCost);
        }, 0);

        const invoiceItemsGross = (invoice.items || []).reduce((sum, item) => sum + Number(item.total_price), 0);
        const itemsDto: PeriodInvoiceItemDto[] = [];

        for (const item of invoice.items || []) {
          // Lọc theo ID sản phẩm nếu có yêu cầu
          if (allowedProductIds && !allowedProductIds.has(item.product_id)) {
            continue;
          }

          const itemGrossPrice = Number(item.total_price);
          const avgCost = Number(item.product?.average_cost_price || 0);
          const itemOriginalCOGS = Number(item.base_quantity || item.quantity) * avgCost;

          // Phân bổ doanh thu thực tế (đã trừ trả hàng) cho item này
          const itemNetRevenue = invoiceItemsGross > 0 
            ? (itemGrossPrice / invoiceItemsGross) * invoiceFinalAmount 
            : 0;

          // Phân bổ giá vốn thực tế (đã trừ trả hàng) cho item này
          const itemActualCOGS = invoiceOriginalCOGSTotal > 0
            ? (itemOriginalCOGS / invoiceOriginalCOGSTotal) * invoiceActualCOGS
            : 0;

          const taxableQty = Number(item.taxable_quantity || 0);
          const originalQty = Number(item.quantity || 1); // Tránh chia cho 0
          
          // Tính số lượng thực bán hiện tại (sau trả hàng) để làm mẫu số cho tỷ lệ thuế
          // Tỷ lệ = Doanh thu thực tế / Doanh thu gốc * Số lượng gốc
          const currentQtySold = itemGrossPrice > 0 
            ? (itemNetRevenue / itemGrossPrice) * originalQty 
            : 0;

          // Tỷ lệ khai thuế trên lượng hàng "thực tế còn lại" sau khi trả
          // Nếu bán 10 trả 5, còn lại 5. Nếu 5 bao đó đều có thuế thì tỷ lệ là 100% (1)
          const taxableRatio = currentQtySold > 0 ? Math.min(1, taxableQty / currentQtySold) : 0;
          
          // Doanh thu khai thuế = số lượng khai thuế * giá khai thuế (ưu tiên lấy từ snapshot của item)
          const itemTaxPrice = Number(item.tax_selling_price || 0);
          const productTaxPrice = Number(item.product?.tax_selling_price || 0);
          const conversionFactor = Number(item.conversion_factor || 1);
          const shouldNormalizeLegacyTaxPrice =
            conversionFactor !== 1 &&
            itemTaxPrice > 0 &&
            productTaxPrice > 0 &&
            Math.abs(itemTaxPrice - productTaxPrice) < 0.000001;
          // ✅ FIX: Luôn ưu tiên giá từ danh mục sản phẩm nếu giá trong đơn bán đang là 0
          // Lý do: sales_invoice_items.tax_selling_price hay bị lưu "0" với dữ liệu cũ
          const effectiveTaxPrice = (() => {
            if (shouldNormalizeLegacyTaxPrice) return itemTaxPrice * conversionFactor;
            if (productTaxPrice > 0) return productTaxPrice; // Ưu tiên giá từ danh mục sản phẩm
            if (itemTaxPrice > 0) return itemTaxPrice;       // Fallback giá trong đơn bán
            return 0;
          })();
          const itemTaxableTotalAmount = taxableQty * effectiveTaxPrice;

          if (taxableQty > 0) {
            revenueWithInvoice += itemNetRevenue * taxableRatio;
            cogsWithInvoice += itemActualCOGS * taxableRatio;
            taxableRevenue += itemTaxableTotalAmount;
          }
          
          if (currentQtySold > taxableQty) {
            const nonTaxableRatio = Math.max(0, 1 - taxableRatio);
            revenueNoInvoice += itemNetRevenue * nonTaxableRatio;
            cogsNoInvoice += itemActualCOGS * nonTaxableRatio;
          }

          // Thêm vào danh sách item của DTO
          itemsDto.push({
            product_trade_name: item.product_name || item.product?.trade_name || 'Không xác định',
            product_name: item.product?.name || item.product_name || 'Không xác định',
            quantity: Number(item.quantity),
            unit_name: item.unit_name || 'Đơn vị',
            unit_price: Number(item.unit_price),
            total_price: Number(item.total_price),
            has_input_invoice: taxableQty > 0,
            taxable_quantity: taxableQty,
            tax_selling_price: effectiveTaxPrice,
            taxable_total_amount: itemTaxableTotalAmount,
          });
        }

        // Thêm vào danh sách hóa đơn của DTO nếu có ít nhất 1 item thỏa mãn
        if (itemsDto.length > 0) {
          invoiceDtoList.push({
            invoice_id: invoice.id,
            invoice_code: invoice.code,
            customer_name: invoice.customer_name,
            sale_date: invoice.sale_date || invoice.created_at,
            total_amount: invoiceFinalAmount,
            items: itemsDto,
          });
        }
      }

      // 3. Lấy chi phí vận hành cửa hàng
      const operatingCostsResult = await this.operatingCostRepository.find({
        where: {
          expense_date: Between(startDate, endDate),
        },
      });
      const totalOperatingCosts = operatingCostsResult.reduce((sum, cost) => sum + Number(cost.value), 0);

      // 4. Lấy chi phí dịch vụ/quà tặng
      const serviceCostsPeriod = await this.farmServiceCostRepository.find({
        where: {
          expense_date: Between(startDate, endDate),
        },
      });
      const giftCostsPeriod = await this.farmGiftCostRepository.find({
        where: {
          gift_date: Between(startDate, endDate),
        },
      });
      
      const totalServiceCostsPeriod = serviceCostsPeriod.reduce((sum, cost) => sum + Number(cost.amount), 0);
      const totalGiftCostsPeriod = giftCostsPeriod.reduce((sum, cost) => sum + Number(cost.amount), 0);
      const totalStoreServiceCosts = totalServiceCostsPeriod + totalGiftCostsPeriod;

      // 5. Thống kê giao hàng (tùy chọn, nếu cần tích hợp sâu hơn)
      const deliveryStats = await this.getSeasonDeliveryStats(startDate, endDate);
      const totalDeliveryCosts = deliveryStats?.total_delivery_cost || 0;

      // 6. Tính toán lợi nhuận
      const grossProfit = totalRevenue - totalCOGS;
      const netProfit = grossProfit - totalOperatingCosts - totalStoreServiceCosts - totalDeliveryCosts;

      // 7. Lọc danh sách hóa đơn theo yêu cầu (nếu Filter không phải 'all')
      let filteredInvoices = invoiceDtoList;
      if (taxableFilter === 'yes') {
        filteredInvoices = invoiceDtoList.filter(inv => 
          inv.items.some(item => Number(item.taxable_quantity) > 0)
        );
      } else if (taxableFilter === 'no') {
        filteredInvoices = invoiceDtoList.filter(inv => 
          inv.items.every(item => Number(item.taxable_quantity) === 0)
        );
      }

      const summary: PeriodSummaryDto = {
        total_revenue: Math.round(totalRevenue),
        revenue_with_invoice: Math.round(revenueWithInvoice),
        revenue_no_invoice: Math.round(revenueNoInvoice),
        taxable_revenue: Math.round(taxableRevenue), // Doanh thu khai báo thuế = số lượng * giá bán khai thuế (của sản phẩm có hóa đơn đầu vào)
        total_cogs: Math.round(totalCOGS),
        cogs_with_invoice: Math.round(cogsWithInvoice),
        cogs_no_invoice: Math.round(cogsNoInvoice),
        gross_profit: Math.round(grossProfit),
        total_operating_costs: Math.round(totalOperatingCosts),
        total_gift_costs: Math.round(totalStoreServiceCosts + totalDeliveryCosts), // Gộp phí giao hàng vào chi phí dịch vụ/quà tặng
        net_profit: Math.round(netProfit),
        invoice_count: invoices.length,
      };

      return {
        summary,
        invoices: filteredInvoices,
        start_date: startDate,
        end_date: endDate,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi báo cáo doanh thu theo kỳ: ${err.message}`, err.stack);
      throw error;
    }
  }
}
