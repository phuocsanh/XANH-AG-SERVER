import { DataSource } from 'typeorm';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';
import { SalesReturnService } from './sales-return.service';

const describePostgres = process.env.TAX_BACKFILL_TEST_URL
  ? describe
  : describe.skip;

describePostgres(
  'SalesReturnService source allocation PostgreSQL TEMP fixtures',
  () => {
    jest.setTimeout(30000);

    let connection: DataSource;
    let runner: ReturnType<DataSource['createQueryRunner']>;
    let table: string;

    beforeAll(async () => {
      const targetHost = new URL(process.env.TAX_BACKFILL_TEST_URL!).hostname;
      if (
        targetHost !==
        'ep-broad-pine-a1675nqi-pooler.ap-southeast-1.aws.neon.tech'
      ) {
        throw new Error(
          `Sales-return allocation tests are restricted to the dev DB host, got ${targetHost}`,
        );
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
      table = `tax_return_source_allocations_${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
      await runner.query(`
        CREATE TEMP TABLE ${table} (
          id integer PRIMARY KEY, sales_invoice_item_id integer NOT NULL,
          inventory_batch_id integer NOT NULL, receipt_item_id integer NOT NULL,
          supplier_id integer NOT NULL, quantity numeric NOT NULL,
          taxable_quantity numeric NOT NULL, unit_cost numeric NOT NULL
        )
      `);
    });

    afterAll(async () => {
      if (runner && table) {
        await runner.query(`DROP TABLE IF EXISTS pg_temp.${table} CASCADE`);
        await runner.release();
      }
      if (connection?.isInitialized) await connection.destroy();
    });

    it('restores tax from the original lot snapshots instead of the current product pool', async () => {
      await runner.query(`
        INSERT INTO ${table} VALUES
          (1,11,100,200,70,40,40,5),
          (2,11,101,201,71,60,0,7)
      `);
      const manager = {
        find: async (
          entity: Function,
          options: { where: { sales_invoice_item_id: number } },
        ) => {
          if (entity !== SalesInvoiceItemStockAllocation) {
            throw new Error(`Unexpected entity ${entity.name}`);
          }
          const rows = await runner.query(
            `SELECT * FROM ${table} WHERE sales_invoice_item_id=$1 ORDER BY id`,
            [options.where.sales_invoice_item_id],
          );
          return rows.map((row: Record<string, unknown>) =>
            Object.assign(new SalesInvoiceItemStockAllocation(), row),
          );
        },
      };
      const service = Object.create(
        SalesReturnService.prototype,
      ) as SalesReturnService;
      const invoke = (
        service as unknown as Record<
          string,
          (
            manager: unknown,
            returnItem: SalesReturnItem,
            invoiceItem: SalesInvoiceItem,
          ) => Promise<unknown[]>
        >
      ).buildReturnRestockPlans!;
      const plans = await invoke.call(
        service,
        manager,
        Object.assign(new SalesReturnItem(), {
          sales_invoice_item_id: 11,
          quantity: 1,
          base_quantity: 10,
          conversion_factor: 10,
        }),
        Object.assign(new SalesInvoiceItem(), {
          id: 11,
          product_id: 15,
          quantity: 10,
          base_quantity: 100,
          conversion_factor: 10,
          cost_price: 99,
        }),
      );

      expect(plans).toEqual([
        {
          quantity: 4,
          unitCost: 99,
          taxableQuantity: 4,
          receiptItemId: 200,
          supplierId: 70,
          sourceBatchId: 100,
          sourceReceiptItemId: 200,
        },
        {
          quantity: 6,
          unitCost: 99,
          taxableQuantity: 0,
          receiptItemId: 201,
          supplierId: 71,
          sourceBatchId: 101,
          sourceReceiptItemId: 201,
        },
      ]);
    });
  },
);
