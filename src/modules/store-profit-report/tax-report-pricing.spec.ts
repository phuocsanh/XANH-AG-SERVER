import { calculateTaxReportPricing, TaxPriceAllocation, TaxPriceReturn } from './tax-report-pricing';

function source(batchId: number, quantity: number, taxableQuantity: number | null, receiptPrice: number | null, receiptFactor = 1): TaxPriceAllocation {
  return { batchId, receiptItemId: batchId, quantity, taxableQuantity, receiptPrice, receiptFactor };
}

function returned(batchId: number, quantity: number, taxableQuantity: number): TaxPriceReturn {
  return { baseQuantity: quantity, allocations: [{ quantity, taxableQuantity, sourceBatchId: batchId }] };
}

function price(allocations: TaxPriceAllocation[], returns: TaxPriceReturn[] = [], legacyTax = 10) {
  return calculateTaxReportPricing({ baseQuantity: allocations.reduce((sum, row) => sum + row.quantity, 0),
    legacyTaxableQuantity: legacyTax, productPrice: 12000, allocations, returns });
}

describe('tax report price source priority', () => {
  it('uses the sold receipt GBKT instead of product GBKT', () => {
    expect(price([source(1, 10, 10, 9600)])).toEqual({ taxableQuantity: 10, taxSellingPrice: 9600, taxableAmount: 96000 });
  });

  it.each([null, 0])('uses product GBKT for a missing receipt price (%s)', (receiptPrice) => {
    expect(price([source(1, 10, 10, receiptPrice)]).taxableAmount).toBe(120000);
  });

  it('applies fallback per lot before calculating weighted price', () => {
    const result = price([source(1, 5, 5, 10000), source(2, 5, 5, null)]);
    expect(result).toEqual({ taxableQuantity: 10, taxSellingPrice: 11000, taxableAmount: 110000 });
  });

  it('excludes non-taxed quantities from price weights', () => {
    expect(price([source(1, 5, 5, 10000), source(2, 5, 0, 30000)]).taxSellingPrice).toBe(10000);
  });

  it('converts receipt bag GBKT into the inventory kg unit', () => {
    expect(price([source(1, 50, 50, 480000, 50)])).toEqual({ taxableQuantity: 50, taxSellingPrice: 9600, taxableAmount: 480000 });
  });

  it('does not round the weighted price before computing the amount', () => {
    expect(price([source(1, 1, 1, 100), source(2, 2, 2, 101)]).taxableAmount).toBe(302);
  });

  it('ignores zero-quantity sources when selecting a source-free return price', () => {
    expect(price([source(1, 0, 0, 99999), source(2, 10, 10, 100)], [{ baseQuantity: 2, allocations: null }]).taxableAmount).toBe(800);
    expect(price([source(1, 0, 0, 99999), source(2, 10, 10, 100)], [{ baseQuantity: 2, allocations: [{ quantity: 2, taxableQuantity: 2 }] }]).taxableAmount).toBe(800);
    expect(price([source(1, 0, null, 99999), source(2, 10, null, 100)], [], 5).taxableAmount).toBe(500);
  });

  it('deducts returned tax at the price of its exact source', () => {
    expect(price([source(1, 5, 5, 10000), source(2, 5, 5, 20000)], [returned(2, 2, 2)])).toEqual({
      taxableQuantity: 8, taxSellingPrice: 13750, taxableAmount: 110000,
    });
  });

  it('does not reduce tax when the returned stock is non-taxed', () => {
    expect(price([source(1, 10, 5, 10000)], [returned(1, 3, 0)])).toEqual({
      taxableQuantity: 5, taxSellingPrice: 10000, taxableAmount: 50000,
    });
  });

  it('uses product GBKT for legacy sales without source allocations', () => {
    expect(calculateTaxReportPricing({ baseQuantity: 10, legacyTaxableQuantity: 6, productPrice: 12000, allocations: [], returns: [] })).toEqual({
      taxableQuantity: 6, taxSellingPrice: 12000, taxableAmount: 72000,
    });
  });

  it('preserves legacy tax quantity when old base-unit snapshot is inconsistent', () => {
    expect(calculateTaxReportPricing({ baseQuantity: 2, legacyTaxableQuantity: 100, productPrice: 13900, allocations: [], returns: [] })).toEqual({
      taxableQuantity: 100, taxSellingPrice: 13900, taxableAmount: 1390000,
    });
  });

  it('preserves the old return deduction for legacy sales without batch snapshots', () => {
    expect(calculateTaxReportPricing({ baseQuantity: 2, legacyTaxableQuantity: 100, productPrice: 13900, allocations: [], returns: [{ baseQuantity: 1, allocations: null }] })).toEqual({
      taxableQuantity: 99, taxSellingPrice: 13900, taxableAmount: 1376100,
    });
  });

  it('infers missing allocation tax only when every sold unit is taxed', () => {
    expect(price([source(1, 5, null, 10000), source(2, 5, null, 20000)]).taxableAmount).toBe(150000);
  });

  it('uses full-tax original receipt evidence and assigns only the proven remainder to a synthetic lot', () => {
    expect(price([{ ...source(1, 2, null, 165000), receiptTaxState: 'all' }, source(2, 2, null, null)], [], 2)).toEqual({
      taxableQuantity: 2, taxSellingPrice: 165000, taxableAmount: 330000,
    });
  });

  it('rejects receipt-inferred tax contradicting the legacy invoice tax snapshot', () => {
    expect(() => price([{ ...source(1, 5, null, 10000), receiptTaxState: 'all' }, source(2, 5, null, 20000)], [], 2)).toThrow('thiếu snapshot');
    expect(() => price([{ ...source(1, 5, null, 10000), receiptTaxState: 'all' },
      { ...source(2, 5, null, 20000), receiptTaxState: 'none' }], [], 7)).toThrow('không khớp snapshot');
  });

  it('does not reinterpret legacy tax quantity when all missing snapshots have one price', () => {
    expect(price([{ ...source(1, 9, null, null), receiptTaxState: 'all' }], [], 8)).toEqual({
      taxableQuantity: 8, taxSellingPrice: 12000, taxableAmount: 96000,
    });
  });

  it('prices the legacy taxed remainder after proving another receipt has no tax', () => {
    expect(price([{ ...source(1, 4, null, null), receiptTaxState: 'none' },
      { ...source(2, 2, null, 55000), receiptTaxState: 'all' }], [], 1)).toEqual({
      taxableQuantity: 1, taxSellingPrice: 55000, taxableAmount: 55000,
    });
  });

  it('bounds returns from unknown sources by their total proven tax budget', () => {
    expect(() => price([source(1, 5, 5, 10000), source(2, 5, null, 20000)], [returned(2, 3, 3)], 6)).toThrow('vượt');
    expect(() => price([source(1, 5, 5, 10000), source(2, 3, null, 20000), source(3, 2, null, 20000)], [returned(2, 1, 1), returned(3, 1, 1)], 6)).toThrow('vượt');
  });

  it('includes unknown tax forced by a mixed known/unknown receipt return', () => {
    expect(() => price([source(1, 5, 0, 100), { ...source(2, 5, null, 100), receiptItemId: 1 },
      source(3, 5, null, 100), source(4, 5, 5, 200)], [{ baseQuantity: 2,
      allocations: [{ quantity: 2, taxableQuantity: 2, sourceReceiptItemId: 1 }] }, returned(3, 2, 2)], 8)).toThrow('vượt phần thuế');
  });

  it('does not use a known sibling batch to fund returns explicitly from an unknown batch', () => {
    expect(() => price([source(1, 5, 5, 100), { ...source(2, 5, null, 100), receiptItemId: 1 },
      source(3, 5, null, 100), source(4, 5, 5, 200)], [returned(2, 2, 2), returned(3, 1, 1)], 12)).toThrow('vượt phần thuế');
  });

  it('supports missing allocation tax when price is the same for all unknown sources', () => {
    expect(price([source(1, 5, null, 10000), source(2, 5, null, 10000)], [], 6).taxableAmount).toBe(60000);
  });

  it('does not treat null as zero or invent tax distribution across different prices', () => {
    expect(() => price([source(1, 5, null, 10000), source(2, 5, null, 20000)], [], 6)).toThrow('thiếu snapshot');
  });

  it('rejects returns exceeding the taxed/non-taxed source even when totals fit', () => {
    expect(() => price([source(1, 5, 0, 10000), source(2, 5, 5, 20000)], [returned(1, 2, 2)])).toThrow('vượt');
    expect(() => price([source(1, 5, 0, 10000), source(2, 5, 5, 20000)], [returned(2, 2, 0)])).toThrow('vượt');
  });

  it('rejects source-free returns if source prices differ', () => {
    expect(() => price([source(1, 5, 5, 10000), source(2, 5, 5, 20000)], [{ baseQuantity: 2, allocations: null }])).toThrow('thiếu nguồn lô');
  });

  it('checks conversion factors on positively priced receipts', () => {
    expect(() => price([source(1, 10, 10, 10000, 0)])).toThrow('quy đổi');
  });

  it('supports several returns and an entirely returned sale', () => {
    expect(price([source(1, 10, 6, 10000)], [returned(1, 3, 2), returned(1, 7, 4)])).toEqual({
      taxableQuantity: 0, taxSellingPrice: 0, taxableAmount: 0,
    });
  });

  it('combines batch-specific and receipt-only return snapshots without double counting', () => {
    const allocations = [source(1, 5, 5, 10000), { ...source(2, 5, 5, 10000), receiptItemId: 1 }];
    expect(price(allocations, [returned(1, 3, 3), {
      baseQuantity: 4, allocations: [{ quantity: 4, taxableQuantity: 4, sourceReceiptItemId: 1 }],
    }]).taxableAmount).toBe(30000);
  });

  it('rejects cumulative over-return across receipt-only and batch snapshots', () => {
    const allocations = [source(1, 5, 5, 10000), { ...source(2, 5, 5, 10000), receiptItemId: 1 }, source(3, 10, 10, 20000)];
    expect(() => price(allocations, [returned(2, 5, 5), {
      baseQuantity: 6, allocations: [{ quantity: 6, taxableQuantity: 6, sourceReceiptItemId: 1 }],
    }])).toThrow('vượt');
  });
});
