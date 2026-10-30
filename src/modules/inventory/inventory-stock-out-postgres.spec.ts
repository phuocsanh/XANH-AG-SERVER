import { DataSource, QueryRunner } from 'typeorm';
import { InventoryBatch } from '../../entities/inventories.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { InventoryReceipt } from '../../entities/inventory-receipts.entity';
import { InventoryTransaction } from '../../entities/inventory-transactions.entity';
import { Product, ProductCostingMethod } from '../../entities/products.entity';
import { SalesInvoice, SalesInvoiceStatus } from '../../entities/sales-invoices.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
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
          item.cost,
        ]),
      ).toEqual([
        [21, 2, 0, 5],
        [22, 1, 1, 7],
      ]);
      expect(result.totalCostValue).toBe(17);
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

describe('InventoryService giá vốn bán theo lô', () => {
  it('tạo phiếu đã duyệt với giảm giá 100% giữ giá vốn lô bằng 0', async () => {
    const manager = {
      create: jest.fn((entity, data) => Object.assign(new entity(), { id: 7 }, data)),
      save: jest.fn(async (entity) => entity),
      findOne: jest.fn().mockResolvedValue({ id: 1, unit_id: 1, unit_conversions: [] }),
      update: jest.fn(),
    };
    const runner = { manager, connect: jest.fn(), startTransaction: jest.fn(),
      commitTransaction: jest.fn(), rollbackTransaction: jest.fn(), release: jest.fn() };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, {
      logger: { log: jest.fn(), error: jest.fn() },
      inventoryReceiptRepository: {
        manager: { connection: { createQueryRunner: () => runner } },
        findOne: jest.fn().mockResolvedValue(null),
      },
      validateReceiptSettlementMode: jest.fn().mockResolvedValue('standard'),
      applyBySaleTypeReceiptDiscountToProductCosts: jest.fn(),
      processStockIn: jest.fn().mockResolvedValue({ batch: { code: 'LOT-TEST' } }),
      recalculateAverageVatInputCost: jest.fn(), recalculateAverageCostPriceForProducts: jest.fn(),
      getTaxRevenueCutoverDateValue: jest.fn().mockResolvedValue(null), syncTaxableDataForProduct: jest.fn(),
    });
    await service.createReceipt({ receipt_code: 'REC-TEST-ZERO', supplier_id: 1, status: 'approved',
      items: [{ product_id: 1, quantity: 2, unit_cost: 100, discount_type: 'percentage', discount_value: 100 }],
    } as any, 1);
    expect(service.processStockIn).toHaveBeenCalledWith(1, 2, 0, 1, 7, 'LOT-TEST-ZERO-1',
      undefined, runner, 0);
    expect(runner.commitTransaction).toHaveBeenCalled();
  });

  it('xem trước hai dòng cùng sản phẩm dùng các lô còn lại và chặn vượt tồn', async () => {
    const batches = [
      { id: 101, product_id: 1, original_quantity: 2, remaining_quantity: 2, taxable_remaining_quantity: 0, unit_cost_price: '100' },
      { id: 102, product_id: 1, original_quantity: 2, remaining_quantity: 2, taxable_remaining_quantity: 0, unit_cost_price: '120' },
    ];
    const batchRepo = {
      find: jest.fn(async () => batches.map((batch) => Object.assign(new InventoryBatch(), batch))),
      save: jest.fn(),
    };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, {
      getInventorySummary: jest.fn(async () => ({ totalQuantity: 4 })),
      getWeightedAverageCost: jest.fn().mockResolvedValue(100),
      productService: { productRepository: { findOne: jest.fn().mockResolvedValue({ id: 1, taxable_quantity_stock: 0 }) } },
      inventoryBatchRepository: batchRepo,
      inventoryReceiptItemRepository: { find: jest.fn().mockResolvedValue([]) },
    });

    const preview = await service.previewStockOutItems([{ productId: 1, quantity: 2 }, { productId: 1, quantity: 2 }]);
    expect(preview.totalCostValue).toBe(440);
    expect(preview.items.map((item) => item.totalCostValue)).toEqual([200, 240]);
    await expect(service.previewStockOutItems([{ productId: 1, quantity: 2 }, { productId: 1, quantity: 3 }]))
      .rejects.toThrow('Không đủ tồn kho');
    expect(batchRepo.save).not.toHaveBeenCalled();
    expect(batches.map((batch) => batch.remaining_quantity)).toEqual([2, 2]);
  });
  it('xuất một sản phẩm từ hai lô có giá khác nhau', async () => {
    const product = Object.assign(new Product(), {
      id: 1, quantity: 3, taxable_quantity_stock: 0, average_cost_price: '5',
    });
    const batches = [
      Object.assign(new InventoryBatch(), {
        id: 21, product_id: 1, remaining_quantity: 2,
        taxable_remaining_quantity: 0, unit_cost_price: '5',
      }),
      Object.assign(new InventoryBatch(), {
        id: 22, product_id: 1, remaining_quantity: 1,
        taxable_remaining_quantity: 0, unit_cost_price: '7',
      }),
    ];
    const batchRepo = {
      find: jest.fn().mockResolvedValue(batches),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const manager = {
      findOne: jest.fn().mockResolvedValue(product),
      getRepository: jest.fn((entity: Function) =>
        entity === InventoryBatch ? batchRepo : { find: jest.fn().mockResolvedValue([]) },
      ),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, {
      getInventorySummary: jest.fn().mockResolvedValue({ totalQuantity: 3 }),
      getWeightedAverageCost: jest.fn().mockResolvedValue(5),
      createTransaction: jest.fn().mockResolvedValue({ id: 1 }),
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    const result = await service.processStockOut(
      1, 3, 'SALE', 9, 100, undefined,
      { manager, isTransactionActive: true } as unknown as QueryRunner,
      { requireBatchTaxSnapshot: true },
    );

    expect(result.affectedBatches.map((row) => [row.batchId, row.deductedQuantity, row.cost]))
      .toEqual([[21, 2, 5], [22, 1, 7]]);
    expect(result.totalCostValue).toBe(17);
    expect(manager.update).toHaveBeenCalledWith(Product, 1,
      expect.objectContaining({ quantity: 0 }));
  });

  it('xuất quà sản phẩm thường ghi giá từng lô thay vì bình quân', async () => {
    const product = Object.assign(new Product(), { id: 1, quantity: 3, taxable_quantity_stock: 0,
      average_cost_price: '50', costing_method: ProductCostingMethod.FIXED });
    const batches = [Object.assign(new InventoryBatch(), { id: 21, product_id: 1,
      remaining_quantity: 2, taxable_remaining_quantity: 0, unit_cost_price: '100' }),
      Object.assign(new InventoryBatch(), { id: 22, product_id: 1,
        remaining_quantity: 1, taxable_remaining_quantity: 0, unit_cost_price: '200' })];
    const manager = { findOne: jest.fn().mockResolvedValue(product),
      getRepository: jest.fn((entity) => entity === InventoryBatch
        ? { find: jest.fn().mockResolvedValue(batches), save: jest.fn() }
        : { find: jest.fn().mockResolvedValue([]) }), update: jest.fn() };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { getInventorySummary: jest.fn().mockResolvedValue({ totalQuantity: 3 }),
      getWeightedAverageCost: jest.fn().mockResolvedValue(50), createTransaction: jest.fn().mockResolvedValue({ id: 1 }),
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } });
    const result = await service.processStockOut(1, 3, 'INVOICE_GIFT', 9, 100, undefined,
      { manager, isTransactionActive: true } as unknown as QueryRunner, { requireBatchTaxSnapshot: true });
    expect(result.totalCostValue).toBe(400);
  });

  it('chặn điều chỉnh tăng sản phẩm thường không còn lô và chưa chọn lô nguồn', async () => {
    const manager = { findOne: jest.fn().mockResolvedValue({ id: 1, costing_method: ProductCostingMethod.FIXED }),
      getRepository: jest.fn().mockReturnValue({ findOne: jest.fn().mockResolvedValue(null) }) };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    await expect((service as any).applyAdjustmentItemStockEffect(
      { product_id: 1, quantity_change: 1 }, { adjustment_type: 'IN' }, 1, { manager },
    )).rejects.toThrow('vui lòng chọn lô nhập nguồn');
  });

  it('cập nhật đúng từng giao dịch khi cùng sản phẩm xuất trên nhiều dòng', async () => {
    const items = [
      { id: 18, product_id: 1, base_quantity: 2, costing_method_snapshot: ProductCostingMethod.BY_BATCH },
      { id: 19, product_id: 1, base_quantity: 2, costing_method_snapshot: ProductCostingMethod.BY_BATCH },
    ];
    const allocations = [
      { id: 1, invoice_id: 7, product_id: 1, sales_invoice_item_id: 18, receipt_item_id: 11, quantity: 2, total_cost: 240 },
      { id: 2, invoice_id: 7, product_id: 1, sales_invoice_item_id: 19, receipt_item_id: 12, quantity: 2, total_cost: 400 },
    ];
    const transactions = [{ id: 33, quantity: -2, notes: 'Bán [sales-item:18]' },
      { id: 34, quantity: -2, notes: 'Bán [sales-item:19]' }];
    const manager = { findOne: jest.fn().mockResolvedValue({ id: 7, status: SalesInvoiceStatus.CONFIRMED }),
      find: jest.fn(async (entity, options) => entity === SalesInvoiceItem ? items :
        entity === InventoryTransaction ? transactions : options.where.receipt_item_id ? [allocations[0]] : allocations),
      update: jest.fn() };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { getManager: () => manager, logger: { log: jest.fn(), warn: jest.fn() },
      syncInvoiceCostSnapshotFromAllocations: jest.fn(), syncSupplierSettlementForPostedInvoice: jest.fn() });
    await (service as any).syncSoldInvoicesForReceiptItems([{ id: 11, product_id: 1, final_unit_cost: 120, conversion_factor: 1 }]);
    expect(manager.update).toHaveBeenCalledWith(InventoryTransaction, 33, { unit_cost_price: '120', total_value: '-240' });
    expect(manager.update).toHaveBeenCalledWith(InventoryTransaction, 34, { unit_cost_price: '200', total_value: '-400' });
    transactions[1]!.notes = 'Dữ liệu cũ không ghi dòng';
    manager.update.mockClear();
    await (service as any).syncSoldInvoicesForReceiptItems([{ id: 11, product_id: 1, final_unit_cost: 120, conversion_factor: 1 }]);
    expect(manager.update).not.toHaveBeenCalledWith(InventoryTransaction, expect.anything(), expect.anything());
  });

  it('cập nhật sổ SALE theo tổng giá các lô khi đối chiếu được duy nhất giao dịch', async () => {
    const allocations = [{ id: 1, invoice_id: 7, product_id: 1, receipt_item_id: 11,
      quantity: 2, total_cost: 240 }];
    const manager = {
      findOne: jest.fn().mockResolvedValue({ id: 7, status: SalesInvoiceStatus.CONFIRMED }),
      find: jest.fn(async (entity) => {
        if (entity === SalesInvoiceItem) return [{ product_id: 1, base_quantity: 2, costing_method_snapshot: ProductCostingMethod.BY_BATCH }];
        if (entity === InventoryTransaction) return [{ id: 33, quantity: -2 }];
        return allocations;
      }), update: jest.fn(),
    };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { getManager: () => manager, logger: { log: jest.fn(), warn: jest.fn() },
      syncInvoiceCostSnapshotFromAllocations: jest.fn(), syncSupplierSettlementForPostedInvoice: jest.fn() });
    await (service as any).syncSoldInvoicesForReceiptItems([{ id: 11, product_id: 1, final_unit_cost: 120, conversion_factor: 1 }]);
    expect(manager.update).toHaveBeenCalledWith(InventoryTransaction, 33, { unit_cost_price: '120', total_value: '-240' });
  });

  it('sửa phí phiếu chuẩn rollback khi tính lại giá lô thất bại', async () => {
    const receipt = { id: 7, status: 'approved', supplier_settlement_mode: 'standard',
      shared_shipping_cost: 0, paid_amount: 0, returned_amount: 0, images: [] };
    const runner = { manager: { findOne: jest.fn().mockResolvedValue(receipt), find: jest.fn().mockResolvedValue([]), update: jest.fn() },
      connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(), rollbackTransaction: jest.fn(), release: jest.fn() };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { findReceiptById: jest.fn().mockResolvedValue(receipt),
      inventoryReceiptRepository: { manager: { connection: { createQueryRunner: () => runner } } },
      inventoryReceiptItemRepository: { find: jest.fn().mockResolvedValue([{ quantity: 1, unit_cost: 100 }]) },
      recalculateApprovedReceiptShipping: jest.fn().mockRejectedValue(new Error('Lỗi cập nhật lô')),
      logger: { log: jest.fn() } });
    await expect(service.updateReceipt(7, { shared_shipping_cost: 10 }, 1)).rejects.toThrow('Lỗi cập nhật lô');
    expect(runner.rollbackTransaction).toHaveBeenCalled();
    expect(runner.commitTransaction).not.toHaveBeenCalled();
  });

  it('tính lại tài chính phiếu chuẩn giữ phần đã trả NCC và phí ngoài công nợ', async () => {
    const receiptRepo = { findOne: jest.fn().mockResolvedValue({
      supplier_settlement_mode: 'standard', paid_amount: 20, returned_amount: 30,
      shared_shipping_cost: 10, items: [{ quantity: 2, unit_cost: 50, individual_shipping_cost: 5 }],
    }), update: jest.fn() };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { inventoryReceiptRepository: receiptRepo, logger: { log: jest.fn() } });
    await (service as any).recalculateReceiptFinance(7);
    expect(receiptRepo.update).toHaveBeenCalledWith(7, expect.objectContaining({
      supplier_amount: 70, total_amount: 85, debt_amount: 50,
    }));
  });

  it('chia phí chung theo số lượng khi tiền hàng sau giảm giá bằng không', async () => {
    const item = { id: 11, product_id: 1, quantity: 2, unit_cost: 100,
      discount_type: 'percentage', discount_value: 100, conversion_factor: 1 };
    const itemRepo = { update: jest.fn() };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, {
      inventoryReceiptRepository: { findOne: jest.fn().mockResolvedValue({
        supplier_settlement_mode: 'standard', shared_shipping_cost: 20,
        shipping_allocation_method: 'by_value', items: [item],
      }) }, inventoryReceiptItemRepository: itemRepo,
      inventoryBatchRepository: { update: jest.fn() },
      inventoryTransactionRepository: { find: jest.fn().mockResolvedValue([]) },
      syncSoldInvoicesForReceiptItems: jest.fn(), logger: { log: jest.fn() },
    });
    await (service as any).recalculateApprovedReceiptShipping(7);
    expect(itemRepo.update).toHaveBeenCalledWith(11, expect.objectContaining({
      allocated_shipping_cost: 20, final_unit_cost: 10,
    }));
  });

  it('tính lại giá lô cộng lượng trả lẻ trước khi làm tròn', async () => {
    const invoice = { id: 7, status: SalesInvoiceStatus.CONFIRMED, final_amount: 10,
      items: [{ id: 18, product_id: 1, quantity: 6, base_quantity: 0.03,
        costing_method_snapshot: ProductCostingMethod.BY_BATCH }] };
    const returnQuery = { innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([1, 2].map((id) => ({
        id, sales_invoice_item_id: 18, base_quantity: 0.005,
        stock_allocations: [{ sourceBatchId: 101, quantity: 0.005 }],
      }))),
    };
    const manager = { findOne: jest.fn().mockResolvedValue(invoice),
      find: jest.fn().mockResolvedValue([{ inventory_batch_id: 101, quantity: 0.03, unit_cost: 1, total_cost: 0.03 }]),
      getRepository: jest.fn().mockReturnValue({ createQueryBuilder: () => returnQuery }), update: jest.fn() };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    await (service as any).syncInvoiceCostSnapshotFromAllocations(7, { manager });
    expect(manager.update).toHaveBeenCalledWith(SalesInvoice, 7,
      expect.objectContaining({ cost_of_goods_sold: 0.02 }));
  });

  it('tính lại giá phiếu nhập vẫn trừ giá vốn của lô khách đã trả', async () => {
    const invoice = Object.assign(new SalesInvoice(), {
      id: 7, code: 'INV-7', status: SalesInvoiceStatus.CONFIRMED,
      final_amount: 400,
      items: [Object.assign(new SalesInvoiceItem(), {
        id: 18, product_id: 1, quantity: 3, base_quantity: 3,
        costing_method_snapshot: ProductCostingMethod.BY_BATCH,
      })],
    });
    const returnQuery = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{
        id: 4, sales_invoice_item_id: 18, base_quantity: 1,
        stock_allocations: [{ sourceBatchId: 101, quantity: 1 }],
      }]),
    };
    const manager = {
      findOne: jest.fn().mockResolvedValue(invoice),
      find: jest.fn().mockResolvedValue([
        { inventory_batch_id: 101, quantity: 2, unit_cost: 100, total_cost: 200 },
        { inventory_batch_id: 102, quantity: 1, unit_cost: 120, total_cost: 120 },
      ]),
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(returnQuery),
      }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = Object.create(InventoryService.prototype) as InventoryService;

    await (service as any).syncInvoiceCostSnapshotFromAllocations(7, {
      manager,
    } as unknown as QueryRunner);

    expect(manager.update).toHaveBeenCalledWith(SalesInvoice, 7, {
      cost_of_goods_sold: 220,
      gross_profit: 180,
      gross_profit_margin: 45,
    });
  });

  it('sửa giá nhập theo bao giữ giá lô theo đơn vị kho và giá trị từng giao dịch', async () => {
    const item = {
      id: 11, product_id: 1, quantity: 2, unit_cost: 500,
      conversion_factor: 50, individual_shipping_cost: 0,
    };
    const itemRepo = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    const batchRepo = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    const transactionRepo = {
      find: jest.fn().mockResolvedValue([{ id: 1, quantity: 100 }, { id: 2, quantity: -10 }]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, {
      inventoryReceiptRepository: { findOne: jest.fn().mockResolvedValue({
        shared_shipping_cost: 0, shipping_allocation_method: 'by_value', items: [item],
      }) },
      inventoryReceiptItemRepository: itemRepo,
      inventoryBatchRepository: batchRepo,
      inventoryTransactionRepository: transactionRepo,
      syncSoldInvoicesForReceiptItems: jest.fn().mockResolvedValue(undefined),
      logger: { log: jest.fn() },
    });

    await (service as any).recalculateApprovedReceiptShipping(7);

    expect(batchRepo.update).toHaveBeenCalledWith({ receipt_item_id: 11 }, { unit_cost_price: '10' });
    expect(transactionRepo.update).toHaveBeenCalledWith(1, { unit_cost_price: '10', total_value: '1000' });
    expect(transactionRepo.update).toHaveBeenCalledWith(2, { unit_cost_price: '10', total_value: '-100' });
    expect(service['syncSoldInvoicesForReceiptItems']).toHaveBeenCalledWith([expect.objectContaining({ final_unit_cost: 500 })], undefined);
  });

  it('tính lại hóa đơn lúa giống vẫn trừ hàng đã trả theo giá vốn loại bán', async () => {
    const invoice = Object.assign(new SalesInvoice(), {
      id: 7, code: 'INV-7', status: SalesInvoiceStatus.CONFIRMED, final_amount: 400,
      items: [Object.assign(new SalesInvoiceItem(), {
        id: 18, product_id: 1, quantity: 3, base_quantity: 3, cost_price: 100,
        costing_method_snapshot: ProductCostingMethod.BY_PRICE_TYPE,
      })],
    });
    const returnQuery = {
      innerJoinAndSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([
        { sales_invoice_item_id: 18, base_quantity: 1 },
      ]),
    };
    const manager = {
      findOne: jest.fn().mockResolvedValue(invoice),
      getRepository: jest.fn().mockReturnValue({ createQueryBuilder: jest.fn().mockReturnValue(returnQuery) }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    await (service as any).syncInvoiceCostSnapshotFromAllocations(7, { manager } as unknown as QueryRunner);
    expect(manager.update).toHaveBeenCalledWith(SalesInvoice, 7, {
      cost_of_goods_sold: 200, gross_profit: 200, gross_profit_margin: 50,
    });
  });

  it('rollback sửa giá phiếu nhập khi đồng bộ giá vốn hóa đơn thất bại', async () => {
    const item = Object.assign(new InventoryReceiptItem(), {
      id: 11, receipt_id: 7, product_id: 1, quantity: 2, unit_cost: 400,
      taxable_quantity: 0, tax_selling_price: '0',
      receipt: Object.assign(new InventoryReceipt(), { id: 7, status: 'approved' }),
    });
    const manager = {
      findOne: jest.fn(async (entity: Function) => {
        if (entity === InventoryReceipt) return item.receipt;
        if (entity === Product) return { id: 1 };
        if (entity === InventoryReceiptItem) return item;
        return null;
      }),
      find: jest.fn().mockResolvedValue([item]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const runner = {
      manager, isTransactionActive: true, connect: jest.fn(), startTransaction: jest.fn(),
      commitTransaction: jest.fn(), rollbackTransaction: jest.fn(), release: jest.fn(),
    };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    const recalculateFinance = jest.fn();
    Object.assign(service, {
      inventoryReceiptItemRepository: { findOne: jest.fn().mockResolvedValue(item) },
      inventoryReceiptRepository: { manager: { connection: { createQueryRunner: () => runner } } },
      logReceiptItemChanges: jest.fn().mockResolvedValue(undefined),
      recalculateApprovedReceiptShipping: jest.fn().mockRejectedValue(new Error('Lỗi đồng bộ giá lô')),
      recalculateReceiptFinance: recalculateFinance,
      logger: { log: jest.fn() },
    });

    await expect(service.updateReceiptItem(11, { unit_cost: 500 }, 1)).rejects.toThrow('Lỗi đồng bộ giá lô');
    expect(manager.update).toHaveBeenCalledWith(InventoryReceiptItem, 11, expect.objectContaining({ unit_cost: 500 }));
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(runner.commitTransaction).not.toHaveBeenCalled();
    expect(recalculateFinance).not.toHaveBeenCalled();
  });
});
