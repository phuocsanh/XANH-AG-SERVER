const QUANTITY_SCALE = 10000;

function toUnits(value: number): number | undefined {
  if (!Number.isFinite(value) || value < 0) return undefined;
  const scaled = value * QUANTITY_SCALE;
  const rounded = Math.round(scaled);
  return Math.abs(scaled - rounded) < 1e-6 ? rounded : undefined;
}

export function taxableQuantityForBorrowReturn(
  borrowedQuantity: number,
  borrowedTaxableQuantity: number,
  alreadyReturnedQuantity: number,
  requestedReturnQuantity: number,
): number | undefined {
  const borrowed = toUnits(borrowedQuantity);
  const taxable = toUnits(borrowedTaxableQuantity);
  const returned = toUnits(alreadyReturnedQuantity);
  const requested = toUnits(requestedReturnQuantity);
  if (
    borrowed === undefined || taxable === undefined || returned === undefined ||
    requested === undefined || taxable > borrowed || returned + requested > borrowed
  ) return undefined;

  const nonTaxable = borrowed - taxable;
  const taxableReturnedBefore = Math.max(0, returned - nonTaxable);
  const taxableReturnedAfter = Math.max(0, returned + requested - nonTaxable);
  return (taxableReturnedAfter - taxableReturnedBefore) / QUANTITY_SCALE;
}
