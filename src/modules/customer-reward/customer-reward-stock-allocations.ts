export interface CustomerRewardStockAllocation {
  batchId: number;
  quantity: number;
  taxableQuantity: number;
}

export type CustomerRewardStockAllocationResult =
  | { allocations: CustomerRewardStockAllocation[]; error?: never }
  | { allocations?: never; error: string };

const QUANTITY_TOLERANCE = 0.0001;

export function validateCustomerRewardStockAllocations(
  expectedQuantity: number,
  value: unknown,
): CustomerRewardStockAllocationResult {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: 'thiếu phân bổ lô và số lượng thuế (stock_allocations)' };
  }

  const allocations: CustomerRewardStockAllocation[] = [];
  const batchIds = new Set<number>();
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') {
      return { error: 'phân bổ lô quà tặng không hợp lệ' };
    }

    const row = candidate as Record<string, unknown>;
    const batchId = typeof row.batchId === 'number' ? row.batchId : NaN;
    const quantity = typeof row.quantity === 'number' ? row.quantity : NaN;
    const taxableQuantity =
      typeof row.taxableQuantity === 'number' ? row.taxableQuantity : NaN;
    if (
      !Number.isInteger(batchId) || batchId <= 0 || batchIds.has(batchId) ||
      !Number.isFinite(quantity) || quantity <= 0 ||
      !Number.isFinite(taxableQuantity) || taxableQuantity < 0 ||
      taxableQuantity > quantity + QUANTITY_TOLERANCE
    ) {
      return { error: 'phân bổ lô hoặc số lượng thuế quà tặng không hợp lệ' };
    }

    batchIds.add(batchId);
    allocations.push({ batchId, quantity, taxableQuantity });
  }

  const allocatedQuantity = allocations.reduce(
    (sum, allocation) => sum + allocation.quantity,
    0,
  );
  if (
    !Number.isFinite(expectedQuantity) || expectedQuantity <= 0 ||
    Math.abs(allocatedQuantity - expectedQuantity) > QUANTITY_TOLERANCE
  ) {
    return { error: 'tổng lượng phân bổ lô không khớp số lượng quà tặng' };
  }

  return { allocations };
}
