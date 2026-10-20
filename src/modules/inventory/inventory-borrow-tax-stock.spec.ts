import { InventoryService } from './inventory.service';
import {
  InventoryBorrow,
  InventoryBorrowStatus,
} from '../../entities/inventory-borrows.entity';
import { InventoryBorrowItem } from '../../entities/inventory-borrow-items.entity';
import { InventoryBatch } from '../../entities/inventories.entity';
import { Product } from '../../entities/products.entity';
import { DataSource } from 'typeorm';

describe('InventoryService borrow taxable stock restoration', () => {
  it('stores the exact stock-out taxable quantity when approving a borrow', async () => {
    const borrow = Object.assign(new InventoryBorrow(), {
      id: 40,
      code: 'BOR-40',
      status: InventoryBorrowStatus.DRAFT,
    });
    const item = {
      id: 9,
      borrow_id: 40,
      product_id: 7,
      batch_id: 12,
      quantity: 10,
      receipt_item_id: 3,
    };
    const manager = {
      findOne: jest.fn().mockResolvedValue(borrow),
      find: jest.fn().mockResolvedValue([item]),
      save: jest.fn(async (entity: Record<string, unknown>) => entity),
    };
    const queryRunner = {
      manager,
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    (service as any).inventoryBorrowRepository = {
      manager: { connection: { createQueryRunner: () => queryRunner } },
    };
    const stockOut = jest.fn().mockResolvedValue({ taxableQuantity: 4 });
    (service as any).processStockOut = stockOut;
    jest.spyOn(service, 'findBorrowById').mockResolvedValue(borrow);

    await service.approveBorrow(40, 5);

    expect(stockOut).toHaveBeenCalledWith(
      7,
      10,
      'BORROW_OUT',
      5,
      40,
      expect.any(String),
      queryRunner,
      { batchId: 12, receiptItemId: 3, requireBatchTaxSnapshot: true },
    );
    expect(item).toHaveProperty('taxable_quantity', 4);
    expect(manager.save).toHaveBeenCalledWith(expect.anything(), item);
  });

  const setup = (item: Record<string, unknown>) => {
    const product = { id: 7, quantity: 100, taxable_quantity_stock: 10 };
    const batch = {
      id: 12,
      product_id: 7,
      remaining_quantity: 20,
      taxable_remaining_quantity: 5,
      unit_cost_price: '2',
      receipt_item_id: 3,
    };
    const manager = {
      findOne: jest.fn()
        .mockResolvedValueOnce(product)
        .mockResolvedValueOnce(batch),
      save: jest.fn(async (entity: Record<string, unknown>) => entity),
      update: jest.fn(),
    };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    (service as any).getWeightedAverageCost = jest.fn().mockResolvedValue(2);
    (service as any).createTransaction = jest.fn().mockResolvedValue({});
    const runner = { manager } as any;
    const borrow = { id: 40, code: 'BOR-40' } as any;
    return { service, runner, borrow, product, batch, manager, item };
  };

  it('restores the snapshot share to both its source batch and product on partial return', async () => {
    const ctx = setup({
      id: 9,
      product_id: 7,
      batch_id: 12,
      quantity: 10,
      taxable_quantity: 4,
      returned_quantity: 6,
    });

    await (ctx.service as any).restoreBorrowItemStock(
      ctx.borrow,
      ctx.item,
      2,
      5,
      'BORROW_RETURN',
      'Trả mượn',
      ctx.runner,
      6,
    );

    expect(ctx.batch.remaining_quantity).toBe(22);
    expect(ctx.batch.taxable_remaining_quantity).toBe(7);
    expect(ctx.manager.update).toHaveBeenCalledWith(
      expect.anything(),
      7,
      { quantity: 102, taxable_quantity_stock: 12 },
    );
  });

  it('blocks a legacy borrow item without a taxable snapshot before changing stock', async () => {
    const ctx = setup({
      id: 9,
      product_id: 7,
      batch_id: 12,
      quantity: 10,
      taxable_quantity: null,
      returned_quantity: 0,
    });

    await expect((ctx.service as any).restoreBorrowItemStock(
      ctx.borrow,
      ctx.item,
      10,
      5,
      'BORROW_CANCEL',
      'Hủy mượn',
      ctx.runner,
      0,
    )).rejects.toThrow('BOR-40');

    expect(ctx.manager.save).not.toHaveBeenCalled();
    expect(ctx.manager.update).not.toHaveBeenCalled();
  });

  it('preserves exact cumulative tax when a borrow is returned in multiple partial returns', async () => {
    const borrow = Object.assign(new InventoryBorrow(), {
      id: 40,
      code: 'BOR-40',
      status: InventoryBorrowStatus.APPROVED,
    });
    const item = Object.assign(new InventoryBorrowItem(), {
      id: 9,
      borrow_id: 40,
      product_id: 7,
      batch_id: 12,
      quantity: 10,
      taxable_quantity: 4,
      returned_quantity: 0,
      converted_to_sale_quantity: 0,
    });
    const product = Object.assign(new Product(), {
      id: 7,
      quantity: 100,
      taxable_quantity_stock: 10,
    });
    const batch = Object.assign(new InventoryBatch(), {
      id: 12,
      product_id: 7,
      remaining_quantity: 20,
      taxable_remaining_quantity: 5,
      unit_cost_price: '2',
      receipt_item_id: 3,
    });
    const makeRunner = () => {
      const manager = {
        findOne: jest.fn(async (entity: Function) =>
          entity === InventoryBorrow ? borrow : entity === Product ? product : batch,
        ),
        find: jest.fn(async () => [item]),
        save: jest.fn(async (entity: Function, value: Record<string, unknown>) => {
          if (entity === InventoryBorrowItem) Object.assign(item, value);
          if (entity === InventoryBorrow) Object.assign(borrow, value);
          return value;
        }),
        update: jest.fn(async (_entity: Function, _id: number, values: object) => {
          Object.assign(product, values);
        }),
      };
      return {
        manager,
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };
    };
    const runners = [makeRunner(), makeRunner()];
    const usedRunners = [...runners];
    const service = Object.create(InventoryService.prototype) as InventoryService;
    (service as any).inventoryBorrowRepository = {
      manager: {
        connection: {
          createQueryRunner: jest.fn(() => runners.shift()),
        },
      },
    };
    jest.spyOn(service, 'findBorrowById').mockResolvedValue(borrow);
    jest.spyOn(service, 'getWeightedAverageCost').mockResolvedValue(2);
    jest.spyOn(service, 'createTransaction').mockResolvedValue({} as never);

    await service.returnBorrow(40, 5, [{ item_id: 9, quantity: 7 }]);

    expect(item.returned_quantity).toBe(7);
    expect(borrow.status).toBe(InventoryBorrowStatus.PARTIAL_RETURNED);
    expect(batch.remaining_quantity).toBe(27);
    expect(batch.taxable_remaining_quantity).toBe(6);
    expect(product.quantity).toBe(107);
    expect(product.taxable_quantity_stock).toBe(11);

    await service.returnBorrow(40, 5, [{ item_id: 9, quantity: 3 }]);

    expect(item.returned_quantity).toBe(10);
    expect(borrow.status).toBe(InventoryBorrowStatus.RETURNED);
    expect(batch.remaining_quantity).toBe(30);
    expect(batch.taxable_remaining_quantity).toBe(9);
    expect(product.quantity).toBe(110);
    expect(product.taxable_quantity_stock).toBe(14);
    expect(service.createTransaction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ quantity: 7, reference_type: 'BORROW_RETURN' }),
      expect.any(Object),
    );
    expect(service.createTransaction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ quantity: 3, reference_type: 'BORROW_RETURN' }),
      expect.any(Object),
    );
    for (const runner of usedRunners) {
      expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(runner.rollbackTransaction).not.toHaveBeenCalled();
    }
  });

  it('rejects returning more than the outstanding borrowed quantity before restoring stock or tax', async () => {
    const borrow = Object.assign(new InventoryBorrow(), {
      id: 40,
      code: 'BOR-40',
      status: InventoryBorrowStatus.PARTIAL_RETURNED,
    });
    const item = Object.assign(new InventoryBorrowItem(), {
      id: 9,
      borrow_id: 40,
      product_id: 7,
      batch_id: 12,
      quantity: 10,
      taxable_quantity: 4,
      returned_quantity: 7,
      converted_to_sale_quantity: 0,
    });
    const queryRunner = {
      manager: {
        findOne: jest.fn(async () => borrow),
        find: jest.fn(async () => [item]),
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
      inventoryBorrowRepository: {
        manager: { connection: { createQueryRunner: () => queryRunner } },
      },
    });
    const restoreBorrowItemStock = jest
      .spyOn(service as any, 'restoreBorrowItemStock')
      .mockResolvedValue(undefined);

    await expect(
      service.returnBorrow(40, 5, [{ item_id: 9, quantity: 4 }]),
    ).rejects.toThrow('Dòng #9 chỉ còn 3 có thể trả');

    expect(restoreBorrowItemStock).not.toHaveBeenCalled();
    expect(queryRunner.manager.save).not.toHaveBeenCalled();
    expect(item.returned_quantity).toBe(7);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('blocks returns when a borrowed item was converted to sale without a tax snapshot', async () => {
    const borrow = Object.assign(new InventoryBorrow(), {
      id: 40,
      code: 'BOR-40',
      status: InventoryBorrowStatus.PARTIAL_RETURNED,
    });
    const item = Object.assign(new InventoryBorrowItem(), {
      id: 9,
      borrow_id: 40,
      product_id: 7,
      batch_id: 12,
      quantity: 10,
      taxable_quantity: 4,
      returned_quantity: 0,
      converted_to_sale_quantity: 2,
    });
    const queryRunner = {
      manager: {
        findOne: jest.fn(async () => borrow),
        find: jest.fn(async () => [item]),
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
      inventoryBorrowRepository: {
        manager: { connection: { createQueryRunner: () => queryRunner } },
      },
    });
    const restoreBorrowItemStock = jest
      .spyOn(service as any, 'restoreBorrowItemStock')
      .mockResolvedValue(undefined);

    await expect(service.returnBorrow(40, 5)).rejects.toThrow(
      'chuyển 2 đơn vị sang bán nhưng chưa có snapshot thuế phần chuyển',
    );

    expect(restoreBorrowItemStock).not.toHaveBeenCalled();
    expect(queryRunner.manager.save).not.toHaveBeenCalled();
    expect(item.returned_quantity).toBe(0);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('requests transaction rollback when logging fails after in-transaction stock updates', async () => {
    const borrow = Object.assign(new InventoryBorrow(), {
      id: 40,
      code: 'BOR-40',
      status: InventoryBorrowStatus.APPROVED,
    });
    const item = Object.assign(new InventoryBorrowItem(), {
      id: 9,
      borrow_id: 40,
      product_id: 7,
      batch_id: 12,
      quantity: 10,
      taxable_quantity: 4,
      returned_quantity: 0,
      converted_to_sale_quantity: 0,
    });
    const product = Object.assign(new Product(), {
      id: 7,
      quantity: 100,
      taxable_quantity_stock: 10,
    });
    const batch = Object.assign(new InventoryBatch(), {
      id: 12,
      product_id: 7,
      remaining_quantity: 20,
      taxable_remaining_quantity: 5,
      unit_cost_price: '2',
      receipt_item_id: 3,
    });
    const manager = {
      findOne: jest.fn(async (entity: Function) =>
        entity === InventoryBorrow ? borrow : entity === Product ? product : batch,
      ),
      find: jest.fn(async () => [item]),
      save: jest.fn(async (entity: Function, value: Record<string, unknown>) => {
        if (entity === InventoryBorrowItem) Object.assign(item, value);
        if (entity === InventoryBorrow) Object.assign(borrow, value);
        return value;
      }),
      update: jest.fn(async (_entity: Function, _id: number, values: object) => {
        Object.assign(product, values);
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
    const service = Object.create(InventoryService.prototype) as InventoryService;
    (service as any).inventoryBorrowRepository = {
      manager: { connection: { createQueryRunner: () => queryRunner } },
    };
    jest.spyOn(service, 'findBorrowById').mockResolvedValue(borrow);
    jest.spyOn(service, 'getWeightedAverageCost').mockResolvedValue(2);
    const createTransaction = jest.spyOn(service, 'createTransaction')
      .mockRejectedValue(new Error('inventory transaction insert failed'));

    await expect(
      service.returnBorrow(40, 5, [{ item_id: 9, quantity: 7 }]),
    ).rejects.toThrow('inventory transaction insert failed');

    expect(manager.save).toHaveBeenCalledWith(batch);
    expect(manager.update).toHaveBeenCalledWith(
      Product,
      7,
      { quantity: 107, taxable_quantity_stock: 11 },
    );
    expect(createTransaction).toHaveBeenCalledTimes(1);
    expect(item.returned_quantity).toBe(0);
    expect(borrow.status).toBe(InventoryBorrowStatus.APPROVED);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    // This unit mock verifies rollback is requested; it does not emulate DB rollback semantics.
  });
});

const describePostgres = process.env.TAX_BACKFILL_TEST_URL ? describe : describe.skip;

describePostgres('InventoryService borrow-return PostgreSQL rollback', () => {
  let connection: DataSource;
  let databaseRunner: ReturnType<DataSource['createQueryRunner']>;
  let tables: {
    borrows: string;
    items: string;
    products: string;
    batches: string;
    transactions: string;
  };

  beforeAll(async () => {
    const suffix = `${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
    tables = {
      borrows: `tax_borrow_rollback_borrows_${suffix}`,
      items: `tax_borrow_rollback_items_${suffix}`,
      products: `tax_borrow_rollback_products_${suffix}`,
      batches: `tax_borrow_rollback_batches_${suffix}`,
      transactions: `tax_borrow_rollback_transactions_${suffix}`,
    };
    const targetHost = new URL(process.env.TAX_BACKFILL_TEST_URL!).hostname;
    if (targetHost !== 'ep-broad-pine-a1675nqi-pooler.ap-southeast-1.aws.neon.tech') {
      throw new Error(`Borrow-return integration tests are restricted to the dev DB host, got ${targetHost}`);
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
    // Keep TEMP fixtures on one Neon pooler session; afterEach rolls back the fixture.
    await databaseRunner.startTransaction();
    await databaseRunner.query(`
      CREATE TEMP TABLE ${tables.borrows} (
        id integer PRIMARY KEY, code text NOT NULL, status text NOT NULL,
        borrower_name text NOT NULL
      );
      CREATE TEMP TABLE ${tables.items} (
        id integer PRIMARY KEY, borrow_id integer NOT NULL, product_id integer NOT NULL,
        batch_id integer NOT NULL, quantity numeric NOT NULL, taxable_quantity numeric,
        returned_quantity numeric NOT NULL, converted_to_sale_quantity numeric NOT NULL
      );
      CREATE TEMP TABLE ${tables.products} (
        id integer PRIMARY KEY, quantity numeric NOT NULL,
        taxable_quantity_stock numeric NOT NULL
      );
      CREATE TEMP TABLE ${tables.batches} (
        id integer PRIMARY KEY, product_id integer NOT NULL, remaining_quantity numeric NOT NULL,
        taxable_remaining_quantity numeric NOT NULL, unit_cost_price text NOT NULL,
        receipt_item_id integer
      );
      CREATE TEMP TABLE ${tables.transactions} (
        id serial PRIMARY KEY, reference_type text NOT NULL,
        CHECK (reference_type <> 'BORROW_RETURN')
      );
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

  it('leaves lot, product, and borrow item unchanged when a mid-return DB write fails', async () => {
    await databaseRunner.query(`DELETE FROM ${tables.transactions}`);
    await databaseRunner.query(`DELETE FROM ${tables.items}`);
    await databaseRunner.query(`DELETE FROM ${tables.borrows}`);
    await databaseRunner.query(`DELETE FROM ${tables.batches}`);
    await databaseRunner.query(`DELETE FROM ${tables.products}`);
    await databaseRunner.query(`INSERT INTO ${tables.borrows} VALUES(40,'BOR-40','approved','Test')`);
    await databaseRunner.query(
      `INSERT INTO ${tables.items} VALUES(9,40,7,12,10,4,0,0)`,
    );
    await databaseRunner.query(`INSERT INTO ${tables.products} VALUES(7,100,10)`);
    await databaseRunner.query(`INSERT INTO ${tables.batches} VALUES(12,7,20,5,'2',3)`);

    const manager = {
      findOne: async (entity: Function, options: { where: { id: number } }) => {
        const table = entity === InventoryBorrow
          ? tables.borrows
          : entity === Product ? tables.products : tables.batches;
        const [row] = await databaseRunner.query(
          `SELECT * FROM ${table} WHERE id = $1`,
          [options.where.id],
        );
        const constructor = entity === InventoryBorrow
          ? InventoryBorrow
          : entity === Product ? Product : InventoryBatch;
        return row ? Object.assign(new constructor(), row) : null;
      },
      find: async (_entity: Function, options: { where: { borrow_id: number } }) => {
        const rows = await databaseRunner.query(
          `SELECT * FROM ${tables.items} WHERE borrow_id = $1 ORDER BY id`,
          [options.where.borrow_id],
        );
        return rows.map((row: Record<string, unknown>) =>
          Object.assign(new InventoryBorrowItem(), row),
        );
      },
      save: async (value: InventoryBatch | InventoryBorrowItem | InventoryBorrow) => {
        if (value instanceof InventoryBatch) {
          await databaseRunner.query(
            `UPDATE ${tables.batches} SET remaining_quantity=$1, taxable_remaining_quantity=$2 WHERE id=$3`,
            [value.remaining_quantity, value.taxable_remaining_quantity, value.id],
          );
        } else if (value instanceof InventoryBorrowItem) {
          await databaseRunner.query(
            `UPDATE ${tables.items} SET returned_quantity=$1 WHERE id=$2`,
            [value.returned_quantity, value.id],
          );
        } else {
          await databaseRunner.query(
            `UPDATE ${tables.borrows} SET status=$1 WHERE id=$2`,
            [value.status, value.id],
          );
        }
        return value;
      },
      update: async (_entity: Function, id: number, values: {
        quantity: number;
        taxable_quantity_stock: number;
      }) => databaseRunner.query(
        `UPDATE ${tables.products} SET quantity=$1, taxable_quantity_stock=$2 WHERE id=$3`,
        [values.quantity, values.taxable_quantity_stock, id],
      ),
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
    (service as any).inventoryBorrowRepository = {
      manager: { connection: { createQueryRunner: () => transactionRunner } },
    };
    jest.spyOn(service, 'getWeightedAverageCost').mockResolvedValue(2);
    const createTransaction = jest.spyOn(service, 'createTransaction').mockImplementation(
      async (_dto, runner) => runner!.query(
        `INSERT INTO ${tables.transactions}(reference_type) VALUES('BORROW_RETURN')`,
      ) as never,
    );

    await expect(
      service.returnBorrow(40, 5, [{ item_id: 9, quantity: 7 }]),
    ).rejects.toMatchObject({
      driverError: expect.objectContaining({ code: '23514' }),
    });
    expect(createTransaction).toHaveBeenCalledTimes(1);

    const [batch] = await databaseRunner.query(
      `SELECT remaining_quantity, taxable_remaining_quantity FROM ${tables.batches} WHERE id=12`,
    );
    const [product] = await databaseRunner.query(
      `SELECT quantity, taxable_quantity_stock FROM ${tables.products} WHERE id=7`,
    );
    const [item] = await databaseRunner.query(
      `SELECT returned_quantity FROM ${tables.items} WHERE id=9`,
    );
    const [borrow] = await databaseRunner.query(
      `SELECT status FROM ${tables.borrows} WHERE id=40`,
    );
    const [{ count }] = await databaseRunner.query(
      `SELECT COUNT(*)::int AS count FROM ${tables.transactions}`,
    );

    expect(Number(batch.remaining_quantity)).toBe(20);
    expect(Number(batch.taxable_remaining_quantity)).toBe(5);
    expect(Number(product.quantity)).toBe(100);
    expect(Number(product.taxable_quantity_stock)).toBe(10);
    expect(Number(item.returned_quantity)).toBe(0);
    expect(borrow.status).toBe('approved');
    expect(Number(count)).toBe(0);
  });
});
