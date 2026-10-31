import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';

/** Chia phí chung theo lượng kho; dòng cuối nhận số dư để tổng phí không tăng do làm tròn. */
export function allocateSharedInboundFee(
  totalFee: number,
  baseQuantity: number,
  totalBaseQuantity: number,
  allocatedBefore: number,
  isLast: boolean,
): number {
  if (totalFee <= 0 || totalBaseQuantity <= 0) return 0;
  return Math.round((isLast ? totalFee - allocatedBefore : totalFee * baseQuantity / totalBaseQuantity) * 100) / 100;
}

/** Phí nhập trên một đơn vị kho của đúng dòng phiếu nhập, tách khỏi giá phải trả NCC. */
export function receiptInboundFeePerBaseUnit(
  item?: Pick<InventoryReceiptItem, 'base_quantity' | 'quantity' | 'conversion_factor' | 'individual_shipping_cost' | 'allocated_shipping_cost'> | null,
): number {
  if (!item) return 0;
  const baseQuantity = Number(item.base_quantity || Number(item.quantity) * Number(item.conversion_factor || 1));
  if (!Number.isFinite(baseQuantity) || baseQuantity <= 0) return 0;
  return (Number(item.individual_shipping_cost || 0) + Number(item.allocated_shipping_cost || 0)) / baseQuantity;
}

/** Tổng phí của các lô xuất; không thay đổi snapshot giá vốn gốc theo loại bán. */
export function allocatedInboundFee(
  allocations: SalesInvoiceItemStockAllocation[],
  receiptItems: Map<number, InventoryReceiptItem>,
): number {
  return allocations.reduce((sum, allocation) =>
    sum + Number(allocation.quantity || 0) * receiptInboundFeePerBaseUnit(
      receiptItems.get(Number(allocation.receipt_item_id || 0)),
    ), 0);
}
