import { CustomerRewardHistory } from '../../entities/customer-reward-history.entity';
import { CustomerRewardTracking } from '../../entities/customer-reward-tracking.entity';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { DebtNoteClosure, DebtNoteClosureStatus } from '../../entities/debt-note-closure.entity';
import { InventoryTransaction } from '../../entities/inventory-transactions.entity';
import { DebtNoteService } from './debt-note.service';

describe('debt note reward stock restoration', () => {
  it('restores the exact gift allocation once and rejects reversing the same closure twice', async () => {
    const debtNote = {
      id: 12,
      customer_id: 5,
      code: 'DN-12',
      status: DebtNoteStatus.PAID,
    };
    const closure = {
      id: 88,
      debt_note_id: 12,
      status: DebtNoteClosureStatus.CLOSED,
      after_snapshot: {},
      before_snapshot: {},
      reward_tracking_after: {},
      reward_history_ids: [42],
      gift_cost_ids: [],
    };
    const history = {
      id: 42,
      gift_status: 'delivered',
      gift_product_id: 7,
      gift_quantity: 2,
      gift_inventory_transaction_id: 52,
      stock_allocations: [{ batchId: 99, quantity: 2, taxableQuantity: 1 }],
      notes: null,
    };
    const tracking = {};
    const manager = {
      queryRunner: { isTransactionActive: true },
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === DebtNote) return debtNote;
        if (entity === DebtNoteClosure) {
          return closure.status === DebtNoteClosureStatus.CLOSED ? closure : null;
        }
        if (entity === CustomerRewardTracking) return tracking;
        if (entity === CustomerRewardHistory) return history;
        if (entity === InventoryTransaction) return { id: 52 };
        return null;
      }),
      save: jest.fn(async (value: unknown) => value),
      remove: jest.fn(async () => undefined),
    };
    const restoreStockToExistingBatch = jest
      .fn()
      .mockResolvedValue({ id: 91 });
    const service = Object.assign(Object.create(DebtNoteService.prototype), {
      dataSource: { transaction: (callback: Function) => callback(manager) },
      inventoryService: { restoreStockToExistingBatch },
      snapshotDebtNote: jest.fn().mockReturnValue({}),
      snapshotRewardTracking: jest.fn().mockReturnValue({}),
      snapshotsMatch: jest.fn().mockReturnValue(true),
      applyDebtNoteSnapshot: jest.fn(),
    }) as DebtNoteService;

    const result = await service.reverseCloseSeasonDebtNote(
      12,
      { reason: 'test hoàn tác' } as any,
      9,
    );

    expect(result.inventory_reversal_transaction_ids).toEqual([91]);
    expect(restoreStockToExistingBatch).toHaveBeenCalledTimes(1);
    expect(restoreStockToExistingBatch).toHaveBeenCalledWith(
      7,
      99,
      2,
      1,
      9,
      42,
      'Quà tặng khách hàng #42',
      manager.queryRunner,
      'CUSTOMER_REWARD_GIFT_CANCEL',
      expect.stringContaining('hoàn đúng lô #99'),
    );
    expect(history.gift_status).toBe('cancelled');
    expect(history.stock_allocations).toEqual([]);
    expect(closure.status).toBe(DebtNoteClosureStatus.REVERSED);

    await expect(
      service.reverseCloseSeasonDebtNote(
        12,
        { reason: 'test lặp' } as any,
        9,
      ),
    ).rejects.toThrow(/không có hồ sơ chốt sổ để hoàn tác an toàn/);
    expect(restoreStockToExistingBatch).toHaveBeenCalledTimes(1);
  });

  it('blocks reversing a legacy reward without allocations before changing stock or history', async () => {
    const debtNote = {
      id: 12,
      customer_id: 5,
      code: 'DN-12',
      status: DebtNoteStatus.PAID,
    };
    const closure = {
      id: 88,
      debt_note_id: 12,
      status: DebtNoteClosureStatus.CLOSED,
      after_snapshot: {},
      before_snapshot: {},
      reward_tracking_after: {},
      reward_history_ids: [42],
      gift_cost_ids: [],
    };
    const history = {
      id: 42,
      gift_status: 'delivered',
      gift_product_id: 7,
      gift_quantity: 1,
      stock_allocations: null,
    };
    const manager = {
      queryRunner: { isTransactionActive: true },
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === DebtNote) return debtNote;
        if (entity === DebtNoteClosure) return closure;
        if (entity === CustomerRewardTracking) return {};
        if (entity === CustomerRewardHistory) return history;
        return null;
      }),
      save: jest.fn(),
      remove: jest.fn(),
    };
    const inventoryService = { restoreStockToExistingBatch: jest.fn() };
    const service = Object.assign(Object.create(DebtNoteService.prototype), {
      dataSource: { transaction: (callback: Function) => callback(manager) },
      inventoryService,
      snapshotDebtNote: jest.fn().mockReturnValue({}),
      snapshotRewardTracking: jest.fn().mockReturnValue({}),
      snapshotsMatch: jest.fn().mockReturnValue(true),
    }) as DebtNoteService;

    await expect(service.reverseCloseSeasonDebtNote(12, { reason: 'kiem tra' } as any, 9))
      .rejects.toThrow(/thiếu hoặc sai snapshot phân bổ lô\/thuế/);
    expect(manager.findOne).toHaveBeenCalledWith(
      DebtNote,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(manager.findOne).toHaveBeenCalledWith(
      DebtNoteClosure,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(manager.findOne).toHaveBeenCalledWith(
      CustomerRewardTracking,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(inventoryService.restoreStockToExistingBatch).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });
});
