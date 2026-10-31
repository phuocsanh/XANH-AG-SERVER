import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, IsNull, MoreThan, Raw } from 'typeorm';
import {
  SalesInvoice,
  SalesInvoiceStatus,
} from '../../entities/sales-invoices.entity';
import { Season } from '../../entities/season.entity';
import { OperatingCost } from '../../entities/operating-costs.entity';
import { DeliveryLog } from '../../entities/delivery-log.entity';
import { RiceCrop } from '../../entities/rice-crop.entity';
import { Customer } from '../../entities/customer.entity';
import { FarmServiceCost } from '../../entities/farm-service-cost.entity';
import { FarmGiftCost } from '../../entities/farm-gift-cost.entity';
import { SystemSetting } from '../../entities/system-setting.entity';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';
import { Product, ProductCostingMethod } from '../../entities/products.entity';
import { ProductType } from '../../entities/product-types.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesReturnStatus } from '../../entities/sales-return.entity';
import { PromotionRewardReservation } from '../../entities/promotion-reward-reservation.entity';
import { QueryHelper } from '../../common/helpers/query-helper';

import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { BusinessLogicException } from '../../common/exceptions/business-logic.exception';
import { loadSupplierRebates } from './supplier-rebate';
import { receiptInboundFeePerBaseUnit } from '../sales/price-type-landed-cost';
import { calculateTaxReportPricing, TaxPriceReturn } from './tax-report-pricing';
import {
  InvoiceProfitDto,
  InvoiceItemProfitDto,
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
  ProductSeasonSalesDto,
  ProductTypesSeasonProfitDto,
} from './dto/product-season-sales.dto';
import { CustomerSeasonSalesDto } from './dto/customer-season-sales.dto';
import {
  CustomerProfitReportDto,
  CustomerInvoiceDto,
  CustomerSeasonSummaryDto,
} from './dto/customer-profit-report.dto';
import {
  PeriodReportDto,
  PeriodSummaryDto,
  PeriodInvoiceDto,
  PeriodInvoiceItemDto,
} from './dto/period-report.dto';

/**
 * Service xử lý logic tính lợi nhuận cho cửa hàng
 */
@Injectable()
export class StoreProfitReportService {
  private readonly logger = new Logger(StoreProfitReportService.name);
  private readonly DEFAULT_TAX_REVENUE_CUTOVER_DATE = '2026-01-01';
  private readonly TAX_REVENUE_CUTOVER_DATE_KEY = 'tax_revenue_cutover_date';
  private readonly LEGACY_TAX_REVENUE_CUTOVER_DATE_KEY =
    'tax_revenue_2026_cutover_date';

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
    @InjectRepository(SystemSetting)
    private systemSettingRepository: Repository<SystemSetting>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async getProductSeasonSales(
    productId: number,
    seasonId: number,
  ): Promise<ProductSeasonSalesDto> {
    const [product, season] = await Promise.all([
      this.productRepository.findOne({
        where: { id: productId },
        relations: ['unit'],
      }),
      this.seasonRepository.findOne({ where: { id: seasonId } }),
    ]);

    if (!product) {
      throw new NotFoundException(
        `Không tìm thấy sản phẩm với ID: ${productId}`,
      );
    }
    if (!season) {
      throw new NotFoundException(`Không tìm thấy mùa vụ với ID: ${seasonId}`);
    }

    const invoices = await this.salesInvoiceRepository.find({
      where: [
        { season_id: seasonId, status: SalesInvoiceStatus.CONFIRMED },
        { season_id: seasonId, status: SalesInvoiceStatus.PAID },
      ],
      relations: ['items'],
    });
    const returnStats = await this.getApprovedReturnStats(
      invoices.map((invoice) => invoice.id),
    );

    let quantityInvoiced = 0;
    let quantityReturned = 0;
    let quantitySold = 0;
    let invoiceCount = 0;

    for (const invoice of invoices) {
      let hasProduct = false;

      for (const item of invoice.items || []) {
        if (item.product_id !== productId) {
          continue;
        }

        hasProduct = true;
        const invoicedBaseQuantity = Number(
          item.base_quantity || item.quantity || 0,
        );
        const returned = this.getReturnStatsForItem(
          returnStats,
          invoice.id,
          item,
        );

        quantityInvoiced += invoicedBaseQuantity;
        quantityReturned += returned.returnedBaseQuantity;
        quantitySold += Math.max(
          0,
          invoicedBaseQuantity - returned.returnedBaseQuantity,
        );
      }

      if (hasProduct) {
        invoiceCount += 1;
      }
    }

    return {
      product_id: productId,
      product_name:
        product.trade_name || product.name || `Sản phẩm #${productId}`,
      season_id: seasonId,
      season_name: season.name,
      quantity_invoiced: quantityInvoiced,
      quantity_returned: quantityReturned,
      quantity_sold: quantitySold,
      unit_name: product.unit?.name,
      invoice_count: invoiceCount,
    };
  }

  /** Tổng hợp doanh thu thuần, giá vốn và lợi nhuận gộp theo loại sản phẩm trong mùa vụ. */
  async getProductTypesSeasonProfit(
    seasonId: number,
    productTypeIds: number[],
  ): Promise<ProductTypesSeasonProfitDto> {
    const selectedTypeIds = [...new Set(productTypeIds)];
    if (!selectedTypeIds.length || selectedTypeIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new BadRequestException('Vui lòng chọn ít nhất một loại sản phẩm hợp lệ');
    }

    const [season, productTypes] = await Promise.all([
      this.seasonRepository.findOne({ where: { id: seasonId } }),
      this.salesInvoiceRepository.manager
        .getRepository(ProductType)
        .find({ where: { id: In(selectedTypeIds) } }),
    ]);
    if (!season) {
      throw new NotFoundException(`Không tìm thấy mùa vụ với ID: ${seasonId}`);
    }

    const invoices = await this.salesInvoiceRepository.find({
      where: [
        { season_id: seasonId, status: SalesInvoiceStatus.CONFIRMED },
        { season_id: seasonId, status: SalesInvoiceStatus.PAID },
      ],
      relations: ['items', 'items.product'],
    });
    const batchCosts = await this.loadBatchCosts(invoices);
    const supplierRebates = await this.loadSupplierRebates(invoices);
    const inboundFees = await this.loadPriceTypeInboundFees(invoices);
    const returnStats = await this.getApprovedReturnStats(
      invoices.map((invoice) => invoice.id),
    );
    const typeNames = new Map<number, string>(
      productTypes.map((type) => [type.id, type.name] as const),
    );
    const totals = new Map<number, { revenue: number; cogs: number; invoices: Set<number> }>();

    for (const typeId of selectedTypeIds) {
      totals.set(typeId, { revenue: 0, cogs: 0, invoices: new Set() });
    }

    for (const invoice of invoices) {
      const items = invoice.items || [];
      const invoiceItemsGross = items.reduce(
        (sum, item) => sum + Number(item.total_price || 0),
        0,
      );

      for (const item of items) {
        const typeId = Number(item.product?.type);
        const typeTotals = totals.get(typeId);
        if (!typeTotals) continue;

        const itemGross = Number(item.total_price || 0);
        const discountShare = invoiceItemsGross > 0
          ? Number(invoice.discount_amount || 0) * (itemGross / invoiceItemsGross)
          : 0;
        const returned = this.getReturnStatsForItem(returnStats, invoice.id, item);
        const itemRevenue = Math.max(0, itemGross - discountShare - returned.returnedAmount);
        const itemCOGS = this.getItemNetCOGS(
          item,
          returned.returnedBaseQuantity,
          batchCosts,
          supplierRebates,
          inboundFees,
        );

        typeTotals.revenue += itemRevenue;
        typeTotals.cogs += itemCOGS;
        if (itemRevenue > 0 || itemCOGS > 0) {
          typeTotals.invoices.add(invoice.id);
        }
      }
    }

    const breakdown = selectedTypeIds.map((productTypeId) => {
      const total = totals.get(productTypeId)!;
      const grossProfit = total.revenue - total.cogs;
      return {
        product_type_id: productTypeId,
        product_type_name: typeNames.get(productTypeId) || `Loại sản phẩm #${productTypeId}`,
        revenue: Math.round(total.revenue * 100) / 100,
        cost_of_goods_sold: Math.round(total.cogs * 100) / 100,
        gross_profit: Math.round(grossProfit * 100) / 100,
        gross_margin: total.revenue > 0
          ? Math.round((grossProfit / total.revenue) * 10000) / 100
          : 0,
        invoice_count: total.invoices.size,
      };
    });
    const revenue = selectedTypeIds.reduce(
      (sum, typeId) => sum + totals.get(typeId)!.revenue,
      0,
    );
    const costOfGoodsSold = selectedTypeIds.reduce(
      (sum, typeId) => sum + totals.get(typeId)!.cogs,
      0,
    );
    const grossProfit = revenue - costOfGoodsSold;
    const invoiceIds = new Set(
      breakdown.flatMap((row) => {
        const typeTotals = totals.get(row.product_type_id)!;
        return [...typeTotals.invoices];
      }),
    );

    return {
      season_id: season.id,
      season_name: season.name,
      product_type_ids: selectedTypeIds,
      revenue: Math.round(revenue * 100) / 100,
      cost_of_goods_sold: Math.round(costOfGoodsSold * 100) / 100,
      gross_profit: Math.round(grossProfit * 100) / 100,
      gross_margin: revenue > 0 ? Math.round((grossProfit / revenue) * 10000) / 100 : 0,
      invoice_count: invoiceIds.size,
      breakdown,
    };
  }

  /** Tổng hợp tiền bán theo khách hàng, mùa vụ và danh mục Phân bón gốc. */
  async getCustomerSeasonSales(
    customerId: number,
    seasonId: number,
  ): Promise<CustomerSeasonSalesDto> {
    const [customer, season, productTypes] = await Promise.all([
      this.customerRepository.findOne({ where: { id: customerId } }),
      this.seasonRepository.findOne({ where: { id: seasonId } }),
      this.salesInvoiceRepository.manager
        .getRepository(ProductType)
        .find(),
    ]);

    if (!customer) {
      throw new NotFoundException(`Không tìm thấy khách hàng với ID: ${customerId}`);
    }
    if (!season) {
      throw new NotFoundException(`Không tìm thấy mùa vụ với ID: ${seasonId}`);
    }

    const normalizeCategoryName = (name: string) =>
      name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .trim()
        .toLocaleLowerCase('vi-VN');
    const baseFertilizerTypeIds = new Set(
      productTypes
        .filter((productType) => normalizeCategoryName(productType.name) === 'phan bon goc')
        .map((productType) => productType.id),
    );
    const riceSeedTypeIds = new Set(
      productTypes
        .filter((productType) => normalizeCategoryName(productType.name) === 'lua giong')
        .map((productType) => productType.id),
    );

    const invoices = await this.salesInvoiceRepository.find({
      where: [
        {
          customer_id: customerId,
          season_id: seasonId,
          status: SalesInvoiceStatus.CONFIRMED,
        },
        {
          customer_id: customerId,
          season_id: seasonId,
          status: SalesInvoiceStatus.PAID,
        },
      ],
      relations: ['items', 'items.product'],
    });
    const returnStats = await this.getApprovedReturnStats(
      invoices.map((invoice) => invoice.id),
    );

    let baseFertilizerAmount = 0;
    let otherProductsAmount = 0;

    for (const invoice of invoices) {
      const items = invoice.items || [];
      const invoiceItemsGross = items.reduce(
        (sum, item) => sum + Number(item.total_price || 0),
        0,
      );

      for (const item of items) {
        const itemGrossPrice = Number(item.total_price || 0);
        const invoiceDiscountShare =
          invoiceItemsGross > 0
            ? Number(invoice.discount_amount || 0) *
              (itemGrossPrice / invoiceItemsGross)
            : 0;
        const returned = this.getReturnStatsForItem(returnStats, invoice.id, item);
        const itemAmount = Math.max(
          0,
          itemGrossPrice - invoiceDiscountShare - returned.returnedAmount,
        );
        const productTypeId = Number(item.product?.type);
        if (riceSeedTypeIds.has(productTypeId)) {
          continue;
        }
        const isBaseFertilizer = baseFertilizerTypeIds.has(productTypeId);

        if (isBaseFertilizer) {
          baseFertilizerAmount += itemAmount;
        } else {
          otherProductsAmount += itemAmount;
        }
      }
    }

    return {
      customer_id: customerId,
      customer_name: customer.name,
      season_id: seasonId,
      season_name: season.name,
      base_fertilizer_amount: baseFertilizerAmount,
      other_products_amount: otherProductsAmount,
      total_amount: baseFertilizerAmount + otherProductsAmount,
    };
  }

  private async getFarmGiftCostsBasic(
    filters: {
      seasonId?: number;
      customerId?: number;
      riceCropId?: number;
      invoiceIds?: number[];
      startDate?: Date;
      endDate?: Date;
    } = {},
  ): Promise<FarmGiftCost[]> {
    const query = this.farmGiftCostRepository
      .createQueryBuilder('gift')
      .select([
        'gift.id',
        'gift.name',
        'gift.amount',
        'gift.season_id',
        'gift.customer_id',
        'gift.rice_crop_id',
        'gift.notes',
        'gift.gift_date',
        'gift.source',
        'gift.invoice_id',
        'gift.reward_history_id',
        'gift.created_at',
        'gift.updated_at',
      ]);

    if (filters.seasonId) {
      query.andWhere('gift.season_id = :seasonId', {
        seasonId: filters.seasonId,
      });
    }
    if (filters.customerId) {
      query.andWhere('gift.customer_id = :customerId', {
        customerId: filters.customerId,
      });
    }
    if (filters.riceCropId) {
      query.andWhere('gift.rice_crop_id = :riceCropId', {
        riceCropId: filters.riceCropId,
      });
    }
    if (filters.invoiceIds) {
      if (filters.invoiceIds.length) query.andWhere('gift.invoice_id IN (:...invoiceIds)', { invoiceIds: filters.invoiceIds });
      else query.andWhere('1 = 0');
    }
    if (filters.startDate && filters.endDate) {
      query.andWhere('gift.gift_date BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    const storedGifts = await query.getMany();
    const invoiceGiftWhere = {
      ...(filters.seasonId ? { season_id: filters.seasonId } : {}),
      ...(filters.customerId ? { customer_id: filters.customerId } : {}),
      ...(filters.riceCropId ? { rice_crop_id: filters.riceCropId } : {}),
      gift_value: MoreThan(0),
      ...(filters.invoiceIds ? { id: In(filters.invoiceIds) } : {}),
    };
    const invoiceGiftConditions = [SalesInvoiceStatus.CONFIRMED, SalesInvoiceStatus.PAID]
      .flatMap((status) => filters.startDate && filters.endDate ? [
        { ...invoiceGiftWhere, status, sale_date: Between(filters.startDate, filters.endDate) },
        { ...invoiceGiftWhere, status, sale_date: IsNull(), created_at: Between(filters.startDate, filters.endDate) },
      ] : [{ ...invoiceGiftWhere, status }]);
    const invoiceGifts = await this.salesInvoiceRepository.find({ where: invoiceGiftConditions });
    // Đọc trực tiếp quà hóa đơn để không bỏ sót khách vãng lai hoặc ghi trùng phiếu chi cũ.
    const gifts = storedGifts.filter((gift) => gift.source !== 'gift_from_invoice');
    for (const invoice of invoiceGifts) {
      gifts.push(Object.assign(new FarmGiftCost(), {
        id: -invoice.id,
        name: invoice.gift_description || `Quà tặng hóa đơn ${invoice.code}`,
        amount: Number(invoice.gift_value),
        gift_date: invoice.sale_date || invoice.created_at,
        customer_id: invoice.customer_id,
        season_id: invoice.season_id,
        rice_crop_id: invoice.rice_crop_id,
        source: 'gift_from_invoice',
        invoice_id: invoice.id,
      }));
    }

    // Campaign chỉ có khách hàng/ngày trao; không tự gán chi phí vào một ruộng cụ thể.
    if (!filters.riceCropId && !filters.invoiceIds) {
      let issuedStart = filters.startDate;
      let issuedEnd = filters.endDate;
      let canResolveSeason = true;
      if (filters.seasonId) {
        const season = await this.seasonRepository.findOne({ where: { id: filters.seasonId } });
        if (!season?.start_date || !season?.end_date) {
          canResolveSeason = false;
        } else {
          const seasonStart = new Date(season.start_date);
          const seasonEnd = new Date(season.end_date);
          seasonEnd.setHours(23, 59, 59, 999);
          issuedStart = issuedStart && issuedStart > seasonStart ? issuedStart : seasonStart;
          issuedEnd = issuedEnd && issuedEnd < seasonEnd ? issuedEnd : seasonEnd;
        }
      }
      if (canResolveSeason && !(issuedStart && issuedEnd && issuedStart > issuedEnd)) {
        const campaignGifts = await this.salesInvoiceRepository.manager.getRepository(PromotionRewardReservation).find({
          where: {
            status: 'issued',
            ...(filters.customerId ? { customer_id: filters.customerId } : {}),
            ...(issuedStart && issuedEnd ? { issued_at: Between(issuedStart, issuedEnd) } : {}),
          },
        });
        for (const reservation of campaignGifts) {
          gifts.push(Object.assign(new FarmGiftCost(), {
            id: -reservation.id,
            name: `Quà campaign: ${reservation.reward_name}`,
            amount: Number(reservation.reward_value),
            gift_date: reservation.issued_at,
            customer_id: reservation.customer_id,
            season_id: filters.seasonId,
            source: 'gift_from_campaign',
          }));
        }
      }
    }
    return gifts;
  }

  async getTaxRevenueCutoverDate(): Promise<{ cutover_date: string }> {
    const setting =
      (await this.systemSettingRepository.findOne({
        where: { key: this.TAX_REVENUE_CUTOVER_DATE_KEY },
      })) ||
      (await this.systemSettingRepository.findOne({
        where: { key: this.LEGACY_TAX_REVENUE_CUTOVER_DATE_KEY },
      }));

    return {
      cutover_date:
        setting?.value?.trim() || this.DEFAULT_TAX_REVENUE_CUTOVER_DATE,
    };
  }

  async updateTaxRevenueCutoverDate(
    cutoverDate: string,
  ): Promise<{ cutover_date: string }> {
    const normalizedDate = cutoverDate.trim();
    let setting = await this.systemSettingRepository.findOne({
      where: { key: this.TAX_REVENUE_CUTOVER_DATE_KEY },
    });

    const legacySetting = await this.systemSettingRepository.findOne({
      where: { key: this.LEGACY_TAX_REVENUE_CUTOVER_DATE_KEY },
    });

    if (!setting) {
      setting = this.systemSettingRepository.create({
        key: this.TAX_REVENUE_CUTOVER_DATE_KEY,
        description: 'Ngay cutover cho report tax-revenue',
        value: normalizedDate,
      });
    } else {
      setting.value = normalizedDate;
      setting.description =
        setting.description || 'Ngay cutover cho report tax-revenue';
    }

    await this.systemSettingRepository.save(setting);

    if (legacySetting) {
      await this.systemSettingRepository.remove(legacySetting);
    }

    return { cutover_date: normalizedDate };
  }

  private getInvoiceItemCostPrice(item: any): number {
    if (item?.cost_price === null || item?.cost_price === undefined) {
      return Number(item?.product?.average_cost_price || 0);
    }

    const snapshotCost = Number(item?.cost_price);
    if (Number.isFinite(snapshotCost) && snapshotCost >= 0) {
      return snapshotCost;
    }

    return Number(item?.product?.average_cost_price || 0);
  }

  private getInvoiceItemCOGS(item: any): number {
    return (
      Number(item?.base_quantity || item?.quantity || 0) *
      this.getInvoiceItemCostPrice(item)
    );
  }

  /** Tổng giá vốn và phần khách trả của từng dòng bán theo lô. */
  private buildBatchCosts(
    invoices: SalesInvoice[],
    allocations: SalesInvoiceItemStockAllocation[],
    returns: SalesReturnItem[],
  ): Map<number, { original: number; returned: number; taxable: number | null }> {
    const items = invoices.flatMap((invoice) => invoice.items || [])
      .filter((item) => item.costing_method_snapshot === ProductCostingMethod.BY_BATCH);
    const costs = new Map<number, { original: number; returned: number; taxable: number | null }>();
    for (const item of items) {
      const sources = allocations.filter((allocation) =>
        Number(allocation.sales_invoice_item_id) === Number(item.id),
      );
      const soldQty = Number(item.base_quantity ?? item.quantity ?? 0);
      const allocatedQty = sources.reduce((sum, source) => sum + Number(source.quantity), 0);
      if (!sources.length || !Number.isFinite(soldQty) || soldQty <= 0 ||
          !Number.isFinite(allocatedQty) || Math.abs(allocatedQty - soldQty) > 0.0001 ||
          sources.some((source) => !source.inventory_batch_id ||
            !Number.isFinite(Number(source.unit_cost)) || Number(source.unit_cost) < 0 ||
            !Number.isFinite(Number(source.total_cost)) || Number(source.total_cost) < 0)) {
        throw new BadRequestException(`Dòng hóa đơn #${item.id} thiếu phân bổ giá vốn theo lô hợp lệ.`);
      }
      const cost = {
        original: sources.reduce((sum, source) => sum + Number(source.total_cost), 0),
        returned: 0,
        taxable: sources.every((source) => source.taxable_quantity != null &&
          Number.isFinite(Number(source.taxable_quantity)) && Number(source.taxable_quantity) >= 0 &&
          Number(source.taxable_quantity) <= Number(source.quantity))
          ? sources.reduce((sum, source) => sum +
              Math.round((Number(source.taxable_quantity) * Number(source.unit_cost) + Number.EPSILON) * 100) / 100, 0)
          : null as number | null,
      };
      const returnedByBatch = new Map<number, number>();
      const returnedTaxByBatch = new Map<number, number>();
      for (const returned of returns.filter((row) => Number(row.sales_invoice_item_id) === Number(item.id))) {
        const snapshots = returned.stock_allocations || [];
        const returnedQty = Number(returned.base_quantity ??
          Number(returned.quantity) * Number(returned.conversion_factor ?? 1));
        if (!snapshots.length || !Number.isFinite(returnedQty) ||
            Math.abs(snapshots.reduce((sum, snapshot) => sum + Number(snapshot.quantity), 0) - returnedQty) > 0.0001) {
          throw new BadRequestException(`Phiếu khách trả dòng #${returned.id} thiếu phân bổ lô để tính lợi nhuận.`);
        }
        for (const snapshot of snapshots) {
          const batchId = Number(snapshot.sourceBatchId);
          const source = sources.find((allocation) => Number(allocation.inventory_batch_id) === batchId);
          const quantity = Number(snapshot.quantity);
          if (!source || !Number.isFinite(quantity) || quantity <= 0) {
            throw new BadRequestException(`Phiếu khách trả dòng #${returned.id} thiếu lô nguồn hợp lệ để tính lợi nhuận.`);
          }
          const previousReturned = returnedByBatch.get(batchId) || 0;
          const totalReturned = Math.round((previousReturned + quantity) * 10000) / 10000;
          if (totalReturned - Number(source.quantity) > 0.0001) {
            throw new BadRequestException(`Lô #${batchId} có số lượng trả vượt số lượng đã bán.`);
          }
          returnedByBatch.set(batchId, totalReturned);
          cost.returned += Math.round((totalReturned * Number(source.unit_cost) + Number.EPSILON) * 100) / 100 -
            Math.round((previousReturned * Number(source.unit_cost) + Number.EPSILON) * 100) / 100;
          if (cost.taxable !== null) {
            if (snapshot.taxableQuantity === null || snapshot.taxableQuantity === undefined ||
                !Number.isFinite(Number(snapshot.taxableQuantity)) || Number(snapshot.taxableQuantity) < 0 ||
                Number(snapshot.taxableQuantity) > quantity) {
              cost.taxable = null;
            } else {
              const previousTax = returnedTaxByBatch.get(batchId) || 0;
              const totalTax = Math.round((previousTax + Number(snapshot.taxableQuantity)) * 10000) / 10000;
              cost.taxable -= Math.round((totalTax * Number(source.unit_cost) + Number.EPSILON) * 100) / 100 -
                Math.round((previousTax * Number(source.unit_cost) + Number.EPSILON) * 100) / 100;
              returnedTaxByBatch.set(batchId, totalTax);
            }
          }
        }
      }
      costs.set(Number(item.id), cost);
    }
    return costs;
  }

  private async loadBatchCosts(invoices: SalesInvoice[]): Promise<Map<number, { original: number; returned: number; taxable: number | null }>> {
    const ids = invoices.flatMap((invoice) => invoice.items || [])
      .filter((item) => item.costing_method_snapshot === ProductCostingMethod.BY_BATCH)
      .map((item) => item.id);
    if (!ids.length) return new Map();
    const manager = this.salesInvoiceRepository.manager;
    const [allocations, returns] = await Promise.all([
      manager.getRepository(SalesInvoiceItemStockAllocation)
        .find({ where: { sales_invoice_item_id: In(ids) } }),
      manager.getRepository(SalesReturnItem).createQueryBuilder('item')
        .innerJoinAndSelect('item.sales_return', 'salesReturn')
        .where('salesReturn.invoice_id IN (:...invoiceIds)', { invoiceIds: invoices.map((invoice) => invoice.id) })
        .andWhere('salesReturn.status = :status', { status: SalesReturnStatus.APPROVED })
        .getMany(),
    ]);
    return this.buildBatchCosts(invoices, allocations, returns);
  }

  private loadSupplierRebates(
    invoices: SalesInvoice[],
    allocations?: SalesInvoiceItemStockAllocation[],
    returns?: SalesReturnItem[],
  ): Promise<Map<number, number>> {
    return loadSupplierRebates(this.salesInvoiceRepository.manager, invoices, allocations, returns);
  }

  /** Phí nhập đã bán ròng theo đúng lô; giá gốc trên dòng hóa đơn vẫn dùng cho quyết toán NCC. */
  private async loadPriceTypeInboundFees(
    invoices: SalesInvoice[],
    allocations?: SalesInvoiceItemStockAllocation[],
    returns?: SalesReturnItem[],
  ): Promise<Map<number, number>> {
    const itemIds = invoices.flatMap((invoice) => invoice.items || [])
      .filter((item) => item.costing_method_snapshot === ProductCostingMethod.BY_PRICE_TYPE)
      .map((item) => Number(item.id));
    const fees = new Map<number, number>();
    if (!itemIds.length) return fees;
    const manager = this.salesInvoiceRepository.manager;
    const sources = allocations || await manager.find(SalesInvoiceItemStockAllocation, {
      where: { sales_invoice_item_id: In(itemIds) }, relations: ['receipt_item'],
    });
    const returnedItems = returns || await manager.getRepository(SalesReturnItem)
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.sales_return', 'salesReturn')
      .where('salesReturn.invoice_id IN (:...invoiceIds)', { invoiceIds: invoices.map((invoice) => invoice.id) })
      .andWhere('salesReturn.status = :status', { status: SalesReturnStatus.APPROVED })
      .getMany();
    for (const source of sources.filter((row) => itemIds.includes(Number(row.sales_invoice_item_id)))) {
      const returnedQty = returnedItems
        .filter((item) => Number(item.sales_invoice_item_id) === Number(source.sales_invoice_item_id))
        .flatMap((item) => item.stock_allocations || [])
        .filter((snapshot) => Number(snapshot.sourceBatchId) === Number(source.inventory_batch_id))
        .reduce((sum, snapshot) => sum + Number(snapshot.quantity || 0), 0);
      const fee = Math.max(0, Number(source.quantity) - returnedQty) *
        receiptInboundFeePerBaseUnit(source.receipt_item);
      fees.set(Number(source.sales_invoice_item_id), (fees.get(Number(source.sales_invoice_item_id)) || 0) + fee);
    }
    return fees;
  }

  /** Tổng chiết khấu NCC phân bổ cho các dòng bán chốt giá vốn theo loại giá bán. */
  private getInvoiceSupplierRebate(invoice: SalesInvoice, rebates: Map<number, number>): number {
    return (invoice.items || []).reduce((sum, item) => sum + (rebates.get(Number(item.id)) || 0), 0);
  }

  private getItemNetCOGS(
    item: SalesInvoiceItem,
    returnedBaseQuantity: number,
    batchCosts: Map<number, { original: number; returned: number; taxable: number | null }>,
    supplierRebates?: Map<number, number>,
    inboundFees?: Map<number, number>,
  ): number {
    if (item.costing_method_snapshot === ProductCostingMethod.BY_BATCH) {
      const cost = batchCosts.get(Number(item.id));
      if (!cost) throw new BadRequestException(`Dòng hóa đơn #${item.id} thiếu giá vốn theo lô.`);
      return Math.max(0, cost.original - cost.returned);
    }
    const saleCost = Math.max(0,
      this.getInvoiceItemCOGS(item) -
      returnedBaseQuantity * this.getInvoiceItemCostPrice(item),
    );
    return saleCost + (inboundFees?.get(Number(item.id)) || 0) -
      (supplierRebates?.get(Number(item.id)) || 0);
  }

  /** Hóa đơn mới đọc tổng giá vốn lô, tránh nhân lại đơn giá bình quân đã làm tròn. */
  private getBatchInvoiceCOGS(
    invoice: SalesInvoice,
    costs: Map<number, { original: number; returned: number; taxable: number | null }>,
  ): number | undefined {
    if (!invoice.items?.length || !invoice.items.every((item) =>
      item.costing_method_snapshot === ProductCostingMethod.BY_BATCH,
    )) return undefined;
    return Math.round(invoice.items.reduce((sum, item) => sum + this.getItemNetCOGS(item, 0, costs), 0) * 100) / 100;
  }

  private getReturnStatsKey(
    invoiceId: number,
    item?: { id?: number; product_id?: number },
    productId?: number,
  ): string {
    if (item?.id) {
      return `${invoiceId}:item:${item.id}`;
    }
    return `${invoiceId}:product:${productId ?? item?.product_id}`;
  }

  private async getApprovedReturnStats(invoiceIds: number[]): Promise<
    Map<
      string,
      {
        returnedQuantity: number;
        returnedBaseQuantity: number;
        returnedAmount: number;
      }
    >
  > {
    const statsMap = new Map<
      string,
      {
        returnedQuantity: number;
        returnedBaseQuantity: number;
        returnedAmount: number;
      }
    >();

    if (!invoiceIds.length) {
      return statsMap;
    }

    const rows = await this.salesInvoiceRepository.manager
      .getRepository(SalesReturnItem)
      .createQueryBuilder('item')
      .innerJoin('item.sales_return', 'sales_return')
      .select('sales_return.invoice_id', 'invoice_id')
      .addSelect('item.sales_invoice_item_id', 'sales_invoice_item_id')
      .addSelect('item.product_id', 'product_id')
      .addSelect('COALESCE(SUM(item.quantity), 0)', 'returned_quantity')
      .addSelect(
        'COALESCE(SUM(COALESCE(item.base_quantity, item.quantity * COALESCE(item.conversion_factor, 1))), 0)',
        'returned_base_quantity',
      )
      .addSelect('COALESCE(SUM(item.total_price), 0)', 'returned_amount')
      .where('sales_return.status = :status', {
        status: SalesReturnStatus.APPROVED,
      })
      .andWhere('sales_return.invoice_id IN (:...invoiceIds)', { invoiceIds })
      .groupBy('sales_return.invoice_id')
      .addGroupBy('item.sales_invoice_item_id')
      .addGroupBy('item.product_id')
      .getRawMany();

    for (const row of rows) {
      const invoiceId = Number(row.invoice_id);
      const invoiceItemId = row.sales_invoice_item_id
        ? Number(row.sales_invoice_item_id)
        : undefined;
      const productId = Number(row.product_id);
      const key = invoiceItemId
        ? `${invoiceId}:item:${invoiceItemId}`
        : `${invoiceId}:product:${productId}`;
      statsMap.set(key, {
        returnedQuantity: Number(row.returned_quantity || 0),
        returnedBaseQuantity: Number(row.returned_base_quantity || 0),
        returnedAmount: Number(row.returned_amount || 0),
      });
    }

    return statsMap;
  }

  private getReturnStatsForItem(
    statsMap: Map<
      string,
      {
        returnedQuantity: number;
        returnedBaseQuantity: number;
        returnedAmount: number;
      }
    >,
    invoiceId: number,
    item: { id?: number; product_id?: number },
  ): {
    returnedQuantity: number;
    returnedBaseQuantity: number;
    returnedAmount: number;
  } {
    return (
      statsMap.get(this.getReturnStatsKey(invoiceId, item)) ||
      statsMap.get(
        this.getReturnStatsKey(invoiceId, undefined, item.product_id),
      ) || {
        returnedQuantity: 0,
        returnedBaseQuantity: 0,
        returnedAmount: 0,
      }
    );
  }

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
        throw new NotFoundException(
          `Không tìm thấy hóa đơn với ID: ${invoiceId}`,
        );
      }
      if (invoice.status && invoice.status !== SalesInvoiceStatus.CONFIRMED &&
          invoice.status !== SalesInvoiceStatus.PAID) {
        throw new BadRequestException('Chỉ hóa đơn đã xác nhận hoặc đã thanh toán mới có báo cáo lợi nhuận bán hàng.');
      }

      // Tính giá vốn và lợi nhuận cho từng sản phẩm
      let totalCOGS = 0;
      const itemDetails: InvoiceItemProfitDto[] = [];
      const returnStatsMap = await this.getApprovedReturnStats([invoice.id]);
      const batchCosts = await this.loadBatchCosts([invoice]);
      const supplierRebates = await this.loadSupplierRebates([invoice]);
      const inboundFees = await this.loadPriceTypeInboundFees([invoice]);
      const invoiceItemsGross = (invoice.items || []).reduce(
        (sum, item) => sum + Number(item.total_price || 0),
        0,
      );

      for (const item of invoice.items || []) {
        const returnStats = this.getReturnStatsForItem(
          returnStatsMap,
          invoice.id,
          item,
        );
        const itemGrossPrice = Number(item.total_price || 0);
        const invoiceDiscountShare =
          invoiceItemsGross > 0
            ? Number(invoice.discount_amount || 0) *
              (itemGrossPrice / invoiceItemsGross)
            : 0;
        const itemRevenue = Math.max(
          0,
          itemGrossPrice - invoiceDiscountShare - returnStats.returnedAmount,
        );
        const itemCOGS = this.getItemNetCOGS(item, returnStats.returnedBaseQuantity, batchCosts, supplierRebates, inboundFees);
        const netQuantity = Math.max(
          0,
          Number(item.quantity || 0) - returnStats.returnedQuantity,
        );
        // Giá vốn đơn vị trên báo cáo phải khớp tổng giá vốn sau hoàn hàng và chiết khấu NCC.
        const avgCost = netQuantity > 0 ? itemCOGS / netQuantity : 0;
        const itemProfit = itemRevenue - itemCOGS;
        const itemMargin =
          itemRevenue > 0 ? (itemProfit / itemRevenue) * 100 : 0;

        totalCOGS += itemCOGS;

        // Dùng trade_name nếu có (đã chứa sẵn volume), fallback về name
        const productName =
          item.product?.trade_name || item.product?.name || 'Unknown';

        itemDetails.push({
          product_name: productName,
          quantity: netQuantity,
          unit_price: item.unit_price,
          avg_cost: avgCost,
          cogs: itemCOGS,
          profit: itemProfit,
          margin: Math.round(itemMargin * 100) / 100,
        });
      }

      const grossProfit = Number(invoice.final_amount) - totalCOGS;
      const margin =
        invoice.final_amount > 0
          ? (grossProfit / invoice.final_amount) * 100
          : 0;

      // Lấy giá trị quà tặng và mô tả
      const giftDescription = invoice.gift_description || undefined;
      const giftValue = Number(invoice.gift_value || 0);

      // Lấy chi phí giao hàng từ delivery_logs
      const deliveryLog = await this.deliveryLogRepository.findOne({
        where: { invoice_id: invoiceId },
      });

      const deliveryCost = deliveryLog
        ? Number(deliveryLog.total_cost || 0)
        : 0;
      // Lợi nhuận ròng của hóa đơn trừ cả quà tặng và chi phí giao hàng.
      const netProfit = grossProfit - giftValue - deliveryCost;

      this.logger.log(
        `✅ Tính toán lợi nhuận đơn hàng #${invoiceId}: Gross ${grossProfit.toLocaleString()} đ, Gift ${giftValue.toLocaleString()} đ${giftDescription ? ` (${giftDescription})` : ''}, Delivery ${deliveryCost.toLocaleString()} đ, Net ${netProfit.toLocaleString()} đ`,
      );

      return {
        invoice_id: invoice.id,
        invoice_code: invoice.code,
        customer_name: invoice.customer_name,
        created_at: invoice.sale_date || invoice.created_at,
        total_amount: invoice.final_amount,
        cost_of_goods_sold: totalCOGS,
        supplier_rebate: this.getInvoiceSupplierRebate(invoice, supplierRebates),
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
      this.logger.error(
        `❌ Lỗi tính toán lợi nhuận đơn hàng: ${err.message}`,
        err.stack,
      );
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
  async getSeasonStoreProfitReport(
    seasonId: number,
  ): Promise<SeasonStoreProfitDto> {
    try {
      // Lấy thông tin season
      const season = await this.seasonRepository.findOne({
        where: { id: seasonId },
      });

      if (!season) {
        throw new NotFoundException(
          `Không tìm thấy mùa vụ với ID: ${seasonId}`,
        );
      }

      this.logger.log(
        `📊 [DEBUG_REPORT] getSeasonStoreProfitReport called with seasonId: ${seasonId} (type: ${typeof seasonId})`,
      );

      // Lấy tất cả hóa đơn trong season (chỉ lấy confirmed và paid, bỏ draft/cancelled/refunded)
      const invoices = await this.salesInvoiceRepository.find({
        where: [
          { season_id: seasonId, status: SalesInvoiceStatus.CONFIRMED },
          { season_id: seasonId, status: SalesInvoiceStatus.PAID },
        ],
        relations: ['items', 'items.product', 'items.product.unit', 'customer'],
      });

      this.logger.log(
        `📊 [DEBUG_REPORT] Found ${invoices.length} invoices for seasonId ${seasonId}`,
      );

      invoices.slice(0, 5).forEach((inv) => {
        this.logger.log(
          `  📄 ${inv.code}: final_amount=${inv.final_amount}, ` +
            `cost_of_goods_sold=${inv.cost_of_goods_sold}, status=${inv.status}`,
        );
      });
      if (invoices.length > 5) {
        this.logger.log(`  ... ${invoices.length - 5} hóa đơn còn lại`);
      }

      // Tính tổng doanh thu, giá vốn, lợi nhuận
      let totalRevenue = 0;
      let totalCOGS = 0;
      const customerProfitMap = new Map<
        number,
        {
          id: number;
          name: string;
          invoiceCount: number;
          revenue: number;
          profit: number;
        }
      >();
      const productProfitMap = new Map<
        number,
        {
          id: number;
          name: string;
          unitName?: string | undefined;
          quantity: number;
          revenue: number;
          profit: number;
        }
      >();
      const approvedReturnStats = await this.getApprovedReturnStats(
        invoices.map((invoice) => invoice.id),
      );
      const batchCosts = await this.loadBatchCosts(invoices);

      const supplierRebates = await this.loadSupplierRebates(invoices);
      const inboundFees = await this.loadPriceTypeInboundFees(invoices);

      for (const invoice of invoices) {
        // Explicitly cast to number to handle TypeORM decimal strings
        let finalAmount = Number(invoice.final_amount);
        totalRevenue += finalAmount;

        // Ưu tiên dùng cost_of_goods_sold đã lưu (chính xác tại thời điểm bán)
        let invoiceCOGS = 0;

        // Check for non-null/undefined. Note: cost_of_goods_sold can be "0.00" (string) or 0 (number) or null
        const batchInvoiceCost = this.getBatchInvoiceCOGS(invoice, batchCosts);
        if (batchInvoiceCost !== undefined) {
          invoiceCOGS = batchInvoiceCost;
        } else if (
          invoice.cost_of_goods_sold !== null &&
          invoice.cost_of_goods_sold !== undefined
        ) {
          // Dùng cost_of_goods_sold đã lưu (chắc chắn dùng cái này nếu có)
          invoiceCOGS = Number(invoice.cost_of_goods_sold);

          // Double check logic: if we just used the saved value, we DO NOT calculate from items
        } else if (invoice.items && invoice.items.length > 0) {
          // Fallback: Tính từ average_cost_price CHỈ KHI cost_of_goods_sold = null
          this.logger.warn(
            `⚠️ Invoice ${invoice.code} has no cost_of_goods_sold. Calculating from items.`,
          );
          for (const item of invoice.items) {
            const avgCost = this.getInvoiceItemCostPrice(item);
            invoiceCOGS +=
              Number(item.base_quantity || item.quantity) * avgCost;
          }
        }

        invoiceCOGS -= this.getInvoiceSupplierRebate(invoice, supplierRebates);

        const invoiceItemsGross = (invoice.items || []).reduce(
          (sum, item) => sum + Number(item.total_price),
          0,
        );

        // Track product profit (chỉ khi hóa đơn còn giá trị sau khi trừ trả hàng)
        if (finalAmount > 0 && invoice.items && invoice.items.length > 0) {
          for (const item of invoice.items) {
            const itemGrossPrice = Number(item.total_price);
            const returnStats = this.getReturnStatsForItem(
              approvedReturnStats,
              invoice.id,
              item,
            );

            const invoiceDiscountShare =
              invoiceItemsGross > 0
                ? Number(invoice.discount_amount || 0) *
                  (itemGrossPrice / invoiceItemsGross)
                : 0;
            const itemNetRevenue = Math.max(
              0,
              itemGrossPrice -
                invoiceDiscountShare -
                returnStats.returnedAmount,
            );
            const itemActualCOGS = this.getItemNetCOGS(item, returnStats.returnedBaseQuantity, batchCosts, supplierRebates, inboundFees);
            const itemProfit = itemNetRevenue - itemActualCOGS;

            // Tính số lượng thực bán (đã trừ trả hàng)
            const originalBaseQty = Number(
              item.base_quantity || item.quantity || 0,
            );
            const currentBaseQtySold = Math.max(
              0,
              originalBaseQty - returnStats.returnedBaseQuantity,
            );

            // Track product profit
            const productId = item.product_id;
            if (!productProfitMap.has(productId)) {
              const productName =
                item.product?.trade_name || item.product?.name || 'Unknown';
              productProfitMap.set(productId, {
                id: productId,
                name: productName,
                unitName: item.product?.unit?.name || item.unit_name,
                quantity: 0,
                revenue: 0,
                profit: 0,
              });
            }
            const productData = productProfitMap.get(productId)!;
            productData.quantity += currentBaseQtySold;
            productData.revenue += itemNetRevenue; // Use itemNetRevenue for accurate revenue
            productData.profit += itemProfit; // Use itemProfit for accurate profit
          }
        }

        totalCOGS += invoiceCOGS;
        const invoiceProfit = finalAmount - invoiceCOGS;

        // Track customer profit (bao gồm cả khách vãng lai)
        const customerKey =
          invoice.customer_id || `guest_${invoice.customer_name}`;
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
      const grossMargin =
        totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

      // Lấy chi phí dịch vụ
      const serviceCostsResult = await this.farmServiceCostRepository.find({
        where: { season_id: seasonId },
      });

      // Lấy chi phí quà tặng
      const giftCostsResult = await this.getFarmGiftCostsBasic({ seasonId });

      const serviceBreakdown = serviceCostsResult.map((item) => ({
        type: 'service',
        name: item.name,
        amount: Number(item.amount),
        date: item.expense_date,
        notes: item.notes,
      }));

      const giftBreakdown = giftCostsResult.map((item) => ({
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

      const operatingCostsBreakdown = operatingCostsResult.map((item) => ({
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

      const totalServiceCosts = serviceBreakdown.reduce(
        (sum, c) => sum + c.amount,
        0,
      );
      const totalGiftCosts = giftBreakdown.reduce(
        (sum, c) => sum + c.amount,
        0,
      );
      const totalFarmServiceCosts = totalServiceCosts + totalGiftCosts;

      const totalDeliveryCosts = deliveryStats?.total_delivery_cost || 0;
      const totalOperatingCosts = operatingCostsBreakdown.reduce(
        (sum, c) => sum + Number(c.amount),
        0,
      );

      // Lợi nhuận ròng = Lợi nhuận gộp - Chi phí dịch vụ - Chi phí giao hàng - Chi phí vận hành
      const netProfit =
        grossProfit -
        totalFarmServiceCosts -
        totalDeliveryCosts -
        totalOperatingCosts;
      const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      // Top customers
      const topCustomers: TopCustomerProfitDto[] = Array.from(
        customerProfitMap.values(),
      )
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 10)
        .map((c) => ({
          customer_id: c.id,
          customer_name: c.name,
          total_invoices: c.invoiceCount,
          total_revenue: c.revenue,
          total_profit: c.profit,
          avg_margin:
            c.revenue > 0
              ? Math.round((c.profit / c.revenue) * 10000) / 100
              : 0,
        }));

      // Top products
      const topProducts: TopProductProfitDto[] = Array.from(
        productProfitMap.values(),
      )
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 10)
        .map((p) => ({
          product_id: p.id,
          product_name: p.name,
          quantity_sold: p.quantity,
          unit_name: p.unitName,
          total_revenue: p.revenue,
          total_profit: p.profit,
          margin:
            p.revenue > 0
              ? Math.round((p.profit / p.revenue) * 10000) / 100
              : 0,
        }));

      const summary: ProfitSummaryDto = {
        total_invoices: invoices.length,
        total_customers: customerProfitMap.size,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        cost_of_goods_sold: Math.round(totalCOGS * 100) / 100,
        supplier_rebate: Math.round(invoices.reduce((sum, invoice) =>
          sum + this.getInvoiceSupplierRebate(invoice, supplierRebates), 0) * 100) / 100,
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

      this.logger.log(
        `✅ Báo cáo mùa ${season.name}: Lợi nhuận ròng ${netProfit.toLocaleString()} đ`,
      );

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
        const invoiceIds = invoices.map((inv) => inv.id);

        const orConditions: any[] = [{ season_id: seasonId }];
        if (invoiceIds.length > 0) {
          orConditions.push({ invoice_id: In(invoiceIds) });
        }

        // Áp dụng bộ lọc cho từng nhánh OR
        const conditions = orConditions.map((cond) => {
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

      const totalCost = deliveries.reduce(
        (sum, d) => sum + Number(d.total_cost),
        0,
      );
      const totalDistance = deliveries.reduce(
        (sum, d) => sum + (Number(d.distance_km) || 0),
        0,
      );
      const avgCost = totalCost / deliveries.length;
      const costPerKm = totalDistance > 0 ? totalCost / totalDistance : 0;

      return {
        total_deliveries: deliveries.length,
        total_delivery_cost: Math.round(totalCost * 100) / 100,
        avg_cost_per_delivery: Math.round(avgCost * 100) / 100,
        total_distance:
          totalDistance > 0 ? Math.round(totalDistance * 100) / 100 : undefined,
        cost_per_km:
          costPerKm > 0 ? Math.round(costPerKm * 100) / 100 : undefined,
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
        customerWhere = customerWhere.map((w: any) => ({
          ...w,
          customer_id: customerId,
        }));
      } else if (customerNameParam) {
        const sanitized = QueryHelper.sanitizeKeyword(customerNameParam);
        customerWhere = customerWhere.map((w: any) => ({
          ...w,
          customer_name: Raw(
            (alias) =>
              `regexp_replace(unaccent(${alias}), '[^a-zA-Z0-9\\s]', '', 'g') ILIKE unaccent('%${sanitized}%')`,
          ),
        }));
      } else {
        throw new Error('Vui lòng cung cấp ID khách hàng hoặc Tên khách hàng');
      }

      const allInvoices = await this.salesInvoiceRepository.find({
        where: customerWhere,
        relations: ['items', 'items.product', 'season'],
        order: { sale_date: 'DESC', created_at: 'DESC' },
      });

      // Chưa có hóa đơn vẫn phải ghi nhận dịch vụ/quà/chi phí đã phát sinh.
      const customerWithoutInvoices = allInvoices.length === 0
        ? await this.customerRepository.findOne({ where: { id: customerId } })
        : null;
      if (allInvoices.length === 0 && !customerWithoutInvoices) {
        throw new NotFoundException(`Không tìm thấy khách hàng ID: ${customerId}`);
      }

      const firstInvoice = allInvoices[0]!;
      const batchCosts = await this.loadBatchCosts(allInvoices);
      const supplierRebates = await this.loadSupplierRebates(allInvoices);
      const customerName = firstInvoice?.customer_name || customerWithoutInvoices?.name || 'Khách hàng';
      const customerPhone = firstInvoice?.customer_phone || customerWithoutInvoices?.phone || undefined;
      const customerEmail = firstInvoice?.customer_email || customerWithoutInvoices?.email || undefined;

      // 2. Tính toán LIFETIME summary
      let lifetimeRevenue = 0;
      let lifetimeCost = 0;
      let lifetimeProfit = 0;

      for (const invoice of allInvoices) {
        // Explicitly cast to number to handle TypeORM decimal strings
        let finalAmount = Number(invoice.final_amount);
        let invoiceCOGS = 0;

        // Check for non-null/undefined. Note: cost_of_goods_sold can be "0.00" (string) or 0 (number) or null
        const batchInvoiceCost = this.getBatchInvoiceCOGS(invoice, batchCosts);
        if (batchInvoiceCost !== undefined) {
          invoiceCOGS = batchInvoiceCost;
        } else if (
          invoice.cost_of_goods_sold !== null &&
          invoice.cost_of_goods_sold !== undefined
        ) {
          // Dùng cost_of_goods_sold đã lưu (chắc chắn dùng cái này nếu có)
          invoiceCOGS = Number(invoice.cost_of_goods_sold);
        } else if (invoice.items && invoice.items.length > 0) {
          // Fallback only if null/undefined
          for (const item of invoice.items) {
            const avgCost = this.getInvoiceItemCostPrice(item);
            invoiceCOGS +=
              Number(item.base_quantity || item.quantity) * avgCost;
          }
        }

        invoiceCOGS -= this.getInvoiceSupplierRebate(invoice, supplierRebates);
        lifetimeRevenue += finalAmount;
        lifetimeCost += invoiceCOGS;
        lifetimeProfit += finalAmount - invoiceCOGS;
      }

      const lifetimeMargin =
        lifetimeRevenue > 0 ? (lifetimeProfit / lifetimeRevenue) * 100 : 0;

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
          ...where.map((w: any) => ({
            ...w,
            sale_date: Between(startDate, endDate),
          })),
          ...where.map((w: any) => ({
            ...w,
            sale_date: IsNull(),
            created_at: Between(startDate, endDate),
          })),
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
      const seasonMap = new Map<
        number,
        {
          id: number;
          name: string;
          invoices: number;
          revenue: number;
          cost: number;
          profit: number;
        }
      >();

      for (const invoice of invoices) {
        // Explicitly cast to number to handle TypeORM decimal strings
        let finalAmount = Number(invoice.final_amount);
        let invoiceCOGS = 0;

        // Check for non-null/undefined. Note: cost_of_goods_sold can be "0.00" (string) or 0 (number) or null
        const batchInvoiceCost = this.getBatchInvoiceCOGS(invoice, batchCosts);
        if (batchInvoiceCost !== undefined) {
          invoiceCOGS = batchInvoiceCost;
        } else if (
          invoice.cost_of_goods_sold !== null &&
          invoice.cost_of_goods_sold !== undefined
        ) {
          // Dùng cost_of_goods_sold đã lưu (chắc chắn dùng cái này nếu có)
          invoiceCOGS = Number(invoice.cost_of_goods_sold);
        } else if (invoice.items && invoice.items.length > 0) {
          // Fallback only if null/undefined
          for (const item of invoice.items) {
            const avgCost = this.getInvoiceItemCostPrice(item);
            invoiceCOGS +=
              Number(item.base_quantity || item.quantity) * avgCost;
          }
        }

        invoiceCOGS -= this.getInvoiceSupplierRebate(invoice, supplierRebates);
        const invoiceProfit = Number(invoice.final_amount) - invoiceCOGS;
        const invoiceMargin =
          invoice.final_amount > 0
            ? (invoiceProfit / invoice.final_amount) * 100
            : 0;

        // Lấy chi phí giao hàng cho hóa đơn này
        const deliveryLog = await this.deliveryLogRepository.findOne({
          where: { invoice_id: invoice.id },
        });
        const deliveryCost = deliveryLog
          ? Number(deliveryLog.total_cost || 0)
          : 0;

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

      const avgMargin =
        totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

      // 6. Season summary
      const seasonSummary: CustomerSeasonSummaryDto[] = Array.from(
        seasonMap.values(),
      )
        .sort((a, b) => b.profit - a.profit)
        .map((s) => ({
          season_id: s.id,
          season_name: s.name,
          total_invoices: s.invoices,
          total_revenue: Math.round(s.revenue * 100) / 100,
          total_cost: Math.round(s.cost * 100) / 100,
          total_profit: Math.round(s.profit * 100) / 100,
          avg_margin:
            s.revenue > 0
              ? Math.round((s.profit / s.revenue) * 10000) / 100
              : 0,
        }));

      this.logger.log(
        `✅ Báo cáo khách hàng #${customerId}: Lifetime ${allInvoices.length} đơn, Filtered ${invoices.length} đơn`,
      );

      // 7. Tính chi phí giao hàng, dịch vụ & vận hành cho khách hàng
      const farmServiceCosts = await this.farmServiceCostRepository.find({
        where: { customer_id: customerId },
      });
      // Khách vãng lai chỉ nhận chi phí gắn đúng các hóa đơn đã tìm được theo tên.
      const giftCustomerFilter = customerId > 0
        ? { customerId }
        : { invoiceIds: allInvoices.map((invoice) => invoice.id) };
      const farmGiftCosts = await this.getFarmGiftCostsBasic(giftCustomerFilter);

      const lifetimeServiceCost = farmServiceCosts.reduce(
        (sum, c) => sum + Number(c.amount),
        0,
      );
      const lifetimeGiftCost = farmGiftCosts.reduce(
        (sum, c) => sum + Number(c.amount),
        0,
      );
      const lifetimeFarmServiceCost = lifetimeServiceCost + lifetimeGiftCost;

      const operatingCostsResult = await this.operatingCostRepository.find({
        where: { customer_id: customerId },
      });
      const lifetimeOperatingCost = operatingCostsResult.reduce(
        (sum, c) => sum + Number(c.value),
        0,
      );

      const allInvoiceIds = allInvoices.map((inv) => inv.id);
      const allDeliveryLogs =
        allInvoiceIds.length > 0
          ? await this.deliveryLogRepository.find({
              where: { invoice_id: In(allInvoiceIds) },
            })
          : [];
      const lifetimeDeliveryCost = allDeliveryLogs.reduce(
        (sum, log) => sum + Number(log.total_cost || 0),
        0,
      );

      // Tính cho filtered invoices
      const filteredInvoiceIds = invoices.map((inv) => inv.id);
      const filteredDeliveryLogs = allDeliveryLogs.filter(
        (log) => log.invoice_id && filteredInvoiceIds.includes(log.invoice_id),
      );
      const filteredDeliveryCost = filteredDeliveryLogs.reduce(
        (sum, log) => sum + Number(log.total_cost || 0),
        0,
      );

      const filteredGiftCosts = seasonId || (startDate && endDate)
        ? await this.getFarmGiftCostsBasic({
            ...giftCustomerFilter,
            ...(seasonId ? { seasonId } : {}),
            ...(startDate && endDate ? { startDate, endDate } : {}),
          })
        : farmGiftCosts;
      // Tính cho filtered generic costs
      let filteredFarmServiceCost = 0;
      let filteredServiceCost = 0;
      let filteredGiftCost = 0;
      let filteredOperatingCost = 0;

      if (seasonId) {
        filteredServiceCost = farmServiceCosts
          .filter((c) => c.season_id === seasonId)
          .reduce((sum, c) => sum + Number(c.amount), 0);
        filteredGiftCost = filteredGiftCosts.reduce((sum, c) => sum + Number(c.amount), 0);

        filteredFarmServiceCost = filteredServiceCost + filteredGiftCost;

        filteredOperatingCost = operatingCostsResult
          .filter((c) => c.season_id === seasonId)
          .reduce((sum, c) => sum + Number(c.value), 0);
      } else if (startDate && endDate) {
        filteredServiceCost = farmServiceCosts
          .filter(
            (c) => c.expense_date >= startDate && c.expense_date <= endDate,
          )
          .reduce((sum, c) => sum + Number(c.amount), 0);
        filteredGiftCost = filteredGiftCosts.reduce((sum, c) => sum + Number(c.amount), 0);

        filteredFarmServiceCost = filteredServiceCost + filteredGiftCost;

        filteredOperatingCost = operatingCostsResult
          .filter(
            (c) => c.expense_date >= startDate && c.expense_date <= endDate,
          )
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
          avg_margin:
            s.revenue > 0
              ? Math.round((s.profit / s.revenue) * 10000) / 100
              : 0,
          delivery_costs: Math.round(filteredDeliveryCost * 100) / 100,
          farm_service_costs: Math.round(filteredFarmServiceCost * 100) / 100,
          service_costs: Math.round(filteredServiceCost * 100) / 100,
          gift_costs: Math.round(filteredGiftCost * 100) / 100,
          operating_costs: Math.round(filteredOperatingCost * 100) / 100,
          net_profit:
            Math.round(
              (s.profit -
                filteredDeliveryCost -
                filteredFarmServiceCost -
                filteredOperatingCost) *
                100,
            ) / 100,
        };
      }

      const serviceBreakdown = (
        seasonId
          ? farmServiceCosts.filter((c) => c.season_id === seasonId)
          : startDate && endDate
            ? farmServiceCosts.filter(
                (c) => c.expense_date >= startDate && c.expense_date <= endDate,
              )
            : farmServiceCosts
      ).map((item) => ({
        type: 'service',
        name: item.name,
        amount: Number(item.amount),
        date: item.expense_date,
        notes: item.notes,
      }));

      const giftBreakdown = filteredGiftCosts.map((item) => ({
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
          net_profit:
            Math.round(
              (lifetimeProfit -
                lifetimeDeliveryCost -
                lifetimeFarmServiceCost -
                lifetimeOperatingCost) *
                100,
            ) / 100,
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
          net_profit:
            Math.round(
              (totalProfit -
                filteredDeliveryCost -
                filteredFarmServiceCost -
                filteredOperatingCost) *
                100,
            ) / 100,
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
        relations: [
          'items',
          'items.product',
          'customer',
          'season',
          'rice_crop',
        ],
        order: { sale_date: 'DESC', created_at: 'DESC' },
      });

      if (invoices.length === 0) {
        // Nếu không có hóa đơn, vẫn trả về thông tin ruộng lúa với số liệu bằng 0
        const riceCrop = await this.riceCropRepository.findOne({
          where: { id: riceCropId },
          relations: ['customer', 'season'],
        });

        if (!riceCrop) {
          throw new NotFoundException(
            `Không tìm thấy mảnh ruộng ID: ${riceCropId}`,
          );
        }

        // Lấy chi phí dịch vụ/quà tặng của cửa hàng dành cho ruộng lúa này (quà tặng tự động...)
        const farmServiceCosts = await this.farmServiceCostRepository.find({
          where: { rice_crop_id: riceCropId },
        });
        const totalFarmServiceCosts = farmServiceCosts.reduce(
          (sum, cost) => sum + Number(cost.amount),
          0,
        );
        const giftCosts = await this.getFarmGiftCostsBasic({ riceCropId });
        const totalGiftCosts = giftCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);

        // Lấy chi phí vận hành dành cho ruộng lúa này (nếu có gán trực tiếp)
        const operatingCosts = await this.operatingCostRepository.find({
          where: { rice_crop_id: riceCropId },
        });
        const totalOperatingCosts = operatingCosts.reduce(
          (sum, cost) => sum + Number(cost.value),
          0,
        );

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
            farm_service_costs: totalFarmServiceCosts + totalGiftCosts,
            service_costs: totalFarmServiceCosts,
            gift_costs: totalGiftCosts,
            operating_costs: totalOperatingCosts,
            net_profit: -(totalFarmServiceCosts + totalGiftCosts + totalOperatingCosts),
            net_margin: 0,
          },
          farm_service_costs_breakdown: [
            ...farmServiceCosts.map((c) => ({
              type: 'service',
              name: c.name,
              amount: Number(c.amount),
              date: c.expense_date,
              notes: c.notes,
              source: c.source,
            })),
            ...giftCosts.map((c) => ({
              type: c.source || 'gift',
              name: c.name,
              amount: Number(c.amount),
              date: c.gift_date,
              notes: c.notes,
              source: c.source,
            })),
          ],
          operating_costs_breakdown: operatingCosts.map((c) => ({
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
      const batchCosts = await this.loadBatchCosts(invoices);
      const supplierRebates = await this.loadSupplierRebates(invoices);
      const fieldName = firstInvoice.rice_crop?.field_name || 'Unknown';
      const customerName =
        firstInvoice.customer?.name || firstInvoice.customer_name;
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
            `final_amount = ${invoice.final_amount}`,
        );

        const batchInvoiceCost = this.getBatchInvoiceCOGS(invoice, batchCosts);
        if (batchInvoiceCost !== undefined) {
          invoiceCOGS = batchInvoiceCost;
        } else if (
          invoice.cost_of_goods_sold !== null &&
          invoice.cost_of_goods_sold !== undefined
        ) {
          // Dùng cost_of_goods_sold đã lưu (có thể = 0 nếu đã trả hàng)
          invoiceCOGS = Number(invoice.cost_of_goods_sold);
          this.logger.log(`  ✅ Dùng cost_of_goods_sold: ${invoiceCOGS}`);
        } else if (invoice.items && invoice.items.length > 0) {
          // Fallback: Tính từ average_cost_price nếu cost_of_goods_sold = null
          for (const item of invoice.items) {
            const avgCost = this.getInvoiceItemCostPrice(item);
            invoiceCOGS +=
              Number(item.base_quantity || item.quantity) * avgCost;
          }
          this.logger.log(`  ⚠️ Fallback tính lại: ${invoiceCOGS}`);
        }

        invoiceCOGS -= this.getInvoiceSupplierRebate(invoice, supplierRebates);
        const invoiceProfit = Number(invoice.final_amount) - invoiceCOGS;
        const invoiceMargin =
          invoice.final_amount > 0
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
        where: { rice_crop_id: riceCropId },
      });
      const giftCosts = await this.getFarmGiftCostsBasic({ riceCropId });

      const totalServiceCosts = serviceCosts.reduce(
        (sum, cost) => sum + Number(cost.amount),
        0,
      );
      const totalGiftCosts = giftCosts.reduce(
        (sum, cost) => sum + Number(cost.amount),
        0,
      );
      const totalFarmServiceCosts = totalServiceCosts + totalGiftCosts;

      const farmServiceCostsBreakdown = [
        ...serviceCosts.map((item) => ({
          type: 'service',
          source: 'manual', // Tương thích ngược với UI cũ dùng source làm loại
          name: item.name,
          amount: Number(item.amount),
          date: item.expense_date,
          notes: item.notes,
        })),
        ...giftCosts.map((item) => ({
          type: item.source || 'gift',
          source: item.source || 'gift',
          name: item.name,
          amount: Number(item.amount),
          date: item.gift_date,
          notes: item.notes,
        })),
      ];

      const operatingCosts = await this.operatingCostRepository.find({
        where: { rice_crop_id: riceCropId },
      });
      const totalOperatingCosts = operatingCosts.reduce(
        (sum, cost) => sum + Number(cost.value),
        0,
      );

      // Tính tổng chi phí giao hàng cho tất cả hóa đơn của ruộng lúa
      const invoiceIds = invoices.map((inv) => inv.id);
      let totalDeliveryCost = 0;
      if (invoiceIds.length > 0) {
        const deliveryLogs = await this.deliveryLogRepository.find({
          where: { invoice_id: In(invoiceIds) },
        });
        totalDeliveryCost = deliveryLogs.reduce(
          (sum, log) => sum + Number(log.total_cost || 0),
          0,
        );
      }

      // 4. Tính Net Profit của vụ lúa (bao gồm chi phí dịch vụ, vận hành và giao hàng)
      const calculatedNetProfit =
        totalProfit -
        totalFarmServiceCosts -
        totalOperatingCosts -
        totalDeliveryCost;

      const avgMargin =
        totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0; // Đây là Gross Margin trung bình

      this.logger.log(
        `✅ Báo cáo mảnh ruộng #${riceCropId}: Gross ${totalProfit}, Service Cost ${totalFarmServiceCosts}, Delivery ${totalDeliveryCost}, Net ${calculatedNetProfit}`,
      );

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
          gift_value_from_invoices:
            Math.round(totalGiftFromInvoices * 100) / 100,

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
          net_margin:
            totalRevenue > 0
              ? Math.round((calculatedNetProfit / totalRevenue) * 10000) / 100
              : 0,
        },
        farm_service_costs_breakdown: farmServiceCostsBreakdown,
        operating_costs_breakdown: operatingCosts.map((c) => ({
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
      this.logger.log(
        `📊 Báo cáo lợi nhuận từ ${startDate.toISOString()} đến ${endDate.toISOString()}`,
      );
      let allowedProductIds: Set<number> | null = null;
      if (filterByReceiptDate) {
        this.logger.log(
          `🔍 Chỉ lấy sản phẩm có hóa đơn nhập từ ${filterByReceiptDate}`,
        );
        const receiptItemRepo =
          this.salesInvoiceRepository.manager.getRepository(
            InventoryReceiptItem,
          );
        const productsWithReceipt = await receiptItemRepo
          .createQueryBuilder('item')
          .innerJoin('item.receipt', 'receipt')
          .select('DISTINCT item.product_id', 'product_id')
          .where('receipt.bill_date >= :filterDate', {
            filterDate: filterByReceiptDate,
          })
          .andWhere('item.taxable_quantity > 0') // BẮT BUỘC: Phải có số lượng thuế trong năm 2026
          .andWhere("receipt.status IN ('approved', 'completed')")
          .getRawMany();

        allowedProductIds = new Set(
          productsWithReceipt.map((p) => Number(p.product_id)),
        );
        this.logger.log(
          `🔍 Tìm thấy ${allowedProductIds.size} sản phẩm thỏa mãn điều kiện nhập hàng.`,
        );
      }

      // 1. Lấy tất cả hóa đơn trong khoảng thời gian (chỉ lấy confirmed và paid, bỏ draft/cancelled/refunded)
      const invoices = await this.salesInvoiceRepository.find({
        where: [
          {
            sale_date: Between(startDate, endDate),
            status: SalesInvoiceStatus.CONFIRMED,
          },
          {
            sale_date: Between(startDate, endDate),
            status: SalesInvoiceStatus.PAID,
          },
          {
            sale_date: IsNull(),
            created_at: Between(startDate, endDate),
            status: SalesInvoiceStatus.CONFIRMED,
          },
          {
            sale_date: IsNull(),
            created_at: Between(startDate, endDate),
            status: SalesInvoiceStatus.PAID,
          },
        ],
        relations: ['items', 'items.product'],
        order: {
          [sortBy === 'total_amount' ? 'final_amount' : sortBy]: sortOrder,
          created_at: 'DESC',
        } as any,
      });

      const itemIds = invoices.flatMap((invoice) => (invoice.items || []).map((item) => item.id));
      const [stockAllocations, approvedReturns] = itemIds.length
        ? await Promise.all([
            this.salesInvoiceRepository.manager.getRepository(SalesInvoiceItemStockAllocation).find({
              where: { sales_invoice_item_id: In(itemIds) },
              relations: ['receipt_item', 'inventory_batch', 'inventory_batch.receipt_item'],
              withDeleted: true,
              order: { id: 'ASC' },
            }),
            this.salesInvoiceRepository.manager.getRepository(SalesReturnItem).find({
              where: { sales_return: { invoice_id: In(invoices.map((invoice) => invoice.id)), status: SalesReturnStatus.APPROVED } },
              relations: ['sales_return'],
            }),
          ])
        : [[], []];
      const batchCosts = this.buildBatchCosts(invoices, stockAllocations, approvedReturns);
      const supplierRebates = await this.loadSupplierRebates(invoices, stockAllocations, approvedReturns);
      const inboundFees = await this.loadPriceTypeInboundFees(invoices, stockAllocations, approvedReturns);
      const allocationsByItem = new Map<number, SalesInvoiceItemStockAllocation[]>();
      for (const allocation of stockAllocations) {
        const rows = allocationsByItem.get(allocation.sales_invoice_item_id) || [];
        rows.push(allocation);
        allocationsByItem.set(allocation.sales_invoice_item_id, rows);
      }
      const returnsByItem = new Map<string, SalesReturnItem[]>();
      for (const returned of approvedReturns) {
        const key = this.getReturnStatsKey(
          returned.sales_return!.invoice_id,
          returned.sales_invoice_item_id ? { id: returned.sales_invoice_item_id } : undefined,
          returned.product_id,
        );
        const rows = returnsByItem.get(key) || [];
        rows.push(returned);
        returnsByItem.set(key, rows);
      }

      const invoiceDtoList: PeriodInvoiceDto[] = [];
      const invoiceReportRows: Array<{
        invoice: PeriodInvoiceDto;
        totalRevenue: number;
        revenueWithInvoice: number;
        revenueNoInvoice: number;
        taxableRevenue: number;
        totalCOGS: number;
        cogsWithInvoice: number;
        cogsNoInvoice: number;
      }> = [];

      // 2. Tính toán doanh thu và giá vốn (phân loại theo has_input_invoice)
      let totalRevenue = 0;
      let revenueWithInvoice = 0;
      let revenueNoInvoice = 0;
      let taxableRevenue = 0;

      let totalCOGS = 0;
      let cogsWithInvoice = 0;
      let cogsNoInvoice = 0;

      for (const invoice of invoices) {
        const invoiceItemsGross = (invoice.items || []).reduce(
          (sum, item) => sum + Number(item.total_price),
          0,
        );
        const itemsDto: PeriodInvoiceItemDto[] = [];
        let invoiceRevenue = 0;
        let invoiceRevenueWithInvoice = 0;
        let invoiceRevenueNoInvoice = 0;
        let invoiceTaxableRevenue = 0;
        let invoiceCOGS = 0;
        let invoiceCOGSWithInvoice = 0;
        let invoiceCOGSNoInvoice = 0;

        for (const item of invoice.items || []) {
          // Lọc theo ID sản phẩm nếu có yêu cầu
          if (allowedProductIds && !allowedProductIds.has(item.product_id)) {
            continue;
          }

          const itemGrossPrice = Number(item.total_price);
          const conversionFactor = Number(item.conversion_factor || 1);
          const itemTaxPrice = Number(item.tax_selling_price || 0);
          const productTaxPrice = Number(item.product?.tax_selling_price || 0);
          // Trước khi lưu snapshot theo đơn vị bán, một số hóa đơn cũ đã lưu
          // trực tiếp số thuế và giá thuế theo đơn vị gốc.
          const legacyBaseTaxSnapshot =
            conversionFactor !== 1 &&
            (Number(item.taxable_quantity || 0) > Number(item.quantity || 0) + 0.0001 ||
              (itemTaxPrice > 0 &&
                productTaxPrice > 0 &&
                Math.abs(itemTaxPrice - productTaxPrice) < 0.000001));
          const itemReturns = [
            ...(returnsByItem.get(this.getReturnStatsKey(invoice.id, item)) || []),
            ...(returnsByItem.get(this.getReturnStatsKey(invoice.id, undefined, item.product_id)) || []),
          ];
          const returnStats = itemReturns.reduce((stats, returned) => ({
            returnedBaseQuantity: stats.returnedBaseQuantity + Number(returned.base_quantity ?? Number(returned.quantity) * Number(returned.conversion_factor ?? 1)),
            returnedAmount: stats.returnedAmount + Number(returned.total_price || 0),
          }), { returnedBaseQuantity: 0, returnedAmount: 0 });

          // Phân bổ doanh thu thực tế (đã trừ trả hàng) cho item này
          const invoiceDiscountShare =
            invoiceItemsGross > 0
              ? Number(invoice.discount_amount || 0) *
                (itemGrossPrice / invoiceItemsGross)
              : 0;
          const itemNetRevenue = Math.max(
            0,
            itemGrossPrice - invoiceDiscountShare - returnStats.returnedAmount,
          );

          // Phân bổ giá vốn thực tế (đã trừ trả hàng) cho item này
          const itemActualCOGS = this.getItemNetCOGS(item, returnStats.returnedBaseQuantity, batchCosts, supplierRebates, inboundFees);

          invoiceRevenue += itemNetRevenue;
          invoiceCOGS += itemActualCOGS;

          const originalTaxableQty = legacyBaseTaxSnapshot
            ? Number(item.taxable_quantity || 0)
            : Number(item.taxable_quantity || 0) * conversionFactor;
          const originalBaseQty = Number(
            item.base_quantity ?? Number(item.quantity || 0) * conversionFactor,
          );
          const currentBaseQtySold = Math.max(
            0,
            originalBaseQty - returnStats.returnedBaseQuantity,
          );
          let taxPricing;
          try {
            if (itemReturns.some((returned) => !returned.sales_invoice_item_id) &&
              (invoice.items || []).filter((row) => row.product_id === item.product_id).length > 1) {
              throw new Error('Phiếu trả không xác định được dòng bán của sản phẩm xuất hiện nhiều lần.');
            }
            taxPricing = calculateTaxReportPricing({
              baseQuantity: originalBaseQty,
              legacyTaxableQuantity: originalTaxableQty,
              productPrice: productTaxPrice,
              allocations: (allocationsByItem.get(item.id) || []).map((allocation) => {
                const receipt = allocation.receipt_item || allocation.inventory_batch?.receipt_item;
                if (receipt && (receipt.product_id !== item.product_id ||
                  (allocation.receipt_item_id && receipt.id !== allocation.receipt_item_id) ||
                  (allocation.receipt_item_id && allocation.inventory_batch?.receipt_item_id &&
                    allocation.receipt_item_id !== allocation.inventory_batch.receipt_item_id))) {
                  throw new Error('Phiếu nhập gốc không khớp sản phẩm/lô đã bán.');
                }
                const receiptFactor = Number(receipt?.conversion_factor ?? 1);
                const receiptQuantity = Number(receipt?.base_quantity ?? Number(receipt?.quantity ?? 0) * receiptFactor);
                const receiptTax = Number(receipt?.taxable_quantity ?? 0) * receiptFactor;
                const batch = allocation.inventory_batch;
                // Lô LOT gốc nhập toàn bộ có/không thuế xác định được phần xuất.
                // Không suy từ phiếu nhập cho các lô tạo lại bởi hủy/trả hàng.
                const originalReceiptBatch = !!receipt && receipt.taxable_quantity != null &&
                  Number.isFinite(receiptFactor) && receiptFactor > 0 && batch?.receipt_item_id === receipt.id &&
                  !!batch.code?.startsWith('LOT-') && batch.code === receipt.batch_number && receiptQuantity > 0 &&
                  Math.abs(Number(batch.original_quantity) - receiptQuantity) < 0.0001;
                return {
                  batchId: allocation.inventory_batch_id ?? null,
                  receiptItemId: allocation.receipt_item_id ?? allocation.inventory_batch?.receipt_item_id ?? null,
                  quantity: Number(allocation.quantity),
                  taxableQuantity: allocation.taxable_quantity == null ? null : Number(allocation.taxable_quantity),
                  receiptPrice: receipt?.tax_selling_price == null ? null : Number(receipt.tax_selling_price),
                  receiptFactor,
                  receiptTaxState: originalReceiptBatch && receiptTax === 0 ? 'none' as const
                    : originalReceiptBatch && Math.abs(receiptTax - receiptQuantity) < 0.0001 ? 'all' as const : 'unknown' as const,
                };
              }),
              returns: itemReturns.map((returned): TaxPriceReturn => ({
                baseQuantity: Number(returned.base_quantity ?? Number(returned.quantity) * Number(returned.conversion_factor ?? 1)),
                allocations: Array.isArray(returned.stock_allocations) ? returned.stock_allocations.map((allocation) => ({
                  ...allocation, quantity: Number(allocation.quantity),
                  taxableQuantity: allocation.taxableQuantity == null ? NaN : Number(allocation.taxableQuantity),
                })) : null,
              })),
            });
          } catch (error) {
            throw new BusinessLogicException(
              `Không tính được khai thuế hóa đơn ${invoice.code}, dòng #${item.id} (${item.product_name || item.product?.name || item.product_id}): ${error instanceof Error ? error.message : 'Thiếu dữ liệu nguồn lô.'}`,
              'TAX_REPORT_SOURCE_INCOMPLETE',
            );
          }
          const taxableQty = taxPricing.taxableQuantity;

          // Tỷ lệ khai thuế trên lượng hàng "thực tế còn lại" sau khi trả
          // Nếu bán 10 trả 5, còn lại 5. Nếu 5 bao đó đều có thuế thì tỷ lệ là 100% (1)
          const taxableRatio =
            currentBaseQtySold > 0
              ? Math.min(1, taxableQty / currentBaseQtySold)
              : 0;

          // Cộng giá trị từng lô theo GBKT nhập, lô thiếu giá dùng GBKT sản phẩm.
          const effectiveTaxPrice = taxPricing.taxSellingPrice;
          const itemTaxableTotalAmount = taxPricing.taxableAmount;

          if (taxableQty > 0) {
            invoiceRevenueWithInvoice += itemNetRevenue * taxableRatio;
            const lotTaxableCost = batchCosts.get(Number(item.id))?.taxable;
            invoiceCOGSWithInvoice += lotTaxableCost != null
              ? Math.min(itemActualCOGS, Math.max(0, lotTaxableCost))
              : itemActualCOGS * taxableRatio;
            invoiceTaxableRevenue += itemTaxableTotalAmount;
          }

          if (currentBaseQtySold > taxableQty) {
            const nonTaxableRatio = Math.max(0, 1 - taxableRatio);
            invoiceRevenueNoInvoice += itemNetRevenue * nonTaxableRatio;
            const lotTaxableCost = batchCosts.get(Number(item.id))?.taxable;
            invoiceCOGSNoInvoice += lotTaxableCost != null
              ? itemActualCOGS - Math.min(itemActualCOGS, Math.max(0, lotTaxableCost))
              : itemActualCOGS * nonTaxableRatio;
          }

          // Thêm vào danh sách item của DTO
          itemsDto.push({
            product_trade_name:
              item.product_name || item.product?.trade_name || 'Không xác định',
            product_name:
              item.product?.name || item.product_name || 'Không xác định',
            quantity: currentBaseQtySold,
            unit_name: item.product?.unit?.name || item.unit_name || 'Đơn vị',
            unit_price: Number(item.unit_price),
            total_price: itemNetRevenue,
            has_input_invoice: taxableQty > 0,
            taxable_quantity: taxableQty,
            tax_selling_price: effectiveTaxPrice,
            taxable_total_amount: itemTaxableTotalAmount,
          });
        }

        // Thêm vào danh sách hóa đơn của DTO nếu có ít nhất 1 item thỏa mãn
        if (itemsDto.length > 0) {
          const invoiceDto = {
            invoice_id: invoice.id,
            invoice_code: invoice.code,
            customer_name: invoice.customer_name,
            sale_date: invoice.sale_date || invoice.created_at,
            total_amount: invoiceRevenue,
            items: itemsDto,
          };
          invoiceDtoList.push(invoiceDto);
          invoiceReportRows.push({
            invoice: invoiceDto,
            totalRevenue: invoiceRevenue,
            revenueWithInvoice: invoiceRevenueWithInvoice,
            revenueNoInvoice: invoiceRevenueNoInvoice,
            taxableRevenue: invoiceTaxableRevenue,
            totalCOGS: invoiceCOGS,
            cogsWithInvoice: invoiceCOGSWithInvoice,
            cogsNoInvoice: invoiceCOGSNoInvoice,
          });
        }
      }

      // 3. Lấy chi phí vận hành cửa hàng
      const operatingCostsResult = await this.operatingCostRepository.find({
        where: {
          expense_date: Between(startDate, endDate),
        },
      });
      const totalOperatingCosts = operatingCostsResult.reduce(
        (sum, cost) => sum + Number(cost.value),
        0,
      );

      // 4. Lấy chi phí dịch vụ/quà tặng
      const serviceCostsPeriod = await this.farmServiceCostRepository.find({
        where: {
          expense_date: Between(startDate, endDate),
        },
      });
      const giftCostsPeriod = await this.getFarmGiftCostsBasic({
        startDate,
        endDate,
      });

      const totalServiceCostsPeriod = serviceCostsPeriod.reduce(
        (sum, cost) => sum + Number(cost.amount),
        0,
      );
      const totalGiftCostsPeriod = giftCostsPeriod.reduce(
        (sum, cost) => sum + Number(cost.amount),
        0,
      );
      const totalStoreServiceCosts =
        totalServiceCostsPeriod + totalGiftCostsPeriod;

      // 5. Thống kê giao hàng (tùy chọn, nếu cần tích hợp sâu hơn)
      const deliveryStats = await this.getSeasonDeliveryStats(
        startDate,
        endDate,
      );
      const totalDeliveryCosts = deliveryStats?.total_delivery_cost || 0;

      // 6. Lọc danh sách hóa đơn theo yêu cầu (nếu Filter không phải 'all')
      let filteredRows = invoiceReportRows;
      if (taxableFilter === 'yes') {
        filteredRows = invoiceReportRows.filter((row) =>
          row.invoice.items.some((item) => Number(item.taxable_quantity) > 0),
        );
      } else if (taxableFilter === 'no') {
        filteredRows = invoiceReportRows.filter((row) =>
          row.invoice.items.every(
            (item) => Number(item.taxable_quantity) === 0,
          ),
        );
      }
      const filteredInvoices = filteredRows.map((row) => row.invoice);
      const allRowsRevenue = invoiceReportRows.reduce(
        (sum, row) => sum + row.totalRevenue,
        0,
      );

      totalRevenue = filteredRows.reduce(
        (sum, row) => sum + row.totalRevenue,
        0,
      );
      revenueWithInvoice = filteredRows.reduce(
        (sum, row) => sum + row.revenueWithInvoice,
        0,
      );
      revenueNoInvoice = filteredRows.reduce(
        (sum, row) => sum + row.revenueNoInvoice,
        0,
      );
      taxableRevenue = filteredRows.reduce(
        (sum, row) => sum + row.taxableRevenue,
        0,
      );
      totalCOGS = filteredRows.reduce((sum, row) => sum + row.totalCOGS, 0);
      cogsWithInvoice = filteredRows.reduce(
        (sum, row) => sum + row.cogsWithInvoice,
        0,
      );
      cogsNoInvoice = filteredRows.reduce(
        (sum, row) => sum + row.cogsNoInvoice,
        0,
      );

      // 7. Tính toán lợi nhuận theo đúng tập hóa đơn sau lọc
      const grossProfit = totalRevenue - totalCOGS;
      const sharedCostAllocationRatio =
        taxableFilter === 'all' || allRowsRevenue <= 0
          ? 1
          : totalRevenue / allRowsRevenue;
      const allocatedOperatingCosts =
        totalOperatingCosts * sharedCostAllocationRatio;
      const allocatedStoreServiceCosts =
        totalStoreServiceCosts * sharedCostAllocationRatio;
      const allocatedDeliveryCosts =
        totalDeliveryCosts * sharedCostAllocationRatio;
      const netProfit =
        grossProfit -
        allocatedOperatingCosts -
        allocatedStoreServiceCosts -
        allocatedDeliveryCosts;

      const summary: PeriodSummaryDto = {
        total_revenue: Math.round(totalRevenue),
        revenue_with_invoice: Math.round(revenueWithInvoice),
        revenue_no_invoice: Math.round(revenueNoInvoice),
        taxable_revenue: Math.round(taxableRevenue), // Doanh thu khai báo thuế = số lượng * giá bán khai thuế (của sản phẩm có hóa đơn đầu vào)
        total_cogs: Math.round(totalCOGS),
        cogs_with_invoice: Math.round(cogsWithInvoice),
        cogs_no_invoice: Math.round(cogsNoInvoice),
        gross_profit: Math.round(grossProfit),
        total_operating_costs: Math.round(allocatedOperatingCosts),
        total_gift_costs: Math.round(
          allocatedStoreServiceCosts + allocatedDeliveryCosts,
        ), // Gộp phí giao hàng vào chi phí dịch vụ/quà tặng
        net_profit: Math.round(netProfit),
        invoice_count: filteredInvoices.length,
      };

      return {
        summary,
        invoices: filteredInvoices,
        start_date: startDate,
        end_date: endDate,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `❌ Lỗi báo cáo doanh thu theo kỳ: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }
}
