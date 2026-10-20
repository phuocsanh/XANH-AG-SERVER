import { taxableQuantityForBorrowReturn } from './borrow-tax-return';

describe('taxableQuantityForBorrowReturn', () => {
  it('returns non-taxable units before taxable units from one borrow lot', () => {
    expect(taxableQuantityForBorrowReturn(10, 4, 0, 6)).toBe(0);
    expect(taxableQuantityForBorrowReturn(10, 4, 6, 2)).toBe(2);
    expect(taxableQuantityForBorrowReturn(10, 4, 8, 2)).toBe(2);
  });

  it('keeps the taxable total consistent when a return is split', () => {
    const first = taxableQuantityForBorrowReturn(10, 4, 0, 7);
    const second = taxableQuantityForBorrowReturn(10, 4, 7, 3);
    expect(first).toBe(1);
    expect(second).toBe(3);
    expect(first! + second!).toBe(4);
  });

  it('rejects invalid or excessive snapshots/returns', () => {
    expect(taxableQuantityForBorrowReturn(10, 11, 0, 1)).toBeUndefined();
    expect(taxableQuantityForBorrowReturn(10, 4, 9, 2)).toBeUndefined();
    expect(taxableQuantityForBorrowReturn(10, 4, 0, -1)).toBeUndefined();
  });
});
