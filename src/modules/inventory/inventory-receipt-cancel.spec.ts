import { BadRequestException } from '@nestjs/common';
import { InventoryReceipt } from '../../entities/inventory-receipts.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { SupplierSettlementMode } from '../../entities/inventory-receipts.entity';
import { InventoryService } from './inventory.service';
import { ReceiptStatus } from './enums/receipt-status.enum';

function setup() {
  const receipt = {
    id: 7,
    status: ReceiptStatus.APPROVED,
    code: 'REC-TEST-7',
    supplier_settlement_mode: SupplierSettlementMode.STANDARD,
  };
  const item = {
    id: 19,
    receipt_id: 7,
    product_id: 3,
    quantity: 4,
    base_quantity: 8,
    conversion_factor: 2,
  };
  const queryRunner: any = {
    manager: {
      findOne: jest.fn(async (entity: Function) =>
        entity === InventoryReceipt ? receipt : null,
      ),
      find: jest.fn(async (entity: Function) =>
        entity === InventoryReceiptItem ? [item] : [],
      ),
      update: jest.fn(async () => undefined),
      save: jest.fn(async (entity: object) => entity),
    },
    connect: jest.fn(async () => undefined),
    startTransaction: jest.fn(async () => undefined),
    commitTransaction: jest.fn(async () => undefined),
    rollbackTransaction: jest.fn(async () => undefined),
    release: jest.fn(async () => undefined),
  };
  const service = Object.create(InventoryService.prototype) as InventoryService;
  Object.assign(service, {
    inventoryReceiptRepository: {
      manager: { connection: { createQueryRunner: () => queryRunner } },
    },
    logger: { log: jest.fn(), error: jest.fn() },
  });
  jest
    .spyOn(service as any, 'recalculateAverageVatInputCost')
    .mockResolvedValue(0);
  jest
    .spyOn(service as any, 'recalculateAverageCostPriceForProducts')
    .mockResolvedValue(undefined);

  return { service, receipt, item, queryRunner };
}

describe('InventoryService.cancelReceipt stock/tax rollback', () => {
  it('rolls back the exact receipt item quantity and rejects a repeated cancellation', async () => {
    const h = setup();
    const stockOut = jest
      .spyOn(h.service, 'processStockOut')
      .mockResolvedValue({} as any);

    await h.service.cancelReceipt(7, 'test rollback', 42);

    expect(stockOut).toHaveBeenCalledWith(
      3,
      8,
      'RECEIPT_CANCELLATION',
      42,
      7,
      expect.stringContaining('Hủy phiếu nhập #7'),
      h.queryRunner,
      { receiptItemId: 19 },
    );
    expect(h.receipt.status).toBe(ReceiptStatus.CANCELLED);
    expect(h.queryRunner.commitTransaction).toHaveBeenCalledTimes(1);

    await expect(
      h.service.cancelReceipt(7, 'test duplicate', 42),
    ).rejects.toThrow(
      new BadRequestException('Phiếu nhập kho đã bị hủy trước đó'),
    );
    expect(stockOut).toHaveBeenCalledTimes(1);
  });

  it('keeps an approved receipt active when exact-lot rollback fails', async () => {
    const h = setup();
    jest
      .spyOn(h.service, 'processStockOut')
      .mockRejectedValue(new Error('Không đủ tồn ở lô nguồn'));

    await expect(
      h.service.cancelReceipt(7, 'test insufficient stock', 42),
    ).rejects.toThrow(
      new BadRequestException(
        'Không thể hủy phiếu nhập kho: Không đủ tồn ở lô nguồn',
      ),
    );

    expect(h.receipt.status).toBe(ReceiptStatus.APPROVED);
    expect(h.queryRunner.manager.save).not.toHaveBeenCalled();
    expect(h.queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('uses a clear fallback when cancellation reason is missing', async () => {
    const h = setup();
    const stockOut = jest
      .spyOn(h.service, 'processStockOut')
      .mockResolvedValue({} as any);

    await h.service.cancelReceipt(7, undefined as unknown as string, 42);

    expect(stockOut).toHaveBeenCalledWith(
      3,
      8,
      'RECEIPT_CANCELLATION',
      42,
      7,
      'Hủy phiếu nhập #7 (Sản phẩm 3): Không ghi lý do',
      h.queryRunner,
      { receiptItemId: 19 },
    );
    expect((h.receipt as any).cancelled_reason).toBe('Không ghi lý do');
  });
});

describe('InventoryService.approveReceipt stock/tax posting', () => {
  it('converts receipt tax quantity to base units and rejects duplicate approval', async () => {
    const h = setup();
    h.receipt.status = ReceiptStatus.DRAFT;
    Object.assign(h.item, {
      taxable_quantity: 1,
      tax_selling_price: 200,
      unit_cost: 300,
      final_unit_cost: 300,
      expiry_date: undefined,
    });
    jest
      .spyOn(h.service as any, 'validateReceiptSettlementMode')
      .mockResolvedValue(SupplierSettlementMode.STANDARD);
    jest
      .spyOn(h.service as any, 'recalculateAverageCostPriceForProducts')
      .mockResolvedValue(undefined);
    const stockIn = jest
      .spyOn(h.service, 'processStockIn')
      .mockResolvedValue({ batch: { code: 'LOT-TEST-7-1' } } as any);

    await h.service.approveReceipt(7, 42);

    expect(stockIn).toHaveBeenCalledWith(
      3,
      8,
      150,
      42,
      19,
      'LOT-TEST-7-1',
      undefined,
      h.queryRunner,
      2,
    );
    expect(h.receipt.status).toBe(ReceiptStatus.APPROVED);
    expect(h.queryRunner.commitTransaction).toHaveBeenCalledTimes(1);

    await expect(h.service.approveReceipt(7, 42)).rejects.toThrow(
      new BadRequestException('Chỉ có thể duyệt phiếu ở trạng thái nháp'),
    );
    expect(stockIn).toHaveBeenCalledTimes(1);
  });
});
