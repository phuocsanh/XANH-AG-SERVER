import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, Between, In } from 'typeorm';
import { SalesInvoice, SalesInvoiceStatus } from '../../entities/sales-invoices.entity';
import { Season } from '../../entities/season.entity';
import { OperatingCost } from '../../entities/operating-costs.entity';
import { DeliveryLog } from '../../entities/delivery-log.entity';
import { 
  InvoiceProfitDto, 
  InvoiceItemProfitDto 
} from './dto/invoice-profit.dto';
import {
  SeasonStoreProfitDto,
  ProfitSummaryDto,
  OperatingCostBreakdownDto,
  DeliveryStatsDto,
  TopCustomerProfitDto,
  TopProductProfitDto,
} from './dto/season-store-profit.dto';
import {
  CustomerProfitReportDto,
  CustomerInvoiceDto,
  CustomerSeasonSummaryDto,
} from './dto/customer-profit-report.dto';

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
        const itemCOGS = item.quantity * avgCost;
        const itemProfit = item.total_price - itemCOGS;
        const itemMargin = item.total_price > 0 
          ? (itemProfit / item.total_price) * 100 
          : 0;

        totalCOGS += itemCOGS;

        itemDetails.push({
          product_name: item.product?.name || 'Unknown',
          quantity: item.quantity,
          unit_price: item.unit_price,
          avg_cost: avgCost,
          cogs: itemCOGS,
          profit: itemProfit,
          margin: Math.round(itemMargin * 100) / 100,
        });
      }

      const grossProfit = invoice.final_amount - totalCOGS;
      const margin = invoice.final_amount > 0
        ? (grossProfit / invoice.final_amount) * 100
        : 0;

      this.logger.log(`✅ Tính toán lợi nhuận đơn hàng #${invoiceId}: ${grossProfit.toLocaleString()} đ`);

      return {
        invoice_id: invoice.id,
        invoice_code: invoice.code,
        customer_name: invoice.customer_name,
        created_at: invoice.created_at,
        total_amount: invoice.final_amount,
        cost_of_goods_sold: totalCOGS,
        gross_profit: grossProfit,
        gross_margin: Math.round(margin * 100) / 100,
        item_details: itemDetails,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi tính toán lợi nhuận đơn hàng: ${err.message}`, err.stack);
      throw error;
    }
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

      // Lấy tất cả hóa đơn trong season (không bao gồm cancelled)
      const invoices = await this.salesInvoiceRepository.find({
        where: {
          season_id: seasonId,
          status: Not(SalesInvoiceStatus.CANCELLED),
        },
        relations: ['items', 'items.product', 'customer'],
      });

      this.logger.log(`📊 Tìm thấy ${invoices.length} hóa đơn trong mùa ${season.name}`);

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
        totalRevenue += invoice.final_amount;

        let invoiceCOGS = 0;
        for (const item of invoice.items || []) {
          const avgCost = Number(item.product?.average_cost_price || 0);
          const itemCOGS = item.quantity * avgCost;
          const itemProfit = item.total_price - itemCOGS;

          invoiceCOGS += itemCOGS;

          // Track product profit
          const productId = item.product_id;
          if (!productProfitMap.has(productId)) {
            productProfitMap.set(productId, {
              id: productId,
              name: item.product?.name || 'Unknown',
              quantity: 0,
              revenue: 0,
              profit: 0,
            });
          }
          const productData = productProfitMap.get(productId)!;
          productData.quantity += item.quantity;
          productData.revenue += item.total_price;
          productData.profit += itemProfit;
        }

        totalCOGS += invoiceCOGS;
        const invoiceProfit = invoice.final_amount - invoiceCOGS;

        // Track customer profit
        if (invoice.customer_id) {
          if (!customerProfitMap.has(invoice.customer_id)) {
            customerProfitMap.set(invoice.customer_id, {
              id: invoice.customer_id,
              name: invoice.customer_name,
              invoiceCount: 0,
              revenue: 0,
              profit: 0,
            });
          }
          const customerData = customerProfitMap.get(invoice.customer_id)!;
          customerData.invoiceCount++;
          customerData.revenue += invoice.final_amount;
          customerData.profit += invoiceProfit;
        }
      }

      const grossProfit = totalRevenue - totalCOGS;
      const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

      // Lấy chi phí vận hành trong khoảng thời gian season
      const operatingCosts = await this.getSeasonOperatingCosts(
        season.start_date,
        season.end_date,
      );

      // Lấy thống kê giao hàng
      const deliveryStats = await this.getSeasonDeliveryStats(
        season.start_date,
        season.end_date,
        seasonId,
      );

      const totalOperatingCosts = operatingCosts.reduce((sum, c) => sum + c.amount, 0)
        + (deliveryStats?.total_delivery_cost || 0);
      
      const netProfit = grossProfit - totalOperatingCosts;
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
        operating_costs_breakdown: operatingCosts,
        delivery_stats: deliveryStats,
        top_customers: topCustomers,
        top_products: topProducts,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi báo cáo mùa vụ: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Lấy chi phí vận hành trong khoảng thời gian
   */
  private async getSeasonOperatingCosts(
    startDate?: Date,
    endDate?: Date,
  ): Promise<OperatingCostBreakdownDto[]> {
    try {
      const where: any = {};
      
      if (startDate && endDate) {
        where.createdAt = Between(startDate, endDate);
      }

      const costs = await this.operatingCostRepository.find({ where });

      return costs.map(cost => ({
        type: cost.type,
        name: cost.name,
        amount: Number(cost.value),
      }));
    } catch (error) {
      this.logger.warn('Không thể lấy chi phí vận hành, trả về mảng rỗng');
      return [];
    }
  }

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
      const where: any = {};
      
      if (startDate && endDate) {
        where.delivery_date = Between(startDate, endDate);
      }

      // Nếu có seasonId, lấy invoice_ids trong season
      if (seasonId) {
        const invoices = await this.salesInvoiceRepository.find({
          where: { season_id: seasonId },
          select: ['id'],
        });
        const invoiceIds = invoices.map(inv => inv.id);
        if (invoiceIds.length > 0) {
          where.invoice_id = In(invoiceIds);
        }
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
    seasonId?: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<CustomerProfitReportDto> {
    try {
      // Build where conditions
      const where: any = {
        customer_id: customerId,
        status: Not(SalesInvoiceStatus.CANCELLED),
      };

      // Filter by season if provided
      if (seasonId) {
        where.season_id = seasonId;
      }

      // Filter by date range if provided
      if (startDate && endDate) {
        where.created_at = Between(startDate, endDate);
      }

      // Lấy tất cả hóa đơn của khách hàng
      const invoices = await this.salesInvoiceRepository.find({
        where,
        relations: ['items', 'items.product', 'season'],
        order: { created_at: 'DESC' },
      });

      if (invoices.length === 0) {
        throw new NotFoundException(`Không tìm thấy đơn hàng nào của khách hàng ID: ${customerId}`);
      }

      const firstInvoice = invoices[0]!;
      const customerName = firstInvoice.customer_name;
      const customerPhone = firstInvoice.customer_phone || undefined;
      const customerEmail = firstInvoice.customer_email || undefined;

      // Tính toán cho từng đơn hàng
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
        // Tính COGS cho đơn hàng này
        let invoiceCOGS = 0;
        for (const item of invoice.items || []) {
          const avgCost = Number(item.product?.average_cost_price || 0);
          invoiceCOGS += item.quantity * avgCost;
        }

        const invoiceProfit = invoice.final_amount - invoiceCOGS;
        const invoiceMargin = invoice.final_amount > 0 
          ? (invoiceProfit / invoice.final_amount) * 100 
          : 0;

        totalRevenue += invoice.final_amount;
        totalCost += invoiceCOGS;
        totalProfit += invoiceProfit;

        invoiceDetails.push({
          invoice_id: invoice.id,
          invoice_code: invoice.code,
          date: invoice.created_at,
          revenue: invoice.final_amount,
          cost: invoiceCOGS,
          profit: invoiceProfit,
          margin: Math.round(invoiceMargin * 100) / 100,
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
          seasonData.revenue += invoice.final_amount;
          seasonData.cost += invoiceCOGS;
          seasonData.profit += invoiceProfit;
        }
      }

      // Summary
      const avgMargin = totalRevenue > 0 
        ? (totalProfit / totalRevenue) * 100 
        : 0;

      // Season summary
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

      this.logger.log(`✅ Báo cáo khách hàng #${customerId}: ${invoices.length} đơn, lợi nhuận ${totalProfit.toLocaleString()} đ`);

      return {
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        summary: {
          total_invoices: invoices.length,
          total_revenue: Math.round(totalRevenue * 100) / 100,
          total_cost: Math.round(totalCost * 100) / 100,
          total_profit: Math.round(totalProfit * 100) / 100,
          avg_margin: Math.round(avgMargin * 100) / 100,
        },
        invoices: invoiceDetails,
        by_season: seasonSummary,
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
      // Lấy tất cả hóa đơn liên quan đến rice_crop này
      const invoices = await this.salesInvoiceRepository.find({
        where: {
          rice_crop_id: riceCropId,
          status: Not(SalesInvoiceStatus.CANCELLED),
        },
        relations: ['items', 'items.product', 'customer', 'season', 'rice_crop'],
        order: { created_at: 'DESC' },
      });

      if (invoices.length === 0) {
        throw new NotFoundException(`Không tìm thấy hóa đơn nào cho vụ lúa ID: ${riceCropId}`);
      }

      const firstInvoice = invoices[0]!;
      const fieldName = firstInvoice.rice_crop?.field_name || 'Unknown';
      const customerName = firstInvoice.customer?.name || firstInvoice.customer_name;
      const seasonName = firstInvoice.season?.name;

      // Tính toán cho từng đơn hàng
      let totalRevenue = 0;
      let totalCost = 0;
      let totalProfit = 0;
      const invoiceDetails: any[] = [];

      for (const invoice of invoices) {
        // Tính COGS cho đơn hàng này
        let invoiceCOGS = 0;
        for (const item of invoice.items || []) {
          const avgCost = Number(item.product?.average_cost_price || 0);
          invoiceCOGS += item.quantity * avgCost;
        }

        const invoiceProfit = invoice.final_amount - invoiceCOGS;
        const invoiceMargin = invoice.final_amount > 0 
          ? (invoiceProfit / invoice.final_amount) * 100 
          : 0;

        totalRevenue += invoice.final_amount;
        totalCost += invoiceCOGS;
        totalProfit += invoiceProfit;

        invoiceDetails.push({
          invoice_id: invoice.id,
          invoice_code: invoice.code,
          date: invoice.created_at,
          revenue: invoice.final_amount,
          cost: invoiceCOGS,
          profit: invoiceProfit,
          margin: Math.round(invoiceMargin * 100) / 100,
          customer_name: invoice.customer_name,
        });
      }

      // Summary
      const avgMargin = totalRevenue > 0 
        ? (totalProfit / totalRevenue) * 100 
        : 0;

      this.logger.log(`✅ Báo cáo vụ lúa #${riceCropId}: ${invoices.length} đơn, lợi nhuận ${totalProfit.toLocaleString()} đ`);

      return {
        rice_crop_id: riceCropId,
        field_name: fieldName,
        customer_name: customerName,
        season_name: seasonName,
        summary: {
          total_invoices: invoices.length,
          total_revenue: Math.round(totalRevenue * 100) / 100,
          total_cost: Math.round(totalCost * 100) / 100,
          total_profit: Math.round(totalProfit * 100) / 100,
          avg_margin: Math.round(avgMargin * 100) / 100,
        },
        invoices: invoiceDetails,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi báo cáo vụ lúa: ${err.message}`, err.stack);
      throw error;
    }
  }
}
