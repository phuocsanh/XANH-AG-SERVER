import { StoreProfitReportService } from './store-profit-report.service';

describe('period tax report after customer returns', () => {
  it.each([
    { returnedBase: 0, expectedTaxBase: 50, revenue: 100000 },
    { returnedBase: 25, expectedTaxBase: 25, revenue: 50000 },
    { returnedBase: 75, expectedTaxBase: 0, revenue: 0 },
  ])('keeps base quantities and prices consistent for $returnedBase returned kg', async ({ returnedBase, expectedTaxBase, revenue }) => {
    const item = {
      id: 1, product_id: 10, quantity: 2, base_quantity: 100, conversion_factor: 50,
      taxable_quantity: 1, tax_selling_price: '100000', unit_price: 150000,
      total_price: 300000, cost_price: 1000,
      product: { name: 'Test', unit: { name: 'kg' }, tax_selling_price: '2000' },
    };
    const service = Object.create(StoreProfitReportService.prototype) as StoreProfitReportService;
    Object.assign(service, {
      logger: { log: jest.fn(), error: jest.fn() },
      salesInvoiceRepository: { find: jest.fn().mockResolvedValue([{ id: 7, code: 'TEST', sale_date: new Date('2026-10-01'), discount_amount: 0, items: [item] }]) },
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
      tax_selling_price: 2000, taxable_total_amount: revenue,
    });
    expect(item.taxable_quantity).toBe(1);
  });
});
