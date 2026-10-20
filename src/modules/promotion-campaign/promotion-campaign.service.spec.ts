import { BadRequestException } from '@nestjs/common';
import { CustomerPromotionOverride } from '../../entities/customer-promotion-override.entity';
import { PromotionRewardPool } from '../../entities/promotion-reward-pool.entity';
import { PromotionRewardReservation } from '../../entities/promotion-reward-reservation.entity';
import { InventoryService } from '../inventory/inventory.service';
import { PromotionCampaignService } from './promotion-campaign.service';

describe('PromotionCampaignService product rewards', () => {
  const makeHarness = (options?: {
    status?: string;
    productId?: number | null;
    poolProductId?: number | null;
    missingPool?: boolean;
    pendingForceWins?: number;
    quantity?: number | null;
    allocations?: PromotionRewardReservation['stock_allocations'];
    stockOutAffectedBatches?: Array<{
      batchId: number;
      deductedQuantity: number;
      taxableQuantity: number;
    }>;
    failStockOut?: Error;
    failRestoreStock?: Error;
    failRestoreOnCall?: number;
  }) => {
    const rewardProductId = options?.productId === undefined ? 21 : options.productId;
    const poolProductId = options?.poolProductId === undefined
      ? rewardProductId
      : options.poolProductId;
    const pendingForceWins = options?.pendingForceWins || 0;
    const reservation = {
      id: 70,
      promotion_id: 4,
      reward_pool_id: 8,
      status: options?.status || 'reserved',
      reward_product_id: rewardProductId,
      reward_product_quantity: options?.quantity ?? 2,
      stock_allocations: options?.allocations ?? null,
      issued_by: 12,
    } as PromotionRewardReservation;
    const pool = {
      id: 8,
      promotion_id: 4,
      total_quantity: 5,
      remaining_quantity: 3,
      reserved_quantity: 1,
      issued_quantity: 1,
      reward_product_id: poolProductId,
      reward_product_quantity: 2,
    } as PromotionRewardPool;
    const manager = {
      findOne: jest.fn(async (entity: { name?: string }) => {
        if (entity === PromotionRewardReservation) return reservation;
        if (entity === PromotionRewardPool) return options?.missingPool ? null : pool;
        return null;
      }),
      save: jest.fn(async (entity: unknown) => entity),
      count: jest.fn(async (entity: unknown, options: { where: { status?: string } }) => {
        if (entity === CustomerPromotionOverride) return pendingForceWins;
        return reservation.status === options.where.status ? 1 : 0;
      }),
    };
    const queryRunner = {
      manager,
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
    const stockOut = options?.failStockOut
      ? jest.fn().mockRejectedValue(options.failStockOut)
      : jest.fn().mockResolvedValue({
          transaction: { id: 901 },
          affectedBatches: options?.stockOutAffectedBatches ?? [
            { batchId: 31, deductedQuantity: 1, taxableQuantity: 1 },
            { batchId: 32, deductedQuantity: 1, taxableQuantity: 0 },
          ],
        });
    const restoreStockToExistingBatch = jest.fn().mockResolvedValue({ id: 902 });
    if (options?.failRestoreStock) {
      const failOnCall = Math.max(1, options.failRestoreOnCall || 1);
      for (let call = 1; call < failOnCall; call += 1) {
        restoreStockToExistingBatch.mockResolvedValueOnce({ id: 902 });
      }
      restoreStockToExistingBatch.mockRejectedValueOnce(options.failRestoreStock);
    }
    const inventoryService = {
      processStockOut: stockOut,
      restoreStockToExistingBatch,
    } as unknown as InventoryService;
    const dataSource = {
      createQueryRunner: jest.fn(() => queryRunner),
    };
    const service = new PromotionCampaignService(
      dataSource as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      inventoryService,
    );

    return {
      service,
      reservation,
      pool,
      manager,
      queryRunner,
      stockOut,
      restoreStockToExistingBatch,
    };
  };

  it('exports product reward by FIFO and saves per-batch taxable snapshot transactionally', async () => {
    const h = makeHarness();

    await h.service.issueReservation(4, 70, 12);

    expect(h.stockOut).toHaveBeenCalledWith(
      21,
      2,
      'PROMOTION_REWARD_GIFT',
      12,
      70,
      expect.any(String),
      h.queryRunner,
      { requireBatchTaxSnapshot: true },
    );
    expect(h.reservation.stock_allocations).toEqual([
      { batchId: 31, quantity: 1, taxableQuantity: 1 },
      { batchId: 32, quantity: 1, taxableQuantity: 0 },
    ]);
    expect(h.reservation.gift_inventory_transaction_id).toBe(901);
    expect(h.reservation.status).toBe('issued');
    expect(h.pool.reserved_quantity).toBe(0);
    expect(h.pool.issued_quantity).toBe(1);
    expect(h.queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      caseName: 'batch quantities do not equal the issued gift quantity',
      affectedBatches: [
        { batchId: 31, deductedQuantity: 1, taxableQuantity: 0 },
      ],
    },
    {
      caseName: 'taxable quantity exceeds the batch quantity',
      affectedBatches: [
        { batchId: 31, deductedQuantity: 2, taxableQuantity: 3 },
      ],
    },
  ])('rejects invalid stock-out snapshots when $caseName', async ({ affectedBatches }) => {
    const h = makeHarness({ stockOutAffectedBatches: affectedBatches });

    await expect(h.service.issueReservation(4, 70, 12)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(h.reservation.status).toBe('reserved');
    expect(h.reservation.stock_allocations).toBeNull();
    expect(h.pool.reserved_quantity).toBe(1);
    expect(h.pool.issued_quantity).toBe(1);
    expect(h.manager.save).not.toHaveBeenCalled();
    expect(h.queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('prevents issuing a product reward more than once', async () => {
    const h = makeHarness({ status: 'issued' });

    await expect(h.service.issueReservation(4, 70, 12)).rejects.toThrow(
      'Chỉ có thể xác nhận trao quà đang được reserve',
    );

    expect(h.stockOut).not.toHaveBeenCalled();
    expect(h.manager.save).not.toHaveBeenCalled();
    expect(h.reservation.status).toBe('issued');
    expect(h.queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('does not issue a reward if its pool configuration is missing', async () => {
    const h = makeHarness({ missingPool: true });

    await expect(h.service.issueReservation(4, 70, 12)).rejects.toThrow(
      'Không tìm thấy cấu hình quà',
    );

    expect(h.stockOut).not.toHaveBeenCalled();
    expect(h.reservation.status).toBe('reserved');
    expect(h.manager.save).not.toHaveBeenCalled();
    expect(h.queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('snapshots and restores the full taxable quantity for a fully-taxable gift batch', async () => {
    const issue = makeHarness({
      quantity: 2,
      stockOutAffectedBatches: [
        { batchId: 31, deductedQuantity: 2, taxableQuantity: 2 },
      ],
    });

    await issue.service.issueReservation(4, 70, 12);

    expect(issue.reservation.stock_allocations).toEqual([
      { batchId: 31, quantity: 2, taxableQuantity: 2 },
    ]);
    expect(issue.reservation.status).toBe('issued');

    const cancel = makeHarness({
      status: 'issued',
      quantity: 2,
      allocations: issue.reservation.stock_allocations,
    });

    await cancel.service.cancelIssueReservation(4, 70, 19);

    expect(cancel.restoreStockToExistingBatch).toHaveBeenCalledTimes(1);
    expect(cancel.restoreStockToExistingBatch).toHaveBeenCalledWith(
      21,
      31,
      2,
      2,
      19,
      70,
      expect.any(String),
      cancel.queryRunner,
      'PROMOTION_REWARD_GIFT_CANCEL',
      expect.stringContaining('lô #31'),
    );
    expect(cancel.reservation.status).toBe('reserved');
    expect(cancel.queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('keeps a fully non-taxable gift batch at zero taxable quantity when issued and cancelled', async () => {
    const issue = makeHarness({
      quantity: 2,
      stockOutAffectedBatches: [
        { batchId: 40, deductedQuantity: 2, taxableQuantity: 0 },
      ],
    });

    await issue.service.issueReservation(4, 70, 12);

    expect(issue.reservation.stock_allocations).toEqual([
      { batchId: 40, quantity: 2, taxableQuantity: 0 },
    ]);

    const cancel = makeHarness({
      status: 'issued',
      quantity: 2,
      allocations: issue.reservation.stock_allocations,
    });

    await cancel.service.cancelIssueReservation(4, 70, 19);

    expect(cancel.restoreStockToExistingBatch).toHaveBeenCalledWith(
      21,
      40,
      2,
      0,
      19,
      70,
      expect.any(String),
      cancel.queryRunner,
      'PROMOTION_REWARD_GIFT_CANCEL',
      expect.stringContaining('lô #40'),
    );
    expect(cancel.reservation.status).toBe('reserved');
    expect(cancel.queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('reissues a cancelled product gift with a fresh stock-out snapshot', async () => {
    const h = makeHarness({
      status: 'issued',
      quantity: 2,
      allocations: [{ batchId: 30, quantity: 2, taxableQuantity: 2 }],
    });
    h.reservation.gift_inventory_transaction_id = 899;

    await h.service.cancelIssueReservation(4, 70, 19);

    expect(h.restoreStockToExistingBatch).toHaveBeenCalledWith(
      21,
      30,
      2,
      2,
      19,
      70,
      expect.any(String),
      h.queryRunner,
      'PROMOTION_REWARD_GIFT_CANCEL',
      expect.stringContaining('lô #30'),
    );
    expect(h.reservation.status).toBe('reserved');
    expect(h.reservation.stock_allocations).toEqual([
      { batchId: 30, quantity: 2, taxableQuantity: 2 },
    ]);
    expect(h.pool.reserved_quantity).toBe(1);
    expect(h.pool.issued_quantity).toBe(0);
    expect(h.pool.remaining_quantity).toBe(4);

    await h.service.issueReservation(4, 70, 12);

    expect(h.stockOut).toHaveBeenCalledTimes(1);
    expect(h.reservation.status).toBe('issued');
    expect(h.reservation.gift_inventory_transaction_id).toBe(901);
    expect(h.reservation.stock_allocations).toEqual([
      { batchId: 31, quantity: 1, taxableQuantity: 1 },
      { batchId: 32, quantity: 1, taxableQuantity: 0 },
    ]);
    expect(h.pool.reserved_quantity).toBe(0);
    expect(h.pool.issued_quantity).toBe(1);
    expect(h.pool.remaining_quantity).toBe(4);
    expect(h.queryRunner.commitTransaction).toHaveBeenCalledTimes(2);
  });

  it('keeps non-product rewards out of inventory', async () => {
    const h = makeHarness({ productId: null });

    await h.service.issueReservation(4, 70, 12);

    expect(h.stockOut).not.toHaveBeenCalled();
    expect(h.reservation.stock_allocations).toBeNull();
    expect(h.reservation.status).toBe('issued');
    expect(h.queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('does not change an existing text-only reservation into a product gift after pool edits', async () => {
    const h = makeHarness({ productId: null, poolProductId: 99 });

    await h.service.issueReservation(4, 70, 12);

    expect(h.stockOut).not.toHaveBeenCalled();
    expect(h.reservation.reward_product_id).toBeNull();
    expect(h.reservation.stock_allocations).toBeNull();
  });

  it('preserves a separately reserved force-win quota when issuing another reward', async () => {
    const h = makeHarness({ pendingForceWins: 1 });

    await h.service.issueReservation(4, 70, 12);

    expect(h.pool.reserved_quantity).toBe(1);
    expect(h.pool.issued_quantity).toBe(1);
    expect(h.pool.remaining_quantity).toBe(3);
  });

  it('restores each exact batch and taxable quantity when issued product reward is cancelled', async () => {
    const h = makeHarness({
      status: 'issued',
      productId: 21,
      quantity: 2,
      allocations: [
        { batchId: 31, quantity: 1, taxableQuantity: 1 },
        { batchId: 32, quantity: 1, taxableQuantity: 0 },
      ],
    });

    await h.service.cancelIssueReservation(4, 70, 19);

    expect(h.restoreStockToExistingBatch).toHaveBeenNthCalledWith(
      1,
      21,
      31,
      1,
      1,
      19,
      70,
      expect.any(String),
      h.queryRunner,
      'PROMOTION_REWARD_GIFT_CANCEL',
      expect.stringContaining('lô #31'),
    );
    expect(h.restoreStockToExistingBatch).toHaveBeenNthCalledWith(
      2,
      21,
      32,
      1,
      0,
      19,
      70,
      expect.any(String),
      h.queryRunner,
      'PROMOTION_REWARD_GIFT_CANCEL',
      expect.stringContaining('lô #32'),
    );
    expect(h.reservation.status).toBe('reserved');
    expect(h.pool.reserved_quantity).toBe(1);
    expect(h.pool.issued_quantity).toBe(0);
    expect(h.queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('does not restore promotion gift stock twice when cancellation is repeated', async () => {
    const h = makeHarness({
      status: 'issued',
      productId: 21,
      quantity: 2,
      allocations: [
        { batchId: 31, quantity: 1, taxableQuantity: 1 },
        { batchId: 32, quantity: 1, taxableQuantity: 0 },
      ],
    });

    await h.service.cancelIssueReservation(4, 70, 19);

    await expect(h.service.cancelIssueReservation(4, 70, 19)).rejects.toThrow(
      'Chỉ có thể hoàn tác quà đang ở trạng thái "Đã trao"',
    );

    expect(h.restoreStockToExistingBatch).toHaveBeenCalledTimes(2);
    expect(h.reservation.status).toBe('reserved');
    expect(h.pool.issued_quantity).toBe(0);
    expect(h.queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('blocks cancellation before stock changes when a physical reward lacks its snapshot', async () => {
    const h = makeHarness({ status: 'issued', allocations: null });

    await expect(h.service.cancelIssueReservation(4, 70, 19)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(h.restoreStockToExistingBatch).not.toHaveBeenCalled();
    expect(h.reservation.status).toBe('issued');
    expect(h.queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      caseName: 'allocation total is below the issued gift quantity',
      allocations: [{ batchId: 31, quantity: 1, taxableQuantity: 0 }],
    },
    {
      caseName: 'taxable allocation exceeds the batch quantity',
      allocations: [{ batchId: 31, quantity: 2, taxableQuantity: 3 }],
    },
  ])('blocks cancellation when $caseName', async ({ allocations }) => {
    const h = makeHarness({ status: 'issued', allocations });

    await expect(h.service.cancelIssueReservation(4, 70, 19)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(h.restoreStockToExistingBatch).not.toHaveBeenCalled();
    expect(h.reservation.status).toBe('issued');
    expect(h.reservation.stock_allocations).toEqual(allocations);
    expect(h.pool.reserved_quantity).toBe(1);
    expect(h.pool.issued_quantity).toBe(1);
    expect(h.manager.save).not.toHaveBeenCalled();
    expect(h.queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('prevents cancelling a reward that has not been issued', async () => {
    const h = makeHarness({ status: 'reserved' });

    await expect(h.service.cancelIssueReservation(4, 70, 19)).rejects.toThrow(
      'Chỉ có thể hoàn tác quà đang ở trạng thái "Đã trao"',
    );

    expect(h.restoreStockToExistingBatch).not.toHaveBeenCalled();
    expect(h.manager.save).not.toHaveBeenCalled();
    expect(h.reservation.status).toBe('reserved');
    expect(h.queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('cancels a non-product reward without touching inventory', async () => {
    const h = makeHarness({ status: 'issued', productId: null });

    await h.service.cancelIssueReservation(4, 70, 19);

    expect(h.restoreStockToExistingBatch).not.toHaveBeenCalled();
    expect(h.reservation.status).toBe('reserved');
    expect(h.pool.reserved_quantity).toBe(1);
    expect(h.pool.issued_quantity).toBe(0);
    expect(h.pool.remaining_quantity).toBe(4);
    expect(h.queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('preserves force-win quota when cancelling an issued product reward', async () => {
    const h = makeHarness({
      status: 'issued',
      pendingForceWins: 2,
      allocations: [{ batchId: 31, quantity: 2, taxableQuantity: 2 }],
    });

    await h.service.cancelIssueReservation(4, 70, 19);

    expect(h.restoreStockToExistingBatch).toHaveBeenCalledWith(
      21,
      31,
      2,
      2,
      19,
      70,
      expect.any(String),
      h.queryRunner,
      'PROMOTION_REWARD_GIFT_CANCEL',
      expect.stringContaining('lô #31'),
    );
    expect(h.reservation.status).toBe('reserved');
    expect(h.pool.reserved_quantity).toBe(3);
    expect(h.pool.issued_quantity).toBe(0);
    expect(h.pool.remaining_quantity).toBe(2);
    expect(h.queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('keeps an issued gift and pool counters unchanged when batch restoration fails', async () => {
    const h = makeHarness({
      status: 'issued',
      allocations: [{ batchId: 31, quantity: 2, taxableQuantity: 2 }],
      failRestoreStock: new BadRequestException('Không thể hoàn tồn vào lô #31'),
    });

    await expect(h.service.cancelIssueReservation(4, 70, 19)).rejects.toThrow(
      'Không thể hoàn tồn vào lô #31',
    );

    expect(h.reservation.status).toBe('issued');
    expect(h.reservation.stock_allocations).toEqual([
      { batchId: 31, quantity: 2, taxableQuantity: 2 },
    ]);
    expect(h.pool.reserved_quantity).toBe(1);
    expect(h.pool.issued_quantity).toBe(1);
    expect(h.manager.save).not.toHaveBeenCalled();
    expect(h.queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('rolls back all batch restores when a later batch restoration fails', async () => {
    const h = makeHarness({
      status: 'issued',
      allocations: [
        { batchId: 31, quantity: 1, taxableQuantity: 1 },
        { batchId: 32, quantity: 1, taxableQuantity: 0 },
      ],
      failRestoreStock: new BadRequestException('Không thể hoàn tồn vào lô #32'),
      failRestoreOnCall: 2,
    });

    await expect(h.service.cancelIssueReservation(4, 70, 19)).rejects.toThrow(
      'Không thể hoàn tồn vào lô #32',
    );

    expect(h.restoreStockToExistingBatch).toHaveBeenCalledTimes(2);
    expect(h.restoreStockToExistingBatch).toHaveBeenNthCalledWith(
      1,
      21,
      31,
      1,
      1,
      19,
      70,
      expect.any(String),
      h.queryRunner,
      'PROMOTION_REWARD_GIFT_CANCEL',
      expect.stringContaining('lô #31'),
    );
    expect(h.restoreStockToExistingBatch).toHaveBeenNthCalledWith(
      2,
      21,
      32,
      1,
      0,
      19,
      70,
      expect.any(String),
      h.queryRunner,
      'PROMOTION_REWARD_GIFT_CANCEL',
      expect.stringContaining('lô #32'),
    );
    expect(h.reservation.status).toBe('issued');
    expect(h.pool.reserved_quantity).toBe(1);
    expect(h.pool.issued_quantity).toBe(1);
    expect(h.manager.save).not.toHaveBeenCalled();
    expect(h.queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('rolls back reservation and counters when stock-out fails', async () => {
    const h = makeHarness({ failStockOut: new BadRequestException('Không đủ tồn kho') });

    await expect(h.service.issueReservation(4, 70, 12)).rejects.toThrow('Không đủ tồn kho');

    expect(h.reservation.status).toBe('reserved');
    expect(h.manager.save).not.toHaveBeenCalled();
    expect(h.queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'zero', quantity: 0 },
    { label: 'negative', quantity: -1 },
    { label: 'non-finite', quantity: Number.NaN },
  ])('rejects a $label product reward quantity before stock-out', async ({ quantity }) => {
    const h = makeHarness({ quantity });

    await expect(h.service.issueReservation(4, 70, 12)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(h.stockOut).not.toHaveBeenCalled();
    expect(h.reservation.status).toBe('reserved');
    expect(h.manager.save).not.toHaveBeenCalled();
    expect(h.queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.queryRunner.commitTransaction).not.toHaveBeenCalled();
  });
});
