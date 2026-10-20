export interface AdjustmentStockAllocation {
  batchId: number;
  quantity: number;
  taxableQuantity: number;
  sourceBatchId?: number;
  pending?: boolean;
}

export type AdjustmentStockAllocationValidation =
  | { allocations: AdjustmentStockAllocation[]; error?: never }
  | { allocations?: never; error: string };

const QUANTITY_TOLERANCE = 0.0001;

export function validateAdjustmentStockAllocations(
  quantityChange: number,
  value: unknown,
): AdjustmentStockAllocationValidation {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: 'thiếu dữ liệu phân bổ lô (stock_allocations)' };
  }

  const allocations: AdjustmentStockAllocation[] = [];
  for (const candidate of value) {
    if (candidate === null || typeof candidate !== 'object') {
      return { error: 'dữ liệu phân bổ lô không hợp lệ' };
    }

    const row = candidate as Record<string, unknown>;
    if (
      row.batchId === null || row.batchId === undefined || row.batchId === '' ||
      row.quantity === null || row.quantity === undefined || row.quantity === '' ||
      row.taxableQuantity === null || row.taxableQuantity === undefined ||
      row.taxableQuantity === ''
    ) {
      return { error: 'dữ liệu phân bổ lô hoặc số lượng thuế không hợp lệ' };
    }
    const batchId = Number(row.batchId);
    const quantity = Number(row.quantity);
    const taxableQuantity = Number(row.taxableQuantity);
    if (
      !Number.isInteger(batchId) || batchId <= 0 ||
      !Number.isFinite(quantity) || quantity <= 0 ||
      !Number.isFinite(taxableQuantity) || taxableQuantity < 0 ||
      taxableQuantity > quantity + QUANTITY_TOLERANCE
    ) {
      return { error: 'dữ liệu phân bổ lô hoặc số lượng thuế không hợp lệ' };
    }

    allocations.push({ batchId, quantity, taxableQuantity });
  }

  const expectedQuantity = Math.abs(Number(quantityChange));
  const allocatedQuantity = allocations.reduce((sum, row) => sum + row.quantity, 0);
  if (
    !Number.isFinite(expectedQuantity) || expectedQuantity <= 0 ||
    Math.abs(allocatedQuantity - expectedQuantity) > QUANTITY_TOLERANCE
  ) {
    return { error: 'tổng số lượng phân bổ lô không khớp số lượng điều chỉnh' };
  }

  if (quantityChange > 0 && allocations.length !== 1) {
    return { error: 'snapshot lô điều chỉnh tăng không hợp lệ' };
  }

  return { allocations };
}

export function adjustmentBatchTaxSnapshotMatches(
  expectedTaxableQuantity: number,
  actualTaxableQuantity: number | string | null | undefined,
): boolean {
  if (
    actualTaxableQuantity === null || actualTaxableQuantity === undefined ||
    !Number.isFinite(Number(expectedTaxableQuantity)) ||
    !Number.isFinite(Number(actualTaxableQuantity))
  ) {
    return false;
  }

  return Math.abs(
    Number(actualTaxableQuantity) - Number(expectedTaxableQuantity),
  ) <= QUANTITY_TOLERANCE;
}
