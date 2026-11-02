import { BadRequestException } from '@nestjs/common';

const EPSILON = 0.00005;
const roundBase = (value: number): number => Math.round(value * 10000) / 10000;

export interface ReceiptTaxSaleAllocation {
  id: number;
  salesInvoiceItemId: number;
  quantity: number;
  taxableQuantity: number;
  createdAt: Date;
}

export interface ReceiptTaxReturnAllocation {
  returnItemId: number;
  salesInvoiceItemId: number;
  batchId: number;
  quantity: number;
  taxableQuantity: number;
  createdAt: Date;
  snapshotIndex: number;
}

export interface ReceiptTaxBackfillPlan {
  sales: Array<{ id: number; taxableQuantity: number }>;
  returns: Array<{ returnItemId: number; snapshotIndex: number; batchId: number; taxableQuantity: number }>;
  sourceBatchTax: number;
  returnBatchTaxDeltas: Map<number, number>;
}

function validQuantity(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || Math.abs(roundBase(value) - value) > 0.00000001) {
    throw new BadRequestException(`${label} không hợp lệ; cần đối soát lịch sử lô.`);
  }
  return roundBase(value);
}

/** Phân bổ lại thuế theo quy tắc xuất phần không thuế trước, rồi hoàn phần có thuế trước. */
export function planReceiptTaxBackfill(input: {
  sourceBatchId: number;
  originalQuantity: number;
  remainingQuantity: number;
  oldReceiptTax: number;
  newReceiptTax: number;
  oldSourceBatchTax: number;
  sales: ReceiptTaxSaleAllocation[];
  returns: ReceiptTaxReturnAllocation[];
}): ReceiptTaxBackfillPlan {
  const original = validQuantity(input.originalQuantity, 'Số lượng gốc');
  const remaining = validQuantity(input.remainingQuantity, 'Tồn lô');
  const oldTax = validQuantity(input.oldReceiptTax, 'Thuế nhập cũ');
  const newTax = validQuantity(input.newReceiptTax, 'Thuế nhập mới');
  const oldBatchTax = validQuantity(input.oldSourceBatchTax, 'Tồn thuế lô');
  if (remaining > original || oldTax > original || newTax > original || oldBatchTax > remaining) {
    throw new BadRequestException('Số lượng hoặc thuế lô vượt hàng nhập; cần đối soát.');
  }

  const sourceByInvoiceItem = new Map<number, ReceiptTaxSaleAllocation>();
  for (const sale of input.sales) {
    const quantity = validQuantity(sale.quantity, `Phân bổ bán #${sale.id}`);
    const tax = validQuantity(sale.taxableQuantity, `Thuế phân bổ bán #${sale.id}`);
    if (quantity <= 0 || tax > quantity || sourceByInvoiceItem.has(sale.salesInvoiceItemId)) {
      throw new BadRequestException(`Dòng bán #${sale.salesInvoiceItemId} có phân bổ lô không duy nhất hoặc sai số lượng; cần đối soát.`);
    }
    sourceByInvoiceItem.set(sale.salesInvoiceItemId, sale);
  }
  const events = [
    ...input.sales.map((row) => ({ kind: 'sale' as const, row, time: row.createdAt?.getTime() })),
    ...input.returns.map((row) => ({ kind: 'return' as const, row, time: row.createdAt?.getTime() })),
  ];
  if (events.some((event) => !Number.isFinite(event.time))) {
    throw new BadRequestException('Lịch sử xuất/hoàn thiếu thời điểm hợp lệ; cần đối soát.');
  }
  events.sort((a, b) => Number(a.time) - Number(b.time) ||
    (a.kind === b.kind ?
      a.kind === 'sale' ? a.row.id - (b.row as ReceiptTaxSaleAllocation).id
        : a.row.returnItemId - (b.row as ReceiptTaxReturnAllocation).returnItemId ||
          a.row.snapshotIndex - (b.row as ReceiptTaxReturnAllocation).snapshotIndex
      : 0));
  if (events.some((event, index) => index > 0 && event.time === events[index - 1]!.time &&
      event.kind !== events[index - 1]!.kind)) {
    throw new BadRequestException('Không xác định được thứ tự bán và trả hàng cùng thời điểm; cần đối soát.');
  }

  // Phát lại lịch sử cũ để kiểm chứng từng snapshot trước khi tính thuế mới.
  const replay = (receiptTax: number, checkOld: boolean) => {
    let stock = original;
    let stockTax = receiptTax;
    const sold = new Map<number, number>();
    const returnedBySale = new Map<number, { quantity: number; taxableQuantity: number }>();
    const saleUpdates: ReceiptTaxBackfillPlan['sales'] = [];
    const returnUpdates: ReceiptTaxBackfillPlan['returns'] = [];
    const returnBatchTaxDeltas = new Map<number, number>();
    for (const event of events) {
      if (event.kind === 'sale') {
        const sale = event.row;
        const quantity = roundBase(sale.quantity);
        if (quantity > stock + EPSILON) {
          throw new BadRequestException(`Phân bổ bán #${sale.id} xuất vượt tồn lô; cần đối soát.`);
        }
        const taxableQuantity = roundBase(Math.min(stockTax, Math.max(0, quantity - (stock - stockTax))));
        stock = roundBase(stock - quantity);
        stockTax = roundBase(stockTax - taxableQuantity);
        if (checkOld && Math.abs(taxableQuantity - sale.taxableQuantity) > EPSILON) {
          throw new BadRequestException(`Thuế đã bán của phân bổ #${sale.id} không khớp quy tắc lô; cần đối soát.`);
        }
        sold.set(sale.salesInvoiceItemId, taxableQuantity);
        saleUpdates.push({ id: sale.id, taxableQuantity });
      } else {
        const returned = event.row;
        const source = sourceByInvoiceItem.get(returned.salesInvoiceItemId);
        const soldTax = sold.get(returned.salesInvoiceItemId);
        const quantity = validQuantity(returned.quantity, `Phân bổ trả #${returned.returnItemId}`);
        const oldReturnedTax = validQuantity(returned.taxableQuantity, `Thuế trả #${returned.returnItemId}`);
        if (!source || soldTax === undefined || quantity <= 0 || oldReturnedTax > quantity ||
            !Number.isSafeInteger(returned.batchId) || returned.batchId <= 0) {
          throw new BadRequestException(`Phiếu trả #${returned.returnItemId} thiếu lô bán nguồn hoặc snapshot hợp lệ.`);
        }
        const prior = returnedBySale.get(returned.salesInvoiceItemId) || { quantity: 0, taxableQuantity: 0 };
        const taxableQuantity = roundBase(Math.min(quantity, Math.max(0, soldTax - prior.taxableQuantity)));
        prior.quantity = roundBase(prior.quantity + quantity);
        prior.taxableQuantity = roundBase(prior.taxableQuantity + taxableQuantity);
        if (prior.quantity > Number(source.quantity) + EPSILON) {
          throw new BadRequestException(`Phiếu trả #${returned.returnItemId} vượt lượng đã bán của lô.`);
        }
        if (checkOld && Math.abs(taxableQuantity - oldReturnedTax) > EPSILON) {
          throw new BadRequestException(`Thuế phiếu trả #${returned.returnItemId} không khớp lô đã bán; cần đối soát.`);
        }
        returnedBySale.set(returned.salesInvoiceItemId, prior);
        if (returned.batchId === input.sourceBatchId) {
          stock = roundBase(stock + quantity);
          stockTax = roundBase(stockTax + taxableQuantity);
        } else {
          const delta = roundBase(taxableQuantity - oldReturnedTax);
          returnBatchTaxDeltas.set(returned.batchId, roundBase((returnBatchTaxDeltas.get(returned.batchId) || 0) + delta));
        }
        returnUpdates.push({ returnItemId: returned.returnItemId, snapshotIndex: returned.snapshotIndex,
          batchId: returned.batchId, taxableQuantity });
      }
      if (stock < -EPSILON || stockTax < -EPSILON || stockTax > stock + EPSILON) {
        throw new BadRequestException('Tồn thuế sau xuất/hoàn không khớp tồn lô; cần đối soát.');
      }
    }
    if (Math.abs(stock - remaining) > EPSILON || (checkOld && Math.abs(stockTax - oldBatchTax) > EPSILON)) {
      throw new BadRequestException('Lượng xuất/hoàn và tồn thuế của lô không khớp phiếu nhập; cần đối soát.');
    }
    return { saleUpdates, returnUpdates, returnBatchTaxDeltas, stockTax };
  };

  replay(oldTax, true);
  const next = replay(newTax, false);
  return {
    sales: next.saleUpdates,
    returns: next.returnUpdates,
    sourceBatchTax: next.stockTax,
    returnBatchTaxDeltas: next.returnBatchTaxDeltas,
  };
}
