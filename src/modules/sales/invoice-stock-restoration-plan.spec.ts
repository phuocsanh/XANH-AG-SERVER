import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';
import { planInvoiceStockRestoration, saleTaxQuantityForStorage } from './invoice-stock-restoration-plan';

function fixture() {
  const items = [{ id: 1, product_id: 10, quantity: 2, conversion_factor: 50, base_quantity: 100, taxable_quantity: 1 }] as SalesInvoiceItem[];
  const allocations = [
    { id: 1, invoice_id: 7, sales_invoice_item_id: 1, product_id: 10, inventory_batch_id: 100, receipt_item_id: 200, quantity: 50, taxable_quantity: 50 },
    { id: 2, invoice_id: 7, sales_invoice_item_id: 1, product_id: 10, inventory_batch_id: 101, receipt_item_id: 201, quantity: 50, taxable_quantity: 0 },
  ] as SalesInvoiceItemStockAllocation[];
  const returns = [{ id: 3, sales_invoice_item_id: 1, product_id: 10, base_quantity: 25,
    stock_allocations: [{ batchId: 300, sourceBatchId: 100, sourceReceiptItemId: 200, quantity: 25, taxableQuantity: 25 }],
  }] as SalesReturnItem[];
  const plan = () => planInvoiceStockRestoration(7, items, allocations, returns);
  return { items, allocations, returns, plan };
}

describe('base-unit invoice restoration plan', () => {
  it('subtracts exact source tax and never infers it from item quantities or prices', () => {
    const s = fixture();
    s.items[0]!.taxable_quantity = 0;
    expect(s.plan().byItem.get(1)).toEqual({ quantity: 75, taxableQuantity: 25 });
    expect(s.plan().byAllocation.get(1)).toEqual({ quantity: 25, taxableQuantity: 25 });
    expect(s.plan().byAllocation.get(2)).toEqual({ quantity: 50, taxableQuantity: 0 });
  });

  it('matches a receipt-only source uniquely even when the sale has a batch id', () => {
    const s = fixture();
    delete s.returns[0]!.stock_allocations![0]!.sourceBatchId;
    expect(s.plan().byItem.get(1)?.taxableQuantity).toBe(25);
  });

  it('accepts legacy product-only returns only when there is one matching invoice line', () => {
    const s = fixture();
    delete s.returns[0]!.sales_invoice_item_id;
    expect(s.plan().byItem.get(1)?.taxableQuantity).toBe(25);
    s.items.push({ ...s.items[0]!, id: 2 });
    expect(s.plan).toThrow('dòng bán gốc duy nhất');
  });

  it.each(['sourceBatchId', 'sourceReceiptItemId'] as const)('rejects inconsistent %s instead of ignoring the conflicting id', (key) => {
    const s = fixture();
    s.returns[0]!.stock_allocations![0]![key] = 999;
    expect(s.plan).toThrow('nguồn lô không khớp');
  });

  it('rejects return allocations with no original source when several lots were sold', () => {
    const s = fixture();
    delete s.returns[0]!.stock_allocations![0]!.sourceBatchId;
    delete s.returns[0]!.stock_allocations![0]!.sourceReceiptItemId;
    expect(s.plan).toThrow('thiếu lô xuất gốc duy nhất');
  });

  it('rejects an ambiguous receipt source shared by multiple allocations', () => {
    const s = fixture();
    s.allocations[1]!.receipt_item_id = 200;
    delete s.returns[0]!.stock_allocations![0]!.sourceBatchId;
    expect(s.plan).toThrow('nguồn lô không khớp');
  });

  it.each([null, undefined, NaN, Infinity, -1, ' ', true])('rejects malformed returned tax %s', (badTax) => {
    const s = fixture();
    Object.assign(s.returns[0]!.stock_allocations![0]!, { taxableQuantity: badTax });
    expect(s.plan).toThrow();
  });

  it('rejects returning non-taxable stock from a fully taxable source instead of clamping', () => {
    const s = fixture();
    s.returns[0]!.stock_allocations![0]!.taxableQuantity = 10;
    expect(s.plan).toThrow('hàng không thuế trả vượt lô xuất gốc');
  });

  it('validates accumulated returns rather than each return independently', () => {
    const s = fixture();
    s.returns.push({ ...s.returns[0]!, id: 4, base_quantity: 30,
      stock_allocations: [{ batchId: 301, sourceBatchId: 100, quantity: 30, taxableQuantity: 30 }],
    });
    expect(s.plan).toThrow('trả vượt lô xuất gốc');
  });

  it('requires returned snapshot quantities to cover the exact return quantity', () => {
    const s = fixture();
    s.returns[0]!.base_quantity = 30;
    expect(s.plan).toThrow('snapshot lô không khớp số lượng trả');
  });

  it.each([null, undefined, NaN, -1])('rejects missing or malformed source tax %s', (badTax) => {
    const s = fixture();
    Object.assign(s.allocations[0]!, { taxable_quantity: badTax });
    expect(s.plan).toThrow();
  });

  it('rejects allocations linked to the wrong invoice or product', () => {
    const s = fixture();
    s.allocations[0]!.invoice_id = 8;
    expect(s.plan).toThrow('không khớp hóa đơn');
    s.allocations[0]!.invoice_id = 7;
    s.allocations[0]!.product_id = 11;
    expect(s.plan).toThrow('không khớp hóa đơn');
  });

  it('does not invent tax for legacy lines without source allocations', () => {
    const s = fixture();
    s.allocations.length = 0;
    expect(s.plan).toThrow('thiếu snapshot thuế theo lô');
    s.items[0]!.taxable_quantity = 0;
    s.returns[0]!.stock_allocations![0]!.taxableQuantity = 0;
    expect(s.plan().byItem.get(1)).toEqual({ quantity: 75, taxableQuantity: 0 });
  });

  it('does not need to restore legacy stock that has already been fully returned', () => {
    const s = fixture();
    s.allocations.length = 0;
    s.returns[0]!.base_quantity = 100;
    s.returns[0]!.stock_allocations![0]!.quantity = 100;
    s.returns[0]!.stock_allocations![0]!.taxableQuantity = 50;
    expect(s.plan().byItem.get(1)).toEqual({ quantity: 0, taxableQuantity: 0 });
  });
});

describe('sale tax snapshot numeric(15,2)', () => {
  it.each([[300, 50, 6], [1, 50, 0.02], [0, 40, 0], [0.12, 0.02, 6], [1.23, 1, 1.23]])('stores %s base tax at factor %s exactly as %s', (tax, factor, expected) => {
    expect(saleTaxQuantityForStorage(tax, factor)).toBe(expected);
  });
  it.each([[1, 1000], [1, 40], [0.001, 1], [0.0002, 0.02], [1, 0], [1, -1], [NaN, 1], [Infinity, 1], [1e13, 1]])('rejects tax %s at factor %s', (tax, factor) => {
    expect(() => saleTaxQuantityForStorage(tax, factor)).toThrow();
  });
});
