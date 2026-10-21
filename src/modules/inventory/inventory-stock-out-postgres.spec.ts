import { DataSource, QueryRunner } from 'typeorm';
import { InventoryBatch } from '../../entities/inventories.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { InventoryTransaction } from '../../entities/inventory-transactions.entity';
import { Product } from '../../entities/products.entity';
import { InventoryService } from './inventory.service';

const describePostgres = process.env.TAX_BACKFILL_TEST_URL
  ? describe
  : describe.skip;

describePostgres(
  'InventoryService FIFO stock-out PostgreSQL TEMP fixtures',
  () => {
    jest.setTimeout(30000);

    let connection: DataSource;
    let databaseRunner: ReturnType<DataSource['createQueryRunner']>;
    let tables: {
      products: string;
      batches: string;
      receipts: string;
      transactions: string;
    };

    beforeAll(async () => {
      const targetHost = new URL(process.env.TAX_BACKFILL_TEST_URL!).hostname;
      if (
        targetHost !==
        'ep-broad-pine-a1675nqi-pooler.ap-southeast-1.aws.neon.tech'
      ) {
        throw new Error(
          `Stock-out integration tests are restricted to the dev DB host, got ${targetHost}`,
        );
      }
      const suffix = `${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
      tables = {
        products: `tax_stock_out_products_${suffix}`,
        batches: `tax_stock_out_batches_${suffix}`,
        receipts: `tax_stock_out_receipts_${suffix}`,
        transactions: `tax_stock_out_transactions_${suffix}`,
      };
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
      // Giữ fixture TEMP trong cùng transaction vì DEV dùng PostgreSQL pooler.
      await databaseRunner.startTransaction();
      await databaseRunner.query(`
      CREATE TEMP TABLE ${tables.products} (
        id integer PRIMARY KEY, quantity numeric NOT NULL,
        taxable_quantity_stock numeric NOT NULL, average_cost_price numeric NOT NULL
      );
      CREATE TEMP TABLE ${tables.batches} (
        id integer PRIMARY KEY, product_id integer NOT NULL, receipt_item_id integer,
        original_quantity numeric NOT NULL, remaining_quantity numeric NOT NULL,
        taxable_remaining_quantity numeric, unit_cost_price numeric NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE TEMP TABLE ${tables.receipts} (
        id integer PRIMARY KEY, taxable_quantity numeric NOT NULL,
        conversion_factor numeric NOT NULL, tax_selling_price numeric NOT NULL
      );
      CREATE TEMP TABLE ${tables.transactions} (
        id serial PRIMARY KEY, product_id integer NOT NULL, transaction_type text NOT NULL,
        quantity numeric NOT NULL, remaining_quantity numeric NOT NULL,
        reference_type text NOT NULL, reference_id integer
      );
    `);
    });

    beforeEach(async () => {
      await databaseRunner.query(`TRUNCATE TABLE
      ${tables.transactions}, ${tables.receipts}, ${tables.batches}, ${tables.products}
      RESTART IDENTITY`);
    });

    afterAll(async () => {
      if (databaseRunner) {
        // Rollback xóa cả bảng TEMP được tạo trong transaction và dữ liệu test.
        if (databaseRunner.isTransactionActive) {
          await databaseRunner.rollbackTransaction();
        }
        if (!databaseRunner.isReleased) await databaseRunner.release();
      }
      if (connection?.isInitialized) await connection.destroy();
    });

    async function serviceForStockOut(): Promise<{
      service: InventoryService;
      runner: QueryRunner;
    }> {
      const manager = {
        findOne: async (
          entity: Function,
          options: { where: { id: number } },
        ) => {
          if (entity !== Product) return null;
          const [row] = await databaseRunner.query(
            `SELECT * FROM ${tables.products} WHERE id=$1`,
            [options.where.id],
          );
          return row
            ? Object.assign(new Product(), {
                ...row,
                quantity: Number(row.quantity),
                taxable_quantity_stock: Number(row.taxable_quantity_stock),
                average_cost_price: String(row.average_cost_price),
              })
            : null;
        },
        update: async (
          entity: Function,
          id: number,
          values: Record<string, number>,
        ) => {
          if (entity !== Product)
            throw new Error(`Unexpected update entity ${entity.name}`);
          await databaseRunner.query(
            `UPDATE ${tables.products} SET quantity=$1,taxable_quantity_stock=$2 WHERE id=$3`,
            [values.quantity, values.taxable_quantity_stock, id],
          );
        },
        getRepository: (entity: Function) => {
          if (entity === InventoryBatch) {
            return {
              find: async (options: {
                where: {
                  product_id: number;
                  receipt_item_id?: number;
                  id?: number;
                };
              }) => {
                const rows = await databaseRunner.query(
                  `SELECT * FROM ${tables.batches}
                 WHERE product_id=$1 AND remaining_quantity>0
                   AND ($2::integer IS NULL OR receipt_item_id=$2)
                   AND ($3::integer IS NULL OR id=$3)
                 ORDER BY created_at ASC,id ASC`,
                  [
                    options.where.product_id,
                    options.where.receipt_item_id ?? null,
                    options.where.id ?? null,
                  ],
                );
                return rows.map((row: Record<string, unknown>) =>
                  Object.assign(new InventoryBatch(), {
                    ...row,
                    original_quantity: Number(row.original_quantity),
                    remaining_quantity: Number(row.remaining_quantity),
                    taxable_remaining_quantity:
                      row.taxable_remaining_quantity == null
                        ? row.taxable_remaining_quantity
                        : Number(row.taxable_remaining_quantity),
                    unit_cost_price: String(row.unit_cost_price),
                  }),
                );
              },
              save: async (batch: InventoryBatch) =>
                databaseRunner.query(
                  `UPDATE ${tables.batches} SET remaining_quantity=$1,
                taxable_remaining_quantity=$2 WHERE id=$3`,
                  [
                    batch.remaining_quantity,
                    batch.taxable_remaining_quantity,
                    batch.id,
                  ],
                ),
            };
          }
          if (entity === InventoryReceiptItem) {
            return {
              find: async (options: {
                where: { id: { _value: number[] } };
              }) => {
                const ids = options.where.id._value;
                const rows = await databaseRunner.query(
                  `SELECT * FROM ${tables.receipts} WHERE id=ANY($1::integer[])`,
                  [ids],
                );
                return rows.map((row: Record<string, unknown>) =>
                  Object.assign(new InventoryReceiptItem(), {
                    ...row,
                    taxable_quantity: Number(row.taxable_quantity),
                    conversion_factor: Number(row.conversion_factor),
                    tax_selling_price: String(row.tax_selling_price),
                  }),
                );
              },
            };
          }
          throw new Error(`Unexpected repository ${entity.name}`);
        },
      };
      const runner = {
        manager,
        isTransactionActive: true,
      } as unknown as QueryRunner;
      const service = Object.create(
        InventoryService.prototype,
      ) as InventoryService;
      Object.assign(service, {
        inventoryBatchRepository: manager.getRepository(InventoryBatch),
        inventoryReceiptItemRepository:
          manager.getRepository(InventoryReceiptItem),
        productService: {
          findOne: async (id: number) =>
            manager.findOne(Product, { where: { id } }),
        },
        logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        getWeightedAverageCost: jest.fn().mockResolvedValue(5),
        createTransaction: async (dto: Record<string, unknown>) => {
          const [row] = await databaseRunner.query(
            `INSERT INTO ${tables.transactions}
            (product_id,transaction_type,quantity,remaining_quantity,reference_type,reference_id)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
            [
              dto.product_id,
              dto.transaction_type,
              dto.quantity,
              dto.remaining_quantity,
              dto.reference_type,
              dto.reference_id ?? null,
            ],
          );
          return Object.assign(new InventoryTransaction(), { id: row.id });
        },
      });
      return { service, runner };
    }

    it('deducts non-taxable units first within the same lot and keeps product and lot tax aligned', async () => {
      await databaseRunner.query(`
      INSERT INTO ${tables.products} VALUES (1,10,6,5);
      INSERT INTO ${tables.receipts} VALUES (11,6,1,20);
      INSERT INTO ${tables.batches} VALUES
        (21,1,11,10,10,6,5,'2026-01-01T00:00:00Z');
    `);
      const { service, runner } = await serviceForStockOut();

      const first = await service.processStockOut(
        1,
        3,
        'SALE',
        9,
        100,
        undefined,
        runner,
        { requireBatchTaxSnapshot: true },
      );
      const second = await service.processStockOut(
        1,
        3,
        'SALE',
        9,
        101,
        undefined,
        runner,
        { requireBatchTaxSnapshot: true },
      );
      const [product] = await databaseRunner.query(
        `SELECT * FROM ${tables.products} WHERE id=1`,
      );
      const [batch] = await databaseRunner.query(
        `SELECT * FROM ${tables.batches} WHERE id=21`,
      );
      const transactions = await databaseRunner.query(
        `SELECT quantity,remaining_quantity FROM ${tables.transactions} ORDER BY id`,
      );

      expect(first.taxableQuantity).toBe(0);
      expect(second.taxableQuantity).toBe(2);
      expect(Number(product.quantity)).toBe(4);
      expect(Number(product.taxable_quantity_stock)).toBe(4);
      expect(Number(batch.remaining_quantity)).toBe(4);
      expect(Number(batch.taxable_remaining_quantity)).toBe(4);
      expect(transactions).toEqual([
        expect.objectContaining({ quantity: '-3', remaining_quantity: '7' }),
        expect.objectContaining({ quantity: '-3', remaining_quantity: '4' }),
      ]);
    });

    it('deducts taxable source-lot stock across four 250ml mixture runs', async () => {
      await databaseRunner.query(`
      INSERT INTO ${tables.products} VALUES (1,1000,1000,5);
      INSERT INTO ${tables.receipts} VALUES (11,2,500,20);
      INSERT INTO ${tables.batches} VALUES
        (21,1,11,1000,1000,NULL,5,'2026-01-01T00:00:00Z');
    `);
      const { service, runner } = await serviceForStockOut();
      const taxablePerRun: number[] = [];

      for (let run = 0; run < 4; run += 1) {
        const result = await service.processStockOut(
          1,
          250,
          'MIXTURE_OUT',
          9,
          200 + run,
          'Test phối trộn DEV 250ml',
          runner,
        );
        taxablePerRun.push(result.taxableQuantity);
      }

      await expect(
        service.processStockOut(
          1,
          250,
          'MIXTURE_OUT',
          9,
          204,
          'Test phối trộn vượt tồn DEV',
          runner,
        ),
      ).rejects.toThrow('Không đủ tồn kho');

      const [product] = await databaseRunner.query(
        `SELECT quantity,taxable_quantity_stock FROM ${tables.products} WHERE id=1`,
      );
      const [batch] = await databaseRunner.query(
        `SELECT remaining_quantity,taxable_remaining_quantity FROM ${tables.batches} WHERE id=21`,
      );
      const transactions = await databaseRunner.query(
        `SELECT quantity,remaining_quantity,reference_type FROM ${tables.transactions} ORDER BY id`,
      );

      expect(taxablePerRun).toEqual([250, 250, 250, 250]);
      expect(Number(product.quantity)).toBe(0);
      expect(Number(product.taxable_quantity_stock)).toBe(0);
      expect(Number(batch.remaining_quantity)).toBe(0);
      expect(Number(batch.taxable_remaining_quantity)).toBe(0);
      expect(transactions).toEqual([
        expect.objectContaining({ quantity: '-250', remaining_quantity: '750' }),
        expect.objectContaining({ quantity: '-250', remaining_quantity: '500' }),
        expect.objectContaining({ quantity: '-250', remaining_quantity: '250' }),
        expect.objectContaining({ quantity: '-250', remaining_quantity: '0' }),
      ]);
    });

    it('blocks a sale instead of estimating tax when a lot has no snapshot or receipt source', async () => {
      await databaseRunner.query(`
      INSERT INTO ${tables.products} VALUES (1,10,5,5);
      INSERT INTO ${tables.batches} VALUES
        (21,1,NULL,10,10,NULL,5,'2026-01-01T00:00:00Z');
    `);
      const { service, runner } = await serviceForStockOut();

      await expect(
        service.processStockOut(
          1,
          1,
          'SALE',
          9,
          7,
          'Test missing source tax snapshot',
          runner,
          { requireBatchTaxSnapshot: true },
        ),
      ).rejects.toThrow('Không thể duyệt hóa đơn bán hàng: lô #21 thiếu snapshot');

      const [product] = await databaseRunner.query(
        `SELECT quantity,taxable_quantity_stock FROM ${tables.products} WHERE id=1`,
      );
      const [batch] = await databaseRunner.query(
        `SELECT remaining_quantity,taxable_remaining_quantity FROM ${tables.batches} WHERE id=21`,
      );
      const [transactionCount] = await databaseRunner.query(
        `SELECT COUNT(*)::int AS count FROM ${tables.transactions}`,
      );
      expect(Number(product.quantity)).toBe(10);
      expect(Number(product.taxable_quantity_stock)).toBe(5);
      expect(Number(batch.remaining_quantity)).toBe(10);
      expect(batch.taxable_remaining_quantity).toBeNull();
      expect(transactionCount.count).toBe(0);
    });

    it('consumes an older non-taxable lot before deducting tax from the next FIFO lot', async () => {
      await databaseRunner.query(`
      INSERT INTO ${tables.products} VALUES (1,10,8,5);
      INSERT INTO ${tables.receipts} VALUES (11,0,1,0),(12,8,1,20);
      INSERT INTO ${tables.batches} VALUES
        (21,1,11,2,2,0,5,'2026-01-01T00:00:00Z'),
        (22,1,12,8,8,8,7,'2026-01-02T00:00:00Z');
    `);
      const { service, runner } = await serviceForStockOut();

      const result = await service.processStockOut(
        1,
        3,
        'SALE',
        9,
        102,
        undefined,
        runner,
        { requireBatchTaxSnapshot: true },
      );
      const batches = await databaseRunner.query(
        `SELECT id,remaining_quantity,taxable_remaining_quantity FROM ${tables.batches} ORDER BY id`,
      );
      const [product] = await databaseRunner.query(
        `SELECT * FROM ${tables.products} WHERE id=1`,
      );

      expect(
        result.affectedBatches.map((item) => [
          item.batchId,
          item.deductedQuantity,
          item.taxableQuantity,
        ]),
      ).toEqual([
        [21, 2, 0],
        [22, 1, 1],
      ]);
      expect(
        batches.map((batch: Record<string, unknown>) => [
          Number(batch.remaining_quantity),
          Number(batch.taxable_remaining_quantity),
        ]),
      ).toEqual([
        [0, 0],
        [7, 7],
      ]);
      expect(Number(product.quantity)).toBe(7);
      expect(Number(product.taxable_quantity_stock)).toBe(7);
    });

    it('persists a four-decimal product tax balance across fractional sales', async () => {
      await databaseRunner.query(`
      INSERT INTO ${tables.products} VALUES (1,1.5,0.75,5);
      INSERT INTO ${tables.receipts} VALUES (11,0,1,0),(12,0.75,1,20);
      INSERT INTO ${tables.batches} VALUES
        (21,1,11,0.375,0.375,0,5,'2026-01-01T00:00:00Z'),
        (22,1,12,1.125,1.125,0.75,7,'2026-01-02T00:00:00Z');
    `);
      const { service, runner } = await serviceForStockOut();

      const first = await service.processStockOut(
        1,
        0.5,
        'SALE',
        9,
        103,
        undefined,
        runner,
        { requireBatchTaxSnapshot: true },
      );
      const second = await service.processStockOut(
        1,
        0.375,
        'SALE',
        9,
        104,
        undefined,
        runner,
        { requireBatchTaxSnapshot: true },
      );
      const [product] = await databaseRunner.query(
        `SELECT quantity,taxable_quantity_stock FROM ${tables.products} WHERE id=1`,
      );
      const batches = await databaseRunner.query(
        `SELECT id,remaining_quantity,taxable_remaining_quantity FROM ${tables.batches} ORDER BY id`,
      );
      const transactions = await databaseRunner.query(
        `SELECT quantity,remaining_quantity FROM ${tables.transactions} ORDER BY id`,
      );

      expect(first.taxableQuantity).toBe(0);
      expect(second.taxableQuantity).toBe(0.125);
      expect(Number(product.quantity)).toBe(0.625);
      expect(Number(product.taxable_quantity_stock)).toBe(0.625);
      expect(
        batches.map((batch: Record<string, unknown>) => [
          Number(batch.remaining_quantity),
          Number(batch.taxable_remaining_quantity),
        ]),
      ).toEqual([[0, 0], [0.625, 0.625]]);
      expect(transactions).toEqual([
        expect.objectContaining({ quantity: '-0.5', remaining_quantity: '1' }),
        expect.objectContaining({ quantity: '-0.375', remaining_quantity: '0.625' }),
      ]);
    });
  },
);
