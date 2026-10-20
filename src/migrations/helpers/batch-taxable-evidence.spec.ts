import { DataSource, QueryRunner } from 'typeorm';
import {
  BATCH_TAXABLE_EVIDENCE_SQL,
  BatchTaxableEvidence,
} from './batch-taxable-evidence';
import { BackfillBatchTaxableRemainingQuantity1786384000000 } from '../1786384000000-BackfillBatchTaxableRemainingQuantity';
import { ReconcileCustomerReturnBatchTaxableRemaining1786385000000 } from '../1786385000000-ReconcileCustomerReturnBatchTaxableRemaining';
import { RepairLegacyBatchTaxableBalances1786386000000 } from '../1786386000000-RepairLegacyBatchTaxableBalances';

const describePostgres = process.env.TAX_BACKFILL_TEST_URL
  ? describe
  : describe.skip;

describePostgres('taxable batch migration on PostgreSQL TEMP fixtures', () => {
  let connection: DataSource;
  let runner: QueryRunner;
  jest.setTimeout(60000);

  beforeAll(async () => {
    const targetHost = new URL(process.env.TAX_BACKFILL_TEST_URL!).hostname;
    if (targetHost !== 'ep-broad-pine-a1675nqi-pooler.ap-southeast-1.aws.neon.tech') {
      throw new Error(`Batch-tax evidence integration tests are restricted to the dev DB host, got ${targetHost}`);
    }
    connection = new DataSource({
      type: 'postgres',
      url: process.env.TAX_BACKFILL_TEST_URL!,
      ssl: { rejectUnauthorized: false },
      synchronize: false,
      logging: false,
    });
    await connection.initialize();
    runner = connection.createQueryRunner();
    await runner.connect();
  });
  afterAll(async () => {
    if (runner) await runner.release();
    if (connection?.isInitialized) await connection.destroy();
  });
  beforeEach(async () => {
    // Neon may reuse a backend session; clear only stale TEMP fixtures before beginning rollback scope.
    await runner.query(`
      DROP TABLE IF EXISTS pg_temp.sales_invoice_item_stock_allocations,
        pg_temp.sales_return_items, pg_temp.sales_returns, pg_temp.inventory_transactions,
        pg_temp.inventories, pg_temp.inventory_receipt_items, pg_temp.inventory_receipts,
        pg_temp.products CASCADE;
    `);
    await runner.startTransaction();
    await runner.query(`
      CREATE TEMP TABLE products(id int PRIMARY KEY,name text,quantity numeric(15,4),
        taxable_quantity_stock numeric(15,2),updated_at timestamp,deleted_at timestamp);
      CREATE TEMP TABLE inventory_receipts(id int PRIMARY KEY,status text,deleted_at timestamp);
      CREATE TEMP TABLE inventory_receipt_items(id int PRIMARY KEY,receipt_id int,product_id int,
        quantity numeric,taxable_quantity numeric,conversion_factor numeric,
        base_quantity numeric,deleted_at timestamp);
      CREATE TEMP TABLE inventories(id int PRIMARY KEY,product_id int,code text,
        original_quantity numeric(15,4),remaining_quantity numeric(15,4),
        taxable_remaining_quantity numeric(15,4),receipt_item_id int,
        created_at timestamp DEFAULT NOW(),updated_at timestamp,deleted_at timestamp);
      CREATE TEMP TABLE inventory_transactions(id serial PRIMARY KEY,product_id int,type text,
        quantity numeric,reference_type text,reference_id int,receipt_item_id int,deleted_at timestamp);
      CREATE TEMP TABLE sales_returns(id int PRIMARY KEY,code text,status text);
      CREATE TEMP TABLE sales_return_items(id int PRIMARY KEY,sales_return_id int,product_id int,
        stock_allocations jsonb,quantity numeric,base_quantity numeric,conversion_factor numeric);
      CREATE TEMP TABLE sales_invoice_item_stock_allocations(id serial PRIMARY KEY,
        product_id int,inventory_batch_id int,quantity numeric);
    `);
  });
  afterEach(async () => {
    if (runner?.isTransactionActive) await runner.rollbackTransaction();
  });

  async function receiptLot(
    options: {
      id?: number;
      productId?: number;
      quantity?: number;
      tax?: number;
      factor?: number;
      remaining?: number;
      currentTax?: number | null;
    } = {},
  ): Promise<number> {
    const id = options.id ?? 1;
    const productId = options.productId ?? 1;
    const quantity = options.quantity ?? 30;
    const factor = options.factor ?? 1;
    const original = quantity * factor;
    const remaining = options.remaining ?? original;
    await runner.query(
      'INSERT INTO products VALUES($1,$2,0,0,NULL,NULL) ON CONFLICT DO NOTHING',
      [productId, `Product ${productId}`],
    );
    await runner.query(
      "INSERT INTO inventory_receipts VALUES($1,'approved',NULL)",
      [id],
    );
    await runner.query(
      'INSERT INTO inventory_receipt_items VALUES($1,$1,$2,$3,$4,$5,$6,NULL)',
      [id, productId, quantity, options.tax ?? quantity, factor, original],
    );
    await runner.query(
      'INSERT INTO inventories(id,product_id,code,original_quantity,remaining_quantity,taxable_remaining_quantity,receipt_item_id) VALUES($1,$2,$3,$4,$5,$6,$1)',
      [
        id,
        productId,
        `LOT-${id}`,
        original,
        remaining,
        options.currentTax ?? null,
      ],
    );
    await runner.query(
      "INSERT INTO inventory_transactions(product_id,type,quantity,reference_type,reference_id,receipt_item_id) VALUES($1,'IN',$2,'STOCK_IN',$3,$3)",
      [productId, original, id],
    );
    if (remaining < original) {
      await runner.query(
        "INSERT INTO inventory_transactions(product_id,type,quantity,reference_type) VALUES($1,'OUT',$2,'SALE')",
        [productId, remaining - original],
      );
    }
    await runner.query(
      'UPDATE products SET quantity=(SELECT SUM(remaining_quantity) FROM inventories WHERE product_id=$1) WHERE id=$1',
      [productId],
    );
    return id;
  }

  async function returnLot(
    options: {
      original?: number;
      remaining?: number;
      currentTax?: number | null;
      allocations?: unknown;
      status?: string;
      allocationProduct?: number;
    } = {},
  ): Promise<void> {
    const original = options.original ?? 5;
    const remaining = options.remaining ?? original;
    await runner.query(
      "INSERT INTO products VALUES(1,'Return product',$1,0,NULL,NULL)",
      [remaining],
    );
    await runner.query(
      "INSERT INTO inventories(id,product_id,code,original_quantity,remaining_quantity,taxable_remaining_quantity) VALUES(100,1,'RETURN-TEST',$1,$2,$3)",
      [original, remaining, options.currentTax ?? null],
    );
    await runner.query("INSERT INTO sales_returns VALUES(1,'TEST',$1)", [
      options.status ?? 'approved',
    ]);
    await runner.query(
      'INSERT INTO sales_return_items VALUES(1,1,$1,$2::jsonb,$3,$3,1)',
      [
        options.allocationProduct ?? 1,
        JSON.stringify(
          options.allocations ?? [
            { batchId: 100, quantity: original, taxableQuantity: 2 },
          ],
        ),
        original,
      ],
    );
    await runner.query(
      "INSERT INTO inventory_transactions(product_id,type,quantity,reference_type,reference_id) VALUES(1,'IN',$1,'STOCK_IN',100)",
      [original],
    );
    if (remaining < original) {
      await runner.query(
        "INSERT INTO inventory_transactions(product_id,type,quantity,reference_type) VALUES(1,'OUT',$1,'SALE')",
        [remaining - original],
      );
    }
  }

  async function row(id: number): Promise<BatchTaxableEvidence> {
    const rows = (await runner.query(
      BATCH_TAXABLE_EVIDENCE_SQL,
    )) as BatchTaxableEvidence[];
    return rows.find((value) => value.id === id)!;
  }

  it('initializes a taxable receipt without any customer-return snapshot', async () => {
    await receiptLot({ remaining: 21 });
    await new BackfillBatchTaxableRemainingQuantity1786384000000().up(runner);
    const [batch] = await runner.query(
      'SELECT taxable_remaining_quantity FROM inventories WHERE id=1',
    );
    expect(Number(batch.taxable_remaining_quantity)).toBe(21);
  });

  it.each([
    [30, 10],
    [21, 10],
    [10, 10],
    [7, 7],
    [0, 0],
  ])(
    'preserves non-tax-first mixed stock at remaining %s',
    async (remaining, expected) => {
      await receiptLot({ tax: 10, remaining });
      expect(Number((await row(1)).expected_tax)).toBe(expected);
    },
  );

  it('keeps a non-tax receipt non-taxable', async () => {
    await receiptLot({ tax: 0, remaining: 21 });
    expect(Number((await row(1)).expected_tax)).toBe(0);
  });

  it('does not infer mixed tax from a stock reduction without matching outflow', async () => {
    await receiptLot({ tax: 10, remaining: 21 });
    await runner.query("DELETE FROM inventory_transactions WHERE type='OUT'");
    expect((await row(1)).expected_tax).toBeNull();
  });

  it('requires complete per-batch allocations when a mixed product has multiple batches', async () => {
    await receiptLot({ id: 1, tax: 10, remaining: 21 });
    await receiptLot({ id: 2, tax: 0, remaining: 25 });
    expect((await row(1)).expected_tax).toBeNull();
    await runner.query(
      'INSERT INTO sales_invoice_item_stock_allocations(product_id,inventory_batch_id,quantity) VALUES(1,1,9),(1,2,5)',
    );
    expect(Number((await row(1)).expected_tax)).toBe(10);
    await runner.query(
      'DELETE FROM sales_invoice_item_stock_allocations WHERE inventory_batch_id=2',
    );
    expect((await row(1)).expected_tax).toBeNull();
  });

  it('uses base quantities for converted and fractional stock', async () => {
    await receiptLot({ quantity: 10, tax: 3, factor: 0.5, remaining: 4.25 });
    expect(Number((await row(1)).expected_tax)).toBe(1.5);
    await receiptLot({
      id: 2,
      productId: 2,
      quantity: 2,
      tax: 1,
      factor: 50,
      remaining: 70,
    });
    expect(Number((await row(2)).expected_tax)).toBe(50);
  });

  it.each(['STOCK_IN_CANCEL', 'BORROW_RETURN', 'ADJUSTMENT_CANCEL'])(
    'does not infer mixed tax after %s',
    async (reference) => {
      await receiptLot({ quantity: 10, tax: 4, remaining: 6, currentTax: 2 });
      await runner.query(
        "INSERT INTO inventory_transactions(product_id,type,quantity,reference_type) VALUES(1,'IN',4,$1)",
        [reference],
      );
      expect((await row(1)).expected_tax).toBeNull();
      await new RepairLegacyBatchTaxableBalances1786386000000().up(runner);
      const [batch] = await runner.query(
        'SELECT taxable_remaining_quantity FROM inventories WHERE id=1',
      );
      expect(Number(batch.taxable_remaining_quantity)).toBe(2);
    },
  );

  it.each(['RETURN', 'BORROW_OUT', null])(
    'rejects unexplained mixed outflow %s',
    async (reference) => {
      await receiptLot({ tax: 10, remaining: 21 });
      await runner.query(
        "INSERT INTO inventory_transactions(product_id,type,quantity,reference_type) VALUES(1,'OUT',-9,$1)",
        [reference],
      );
      expect((await row(1)).expected_tax).toBeNull();
    },
  );

  it('restores full-tax receipt balances after supplier depletion without taxing unrelated lots', async () => {
    await receiptLot({ id: 1, quantity: 10, remaining: 4 });
    await receiptLot({ id: 2, tax: 0, quantity: 10, remaining: 8 });
    await runner.query(
      "INSERT INTO inventory_transactions(product_id,type,quantity,reference_type) VALUES(1,'OUT',-6,'RETURN')",
    );
    await new RepairLegacyBatchTaxableBalances1786386000000().up(runner);
    const [product] = await runner.query(
      'SELECT quantity,taxable_quantity_stock FROM products WHERE id=1',
    );
    expect(Number(product.quantity)).toBe(12);
    expect(Number(product.taxable_quantity_stock)).toBe(4);
  });

  it('requires a unique receipt batch and matching creation transaction', async () => {
    await receiptLot({ remaining: 21 });
    await runner.query('DELETE FROM inventory_transactions');
    expect((await row(1)).expected_tax).toBeNull();
    await runner.query(
      "INSERT INTO inventory_transactions(product_id,type,quantity,reference_type,reference_id,receipt_item_id) VALUES(1,'IN',30,'STOCK_IN',1,1)",
    );
    await runner.query(
      "INSERT INTO inventories(id,product_id,code,original_quantity,remaining_quantity,receipt_item_id) VALUES(2,1,'LOT-duplicate',30,10,1)",
    );
    expect((await row(1)).expected_tax).toBeNull();
  });

  it('rejects a receipt that does not match original converted quantity', async () => {
    await receiptLot({ remaining: 21 });
    await runner.query(
      'UPDATE inventory_receipt_items SET quantity=31 WHERE id=1',
    );
    expect((await row(1)).expected_tax).toBeNull();
  });

  it('restores a complete mixed return snapshot with non-tax-first depletion', async () => {
    await returnLot({ remaining: 4 });
    expect(Number((await row(100)).expected_tax)).toBe(2);
    await new ReconcileCustomerReturnBatchTaxableRemaining1786385000000().up(
      runner,
    );
    const [batch] = await runner.query(
      'SELECT taxable_remaining_quantity FROM inventories WHERE id=100',
    );
    expect(Number(batch.taxable_remaining_quantity)).toBe(2);
  });

  it('rejects a partial return snapshot even when it matches the destination batch', async () => {
    await returnLot({
      original: 10,
      allocations: [{ batchId: 100, quantity: 10, taxableQuantity: 10 }],
    });
    await runner.query(
      'UPDATE sales_return_items SET quantity=20,base_quantity=20',
    );
    expect((await row(100)).expected_tax).toBeNull();
  });

  it.each(['missing', 'wrong_product', 'wrong_code', 'missing_creation'])(
    'rejects the entire return line when a sibling destination is %s',
    async (fault) => {
      await returnLot({
        original: 10,
        allocations: [
          { batchId: 100, quantity: 10, taxableQuantity: 10 },
          { batchId: 101, quantity: 10, taxableQuantity: 10 },
        ],
      });
      await runner.query(
        'UPDATE sales_return_items SET quantity=20,base_quantity=20',
      );
      if (fault !== 'missing') {
        await runner.query(
          'INSERT INTO inventories(id,product_id,code,original_quantity,remaining_quantity) VALUES(101,$1,$2,10,10)',
          [
            fault === 'wrong_product' ? 2 : 1,
            fault === 'wrong_code' ? 'RETURN-OTHER' : 'RETURN-TEST',
          ],
        );
        if (fault !== 'missing_creation')
          await runner.query(
            "INSERT INTO inventory_transactions(product_id,type,quantity,reference_type,reference_id) VALUES($1,'IN',10,'STOCK_IN',101)",
            [fault === 'wrong_product' ? 2 : 1],
          );
      }
      expect((await row(100)).expected_tax).toBeNull();
    },
  );

  it('accepts a complete return line with two valid destination batches', async () => {
    await returnLot({
      original: 10,
      allocations: [
        { batchId: 100, quantity: 10, taxableQuantity: 10 },
        { batchId: 101, quantity: 10, taxableQuantity: 0 },
      ],
    });
    await runner.query(
      'UPDATE sales_return_items SET quantity=20,base_quantity=20',
    );
    await runner.query(
      "INSERT INTO inventories(id,product_id,code,original_quantity,remaining_quantity) VALUES(101,1,'RETURN-TEST',10,10)",
    );
    await runner.query(
      "INSERT INTO inventory_transactions(product_id,type,quantity,reference_type,reference_id) VALUES(1,'IN',10,'STOCK_IN',101)",
    );
    expect(Number((await row(100)).expected_tax)).toBe(10);
    expect(Number((await row(101)).expected_tax)).toBe(0);
  });

  it.each(
    [
      {},
      null,
      [{ batchId: 100, quantity: 5 }],
      [{ batchId: 100, quantity: 5, taxableQuantity: null }],
      [{ batchId: 100, quantity: 5, taxableQuantity: '2' }],
      [{ batchId: 100, quantity: 5, taxableQuantity: -1 }],
      [{ batchId: 100, quantity: 5, taxableQuantity: 6 }],
      [{ batchId: 100, quantity: 4, taxableQuantity: 2 }],
      [{ batchId: 'invalid', quantity: 5, taxableQuantity: 2 }],
      [
        { batchId: 100, quantity: 2, taxableQuantity: 1 },
        { batchId: 100, quantity: 3, taxableQuantity: 1 },
      ],
    ].map((allocations) => [allocations]),
  )(
    'does not invent tax for an incomplete or malformed return snapshot %#',
    async (allocations) => {
      await returnLot({ allocations });
      if (allocations === null)
        await runner.query(
          'UPDATE sales_return_items SET stock_allocations=NULL',
        );
      expect((await row(100)).expected_tax).toBeNull();
      await new BackfillBatchTaxableRemainingQuantity1786384000000().up(runner);
      const [batch] = await runner.query(
        'SELECT taxable_remaining_quantity FROM inventories WHERE id=100',
      );
      expect(batch.taxable_remaining_quantity).toBeNull();
    },
  );

  it.each(['draft', 'cancelled'])(
    'ignores return snapshot from a %s document',
    async (status) => {
      await returnLot({ status });
      expect((await row(100)).expected_tax).toBeNull();
    },
  );

  it('rejects a snapshot mapped to another product', async () => {
    await returnLot({ allocationProduct: 2 });
    expect((await row(100)).expected_tax).toBeNull();
  });

  it('does not override a manually corrected return without sufficient history', async () => {
    await returnLot({
      original: 2,
      remaining: 2,
      currentTax: 0,
      allocations: [],
    });
    await runner.query(
      'UPDATE products SET quantity=48,taxable_quantity_stock=0',
    );
    await runner.query(
      "INSERT INTO inventory_receipts VALUES(2,'approved',NULL)",
    );
    await runner.query(
      'INSERT INTO inventory_receipt_items VALUES(2,2,1,50,0,1,50,NULL)',
    );
    await runner.query(
      "INSERT INTO inventories(id,product_id,code,original_quantity,remaining_quantity,taxable_remaining_quantity,receipt_item_id) VALUES(2,1,'LOT-2',50,46,0,2)",
    );
    await runner.query(
      "INSERT INTO inventory_transactions(product_id,type,quantity,reference_type,reference_id,receipt_item_id) VALUES(1,'IN',50,'STOCK_IN',2,2)",
    );
    await new RepairLegacyBatchTaxableBalances1786386000000().up(runner);
    const [product] = await runner.query(
      'SELECT quantity,taxable_quantity_stock FROM products',
    );
    expect(Number(product.quantity)).toBe(48);
    expect(Number(product.taxable_quantity_stock)).toBe(0);
    expect((await row(100)).current_tax).toBe('0.0000');
  });

  it('does not reconcile aggregate product tax while a positive batch is unresolved', async () => {
    await receiptLot({ quantity: 10 });
    await runner.query(
      "INSERT INTO inventories(id,product_id,code,original_quantity,remaining_quantity,taxable_remaining_quantity) VALUES(2,1,'CANCEL-UNKNOWN',2,2,0)",
    );
    await runner.query(
      'UPDATE products SET quantity=12,taxable_quantity_stock=5',
    );
    await new RepairLegacyBatchTaxableBalances1786386000000().up(runner);
    const [product] = await runner.query(
      'SELECT taxable_quantity_stock FROM products',
    );
    expect(Number(product.taxable_quantity_stock)).toBe(5);
  });

  it('does not reconcile product totals when physical batch stock disagrees', async () => {
    await receiptLot({ remaining: 21 });
    await runner.query(
      'UPDATE products SET quantity=22,taxable_quantity_stock=1',
    );
    await new RepairLegacyBatchTaxableBalances1786386000000().up(runner);
    const [product] = await runner.query(
      'SELECT quantity,taxable_quantity_stock FROM products',
    );
    expect(Number(product.quantity)).toBe(22);
    expect(Number(product.taxable_quantity_stock)).toBe(1);
  });

  it('repairs zeroed batches, preserves physical stock and is repeat-safe', async () => {
    await receiptLot({ quantity: 40, remaining: 40, currentTax: 0 });
    await runner.query('UPDATE products SET taxable_quantity_stock=39');
    const migration = new RepairLegacyBatchTaxableBalances1786386000000();
    await migration.up(runner);
    const first = await runner.query(
      'SELECT id,quantity,taxable_quantity_stock,updated_at FROM products',
    );
    expect(Number(first[0].taxable_quantity_stock)).toBe(40);
    expect(Number(first[0].quantity)).toBe(40);
    await migration.up(runner);
    expect(
      await runner.query(
        'SELECT id,quantity,taxable_quantity_stock,updated_at FROM products',
      ),
    ).toEqual(first);
  });

  it('does not silently round a product tax total that exceeds its database precision', async () => {
    await receiptLot({
      quantity: 3,
      tax: 1,
      factor: 1.2345,
      remaining: 3,
      currentTax: 0,
    });
    await new RepairLegacyBatchTaxableBalances1786386000000().up(runner);
    const [product] = await runner.query(
      'SELECT taxable_quantity_stock FROM products',
    );
    expect(Number(product.taxable_quantity_stock)).toBe(0);
    expect(Number((await row(1)).current_tax)).toBe(1.2345);
  });
});
