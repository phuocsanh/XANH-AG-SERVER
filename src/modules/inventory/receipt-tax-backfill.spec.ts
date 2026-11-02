import { BadRequestException } from '@nestjs/common';
import { planReceiptTaxBackfill, ReceiptTaxSaleAllocation, ReceiptTaxReturnAllocation } from './receipt-tax-backfill';

const sale = (id: number, quantity: number, taxableQuantity = 0, day = 1): ReceiptTaxSaleAllocation => ({
  id, salesInvoiceItemId: id + 100, quantity, taxableQuantity,
  createdAt: new Date(`2026-10-${String(day).padStart(2, '0')}T00:00:00Z`),
});
const returned = (saleId: number, batchId: number, quantity: number, day = 5): ReceiptTaxReturnAllocation => ({
  returnItemId: saleId + 200, salesInvoiceItemId: saleId + 100, batchId,
  quantity, taxableQuantity: 0, snapshotIndex: 0,
  createdAt: new Date(`2026-10-${String(day).padStart(2, '0')}T00:00:00Z`),
});

describe('Đồng bộ thuế lô nhập đã bán', () => {
  it('phân bổ phần không thuế bán trước và giữ lại tồn thuế đúng lô', () => {
    const plan = planReceiptTaxBackfill({
      sourceBatchId: 7, originalQuantity: 100, remainingQuantity: 50,
      oldReceiptTax: 0, newReceiptTax: 60, oldSourceBatchTax: 0,
      sales: [sale(1, 30), sale(2, 20, 0, 2)], returns: [],
    });
    expect(plan.sales).toEqual([{ id: 1, taxableQuantity: 0 }, { id: 2, taxableQuantity: 10 }]);
    expect(plan.sourceBatchTax).toBe(50);
  });

  it('cập nhật thuế trả hàng vào cùng lô nguồn', () => {
    const plan = planReceiptTaxBackfill({
      sourceBatchId: 7, originalQuantity: 100, remainingQuantity: 80,
      oldReceiptTax: 0, newReceiptTax: 100, oldSourceBatchTax: 0,
      sales: [sale(1, 30)], returns: [returned(1, 7, 10)],
    });
    expect(plan.sales[0]?.taxableQuantity).toBe(30);
    expect(plan.returns[0]?.taxableQuantity).toBe(10);
    expect(plan.sourceBatchTax).toBe(80);
  });

  it('tách phần thuế hoàn sang lô trả mới khi hàng không về lô gốc', () => {
    const plan = planReceiptTaxBackfill({
      sourceBatchId: 7, originalQuantity: 100, remainingQuantity: 70,
      oldReceiptTax: 0, newReceiptTax: 100, oldSourceBatchTax: 0,
      sales: [sale(1, 30)], returns: [returned(1, 8, 10)],
    });
    expect(plan.sourceBatchTax).toBe(70);
    expect(plan.returnBatchTaxDeltas.get(8)).toBe(10);
  });

  it('phát lại đúng lô khi khách trả rồi bán tiếp, và chặn số dư cũ không khớp', () => {
    const input = {
      sourceBatchId: 7, originalQuantity: 100, remainingQuantity: 60,
      oldReceiptTax: 0, newReceiptTax: 100, oldSourceBatchTax: 0,
      sales: [sale(1, 30), sale(2, 20, 0, 6)], returns: [returned(1, 7, 10, 5)],
    };
    const plan = planReceiptTaxBackfill(input);
    expect(plan.sales.map((row) => row.taxableQuantity)).toEqual([30, 20]);
    expect(plan.returns[0]?.taxableQuantity).toBe(10);
    expect(plan.sourceBatchTax).toBe(60);
    expect(() => planReceiptTaxBackfill({ ...input, remainingQuantity: 61 })).toThrow(BadRequestException);
  });

  it('chặn snapshot thuế bán cũ lệch quy tắc lô', () => {
    expect(() => planReceiptTaxBackfill({
      sourceBatchId: 7, originalQuantity: 100, remainingQuantity: 90,
      oldReceiptTax: 20, newReceiptTax: 100, oldSourceBatchTax: 20,
      sales: [sale(1, 10, 10)], returns: [],
    })).toThrow('không khớp quy tắc lô');
  });
});
