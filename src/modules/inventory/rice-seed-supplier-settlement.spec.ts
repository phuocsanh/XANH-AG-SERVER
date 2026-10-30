import { InventoryReceiptSupplierSettlement } from '../../entities/inventory-receipt-supplier-settlements.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { InventoryReceipt, SupplierSettlementMode } from '../../entities/inventory-receipts.entity';
import { InventoryReturnItem } from '../../entities/inventory-return-items.entity';
import { InventoryService } from './inventory.service';

describe('quyết toán NCC lúa giống và chiết khấu theo kg', () => {
  it('trừ chiết khấu trên kg nhập ròng sau phiếu trả NCC đã duyệt', async () => {
    const receipt = Object.assign(new InventoryReceipt(), {
      id: 55,
      supplier_settlement_mode: SupplierSettlementMode.BY_SALE_TYPE,
      items: [Object.assign(new InventoryReceiptItem(), {
        id: 101,
        quantity: 10,
        conversion_factor: 40,
        base_quantity: 400,
        total_price: 500_000,
        supplier_rebate_per_base_unit: 250,
      })],
      shared_shipping_cost: 0,
      paid_amount: 100_000,
    });
    const returnedQuery = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        Object.assign(new InventoryReturnItem(), {
          id: 301,
          return_id: 77,
          receipt_item_id: 101,
          base_quantity: 40,
        }),
      ]),
    };
    const manager = {
      findOne: jest.fn().mockResolvedValue(receipt),
      find: jest.fn().mockResolvedValue([{ amount: 400_000 }]),
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(returnedQuery),
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const service = Object.create(InventoryService.prototype) as any;

    await service.recalculateBySaleTypeReceiptFinance(55, { manager } as any);

    expect(returnedQuery.andWhere).toHaveBeenCalledWith(
      'returnDoc.status = :status',
      { status: 'approved' },
    );
    expect(manager.update).toHaveBeenCalledWith(InventoryReceipt, 55, expect.objectContaining({
      supplier_rebate_total: 90_000,
      supplier_amount: 310_000,
      final_amount: 310_000,
      debt_amount: 210_000,
      payment_status: 'partial',
    }));
  });

  it('tạo khoản đảo quyết toán âm khi khách trả lúa giống', async () => {
    const receipt = Object.assign(new InventoryReceipt(), {
      id: 55,
      supplier_settlement_mode: SupplierSettlementMode.BY_SALE_TYPE,
      supplier_id: 9,
    });
    const receiptItem = Object.assign(new InventoryReceiptItem(), {
      id: 101,
      receipt_id: 55,
      receipt,
    });
    const repository = {
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const manager = {
      find: jest.fn().mockResolvedValue([receiptItem]),
      getRepository: jest.fn((entity: Function) => entity === InventoryReceiptSupplierSettlement
        ? repository
        : { find: jest.fn().mockResolvedValue([receiptItem]) }),
      create: jest.fn((_entity, data) => data),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const service = Object.create(InventoryService.prototype) as any;
    const recalculate = jest.spyOn(service, 'recalculateBySaleTypeReceiptFinance')
      .mockResolvedValue(undefined);

    await service.createSupplierSettlementReturnEntries(77, [{
      receipt_item_id: 101,
      product_id: 7,
      invoice_id: 800,
      sales_invoice_item_id: 900,
      quantity: 40,
      unit_cost: 2_000,
    }], { manager } as any);

    expect(manager.save).toHaveBeenCalledWith(InventoryReceiptSupplierSettlement, [expect.objectContaining({
      receipt_id: 55,
      receipt_item_id: 101,
      sales_return_id: 77,
      entry_type: 'return',
      quantity: -40,
      amount: -80_000,
    })]);
    expect(recalculate).toHaveBeenCalledWith(55, { manager });
  });

  it('xóa khoản hoàn quyết toán khi hủy phiếu khách trả lúa giống', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([{ id: 41, receipt_id: 55 }]),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const manager = { getRepository: jest.fn().mockReturnValue(repository) };
    const service = Object.create(InventoryService.prototype) as any;
    const recalculate = jest.spyOn(service, 'recalculateBySaleTypeReceiptFinance')
      .mockResolvedValue(undefined);

    await service.removeSupplierSettlementForSalesReturn(77, { manager } as any);

    expect(repository.find).toHaveBeenCalledWith({
      where: { sales_return_id: 77, entry_type: 'return' },
      select: ['id', 'receipt_id'],
    });
    expect(repository.delete).toHaveBeenCalledWith([41]);
    expect(recalculate).toHaveBeenCalledWith(55, { manager });
  });

  it('xóa khoản bán và tính lại công nợ khi hủy hóa đơn lúa giống', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([{ id: 42, receipt_id: 55 }]),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const manager = { getRepository: jest.fn().mockReturnValue(repository) };
    const service = Object.create(InventoryService.prototype) as any;
    const recalculate = jest.spyOn(service, 'recalculateBySaleTypeReceiptFinance')
      .mockResolvedValue(undefined);

    await service.removeSupplierSettlementForInvoice(800, { manager } as any);

    expect(repository.find).toHaveBeenCalledWith({
      where: { invoice_id: 800, entry_type: 'sale' },
      select: ['id', 'receipt_id'],
    });
    expect(repository.delete).toHaveBeenCalledWith([42]);
    expect(recalculate).toHaveBeenCalledWith(55, { manager });
  });
});
