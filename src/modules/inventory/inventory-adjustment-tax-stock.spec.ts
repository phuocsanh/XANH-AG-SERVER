import { InventoryAdjustment } from '../../entities/inventory-adjustments.entity';
import { InventoryAdjustmentItem } from '../../entities/inventory-adjustment-items.entity';
import { AdjustmentStatus } from './enums/adjustment-status.enum';
import { InventoryService } from './inventory.service';
import { InventoryBatch } from '../../entities/inventories.entity';
import { Product } from '../../entities/products.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { InventoryReceipt } from '../../entities/inventory-receipts.entity';
import { DataSource } from 'typeorm';

function cancellationHarness(
  quantityChange: number,
  stockAllocations?: InventoryAdjustmentItem['stock_allocations'],
) {
  const adjustment = Object.assign(new InventoryAdjustment(), {
    id: 42,
    code: 'ADJ-42',
    adjustment_type: quantityChange > 0 ? 'IN' : 'OUT',
    status: AdjustmentStatus.APPROVED,
  });
  const item = Object.assign(new InventoryAdjustmentItem(), {
    id: 7,
    adjustment_id: 42,
    product_id: 15,
    quantity_change: quantityChange,
    stock_allocations: stockAllocations,
  });
  const queryRunner = {
    manager: {
      findOne: jest.fn(async () => adjustment),
      find: jest.fn(async () => [item]),
      save: jest.fn(async (entity: unknown) => entity),
    },
    connect: jest.fn(async () => undefined),
    startTransaction: jest.fn(async () => undefined),
    commitTransaction: jest.fn(async () => undefined),
    rollbackTransaction: jest.fn(async () => undefined),
    release: jest.fn(async () => undefined),
  };
  const service = Object.create(InventoryService.prototype) as InventoryService;
  Object.assign(service, {
    inventoryAdjustmentRepository: {
      manager: { connection: { createQueryRunner: () => queryRunner } },
    },
    logger: { log: jest.fn(), error: jest.fn() },
  });
  const stockOut = jest.spyOn(service, 'processStockOut').mockResolvedValue({
    transaction: {} as never,
    taxableQuantity: 0,
    taxSellingPrice: 0,
    affectedBatches: [],
    totalCostValue: 0,
    averageCostUsed: 0,
    remainingQuantity: 0,
  });
  const serviceWithRestore = service as unknown as {
    restoreStockToExistingBatch: (...args: unknown[]) => Promise<void>;
  };
  const restoreBatch = jest.spyOn(serviceWithRestore, 'restoreStockToExistingBatch')
    .mockResolvedValue(undefined);

  return { service, adjustment, item, queryRunner, stockOut, restoreBatch };
}

describe('inventory adjustment taxable-stock cancellation', () => {
  it('rejects a quantity sign that conflicts with the adjustment type', async () => {
    const { service, adjustment, item, queryRunner, stockOut } = cancellationHarness(-2, [
      { batchId: 3, quantity: 2, taxableQuantity: 0 },
    ]);
    adjustment.adjustment_type = 'IN';

    await expect((service as any).applyAdjustmentItemStockEffect(
      item, adjustment, 9, queryRunner,
    )).rejects.toThrow('Loại điều chỉnh IN không khớp dấu số lượng');
    expect(stockOut).not.toHaveBeenCalled();
  });

  it('creates the increase batch against the selected receipt source with its taxable quantity', async () => {
    const adjustment = Object.assign(new InventoryAdjustment(), { id: 42, code: 'ADJ-42' });
    const item = Object.assign(new InventoryAdjustmentItem(), {
      id: 7,
      product_id: 15,
      quantity_change: 4,
      stock_allocations: [{
        batchId: 12,
        sourceBatchId: 12,
        quantity: 4,
        taxableQuantity: 2,
        pending: true,
      }],
    });
    const sourceBatch = Object.assign(new InventoryBatch(), {
      id: 12,
      product_id: 15,
      receipt_item_id: 55,
      unit_cost_price: '900',
    });
    const receiptItem = Object.assign(new InventoryReceiptItem(), {
      id: 55,
      product_id: 15,
      receipt_id: 18,
    });
    const receipt = Object.assign(new InventoryReceipt(), { id: 18, status: 'approved' });
    const queryRunner = {
      manager: {
        findOne: jest.fn(async (entity: unknown) =>
          entity === InventoryBatch
            ? sourceBatch
            : entity === InventoryReceiptItem ? receiptItem : receipt,
        ),
        save: jest.fn(async (entity: unknown) => entity),
      },
    };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    jest.spyOn(service, 'getWeightedAverageCost').mockResolvedValue(1000);
    const stockIn = jest.spyOn(service, 'processStockIn').mockResolvedValue({
      batch: { id: 99 } as InventoryBatch,
    } as never);

    await (service as any).applyAdjustmentItemStockEffect(item, adjustment, 9, queryRunner);

    expect(stockIn).toHaveBeenCalledWith(
      15, 4, 900, 9, 55, 'ADJ_ADJ-42_7', undefined, queryRunner, 2, undefined, true,
    );
    expect(item.stock_allocations).toEqual([
      { batchId: 99, quantity: 4, taxableQuantity: 2 },
    ]);
  });

  it('rejects an increase allocation whose taxable quantity exceeds its quantity before stock-in', async () => {
    const adjustment = Object.assign(new InventoryAdjustment(), {
      id: 42,
      code: 'ADJ-42',
      adjustment_type: 'IN',
    });
    const item = Object.assign(new InventoryAdjustmentItem(), {
      id: 7,
      product_id: 15,
      quantity_change: 4,
      stock_allocations: [{
        batchId: 12,
        sourceBatchId: 12,
        quantity: 4,
        taxableQuantity: 5,
        pending: true,
      }],
    });
    const service = Object.create(InventoryService.prototype) as InventoryService;
    const weightedCost = jest.spyOn(service, 'getWeightedAverageCost');
    const queryRunner = { manager: { save: jest.fn() } };

    await expect((service as any).applyAdjustmentItemStockEffect(
      item, adjustment, 9, queryRunner,
    )).rejects.toThrow(
      'Số lượng thuế điều chỉnh tăng của sản phẩm #15 phải nằm trong 0 và số lượng tăng.',
    );
    expect(weightedCost).not.toHaveBeenCalled();
    expect(queryRunner.manager.save).not.toHaveBeenCalled();
  });

  it('restores a stock decrease into the exact original batches and taxable quantities', async () => {
    const allocations = [
      { batchId: 3, quantity: 2, taxableQuantity: 1 },
      { batchId: 8, quantity: 3, taxableQuantity: 0 },
    ];
    const { service, restoreBatch, queryRunner } = cancellationHarness(-5, allocations);

    await service.cancelAdjustment(42, 'test', 9);

    expect(restoreBatch).toHaveBeenCalledTimes(2);
    expect(restoreBatch.mock.calls.map((call) => call.slice(0, 5))).toEqual([
      [15, 3, 2, 1, 9],
      [15, 8, 3, 0, 9],
    ]);
    expect(queryRunner.manager.findOne).toHaveBeenCalledWith(
      InventoryAdjustment,
      { where: { id: 42 }, lock: { mode: 'pessimistic_write' } },
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('cancels a stock increase from its lot with the exact taxable snapshot', async () => {
    const { service, stockOut } = cancellationHarness(4, [
      { batchId: 12, quantity: 4, taxableQuantity: 2 },
    ]);

    await service.cancelAdjustment(42, 'test', 9);

    expect(stockOut).toHaveBeenCalledWith(
      15,
      4,
      'ADJUSTMENT_CANCEL',
      9,
      42,
      expect.any(String),
      expect.any(Object),
      {
        batchId: 12,
        taxableQuantity: 2,
        requireBatchTaxSnapshot: true,
        expectedBatchTaxableQuantity: 2,
      },
    );
  });

  it('blocks a legacy approved adjustment without allocations before changing stock', async () => {
    const { service, stockOut, restoreBatch, queryRunner } = cancellationHarness(-2);

    await expect(service.cancelAdjustment(42, 'test', 9)).rejects.toThrow(
      'Không thể hủy phiếu điều chỉnh ADJ-42: sản phẩm #15 thiếu dữ liệu phân bổ lô (stock_allocations).',
    );

    expect(stockOut).not.toHaveBeenCalled();
    expect(restoreBatch).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('refuses to remove a positive adjustment lot after its taxable snapshot changed', async () => {
    const product = Object.assign(new Product(), {
      id: 15,
      quantity: 4,
      taxable_quantity_stock: 1,
      tax_selling_price: '10',
    });
    const batch = Object.assign(new InventoryBatch(), {
      id: 12,
      product_id: 15,
      original_quantity: 4,
      remaining_quantity: 4,
      taxable_remaining_quantity: 1,
      unit_cost_price: '5',
    });
    const batchRepository = { find: jest.fn(async () => [batch]) };
    const queryRunner = {
      isTransactionActive: true,
      manager: {
        findOne: jest.fn(async () => product),
        getRepository: jest.fn(() => batchRepository),
      },
    };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    jest.spyOn(service, 'getInventorySummary').mockResolvedValue({
      productId: 15,
      totalQuantity: 4,
      batchTotalQuantity: 4,
      batches: 1,
    });

    await expect(service.processStockOut(
      15,
      4,
      'ADJUSTMENT_CANCEL',
      9,
      42,
      'cancel adjustment',
      queryRunner as never,
      {
        batchId: 12,
        taxableQuantity: 0,
        requireBatchTaxSnapshot: true,
        expectedBatchTaxableQuantity: 0,
      },
    )).rejects.toThrow(
      'Không thể hủy phiếu điều chỉnh: tồn thuế của lô #12 đã thay đổi hoặc thiếu snapshot',
    );
    expect(batch.remaining_quantity).toBe(4);
  });
});

describe('inventory adjustment approval idempotency', () => {
  it('does not apply stock or tax twice when approving an already approved adjustment', async () => {
    const adjustment = Object.assign(new InventoryAdjustment(), {
      id: 42,
      status: AdjustmentStatus.APPROVED,
    });
    const queryRunner = {
      manager: {
        findOne: jest.fn(async () => adjustment),
        find: jest.fn(),
        save: jest.fn(),
      },
      connect: jest.fn(async () => undefined),
      startTransaction: jest.fn(async () => undefined),
      commitTransaction: jest.fn(async () => undefined),
      rollbackTransaction: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
    };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, {
      inventoryAdjustmentRepository: {
        manager: { connection: { createQueryRunner: () => queryRunner } },
      },
      logger: { log: jest.fn(), error: jest.fn() },
    });
    const applyStockEffect = jest.spyOn(
      service as any,
      'applyAdjustmentItemStockEffect',
    );

    await expect(service.approveAdjustment(42, 9)).resolves.toBe(adjustment);

    expect(queryRunner.manager.find).not.toHaveBeenCalled();
    expect(applyStockEffect).not.toHaveBeenCalled();
    expect(queryRunner.manager.save).not.toHaveBeenCalled();
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });
});

describe('inventory adjustment taxable quantity validation', () => {
  const invalidValues = [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    'not-a-number',
  ];

  it.each(invalidValues)(
    'rejects non-finite tax quantity when creating a draft (%s)',
    async (value) => {
      const savedItems: unknown[] = [];
      const adjustment = Object.assign(new InventoryAdjustment(), { id: 42 });
      const queryRunner = {
        manager: {
          create: jest.fn((entity: new () => object, data: object) =>
            Object.assign(new entity(), data),
          ),
          save: jest.fn(async (entity: unknown) => {
            if (entity instanceof InventoryAdjustment) return adjustment;
            savedItems.push(entity);
            return entity;
          }),
        },
        connect: jest.fn(async () => undefined),
        startTransaction: jest.fn(async () => undefined),
        commitTransaction: jest.fn(async () => undefined),
        rollbackTransaction: jest.fn(async () => undefined),
        release: jest.fn(async () => undefined),
      };
      const service = Object.create(
        InventoryService.prototype,
      ) as InventoryService;
      Object.assign(service, {
        inventoryAdjustmentRepository: {
          manager: { connection: { createQueryRunner: () => queryRunner } },
        },
        logger: { log: jest.fn(), error: jest.fn() },
      });

      await expect(
        service.createAdjustment(
          {
            adjustment_type: 'IN',
            reason: 'test',
            items: [
              { product_id: 15, quantity_change: 4, taxable_quantity: value },
            ],
          } as never,
          9,
        ),
      ).rejects.toThrow(
        'Số lượng thuế điều chỉnh của sản phẩm #15 phải là số hữu hạn.',
      );
      expect(savedItems).toHaveLength(0);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    },
  );

  it.each(invalidValues)(
    'rejects non-finite tax quantity when updating a draft (%s)',
    async (value) => {
      const savedItems: unknown[] = [];
      const adjustment = Object.assign(new InventoryAdjustment(), {
        id: 42,
        status: AdjustmentStatus.DRAFT,
        adjustment_type: 'IN',
        images: [],
      });
      const queryRunner = {
        manager: {
          findOne: jest.fn(async () => adjustment),
          update: jest.fn(async () => undefined),
          delete: jest.fn(async () => undefined),
          create: jest.fn((entity: new () => object, data: object) =>
            Object.assign(new entity(), data),
          ),
          save: jest.fn(async (entity: unknown) => {
            savedItems.push(entity);
            return entity;
          }),
        },
        connect: jest.fn(async () => undefined),
        startTransaction: jest.fn(async () => undefined),
        commitTransaction: jest.fn(async () => undefined),
        rollbackTransaction: jest.fn(async () => undefined),
        release: jest.fn(async () => undefined),
      };
      const service = Object.create(
        InventoryService.prototype,
      ) as InventoryService;
      jest.spyOn(service, 'findAdjustmentById').mockResolvedValue(adjustment);
      Object.assign(service, {
        inventoryAdjustmentRepository: {
          manager: { connection: { createQueryRunner: () => queryRunner } },
        },
        logger: { log: jest.fn(), error: jest.fn() },
      });

      await expect(
        service.updateAdjustment(
          42,
          {
            items: [
              { product_id: 15, quantity_change: 4, taxable_quantity: value },
            ],
          },
          9,
        ),
      ).rejects.toThrow(
        'Số lượng thuế điều chỉnh của sản phẩm #15 phải là số hữu hạn.',
      );
      expect(savedItems).toHaveLength(0);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    },
  );

  it('rolls back creation when taxable quantity exceeds the increase quantity', async () => {
    const savedItems: unknown[] = [];
    const adjustment = Object.assign(new InventoryAdjustment(), { id: 42 });
    const queryRunner = {
      manager: {
        create: jest.fn((entity: new () => object, data: object) =>
          Object.assign(new entity(), data),
        ),
        save: jest.fn(async (entity: unknown) => {
          if (entity instanceof InventoryAdjustment) return adjustment;
          savedItems.push(entity);
          return entity;
        }),
      },
      connect: jest.fn(async () => undefined),
      startTransaction: jest.fn(async () => undefined),
      commitTransaction: jest.fn(async () => undefined),
      rollbackTransaction: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
    };
    const service = Object.create(
      InventoryService.prototype,
    ) as InventoryService;
    Object.assign(service, {
      inventoryAdjustmentRepository: {
        manager: { connection: { createQueryRunner: () => queryRunner } },
      },
      logger: { log: jest.fn(), error: jest.fn() },
    });

    await expect(
      service.createAdjustment(
        {
          adjustment_type: 'IN',
          reason: 'test',
          items: [
            { product_id: 15, quantity_change: 4, taxable_quantity: 5 },
          ],
        } as never,
        9,
      ),
    ).rejects.toThrow(
      'Số lượng thuế phải nằm trong 0 và số lượng điều chỉnh tăng.',
    );
    expect(savedItems).toHaveLength(0);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('rolls back replacement of draft items when taxable quantity exceeds the increase quantity', async () => {
    const savedItems: unknown[] = [];
    const adjustment = Object.assign(new InventoryAdjustment(), {
      id: 42,
      status: AdjustmentStatus.DRAFT,
      adjustment_type: 'IN',
      images: [],
    });
    const queryRunner = {
      manager: {
        findOne: jest.fn(async () => adjustment),
        update: jest.fn(async () => undefined),
        delete: jest.fn(async () => undefined),
        create: jest.fn((entity: new () => object, data: object) =>
          Object.assign(new entity(), data),
        ),
        save: jest.fn(async (entity: unknown) => {
          savedItems.push(entity);
          return entity;
        }),
      },
      connect: jest.fn(async () => undefined),
      startTransaction: jest.fn(async () => undefined),
      commitTransaction: jest.fn(async () => undefined),
      rollbackTransaction: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
    };
    const service = Object.create(
      InventoryService.prototype,
    ) as InventoryService;
    jest.spyOn(service, 'findAdjustmentById').mockResolvedValue(adjustment);
    Object.assign(service, {
      inventoryAdjustmentRepository: {
        manager: { connection: { createQueryRunner: () => queryRunner } },
      },
      logger: { log: jest.fn(), error: jest.fn() },
    });

    await expect(
      service.updateAdjustment(
        42,
        {
          items: [
            { product_id: 15, quantity_change: 4, taxable_quantity: 5 },
          ],
        },
        9,
      ),
    ).rejects.toThrow(
      'Số lượng thuế phải nằm trong 0 và số lượng điều chỉnh tăng.',
    );
    expect(queryRunner.manager.delete).toHaveBeenCalledWith(
      InventoryAdjustmentItem,
      { adjustment_id: 42 },
    );
    expect(savedItems).toHaveLength(0);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });
});

const describePostgres = process.env.TAX_BACKFILL_TEST_URL ? describe : describe.skip;

describePostgres('inventory adjustment cancellation PostgreSQL rollback', () => {
  let connection: DataSource;
  let databaseRunner: ReturnType<DataSource['createQueryRunner']>;
  let tables: Record<string, string>;

  beforeAll(async () => {
    const suffix = `${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
    tables = {
      adjustments: `tax_adjustment_cancel_${suffix}`,
      items: `tax_adjustment_cancel_items_${suffix}`,
      products: `tax_adjustment_cancel_products_${suffix}`,
      batches: `tax_adjustment_cancel_batches_${suffix}`,
      transactions: `tax_adjustment_cancel_transactions_${suffix}`,
    };
    const targetHost = new URL(process.env.TAX_BACKFILL_TEST_URL!).hostname;
    if (targetHost !== 'ep-broad-pine-a1675nqi-pooler.ap-southeast-1.aws.neon.tech') {
      throw new Error(`Adjustment integration tests are restricted to the dev DB host, got ${targetHost}`);
    }
    connection = new DataSource({
      type: 'postgres',
      url: process.env.TAX_BACKFILL_TEST_URL!,
      ssl: { rejectUnauthorized: false },
      synchronize: false,
      logging: false,
    });
    await connection.initialize();
    databaseRunner = connection.createQueryRunner();
    await databaseRunner.connect();
    // Pin TEMP fixtures to one Neon pooler session and roll back the whole suite.
    await databaseRunner.startTransaction();
    await databaseRunner.query(`
      CREATE TEMP TABLE ${tables.adjustments} (
        id integer PRIMARY KEY, code text NOT NULL, adjustment_type text NOT NULL,
        status text NOT NULL CHECK (status <> 'cancelled')
      );
      CREATE TEMP TABLE ${tables.items} (
        id integer PRIMARY KEY, adjustment_id integer NOT NULL, product_id integer NOT NULL,
        quantity_change numeric NOT NULL, stock_allocations jsonb NOT NULL
      );
      CREATE TEMP TABLE ${tables.products} (
        id integer PRIMARY KEY, quantity numeric NOT NULL, taxable_quantity_stock numeric NOT NULL
      );
      CREATE TEMP TABLE ${tables.batches} (
        id integer PRIMARY KEY, product_id integer NOT NULL, receipt_item_id integer,
        unit_cost_price numeric NOT NULL, remaining_quantity numeric NOT NULL,
        taxable_remaining_quantity numeric NOT NULL
      );
      CREATE TEMP TABLE ${tables.transactions} (
        id serial PRIMARY KEY, reference_type text NOT NULL, reference_id integer NOT NULL,
        product_id integer NOT NULL, quantity numeric NOT NULL, receipt_item_id integer
      );
    `);
  });

  afterAll(async () => {
    if (databaseRunner?.isTransactionActive) {
      await databaseRunner.rollbackTransaction();
    }
    if (databaseRunner && tables) {
      await databaseRunner.release();
    }
    if (connection?.isInitialized) await connection.destroy();
  });

  it('rolls back exact-lot stock and taxable restoration when final cancellation save fails', async () => {
    await databaseRunner.query(`
      INSERT INTO ${tables.adjustments} VALUES (42, 'ADJ-42', 'OUT', 'approved');
      INSERT INTO ${tables.items} VALUES
        (7, 42, 15, -5,
          '[{"batchId":3,"quantity":2,"taxableQuantity":1},
            {"batchId":8,"quantity":3,"taxableQuantity":0}]'::jsonb);
      INSERT INTO ${tables.products} VALUES (15, 10, 3);
      INSERT INTO ${tables.batches} VALUES
        (3, 15, 301, 10, 5, 2),
        (8, 15, 802, 8, 4, 1);
    `);

    const manager = {
      findOne: async (entity: Function, options: { where: { id: number } }) => {
        const id = options.where.id;
        if (entity === InventoryAdjustment) {
          const [row] = await databaseRunner.query(
            `SELECT * FROM ${tables.adjustments} WHERE id=$1`, [id],
          );
          return row ? Object.assign(new InventoryAdjustment(), row) : null;
        }
        if (entity === Product) {
          const [row] = await databaseRunner.query(
            `SELECT * FROM ${tables.products} WHERE id=$1`, [id],
          );
          return row ? Object.assign(new Product(), row) : null;
        }
        if (entity === InventoryBatch) {
          const [row] = await databaseRunner.query(
            `SELECT * FROM ${tables.batches} WHERE id=$1`, [id],
          );
          return row ? Object.assign(new InventoryBatch(), row) : null;
        }
        return null;
      },
      find: async (_entity: Function, options: { where: { adjustment_id: number } }) => {
        const rows = await databaseRunner.query(
          `SELECT * FROM ${tables.items} WHERE adjustment_id=$1 ORDER BY id`,
          [options.where.adjustment_id],
        );
        return rows.map((row: Record<string, unknown>) =>
          Object.assign(new InventoryAdjustmentItem(), row),
        );
      },
      update: async (_entity: Function, id: number, values: Record<string, unknown>) =>
        databaseRunner.query(
          `UPDATE ${tables.products} SET quantity=$1, taxable_quantity_stock=$2 WHERE id=$3`,
          [values.quantity, values.taxable_quantity_stock, id],
        ),
      save: async (value: InventoryBatch | InventoryAdjustment) => {
        if (value instanceof InventoryBatch) {
          await databaseRunner.query(
            `UPDATE ${tables.batches} SET remaining_quantity=$1,
              taxable_remaining_quantity=$2 WHERE id=$3`,
            [value.remaining_quantity, value.taxable_remaining_quantity, value.id],
          );
          return value;
        }
        return databaseRunner.query(
          `UPDATE ${tables.adjustments} SET status=$1 WHERE id=$2`,
          [value.status, value.id],
        );
      },
    };
    const transactionRunner = {
      manager,
      connect: async () => undefined,
      startTransaction: () => databaseRunner.startTransaction(),
      commitTransaction: () => databaseRunner.commitTransaction(),
      rollbackTransaction: () => databaseRunner.rollbackTransaction(),
      release: async () => undefined,
      query: (sql: string, parameters?: unknown[]) => databaseRunner.query(sql, parameters),
    };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, {
      logger: { log: jest.fn(), error: jest.fn() },
      inventoryAdjustmentRepository: {
        manager: { connection: { createQueryRunner: () => transactionRunner } },
      },
    });
    jest.spyOn(service, 'getWeightedAverageCost').mockResolvedValue(10);
    const createTransaction = jest.spyOn(service, 'createTransaction').mockImplementation(async (dto, runner) => {
      const [row] = await runner!.query(
        `INSERT INTO ${tables.transactions}
          (reference_type, reference_id, product_id, quantity, receipt_item_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [dto.reference_type, dto.reference_id, dto.product_id, dto.quantity, dto.receipt_item_id ?? null],
      );
      return row as never;
    });

    await expect(service.cancelAdjustment(42, 'integration failure', 9)).rejects.toMatchObject({
      driverError: expect.objectContaining({ code: '23514' }),
    });
    expect(createTransaction).toHaveBeenCalledTimes(2);

    const batchRows = await databaseRunner.query(
      `SELECT id, remaining_quantity, taxable_remaining_quantity
       FROM ${tables.batches} ORDER BY id`,
    );
    const [product] = await databaseRunner.query(
      `SELECT quantity, taxable_quantity_stock FROM ${tables.products} WHERE id=15`,
    );
    const [adjustment] = await databaseRunner.query(
      `SELECT status FROM ${tables.adjustments} WHERE id=42`,
    );
    const [{ transactionCount }] = await databaseRunner.query(
      `SELECT COUNT(*)::int AS "transactionCount" FROM ${tables.transactions}`,
    );

    expect(batchRows.map((row: Record<string, unknown>) => [
      Number(row.id), Number(row.remaining_quantity), Number(row.taxable_remaining_quantity),
    ])).toEqual([[3, 5, 2], [8, 4, 1]]);
    expect(Number(product.quantity)).toBe(10);
    expect(Number(product.taxable_quantity_stock)).toBe(3);
    expect(adjustment.status).toBe('approved');
    expect(Number(transactionCount)).toBe(0);
  });
});
