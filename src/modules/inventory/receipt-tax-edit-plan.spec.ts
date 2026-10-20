import { DataSource, QueryRunner } from 'typeorm';
import { RECEIPT_TAX_EDIT_PLAN_SQL } from './receipt-tax-edit-plan';

const describePostgres = process.env.TAX_BACKFILL_TEST_URL
  ? describe
  : describe.skip;

describePostgres('approved receipt taxable quantity edit plan', () => {
  jest.setTimeout(30000);

  let connection: DataSource;
  let runner: QueryRunner;

  beforeAll(async () => {
    const targetHost = new URL(process.env.TAX_BACKFILL_TEST_URL!).hostname;
    if (targetHost !== 'ep-broad-pine-a1675nqi-pooler.ap-southeast-1.aws.neon.tech') {
      throw new Error(`Receipt-tax edit integration tests are restricted to the dev DB host, got ${targetHost}`);
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
      DROP TABLE IF EXISTS pg_temp.inventory_returns, pg_temp.inventory_return_items,
        pg_temp.inventory_borrows, pg_temp.inventory_borrow_items,
        pg_temp.sales_invoice_item_stock_allocations, pg_temp.inventory_transactions,
        pg_temp.inventories, pg_temp.inventory_receipt_items, pg_temp.inventory_receipts,
        pg_temp.products CASCADE;
    `);
    await runner.startTransaction();
    await runner.query(`
      CREATE TEMP TABLE products(id int PRIMARY KEY,quantity numeric,taxable_quantity_stock numeric,deleted_at timestamp);
      CREATE TEMP TABLE inventory_receipts(id int PRIMARY KEY,status text,deleted_at timestamp);
      CREATE TEMP TABLE inventory_receipt_items(id int PRIMARY KEY,receipt_id int,product_id int,
        quantity numeric,conversion_factor numeric,taxable_quantity numeric,base_quantity numeric,
        batch_number text,deleted_at timestamp);
      CREATE TEMP TABLE inventories(id int PRIMARY KEY,product_id int,receipt_item_id int,code text,
        original_quantity numeric,remaining_quantity numeric,taxable_remaining_quantity numeric,deleted_at timestamp);
      CREATE TEMP TABLE inventory_transactions(id serial PRIMARY KEY,product_id int,type text,quantity numeric,
        reference_type text,reference_id int,receipt_item_id int,deleted_at timestamp);
      CREATE TEMP TABLE sales_invoice_item_stock_allocations(id serial PRIMARY KEY,product_id int,invoice_id int,
        inventory_batch_id int,receipt_item_id int,quantity numeric);
      CREATE TEMP TABLE inventory_borrow_items(id int,receipt_item_id int,batch_id int,borrow_id int);
      CREATE TEMP TABLE inventory_borrows(id int,status text);
      CREATE TEMP TABLE inventory_return_items(id int,product_id int,receipt_item_id int,return_id int);
      CREATE TEMP TABLE inventory_returns(id int,status text,receipt_id int);
    `);
    await runner.query('INSERT INTO products VALUES(1,10,2,NULL)');
    await runner.query(
      "INSERT INTO inventory_receipts VALUES(1,'approved',NULL)",
    );
    await runner.query(
      "INSERT INTO inventory_receipt_items VALUES(1,1,1,10,1,2,10,'LOT-1',NULL)",
    );
    await runner.query(
      "INSERT INTO inventories VALUES(1,1,1,'LOT-1',10,10,2,NULL)",
    );
    await runner.query(
      "INSERT INTO inventory_transactions(product_id,type,quantity,reference_type,reference_id,receipt_item_id) VALUES(1,'IN',10,'STOCK_IN',1,1)",
    );
  });

  afterEach(async () => {
    if (runner?.isTransactionActive) await runner.rollbackTransaction();
  });

  async function plan(tax = 3) {
    return runner.query(RECEIPT_TAX_EDIT_PLAN_SQL, [1, tax]);
  }

  async function addUsedSecondBatchAndSale(
    movementQuantities: number[],
    allocationQuantities: number[],
  ) {
    await runner.query(
      "INSERT INTO inventory_receipts VALUES(2,'approved',NULL)",
    );
    await runner.query(
      "INSERT INTO inventory_receipt_items VALUES(2,2,1,10,1,0,10,'LOT-2',NULL)",
    );
    await runner.query(
      "INSERT INTO inventories VALUES(2,1,2,'LOT-2',10,0,0,NULL)",
    );
    await runner.query(
      "INSERT INTO inventory_transactions(product_id,type,quantity,reference_type,reference_id,receipt_item_id) VALUES(1,'IN',10,'STOCK_IN',2,2)",
    );
    await runner.query('UPDATE products SET quantity=10 WHERE id=1');
    for (const quantity of movementQuantities) {
      await runner.query(
        "INSERT INTO inventory_transactions(product_id,type,quantity,reference_type,reference_id) VALUES(1,'OUT',$1,'SALE',77)",
        [-quantity],
      );
    }
    for (const quantity of allocationQuantities) {
      await runner.query(
        'INSERT INTO sales_invoice_item_stock_allocations(product_id,invoice_id,inventory_batch_id,receipt_item_id,quantity) VALUES(1,77,2,2,$1)',
        [quantity],
      );
    }
  }

  it('plans a quantity delta for a proven untouched lot', async () => {
    const [result] = await plan(3);
    expect(Number(result.batch_id)).toBe(1);
    expect(Number(result.new_batch_tax)).toBe(3);
    expect(Number(result.new_product_tax)).toBe(3);
  });

  it('validates same invoice product outflow across multiple movement rows as one group', async () => {
    await addUsedSecondBatchAndSale([3, 7], [3, 7]);
    expect(await plan()).toHaveLength(1);
  });

  it('allows a fully reconciled sale scoped to a different receipt item', async () => {
    await addUsedSecondBatchAndSale([10], [10]);
    await runner.query(
      "UPDATE inventory_transactions SET receipt_item_id=2 WHERE reference_type='SALE'",
    );
    expect(await plan()).toHaveLength(1);
  });

  it('rejects duplicate movements that would reuse a single allocation set', async () => {
    await addUsedSecondBatchAndSale([10, 10], [10]);
    expect(await plan()).toHaveLength(0);
  });

  it('rejects sales whose allocation points to a receipt item for another product', async () => {
    await addUsedSecondBatchAndSale([10], [10]);
    await runner.query('INSERT INTO products VALUES(2,0,0,NULL)');
    await runner.query(
      "INSERT INTO inventory_receipt_items VALUES(3,2,2,10,1,0,10,'LOT-3',NULL)",
    );
    await runner.query(
      'UPDATE sales_invoice_item_stock_allocations SET receipt_item_id=3',
    );
    expect(await plan()).toHaveLength(0);
  });

  it('rejects a sale movement scoped to the edited source when allocations use another batch', async () => {
    await addUsedSecondBatchAndSale([10], [10]);
    await runner.query(
      "UPDATE inventory_transactions SET receipt_item_id=1 WHERE reference_type='SALE'",
    );
    expect(await plan()).toHaveLength(0);
  });

  it('rejects gift movements without dedicated allocation evidence', async () => {
    await runner.query(
      "INSERT INTO inventory_transactions(product_id,type,quantity,reference_type,reference_id) VALUES(1,'OUT',-1,'INVOICE_GIFT',8)",
    );
    expect(await plan()).toHaveLength(0);
  });

  it('rejects source rows with soft-deleted outbound evidence', async () => {
    await runner.query(
      "INSERT INTO inventory_transactions(product_id,type,quantity,reference_type,reference_id,deleted_at) VALUES(1,'OUT',-1,'SALE',9,NOW())",
    );
    expect(await plan()).toHaveLength(0);
  });
});
