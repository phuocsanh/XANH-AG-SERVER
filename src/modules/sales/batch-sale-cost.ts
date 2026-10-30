import { BadRequestException } from '@nestjs/common';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';

/** Tính giá vốn của dòng bán theo các lô đã xuất và các lô khách đã trả. */
export function calculateBatchSaleCost(
  item: SalesInvoiceItem,
  allocations: SalesInvoiceItemStockAllocation[],
  returns: SalesReturnItem[],
): { original: number; net: number; unitCost: number } {
  const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const baseQty = Number(item.base_quantity ?? item.quantity);
  const allocatedQty = allocations.reduce((sum, row) => sum + Number(row.quantity), 0);
  if (!Number.isFinite(baseQty) || baseQty <= 0 || !allocations.length ||
      allocations.some((row) => !row.inventory_batch_id ||
        !Number.isFinite(Number(row.quantity)) || Number(row.quantity) <= 0 ||
        row.unit_cost == null || !Number.isFinite(Number(row.unit_cost)) || Number(row.unit_cost) < 0 ||
        row.total_cost == null || !Number.isFinite(Number(row.total_cost)) || Number(row.total_cost) < 0) ||
      Math.abs(allocatedQty - baseQty) > 0.0001) {
    throw new BadRequestException(`Dòng hóa đơn #${item.id} thiếu phân bổ lô hợp lệ để tính giá vốn.`);
  }
  const original = roundMoney(allocations.reduce((sum, row) => sum + Number(row.total_cost), 0));
  const returnedByBatch = new Map<number, number>();
  for (const returned of returns) {
    const snapshots = returned.stock_allocations || [];
    const quantity = Number(returned.base_quantity ?? Number(returned.quantity) * Number(returned.conversion_factor ?? 1));
    if (!snapshots.length || !Number.isFinite(quantity) ||
        Math.abs(snapshots.reduce((sum, row) => sum + Number(row.quantity), 0) - quantity) > 0.0001) {
      throw new BadRequestException(`Phiếu khách trả dòng #${returned.id} thiếu phân bổ lô để tính lại giá vốn.`);
    }
    for (const snapshot of snapshots) {
      const source = allocations.find((row) => Number(row.inventory_batch_id) === Number(snapshot.sourceBatchId));
      const returnedQty = Number(snapshot.quantity);
      if (!source || !Number.isFinite(returnedQty) || returnedQty <= 0) {
        throw new BadRequestException(`Phiếu khách trả dòng #${returned.id} thiếu lô nguồn hợp lệ để tính lại giá vốn.`);
      }
      const batchId = Number(source.inventory_batch_id);
      const total = Math.round(((returnedByBatch.get(batchId) || 0) + returnedQty) * 10000) / 10000;
      if (total - Number(source.quantity) > 0.0001) {
        throw new BadRequestException(`Lô #${batchId} có số lượng trả vượt số lượng đã bán.`);
      }
      returnedByBatch.set(batchId, total);
    }
  }
  const returnedCost = allocations.reduce((sum, source) =>
    sum + roundMoney((returnedByBatch.get(Number(source.inventory_batch_id)) || 0) * Number(source.unit_cost)), 0);
  return { original, net: Math.max(0, roundMoney(original - returnedCost)), unitCost: roundMoney(original / baseQty) };
}
