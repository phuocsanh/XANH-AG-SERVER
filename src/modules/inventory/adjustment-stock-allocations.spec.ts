import {
  adjustmentBatchTaxSnapshotMatches,
  validateAdjustmentStockAllocations,
} from './adjustment-stock-allocations';

describe('validateAdjustmentStockAllocations', () => {
  it('requires a snapshot for approved legacy adjustments', () => {
    expect(validateAdjustmentStockAllocations(-3, null)).toEqual({
      error: 'thiếu dữ liệu phân bổ lô (stock_allocations)',
    });
  });

  it('requires allocation quantity to match the approved adjustment', () => {
    expect(validateAdjustmentStockAllocations(-5, [
      { batchId: 4, quantity: 3, taxableQuantity: 2 },
    ])).toEqual({
      error: 'tổng số lượng phân bổ lô không khớp số lượng điều chỉnh',
    });
  });

  it('keeps per-batch taxable quantities for a stock decrease', () => {
    expect(validateAdjustmentStockAllocations(-5, [
      { batchId: 4, quantity: 3, taxableQuantity: 2 },
      { batchId: 9, quantity: 2, taxableQuantity: 0 },
    ])).toEqual({
      allocations: [
        { batchId: 4, quantity: 3, taxableQuantity: 2 },
        { batchId: 9, quantity: 2, taxableQuantity: 0 },
      ],
    });
  });

  it('accepts the taxable snapshot for a single adjustment-increase lot', () => {
    expect(validateAdjustmentStockAllocations(4, [
      { batchId: 7, quantity: 4, taxableQuantity: 0 },
    ]).error).toBeUndefined();
    expect(validateAdjustmentStockAllocations(4, [
      { batchId: 7, quantity: 4, taxableQuantity: 1 },
    ])).toEqual({
      allocations: [{ batchId: 7, quantity: 4, taxableQuantity: 1 }],
    });
    expect(validateAdjustmentStockAllocations(4, [
      { batchId: 7, quantity: 4, taxableQuantity: 5 },
    ]).error).toBe('dữ liệu phân bổ lô hoặc số lượng thuế không hợp lệ');
  });

  it('does not treat an unknown batch tax snapshot as zero', () => {
    expect(validateAdjustmentStockAllocations(-1, [
      { batchId: 3, quantity: 1, taxableQuantity: null },
    ]).error).toBe('dữ liệu phân bổ lô hoặc số lượng thuế không hợp lệ');
    expect(adjustmentBatchTaxSnapshotMatches(0, null)).toBe(false);
    expect(adjustmentBatchTaxSnapshotMatches(0, 2)).toBe(false);
    expect(adjustmentBatchTaxSnapshotMatches(0, 0)).toBe(true);
  });
});
