import { StoreProfitReportService } from './store-profit-report.service';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';

describe('period tax report after customer returns', () => {
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
});
