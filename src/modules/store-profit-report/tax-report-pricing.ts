export interface TaxPriceAllocation {
  batchId: number | null;
  receiptItemId: number | null;
  quantity: number;
  taxableQuantity: number | null;
  receiptPrice: number | null;
  receiptFactor: number;
  receiptTaxState?: 'all' | 'none' | 'unknown';
}

export interface TaxPriceReturn {
  baseQuantity: number;
  allocations: Array<{
    quantity: number;
    taxableQuantity: number;
    sourceBatchId?: number;
    sourceReceiptItemId?: number;
  }> | null;
}

export interface TaxReportPricing {
  taxableQuantity: number;
  taxSellingPrice: number;
  taxableAmount: number;
}

const EPSILON = 0.0001;

function checkQuantity(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} không hợp lệ.`);
  }
  return value;
}

/** Các lượng đều theo đơn vị kho; GBKT phiếu nhập theo đơn vị nhập. */
export function calculateTaxReportPricing(input: {
  baseQuantity: number;
  legacyTaxableQuantity: number;
  productPrice: number;
  allocations: TaxPriceAllocation[];
  returns: TaxPriceReturn[];
}): TaxReportPricing {
  const baseQuantity = checkQuantity(input.baseQuantity, 'Số lượng bán');
  const productPrice = Number.isFinite(input.productPrice) && input.productPrice > 0
    ? input.productPrice : 0;
  if (!input.allocations.length) {
    // Hóa đơn cũ thiếu nguồn lô: giữ cách đọc lượng thuế cũ, chỉ đổi nguồn GBKT.
    // Không sửa các snapshot đơn vị cũ thông qua thao tác xem báo cáo.
    const originalTax = checkQuantity(input.legacyTaxableQuantity, 'Số lượng thuế hóa đơn');
    let returnedTax = 0;
    for (const returned of input.returns) {
      const returnedQuantity = checkQuantity(returned.baseQuantity, 'Số lượng trả');
      if (!returned.allocations?.length) {
        returnedTax += returnedQuantity;
        continue;
      }
      let snapshotQuantity = 0;
      for (const snapshot of returned.allocations) {
        const quantity = checkQuantity(snapshot.quantity, 'Số lượng lô hoàn');
        const tax = checkQuantity(snapshot.taxableQuantity, 'Số lượng thuế hoàn');
        if (tax > quantity + EPSILON) throw new Error('Số lượng thuế hoàn vượt số hàng hoàn.');
        snapshotQuantity += quantity;
        returnedTax += tax;
      }
      if (Math.abs(snapshotQuantity - returnedQuantity) > EPSILON) throw new Error('Snapshot lô hoàn không khớp số lượng trả.');
    }
    const taxableQuantity = Math.max(0, originalTax - returnedTax);
    return { taxableQuantity, taxSellingPrice: taxableQuantity > 0 ? productPrice : 0, taxableAmount: taxableQuantity * productPrice };
  }
  const sources = input.allocations.map((allocation) => {
    const quantity = checkQuantity(allocation.quantity, 'Số lượng lô xuất');
    const tax = allocation.taxableQuantity ?? (quantity === 0 ? 0 : null);
    if (tax !== null && (checkQuantity(tax, 'Số lượng thuế lô xuất') > quantity + EPSILON)) {
      throw new Error('Số lượng thuế vượt số lượng lô xuất.');
    }
    let price = productPrice;
    if (allocation.receiptPrice !== null && Number.isFinite(allocation.receiptPrice) && allocation.receiptPrice > 0) {
      if (!Number.isFinite(allocation.receiptFactor) || allocation.receiptFactor <= 0) {
        throw new Error('Hệ số quy đổi phiếu nhập không hợp lệ.');
      }
      price = allocation.receiptPrice / allocation.receiptFactor;
    }
    return { ...allocation, quantity, taxableQuantity: tax, price };
  });
  if (sources.length && Math.abs(sources.reduce((sum, source) => sum + source.quantity, 0) - baseQuantity) > EPSILON) {
    throw new Error('Số lượng lô xuất không khớp dòng hóa đơn bán.');
  }
  let unknown = sources.filter((source) => source.taxableQuantity === null);
  let knownTax = sources.reduce((sum, source) => sum + (source.taxableQuantity ?? 0), 0);
  let originalTax = !unknown.length ? knownTax : checkQuantity(input.legacyTaxableQuantity, 'Số lượng thuế hóa đơn');
  const initialUnknownQuantity = unknown.reduce((sum, source) => sum + source.quantity, 0);
  const initialUnknownTax = originalTax - knownTax;
  // Cùng một giá thì thành tiền đã xác định từ tổng thuế cũ; không cần suy lại quantity.
  if (initialUnknownTax > EPSILON && initialUnknownTax < initialUnknownQuantity - EPSILON &&
    new Set(unknown.filter((source) => source.quantity > 0).map((source) => source.price)).size > 1) {
    for (const source of unknown) {
      if (source.receiptTaxState === 'none') source.taxableQuantity = 0;
    }
    const fullyTaxed = unknown.filter((source) => source.receiptTaxState === 'all');
    const fullTaxQuantity = fullyTaxed.reduce((sum, source) => sum + source.quantity, 0);
    // Không tăng tổng thuế cũ: chỉ chốt cả lô full-tax khi tổng cũ bao phủ nó.
    if (fullTaxQuantity <= originalTax - knownTax + EPSILON) {
      for (const source of fullyTaxed) source.taxableQuantity = source.quantity;
    }
    unknown = sources.filter((source) => source.taxableQuantity === null);
    knownTax = sources.reduce((sum, source) => sum + (source.taxableQuantity ?? 0), 0);
    if (knownTax > originalTax + EPSILON || (!unknown.length && Math.abs(knownTax - originalTax) > EPSILON)) {
      throw new Error('Thuế xác định từ phiếu nhập không khớp snapshot thuế hóa đơn cũ.');
    }
  }
  if (originalTax > baseQuantity + EPSILON || knownTax > originalTax + EPSILON) {
    throw new Error('Số lượng thuế không khớp số lượng bán.');
  }
  const unknownTax = Math.max(0, originalTax - knownTax);
  const unknownQuantity = unknown.reduce((sum, source) => sum + source.quantity, 0);
  if (sources.length && unknownTax > unknownQuantity + EPSILON) {
    throw new Error('Số lượng thuế thiếu snapshot vượt số lượng lô.');
  }
  if (unknown.length) {
    // Chỉ suy ra lượng thuế khi toàn bộ phần thiếu snapshot đều có/không có thuế.
    if (unknownTax < EPSILON || Math.abs(unknownTax - unknownQuantity) < EPSILON) {
      for (const source of unknown) source.taxableQuantity = unknownTax < EPSILON ? 0 : source.quantity;
    } else if (new Set(unknown.map((source) => source.price)).size > 1) {
      throw new Error('Các lô có GBKT khác nhau nhưng thiếu snapshot số lượng thuế theo lô.');
    }
  }
  let amount = sources.reduce((sum, source) => sum + (source.taxableQuantity ?? 0) * source.price, 0);
  const unresolved = sources.filter((source) => source.taxableQuantity === null);
  if (unresolved.length) amount += unknownTax * unresolved[0]!.price;

  let returnedQuantity = 0;
  let returnedTax = 0;
  const sourceReturns: Array<{ sources: typeof sources; quantity: number; tax: number }> = [];
  for (const returned of input.returns) {
    const quantity = checkQuantity(returned.baseQuantity, 'Số lượng trả');
    returnedQuantity += quantity;
    if (!returned.allocations?.length) {
      // Không có snapshot: chỉ toàn bộ có thuế hoặc toàn bộ không thuế là xác định được.
      if (originalTax > EPSILON && Math.abs(originalTax - baseQuantity) > EPSILON) {
        throw new Error('Phiếu trả thiếu snapshot thuế cho dòng bán có cả hàng có và không thuế.');
      }
      const tax = originalTax > EPSILON ? quantity : 0;
      const prices = new Set(sources.filter((source) => source.quantity > 0).map((source) => source.price));
      if (tax > 0 && prices.size > 1) {
        throw new Error('Phiếu trả thiếu nguồn lô trong khi các lô có GBKT khác nhau.');
      }
      returnedTax += tax;
      amount -= tax * ([...prices][0] ?? productPrice);
      continue;
    }
    let snapshotQuantity = 0;
    for (const snapshot of returned.allocations) {
      const restored = checkQuantity(snapshot.quantity, 'Số lượng lô hoàn');
      const tax = checkQuantity(snapshot.taxableQuantity, 'Số lượng thuế hoàn');
      if (tax > restored + EPSILON) throw new Error('Số lượng thuế hoàn vượt số hàng hoàn.');
      snapshotQuantity += restored;
      returnedTax += tax;
      const matching = sources.filter((source) => snapshot.sourceBatchId
        ? source.batchId === snapshot.sourceBatchId && (!snapshot.sourceReceiptItemId || source.receiptItemId === snapshot.sourceReceiptItemId)
        : !!snapshot.sourceReceiptItemId && source.receiptItemId === snapshot.sourceReceiptItemId);
      const prices = new Set((matching.length ? matching : sources).filter((source) => source.quantity > 0).map((source) => source.price));
      if (tax > 0 && (!prices.size || prices.size > 1)) {
        throw new Error('Phiếu trả không xác định được GBKT của lô xuất gốc.');
      }
      if ((snapshot.sourceBatchId || snapshot.sourceReceiptItemId) && !matching.length) {
        throw new Error('Nguồn lô trên phiếu trả không khớp lô đã bán.');
      }
      if (matching.length) {
        sourceReturns.push({ sources: matching, quantity: restored, tax });
      }
      amount -= tax * ([...prices][0] ?? productPrice);
    }
    if (Math.abs(snapshotQuantity - quantity) > EPSILON) throw new Error('Snapshot lô hoàn không khớp số lượng trả.');
  }
  // Kiểm tra cả nhóm theo phiếu nhập và các nhóm batch nằm trong nó.
  for (const group of sourceReturns) {
    const related = sourceReturns.filter((record) => record.sources.every((source) => group.sources.includes(source)));
    const restored = related.reduce((sum, record) => sum + record.quantity, 0);
    const tax = related.reduce((sum, record) => sum + record.tax, 0);
    const sold = group.sources.reduce((sum, source) => sum + source.quantity, 0);
    const knownGroupTax = group.sources.reduce((sum, source) => sum + (source.taxableQuantity ?? 0), 0);
    const unknownGroupQuantity = group.sources.filter((source) => source.taxableQuantity === null).reduce((sum, source) => sum + source.quantity, 0);
    const maxTax = knownGroupTax + Math.min(unknownTax, unknownGroupQuantity);
    const minTax = knownGroupTax + Math.max(0, unknownTax - (unknownQuantity - unknownGroupQuantity));
    if (restored > sold + EPSILON ||
      tax > maxTax + EPSILON || restored - tax > sold - minTax + EPSILON) {
      throw new Error('Phiếu trả hoàn vượt số lượng/thuế của lô đã bán.');
    }
  }
  // Phân vùng nguồn không giao nhau để tính cả phần unknown bắt buộc trong nhóm mixed.
  const partitions = new Map<string, typeof sources>();
  sources.forEach((source, index) => {
    const key = source.receiptItemId !== null ? `receipt:${source.receiptItemId}`
      : source.batchId !== null ? `batch:${source.batchId}` : `source:${index}`;
    const group = partitions.get(key) || [];
    group.push(source);
    partitions.set(key, group);
  });
  let unknownReturnedTax = 0;
  let unknownReturnedNonTax = 0;
  for (const group of partitions.values()) {
    const related = sourceReturns.filter((record) => record.sources.every((source) => group.includes(source)));
    const groupTax = group.reduce((sum, source) => sum + (source.taxableQuantity ?? 0), 0);
    const groupNonTax = group.filter((source) => source.taxableQuantity !== null).reduce((sum, source) => sum + source.quantity - source.taxableQuantity!, 0);
    const batches = new Map<number | typeof sources[number], typeof sources>();
    for (const source of group) {
      const key = source.batchId ?? source;
      const batch = batches.get(key) || [];
      batch.push(source);
      batches.set(key, batch);
    }
    let batchUnknownTax = 0;
    let batchUnknownNonTax = 0;
    for (const batch of batches.values()) {
      const batchReturns = related.filter((record) => record.sources.every((source) => batch.includes(source)));
      const knownBatchTax = batch.reduce((sum, source) => sum + (source.taxableQuantity ?? 0), 0);
      const knownBatchNonTax = batch.filter((source) => source.taxableQuantity !== null).reduce((sum, source) => sum + source.quantity - source.taxableQuantity!, 0);
      batchUnknownTax += Math.max(0, batchReturns.reduce((sum, record) => sum + record.tax, 0) - knownBatchTax);
      batchUnknownNonTax += Math.max(0, batchReturns.reduce((sum, record) => sum + record.quantity - record.tax, 0) - knownBatchNonTax);
    }
    unknownReturnedTax += Math.max(batchUnknownTax, related.reduce((sum, record) => sum + record.tax, 0) - groupTax);
    unknownReturnedNonTax += Math.max(batchUnknownNonTax, related.reduce((sum, record) => sum + record.quantity - record.tax, 0) - groupNonTax);
  }
  if (unknownReturnedTax > unknownTax + EPSILON || unknownReturnedNonTax > unknownQuantity - unknownTax + EPSILON) {
    throw new Error('Phiếu trả vượt phần thuế hoặc không thuế còn xác định được của các lô thiếu snapshot.');
  }
  if (returnedQuantity > baseQuantity + EPSILON || returnedTax > originalTax + EPSILON ||
    returnedQuantity - returnedTax > baseQuantity - originalTax + EPSILON || amount < -EPSILON) {
    throw new Error('Tổng số lượng hoặc thuế trả vượt số đã bán.');
  }
  originalTax = Math.max(0, originalTax - returnedTax);
  amount = Math.max(0, amount);
  return { taxableQuantity: originalTax, taxSellingPrice: originalTax > 0 ? amount / originalTax : 0, taxableAmount: amount };
}
