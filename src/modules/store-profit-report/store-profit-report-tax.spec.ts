import { StoreProfitReportService } from './store-profit-report.service';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';
import { ProductCostingMethod } from '../../entities/products.entity';
import { PromotionRewardReservation } from '../../entities/promotion-reward-reservation.entity';

describe('period tax report after customer returns', () => {
  it('cộng dồn lượng trả theo lô trước khi làm tròn giá vốn và giá vốn thuế', () => {
    const service = Object.create(StoreProfitReportService.prototype) as StoreProfitReportService;
    const costs = (service as any).buildBatchCosts([{ items: [{ id: 1, base_quantity: 0.03,
      costing_method_snapshot: ProductCostingMethod.BY_BATCH }] }], [{
      sales_invoice_item_id: 1, inventory_batch_id: 101, quantity: 0.03,
      taxable_quantity: 0.03, unit_cost: 1, total_cost: 0.03,
    }], [1, 2].map((id) => ({ id, sales_invoice_item_id: 1, base_quantity: 0.005,
      stock_allocations: [{ sourceBatchId: 101, quantity: 0.005, taxableQuantity: 0.005 }],
    })));
    expect(costs.get(1).returned).toBeCloseTo(0.01, 2);
    expect(costs.get(1).taxable).toBeCloseTo(0.02, 2);
  });

  it('khách hàng và ruộng chưa bán hàng vẫn phải trừ chi phí đã phát sinh', async () => {
    const service = Object.create(StoreProfitReportService.prototype) as StoreProfitReportService;
    Object.assign(service, {
      logger: { log: jest.fn(), error: jest.fn() },
      salesInvoiceRepository: { find: jest.fn().mockResolvedValue([]) },
      customerRepository: { findOne: jest.fn().mockResolvedValue({ id: 1, name: 'Khách' }) },
      riceCropRepository: { findOne: jest.fn().mockResolvedValue({ id: 1, field_name: 'Ruộng' }) },
      farmServiceCostRepository: { find: jest.fn().mockResolvedValue([{ amount: 20 }]) },
      operatingCostRepository: { find: jest.fn().mockResolvedValue([{ value: 10 }]) },
      getFarmGiftCostsBasic: jest.fn().mockResolvedValue([{ amount: 5 }]),
    });
    const customer = await service.getCustomerProfitReport(1);
    expect(customer.summary.net_profit).toBe(-35);
    expect(customer.lifetime_summary.net_profit).toBe(-35);
    const field = await service.getRiceCropProfitReport(1);
    expect(field.summary.gift_costs).toBe(5);
    expect(field.summary.net_profit).toBe(-35);
  });
  it('đọc đủ quà hóa đơn và campaign đã trao, không cộng trùng phiếu chi hóa đơn', async () => {
    const giftQuery = {
      select: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { id: 1, amount: 30, source: 'manually_awarded' },
        { id: 2, amount: 50, source: 'gift_from_invoice', invoice_id: 7 },
      ]),
    };
    const campaignRepo = { find: jest.fn().mockResolvedValue([
      { id: 8, reward_name: 'Quà', reward_value: 20, customer_id: 2, issued_at: new Date('2026-10-10') },
    ]) };
    const invoiceRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 7, code: 'INV-7', gift_value: 50, customer_id: 2, season_id: 1, sale_date: new Date('2026-10-10') },
      ]),
      manager: { getRepository: jest.fn((entity) => {
        if (entity !== PromotionRewardReservation) throw new Error('Sai repository');
        return campaignRepo;
      }) },
    };
    const service = Object.create(StoreProfitReportService.prototype) as StoreProfitReportService;
    Object.assign(service, {
      farmGiftCostRepository: { createQueryBuilder: jest.fn().mockReturnValue(giftQuery) },
      salesInvoiceRepository: invoiceRepo,
      seasonRepository: { findOne: jest.fn().mockResolvedValue({ start_date: '2026-10-01', end_date: '2026-10-31' }) },
    });

    const gifts = await (service as any).getFarmGiftCostsBasic({ seasonId: 1, customerId: 2 });
    expect(gifts.reduce((sum: number, gift: { amount: number }) => sum + gift.amount, 0)).toBe(100);
    expect(invoiceRepo.find.mock.calls[0]?.[0].where.map((row: { status: string }) => row.status))
      .toEqual(['confirmed', 'paid']);
    expect(campaignRepo.find).toHaveBeenCalledWith({ where: expect.objectContaining({ status: 'issued', customer_id: 2 }) });
    campaignRepo.find.mockClear();
    await (service as any).getFarmGiftCostsBasic({ riceCropId: 3 });
    expect(campaignRepo.find).not.toHaveBeenCalled();
    await (service as any).getFarmGiftCostsBasic({ invoiceIds: [7] });
    expect(giftQuery.andWhere).toHaveBeenCalledWith('gift.invoice_id IN (:...invoiceIds)', { invoiceIds: [7] });
    expect(campaignRepo.find).not.toHaveBeenCalled();
  });
  it.each([
    { returnedBase: 0, expectedTaxBase: 50, revenue: 100000, receiptPrice: 100000, productPrice: 999, hasAllocations: true },
    { returnedBase: 25, expectedTaxBase: 25, revenue: 50000, receiptPrice: 100000, productPrice: 999, hasAllocations: true },
    { returnedBase: 75, expectedTaxBase: 0, revenue: 0, receiptPrice: 100000, productPrice: 999, hasAllocations: true },
    { returnedBase: 0, expectedTaxBase: 50, revenue: 125000, receiptPrice: 0, productPrice: 2500, hasAllocations: true },
    { returnedBase: 0, expectedTaxBase: 50, revenue: 125000, receiptPrice: 0, productPrice: 2500, hasAllocations: false },
  ])('prices the report with $receiptPrice receipt GBKT, allocations=$hasAllocations and $returnedBase returned kg', async ({ returnedBase, expectedTaxBase, revenue, receiptPrice, productPrice, hasAllocations }) => {
    const item = {
      id: 1, product_id: 10, quantity: 2, base_quantity: 100, conversion_factor: 50,
      taxable_quantity: 1, tax_selling_price: '777777', unit_price: 150000,
      total_price: 300000, cost_price: 1000,
      product: { name: 'Test', unit: { name: 'kg' }, tax_selling_price: String(productPrice) },
    };
    const service = Object.create(StoreProfitReportService.prototype) as StoreProfitReportService;
    const allocationRepo = { find: jest.fn().mockResolvedValue(hasAllocations ? [{
      sales_invoice_item_id: 1, product_id: 10, inventory_batch_id: 8, receipt_item_id: 2,
      quantity: 100, taxable_quantity: 50,
      receipt_item: { id: 2, product_id: 10, tax_selling_price: receiptPrice, conversion_factor: 50 },
    }] : []) };
    const returnRepo = { find: jest.fn().mockResolvedValue(returnedBase > 0 ? [{
      sales_return: { invoice_id: 7 }, sales_invoice_item_id: 1, product_id: 10,
      base_quantity: returnedBase, stock_allocations: [{
        batchId: 99, sourceBatchId: 8, quantity: returnedBase, taxableQuantity: Math.min(returnedBase, 50),
      }],
    }] : []) };
    const write = jest.fn();
    const findInvoices = jest.fn().mockResolvedValue([{ id: 7, code: 'TEST', sale_date: new Date('2026-10-01'), discount_amount: 0, items: [item] }]);
    const manager = { save: write, update: write, getRepository: jest.fn((entity) => entity === SalesInvoiceItemStockAllocation ? allocationRepo : returnRepo) };
    Object.assign(service, {
      logger: { log: jest.fn(), error: jest.fn() },
      salesInvoiceRepository: { manager, find: findInvoices },
      operatingCostRepository: { find: jest.fn().mockResolvedValue([]) },
      farmServiceCostRepository: { find: jest.fn().mockResolvedValue([]) },
      getTaxRevenueCutoverDate: jest.fn().mockResolvedValue({ cutover_date: '2026-01-01' }),
      getApprovedReturnStats: jest.fn().mockResolvedValue(new Map([
        ['7:item:1', { returnedQuantity: returnedBase / 50, returnedBaseQuantity: returnedBase, returnedAmount: returnedBase * 3000 }],
      ])),
      getFarmGiftCostsBasic: jest.fn().mockResolvedValue([]),
      getSeasonDeliveryStats: jest.fn().mockResolvedValue({ total_delivery_cost: 0 }),
    });
    const report = await service.getPeriodProfitReport(new Date('2026-10-01'), new Date('2026-10-31'));
    expect(report.summary.taxable_revenue).toBe(revenue);
    expect(report.invoices[0]?.items[0]).toMatchObject({
      quantity: 100 - returnedBase, taxable_quantity: expectedTaxBase,
      tax_selling_price: expectedTaxBase > 0 ? (receiptPrice > 0 && hasAllocations ? receiptPrice / 50 : productPrice) : 0, taxable_total_amount: revenue,
    });
    expect(item.taxable_quantity).toBe(1);
    expect(write).not.toHaveBeenCalled();
    expect(item.tax_selling_price).toBe('777777');
    const invoiceQuery = findInvoices.mock.calls[0]?.[0];
    const queriedStatuses = invoiceQuery.where.map((condition: { status: string }) => condition.status);
    expect(queriedStatuses).toEqual(['confirmed', 'paid', 'confirmed', 'paid']);
    expect(queriedStatuses).not.toContain('refunded');
    expect(queriedStatuses).not.toContain('cancelled');
    expect(returnRepo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ sales_return: expect.objectContaining({ status: 'approved' }) }),
    }));
  });

  it.each([false, true])('tính giá vốn đúng từng lô có/không thuế, đã trả lô mới: %s', async (returnedNewest) => {
    const item = {
      id: 1, product_id: 10, quantity: 3, base_quantity: 3, conversion_factor: 1,
      taxable_quantity: 1, tax_selling_price: '200', unit_price: 200,
      total_price: 600, cost_price: 106.67, costing_method_snapshot: ProductCostingMethod.BY_BATCH,
      product: { name: 'Test', unit: { name: 'chai' }, tax_selling_price: '200' },
    };
    const allocations = [
      { sales_invoice_item_id: 1, product_id: 10, inventory_batch_id: 101,
        receipt_item_id: 21, quantity: 2, taxable_quantity: 0, unit_cost: 100, total_cost: 200,
        receipt_item: { id: 21, product_id: 10, tax_selling_price: 200, conversion_factor: 1 } },
      { sales_invoice_item_id: 1, product_id: 10, inventory_batch_id: 102,
        receipt_item_id: 22, quantity: 1, taxable_quantity: 1, unit_cost: 120, total_cost: 120,
        receipt_item: { id: 22, product_id: 10, tax_selling_price: 200, conversion_factor: 1 } },
    ];
    const returned = returnedNewest ? [{
      id: 4, sales_return: { invoice_id: 7 }, sales_invoice_item_id: 1, product_id: 10,
      quantity: 1, base_quantity: 1, total_price: 200,
      stock_allocations: [{ batchId: 102, sourceBatchId: 102, quantity: 1, taxableQuantity: 1 }],
    }] : [];
    const allocationRepo = { find: jest.fn().mockResolvedValue(allocations) };
    const returnRepo = { find: jest.fn().mockResolvedValue(returned) };
    const service = Object.create(StoreProfitReportService.prototype) as StoreProfitReportService;
    Object.assign(service, {
      logger: { log: jest.fn(), error: jest.fn() },
      salesInvoiceRepository: {
        manager: { getRepository: jest.fn((entity) => entity === SalesInvoiceItemStockAllocation ? allocationRepo : returnRepo) },
        find: jest.fn().mockResolvedValue([{ id: 7, code: 'TEST', sale_date: new Date('2026-10-01'), discount_amount: 0, items: [item] }]),
      },
      operatingCostRepository: { find: jest.fn().mockResolvedValue([]) },
      farmServiceCostRepository: { find: jest.fn().mockResolvedValue([]) },
      getTaxRevenueCutoverDate: jest.fn().mockResolvedValue({ cutover_date: '2026-01-01' }),
      getFarmGiftCostsBasic: jest.fn().mockResolvedValue([]),
      getSeasonDeliveryStats: jest.fn().mockResolvedValue({ total_delivery_cost: 0 }),
    });

    const report = await service.getPeriodProfitReport(new Date('2026-10-01'), new Date('2026-10-31'));
    expect(report.summary.total_cogs).toBe(returnedNewest ? 200 : 320);
    expect(report.summary.cogs_with_invoice).toBe(returnedNewest ? 0 : 120);
    expect(report.summary.cogs_no_invoice).toBe(200);
  });
});
