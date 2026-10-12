import { InventoryService } from './inventory.service';
import { InventoryReturn } from '../../entities/inventory-returns.entity';
import { InventoryReturnItem } from '../../entities/inventory-return-items.entity';
import { ReturnStatus } from './enums/return-status.enum';

describe('supplier return source-batch restoration', () => {
  it('restores each persisted batch allocation with its taxable quantity on cancellation', async () => {
    const returnDoc = Object.assign(new InventoryReturn(), {
      id: 9,
      code: 'RT-9',
      status: ReturnStatus.APPROVED,
    });
    const item = Object.assign(new InventoryReturnItem(), {
      id: 10,
      return_id: 9,
      product_id: 1,
      quantity: 5,
      base_quantity: 5,
      stock_allocations: [
        { batchId: 101, quantity: 3, taxableQuantity: 2 },
        { batchId: 102, quantity: 2, taxableQuantity: 0 },
      ],
    });
    const manager = {
      findOne: jest.fn().mockResolvedValue(returnDoc),
      find: jest.fn().mockResolvedValue([item]),
      save: jest.fn().mockResolvedValue(returnDoc),
    };
    const runner = {
      manager,
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
    const service = Object.create(InventoryService.prototype) as any;
    service.logger = { error: jest.fn(), log: jest.fn() };
    service.inventoryReturnRepository = {
      manager: { connection: { createQueryRunner: () => runner } },
    };
    service.restoreStockToExistingBatch = jest.fn().mockResolvedValue(undefined);
    service.recalculateAverageCostPriceForProducts = jest.fn().mockResolvedValue(undefined);

    await service.cancelReturn(9, 'test', 3);

    expect(service.restoreStockToExistingBatch.mock.calls).toEqual([
      [1, 101, 3, 2, 3, 9, 'RT-9', runner],
      [1, 102, 2, 0, 3, 9, 'RT-9', runner],
    ]);
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
  });
});
