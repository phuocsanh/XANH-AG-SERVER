import { DataSource, QueryRunner } from 'typeorm';
import { CustomerPromotionOverride } from '../../entities/customer-promotion-override.entity';
import { PromotionRewardPool } from '../../entities/promotion-reward-pool.entity';
import { PromotionRewardReservation } from '../../entities/promotion-reward-reservation.entity';
import { InventoryService } from '../inventory/inventory.service';
import { PromotionCampaignService } from './promotion-campaign.service';

const describePostgres = process.env.TAX_BACKFILL_TEST_URL
  ? describe
  : describe.skip;

describePostgres('Promotion campaign gift cancellation PostgreSQL rollback', () => {
  jest.setTimeout(30000);

  let connection: DataSource;
  let databaseRunner: ReturnType<DataSource['createQueryRunner']>;
  let batchesTable: string;

  beforeAll(async () => {
    const url = process.env.TAX_BACKFILL_TEST_URL!;
    const targetHost = new URL(url).hostname;
    if (targetHost !== 'ep-broad-pine-a1675nqi-pooler.ap-southeast-1.aws.neon.tech') {
      throw new Error(
        `Promotion rollback integration test is restricted to the dev DB host, got ${targetHost}`,
      );
    }

    batchesTable = `promotion_gift_rollback_batches_${process.pid}_${Date.now()}`;
    connection = new DataSource({
      type: 'postgres',
      url,
      ssl: { rejectUnauthorized: false },
      synchronize: false,
      logging: false,
    });
    await connection.initialize();
    databaseRunner = connection.createQueryRunner();
    await databaseRunner.connect();
  });

  beforeEach(async () => {
    // Mỗi ca test giữ TEMP fixture trong transaction để Neon pooler không đổi session.
    await databaseRunner.startTransaction();
    await databaseRunner.query(`
      CREATE TEMP TABLE ${batchesTable} (
        id integer PRIMARY KEY,
        remaining_quantity numeric NOT NULL,
        taxable_remaining_quantity numeric NOT NULL
      )
    `);
    await databaseRunner.query(`
      INSERT INTO ${batchesTable} VALUES (31, 0, 0), (32, 0, 0)
    `);
  });

  afterEach(async () => {
    if (databaseRunner?.isTransactionActive) {
      await databaseRunner.rollbackTransaction();
    }
  });

  afterAll(async () => {
    if (databaseRunner) await databaseRunner.release();
    if (connection?.isInitialized) await connection.destroy();
  });

  it('rolls back the first batch restore when restoring a later batch fails', async () => {
    const reservation = {
      id: 70,
      promotion_id: 4,
      reward_pool_id: 8,
      status: 'issued',
      reward_product_id: 21,
      reward_product_quantity: 2,
      stock_allocations: [
        { batchId: 31, quantity: 1, taxableQuantity: 1 },
        { batchId: 32, quantity: 1, taxableQuantity: 0 },
      ],
    } as PromotionRewardReservation;
    const pool = {
      id: 8,
      promotion_id: 4,
      total_quantity: 5,
      remaining_quantity: 3,
      reserved_quantity: 0,
      issued_quantity: 1,
    } as PromotionRewardPool;
    const manager = {
      findOne: jest.fn(async (entity: Function) => {
        if (entity === PromotionRewardReservation) return reservation;
        if (entity === PromotionRewardPool) return pool;
        return null;
      }),
      save: jest.fn(async (entity: unknown) => entity),
      count: jest.fn(async (entity: Function, options: { where: { status?: string } }) => {
        if (entity === CustomerPromotionOverride) return 0;
        return reservation.status === options.where.status ? 1 : 0;
      }),
    };
    const queryRunner = {
      manager,
      connect: jest.fn(() => databaseRunner.connect()),
      startTransaction: jest.fn(() => databaseRunner.startTransaction()),
      commitTransaction: jest.fn(() => databaseRunner.commitTransaction()),
      rollbackTransaction: jest.fn(() => databaseRunner.rollbackTransaction()),
      release: jest.fn(),
    } as unknown as QueryRunner;
    const restoreStockToExistingBatch = jest.fn(
      async (
        _productId: number,
        batchId: number,
        quantity: number,
        taxableQuantity: number,
      ) => {
        if (batchId === 32) {
          throw new Error('Simulated failure restoring batch 32');
        }
        await databaseRunner.query(
          `UPDATE ${batchesTable}
           SET remaining_quantity = remaining_quantity + $2,
               taxable_remaining_quantity = taxable_remaining_quantity + $3
           WHERE id = $1`,
          [batchId, quantity, taxableQuantity],
        );
      },
    );
    const inventoryService = {
      restoreStockToExistingBatch,
    } as unknown as InventoryService;
    const service = new PromotionCampaignService(
      { createQueryRunner: () => queryRunner } as never,
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

    await expect(service.cancelIssueReservation(4, 70, 19)).rejects.toThrow(
      'Simulated failure restoring batch 32',
    );

    const rows = await databaseRunner.query(
      `SELECT id, remaining_quantity, taxable_remaining_quantity
       FROM ${batchesTable} ORDER BY id`,
    );
    expect(rows).toEqual([
      { id: 31, remaining_quantity: '0', taxable_remaining_quantity: '0' },
      { id: 32, remaining_quantity: '0', taxable_remaining_quantity: '0' },
    ]);
    expect(restoreStockToExistingBatch).toHaveBeenCalledTimes(2);
    expect(reservation.status).toBe('issued');
    expect(manager.save).not.toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('issues a mixed-tax product gift and cancels it back into the exact batches', async () => {
    await databaseRunner.query(`
      UPDATE ${batchesTable}
      SET remaining_quantity = CASE id WHEN 31 THEN 2 ELSE 2 END,
          taxable_remaining_quantity = CASE id WHEN 31 THEN 2 ELSE 0 END
    `);
    const reservation = {
      id: 70,
      promotion_id: 4,
      reward_pool_id: 8,
      status: 'reserved',
      reward_product_id: 21,
      reward_product_quantity: 3,
      stock_allocations: null,
    } as PromotionRewardReservation;
    const pool = {
      id: 8,
      promotion_id: 4,
      total_quantity: 5,
      remaining_quantity: 4,
      reserved_quantity: 1,
      issued_quantity: 0,
    } as PromotionRewardPool;
    const manager = {
      findOne: jest.fn(async (entity: Function) => {
        if (entity === PromotionRewardReservation) return reservation;
        if (entity === PromotionRewardPool) return pool;
        return null;
      }),
      save: jest.fn(async (entity: unknown) => entity),
      count: jest.fn(async (entity: Function, options: { where: { status?: string } }) => {
        if (entity === CustomerPromotionOverride) return 0;
        return reservation.status === options.where.status ? 1 : 0;
      }),
    };
    const queryRunner = {
      manager,
      connect: jest.fn(() => databaseRunner.connect()),
      startTransaction: jest.fn(() => databaseRunner.startTransaction()),
      commitTransaction: jest.fn(() => databaseRunner.commitTransaction()),
      rollbackTransaction: jest.fn(() => databaseRunner.rollbackTransaction()),
      release: jest.fn(),
    } as unknown as QueryRunner;
    const inventoryService = {
      processStockOut: jest.fn(async () => {
        await databaseRunner.query(
          `UPDATE ${batchesTable}
           SET remaining_quantity = remaining_quantity - 2,
               taxable_remaining_quantity = taxable_remaining_quantity - 2
           WHERE id = 31`,
        );
        await databaseRunner.query(
          `UPDATE ${batchesTable}
           SET remaining_quantity = remaining_quantity - 1
           WHERE id = 32`,
        );
        return {
          transaction: { id: 901 },
          affectedBatches: [
            { batchId: 31, deductedQuantity: 2, taxableQuantity: 2 },
            { batchId: 32, deductedQuantity: 1, taxableQuantity: 0 },
          ],
        };
      }),
      restoreStockToExistingBatch: jest.fn(
        async (_productId: number, batchId: number, quantity: number, taxableQuantity: number) => {
          await databaseRunner.query(
            `UPDATE ${batchesTable}
             SET remaining_quantity = remaining_quantity + $2,
                 taxable_remaining_quantity = taxable_remaining_quantity + $3
             WHERE id = $1`,
            [batchId, quantity, taxableQuantity],
          );
        },
      ),
    } as unknown as InventoryService;
    const service = new PromotionCampaignService(
      { createQueryRunner: () => queryRunner } as never,
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

    await service.issueReservation(4, 70, 12);

    expect(reservation.status).toBe('issued');
    expect(reservation.stock_allocations).toEqual([
      { batchId: 31, quantity: 2, taxableQuantity: 2 },
      { batchId: 32, quantity: 1, taxableQuantity: 0 },
    ]);
    expect(pool.issued_quantity).toBe(1);

    let rows = await databaseRunner.query(
      `SELECT id, remaining_quantity, taxable_remaining_quantity
       FROM ${batchesTable} ORDER BY id`,
    );
    expect(rows).toEqual([
      { id: 31, remaining_quantity: '0', taxable_remaining_quantity: '0' },
      { id: 32, remaining_quantity: '1', taxable_remaining_quantity: '0' },
    ]);

    await service.cancelIssueReservation(4, 70, 19);

    rows = await databaseRunner.query(
      `SELECT id, remaining_quantity, taxable_remaining_quantity
       FROM ${batchesTable} ORDER BY id`,
    );
    expect(rows).toEqual([
      { id: 31, remaining_quantity: '2', taxable_remaining_quantity: '2' },
      { id: 32, remaining_quantity: '2', taxable_remaining_quantity: '0' },
    ]);
    expect(reservation.status).toBe('reserved');
    expect(pool.reserved_quantity).toBe(1);
    expect(pool.issued_quantity).toBe(0);
    expect(pool.remaining_quantity).toBe(4);
    expect(inventoryService.processStockOut).toHaveBeenCalledWith(
      21,
      3,
      'PROMOTION_REWARD_GIFT',
      12,
      70,
      expect.any(String),
      queryRunner,
      { requireBatchTaxSnapshot: true },
    );
    expect(inventoryService.restoreStockToExistingBatch).toHaveBeenCalledTimes(2);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(2);
  });
});
