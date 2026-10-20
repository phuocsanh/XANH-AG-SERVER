import { CustomerRewardHistory } from '../../entities/customer-reward-history.entity';
import { Product } from '../../entities/products.entity';
import { CustomerRewardService } from './customer-reward.service';
import { validateCustomerRewardStockAllocations } from './customer-reward-stock-allocations';

describe('customer reward stock allocations', () => {
  it('accepts allocations whose quantities and taxable quantities are exact', () => {
    expect(validateCustomerRewardStockAllocations(5, [
      { batchId: 10, quantity: 2, taxableQuantity: 0 },
      { batchId: 11, quantity: 3, taxableQuantity: 2 },
    ])).toEqual({
      allocations: [
        { batchId: 10, quantity: 2, taxableQuantity: 0 },
        { batchId: 11, quantity: 3, taxableQuantity: 2 },
      ],
    });
  });

  it('does not expose internal batch/tax allocations in customer reward history', async () => {
    const service = Object.assign(Object.create(CustomerRewardService.prototype), {
      rewardHistoryRepository: {
        findAndCount: jest.fn().mockResolvedValue([[
          { id: 8, gift_value: 500, stock_allocations: [{ batchId: 9, quantity: 1, taxableQuantity: 1 }] },
        ], 1]),
      },
      rewardTrackingRepository: { findOne: jest.fn() },
      systemSettingRepository: { findOne: jest.fn().mockResolvedValue(null) },
    }) as CustomerRewardService;

    const result = await service.getMyRewardHistory(3);

    expect(result.items[0]).not.toHaveProperty('gift_value');
    expect(result.items[0]).not.toHaveProperty('stock_allocations');
  });

  it.each([
    [5, null],
    [5, [{ batchId: 10, quantity: 4, taxableQuantity: 0 }]],
    [2, [{ batchId: 10, quantity: 2, taxableQuantity: 3 }]],
    [2, [
      { batchId: 10, quantity: 1, taxableQuantity: 0 },
      { batchId: 10, quantity: 1, taxableQuantity: 1 },
    ]],
    [1, [{ batchId: 10, quantity: 1, taxableQuantity: null }]],
    [1, [{ batchId: 10, quantity: 1, taxableQuantity: '' }]],
    [1, [{ batchId: 10, quantity: 1 }]],
    [1, {}],
  ])('rejects missing, mismatched, or invalid snapshots', (quantity, allocations) => {
    expect(validateCustomerRewardStockAllocations(
      quantity as number,
      allocations,
    )).toHaveProperty('error');
  });

  it('blocks changing stock for a legacy reward without touching inventory', async () => {
    const history = {
      id: 42,
      gift_product_id: 7,
      gift_quantity: 1,
      gift_status: 'delivered',
      gift_unit_price: 100,
      gift_product_name: 'Quà',
      stock_allocations: null,
    };
    const manager = {
      queryRunner: { isTransactionActive: true },
      findOne: jest.fn(async (entity: unknown) =>
        entity === CustomerRewardHistory ? history : { id: 7, name: 'Quà' }),
    };
    const inventoryService = {
      processStockIn: jest.fn(),
      processStockOut: jest.fn(),
      restoreStockToExistingBatch: jest.fn(),
    };
    const service = Object.assign(Object.create(CustomerRewardService.prototype), {
      rewardHistoryRepository: { manager: { transaction: (callback: Function) => callback(manager) } },
      debtNoteRepository: { manager },
      inventoryService,
    }) as CustomerRewardService;

    await expect(service.updateHistory(42, { gift_quantity: 2 } as any, 9))
      .rejects.toThrow(/thiếu hoặc sai phân bổ lô\/thuế/);
    expect(inventoryService.processStockIn).not.toHaveBeenCalled();
    expect(inventoryService.processStockOut).not.toHaveBeenCalled();
    expect(inventoryService.restoreStockToExistingBatch).not.toHaveBeenCalled();
  });

  it('blocks deleting a legacy physical reward before changing tracking or inventory', async () => {
    const history = {
      id: 43,
      customer_id: 5,
      reward_type: 'ACCUMULATION_REWARD',
      gift_product_id: 7,
      gift_quantity: 1,
      stock_allocations: null,
    };
    const manager = {
      queryRunner: { isTransactionActive: true },
      findOne: jest.fn(async (entity: unknown) =>
        entity === CustomerRewardHistory ? history : null),
      save: jest.fn(),
      remove: jest.fn(),
    };
    const inventoryService = { restoreStockToExistingBatch: jest.fn() };
    const service = Object.assign(Object.create(CustomerRewardService.prototype), {
      rewardHistoryRepository: { manager: { transaction: (callback: Function) => callback(manager) } },
      inventoryService,
    }) as CustomerRewardService;

    await expect(service.deleteHistory(43, 9))
      .rejects.toThrow(/thiếu hoặc sai phân bổ lô\/thuế/);
    expect(manager.save).not.toHaveBeenCalled();
    expect(manager.remove).not.toHaveBeenCalled();
    expect(inventoryService.restoreStockToExistingBatch).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON allocations even for an undelivered reward', async () => {
    const history = {
      id: 48,
      customer_id: 5,
      reward_type: 'APPRECIATION_GIFT',
      gift_product_id: 7,
      gift_quantity: 1,
      gift_status: 'pending',
      stock_allocations: {} as any,
    };
    const manager = {
      queryRunner: { isTransactionActive: true },
      findOne: jest.fn(async (entity: unknown) =>
        entity === CustomerRewardHistory ? history : null),
      save: jest.fn(),
      remove: jest.fn(),
    };
    const service = Object.assign(Object.create(CustomerRewardService.prototype), {
      rewardHistoryRepository: { manager: { transaction: (callback: Function) => callback(manager) } },
      inventoryService: { restoreStockToExistingBatch: jest.fn() },
    }) as CustomerRewardService;

    await expect(service.deleteHistory(48, 9))
      .rejects.toThrow(/thiếu phân bổ lô và số lượng thuế/);
    expect(manager.save).not.toHaveBeenCalled();
    expect(manager.remove).not.toHaveBeenCalled();
  });

  it('restores the original batch snapshot before reissuing an edited reward', async () => {
    const history = {
      id: 44,
      customer_id: 5,
      customer_name: 'Khách',
      gift_product_id: 7,
      gift_quantity: 1,
      gift_status: 'delivered',
      gift_unit_price: 100,
      gift_product_name: 'Quà',
      gift_inventory_transaction_id: 51,
      stock_allocations: [{ batchId: 99, quantity: 1, taxableQuantity: 1 }],
    };
    const manager = {
      queryRunner: { isTransactionActive: true },
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === CustomerRewardHistory) return history;
        if (entity === Product) return { id: 7, name: 'Quà' };
        return null;
      }),
      save: jest.fn(async (value: unknown) => value),
    };
    const inventoryService = {
      restoreStockToExistingBatch: jest.fn().mockResolvedValue(undefined),
      processStockOut: jest.fn().mockResolvedValue({
        transaction: { id: 52 },
        taxableQuantity: 1,
        affectedBatches: [{ batchId: 99, deductedQuantity: 2, taxableQuantity: 1 }],
      }),
    };
    const service = Object.assign(Object.create(CustomerRewardService.prototype), {
      rewardHistoryRepository: { manager: { transaction: (callback: Function) => callback(manager) } },
      inventoryService,
    }) as CustomerRewardService;

    await service.updateHistory(44, { gift_quantity: 2 } as any, 9);

    expect(inventoryService.restoreStockToExistingBatch).toHaveBeenCalledWith(
      7,
      99,
      1,
      1,
      9,
      44,
      'Quà tặng khách hàng #44',
      manager.queryRunner,
      'CUSTOMER_REWARD_GIFT_CANCEL',
      expect.stringContaining('hoàn đúng lô #99'),
    );
    expect(inventoryService.processStockOut).toHaveBeenCalledWith(
      7,
      2,
      'CUSTOMER_REWARD_GIFT',
      9,
      44,
      expect.any(String),
      manager.queryRunner,
      { requireBatchTaxSnapshot: true },
    );
    expect(history.stock_allocations).toEqual([
      { batchId: 99, quantity: 2, taxableQuantity: 1 },
    ]);
  });

  it('returns delivered gift stock when status changes to cancelled', async () => {
    const history = {
      id: 45,
      customer_id: 5,
      customer_name: 'Khách',
      gift_product_id: 7,
      gift_quantity: 1,
      gift_unit_price: 100,
      gift_status: 'delivered',
      gift_inventory_transaction_id: 52,
      stock_allocations: [{ batchId: 99, quantity: 1, taxableQuantity: 1 }],
    };
    const manager = {
      queryRunner: { isTransactionActive: true },
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === CustomerRewardHistory) return history;
        if (entity === Product) return { id: 7, name: 'Quà' };
        return null;
      }),
      save: jest.fn(async (value: unknown) => value),
    };
    const inventoryService = {
      restoreStockToExistingBatch: jest.fn().mockResolvedValue(undefined),
      processStockOut: jest.fn(),
    };
    const service = Object.assign(Object.create(CustomerRewardService.prototype), {
      rewardHistoryRepository: { manager: { transaction: (callback: Function) => callback(manager) } },
      inventoryService,
    }) as CustomerRewardService;

    await service.updateHistory(45, { gift_status: 'cancelled' } as any, 9);

    expect(inventoryService.restoreStockToExistingBatch).toHaveBeenCalledTimes(1);
    expect(inventoryService.processStockOut).not.toHaveBeenCalled();
    expect(history.stock_allocations).toEqual([]);
    expect(history.gift_inventory_transaction_id).toBeNull();
  });

  it('does not restore customer reward stock again when cancellation is repeated', async () => {
    const history = {
      id: 45,
      customer_id: 5,
      customer_name: 'Khách',
      gift_product_id: 7,
      gift_quantity: 1,
      gift_unit_price: 100,
      gift_status: 'delivered',
      gift_inventory_transaction_id: 52,
      stock_allocations: [{ batchId: 99, quantity: 1, taxableQuantity: 1 }],
    };
    const manager = {
      queryRunner: { isTransactionActive: true },
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === CustomerRewardHistory) return history;
        if (entity === Product) return { id: 7, name: 'Quà' };
        return null;
      }),
      save: jest.fn(async (value: unknown) => value),
    };
    const inventoryService = {
      restoreStockToExistingBatch: jest.fn().mockResolvedValue(undefined),
      processStockOut: jest.fn(),
    };
    const service = Object.assign(Object.create(CustomerRewardService.prototype), {
      rewardHistoryRepository: {
        manager: { transaction: (callback: Function) => callback(manager) },
      },
      inventoryService,
    }) as CustomerRewardService;

    await service.updateHistory(45, { gift_status: 'cancelled' } as any, 9);
    await service.updateHistory(45, { gift_status: 'cancelled' } as any, 9);

    expect(inventoryService.restoreStockToExistingBatch).toHaveBeenCalledTimes(1);
    expect(inventoryService.restoreStockToExistingBatch).toHaveBeenCalledWith(
      7,
      99,
      1,
      1,
      9,
      45,
      expect.any(String),
      manager.queryRunner,
      'CUSTOMER_REWARD_GIFT_CANCEL',
      expect.any(String),
    );
    expect(inventoryService.processStockOut).not.toHaveBeenCalled();
    expect(history.gift_status).toBe('cancelled');
    expect(history.stock_allocations).toEqual([]);
  });

  it('blocks changing a delivered gift whose snapshot is empty', async () => {
    const history = {
      id: 47,
      gift_product_id: 7,
      gift_quantity: 1,
      gift_status: 'delivered',
      stock_allocations: [],
    };
    const manager = {
      queryRunner: { isTransactionActive: true },
      findOne: jest.fn(async (entity: unknown) =>
        entity === CustomerRewardHistory ? history : { id: 7, name: 'Quà' }),
      save: jest.fn(),
    };
    const inventoryService = {
      restoreStockToExistingBatch: jest.fn(),
      processStockOut: jest.fn(),
    };
    const service = Object.assign(Object.create(CustomerRewardService.prototype), {
      rewardHistoryRepository: { manager: { transaction: (callback: Function) => callback(manager) } },
      inventoryService,
    }) as CustomerRewardService;

    await expect(service.updateHistory(47, { gift_status: 'cancelled' } as any, 9))
      .rejects.toThrow(/thiếu phân bổ lô và số lượng thuế/);
    expect(inventoryService.restoreStockToExistingBatch).not.toHaveBeenCalled();
    expect(inventoryService.processStockOut).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('issues and snapshots stock when a cancelled gift becomes delivered', async () => {
    const history = {
      id: 46,
      customer_id: 5,
      customer_name: 'Khách',
      gift_product_id: 7,
      gift_quantity: 1,
      gift_unit_price: 100,
      gift_status: 'cancelled',
      gift_inventory_transaction_id: null,
      stock_allocations: [],
    };
    const manager = {
      queryRunner: { isTransactionActive: true },
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === CustomerRewardHistory) return history;
        if (entity === Product) return { id: 7, name: 'Quà' };
        return null;
      }),
      save: jest.fn(async (value: unknown) => value),
    };
    const inventoryService = {
      restoreStockToExistingBatch: jest.fn(),
      processStockOut: jest.fn().mockResolvedValue({
        transaction: { id: 53 },
        taxableQuantity: 0,
        affectedBatches: [{ batchId: 100, deductedQuantity: 1, taxableQuantity: 0 }],
      }),
    };
    const service = Object.assign(Object.create(CustomerRewardService.prototype), {
      rewardHistoryRepository: { manager: { transaction: (callback: Function) => callback(manager) } },
      inventoryService,
    }) as CustomerRewardService;

    await service.updateHistory(46, { gift_status: 'delivered' } as any, 9);

    expect(inventoryService.restoreStockToExistingBatch).not.toHaveBeenCalled();
    expect(inventoryService.processStockOut).toHaveBeenCalledWith(
      7,
      1,
      'CUSTOMER_REWARD_GIFT',
      9,
      46,
      expect.any(String),
      manager.queryRunner,
      { requireBatchTaxSnapshot: true },
    );
    expect(history.stock_allocations).toEqual([
      { batchId: 100, quantity: 1, taxableQuantity: 0 },
    ]);
    expect(history.gift_inventory_transaction_id).toBe(53);
  });
});
