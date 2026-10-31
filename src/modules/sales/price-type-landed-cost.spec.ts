import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';
import { allocateSharedInboundFee, allocatedInboundFee, receiptInboundFeePerBaseUnit } from './price-type-landed-cost';

describe('Phí nhập của sản phẩm chốt giá vốn theo loại bán', () => {
  it('phí chung 1 đồng chia hai dòng không bị làm tròn thành 2 đồng', () => {
    const first = allocateSharedInboundFee(1, 1, 2, 0, false);
    const second = allocateSharedInboundFee(1, 1, 2, first, true);
    expect([first, second]).toEqual([0.5, 0.5]);
    expect(first + second).toBe(1);
    expect(allocateSharedInboundFee(1, 1, 3, 0.33, true)).toBe(0.67);
  });
  it('cộng đúng phí khi một hóa đơn xuất hai lô có phí khác nhau', () => {
    const lots = new Map<number, InventoryReceiptItem>([
      [1, { id: 1, quantity: 25, conversion_factor: 40, base_quantity: 1000, individual_shipping_cost: 500000, allocated_shipping_cost: 0 } as InventoryReceiptItem],
      [2, { id: 2, quantity: 500, conversion_factor: 1, base_quantity: 500, individual_shipping_cost: 100000, allocated_shipping_cost: 0 } as InventoryReceiptItem],
    ]);
    const allocations = [
      { quantity: 1000, receipt_item_id: 1 },
      { quantity: 200, receipt_item_id: 2 },
    ] as SalesInvoiceItemStockAllocation[];

    expect(receiptInboundFeePerBaseUnit(lots.get(1))).toBe(500);
    expect(receiptInboundFeePerBaseUnit(lots.get(2))).toBe(200);
    expect(allocatedInboundFee(allocations, lots)).toBe(540000);
    expect(1200 * 13000 + allocatedInboundFee(allocations, lots)).toBe(16140000);
    expect(1200 * 13500 + allocatedInboundFee(allocations, lots)).toBe(16740000);
  });
});
