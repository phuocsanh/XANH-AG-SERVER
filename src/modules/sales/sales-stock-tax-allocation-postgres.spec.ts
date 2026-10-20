import { DataSource, QueryRunner } from 'typeorm';
import { InventoryBatch } from '../../entities/inventories.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { InventoryTransaction } from '../../entities/inventory-transactions.entity';
import { Product } from '../../entities/products.entity';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import {
  SalesInvoice,
  SalesInvoiceStatus,
} from '../../entities/sales-invoices.entity';
import { SalesService } from './sales.service';

const describePostgres = process.env.TAX_BACKFILL_TEST_URL
  ? describe
  : describe.skip;

describePostgres(
  'SalesService stock tax allocations PostgreSQL TEMP fixtures',
  () => {
    jest.setTimeout(30000);

    let connection: DataSource;
    let databaseRunner: ReturnType<DataSource['createQueryRunner']>;
    let tables: {
      invoices: string;
      items: string;
      batches: string;
      receipts: string;
      allocations: string;
      transactions: string;
    };

    beforeAll(async () => {
      const targetHost = new URL(process.env.TAX_BACKFILL_TEST_URL!).hostname;
      if (
        targetHost !==
        'ep-broad-pine-a1675nqi-pooler.ap-southeast-1.aws.neon.tech'
      ) {
        throw new Error(
          `Sales-allocation integration tests are restricted to the dev DB host, got ${targetHost}`,
        );
      }
      const suffix = `${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
      tables = {
        invoices: `tax_sale_alloc_invoices_${suffix}`,
        items: `tax_sale_alloc_items_${suffix}`,
        batches: `tax_sale_alloc_batches_${suffix}`,
        receipts: `tax_sale_alloc_receipts_${suffix}`,
        allocations: `tax_sale_alloc_rows_${suffix}`,
        transactions: `tax_sale_alloc_transactions_${suffix}`,
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
      await databaseRunner.query(`
      CREATE TEMP TABLE ${tables.invoices} (
        id integer PRIMARY KEY, status text NOT NULL, code text NOT NULL, created_by integer NOT NULL
      );
      CREATE TEMP TABLE ${tables.items} (
        id integer PRIMARY KEY, invoice_id integer NOT NULL, product_id integer NOT NULL,
        quantity numeric NOT NULL, base_quantity numeric NOT NULL,
        conversion_factor numeric NOT NULL, taxable_quantity numeric NOT NULL,
        tax_selling_price numeric NOT NULL
      );
      CREATE TEMP TABLE ${tables.batches} (
        id integer PRIMARY KEY, receipt_item_id integer, supplier_id integer
      );
      CREATE TEMP TABLE ${tables.receipts} (
        id integer PRIMARY KEY, supplier_id integer NOT NULL
      );
      CREATE TEMP TABLE ${tables.allocations} (
        id serial PRIMARY KEY, invoice_id integer NOT NULL, sales_invoice_item_id integer NOT NULL,
        product_id integer NOT NULL, inventory_batch_id integer, receipt_item_id integer,
        supplier_id integer, quantity numeric NOT NULL, taxable_quantity numeric NOT NULL,
        unit_cost numeric NOT NULL, total_cost numeric NOT NULL
      );
      CREATE TEMP TABLE ${tables.transactions} (
        id serial PRIMARY KEY, reference_type text NOT NULL, reference_id integer NOT NULL
      );
    `);
    });

    beforeEach(async () => {
      await databaseRunner.query(`TRUNCATE TABLE
      ${tables.transactions}, ${tables.allocations}, ${tables.receipts},
      ${tables.batches}, ${tables.items}, ${tables.invoices} RESTART IDENTITY`);
    });

    afterAll(async () => {
      if (databaseRunner && tables) {
        const temporaryTables = Object.values(tables)
          .map((table) => `pg_temp.${table}`)
          .join(', ');
        await databaseRunner.query(
          `DROP TABLE IF EXISTS ${temporaryTables} CASCADE`,
        );
        await databaseRunner.release();
      }
      if (connection?.isInitialized) await connection.destroy();
    });

    it('persists exact lot tax snapshots once and keeps sale-unit tax on the invoice item', async () => {
      await databaseRunner.query(`
      INSERT INTO ${tables.invoices} VALUES (7,'confirmed','INV-7',3);
      INSERT INTO ${tables.items} VALUES (11,7,10,1,50,50,0,0);
      INSERT INTO ${tables.batches} VALUES (100,200,70),(101,201,71);
      INSERT INTO ${tables.receipts} VALUES (200,70),(201,71);
    `);

      const item = Object.assign(new SalesInvoiceItem(), {
        id: 11,
        invoice_id: 7,
        product_id: 10,
        quantity: 1,
        base_quantity: 50,
        conversion_factor: 50,
        taxable_quantity: 0,
        tax_selling_price: '0',
      });
      const invoice = Object.assign(new SalesInvoice(), {
        id: 7,
        code: 'INV-7',
        created_by: 3,
        status: SalesInvoiceStatus.CONFIRMED,
        items: [item],
      });
      const manager = {
        findOne: async (
          entity: Function,
          options: { where: { id: number } },
        ) => {
          const id = options.where.id;
          if (entity === SalesInvoice) {
            const [row] = await databaseRunner.query(
              `SELECT * FROM ${tables.invoices} WHERE id=$1`,
              [id],
            );
            return row ? Object.assign(new SalesInvoice(), row) : null;
          }
          if (entity === InventoryBatch) {
            const [row] = await databaseRunner.query(
              `SELECT * FROM ${tables.batches} WHERE id=$1`,
              [id],
            );
            return row ? Object.assign(new InventoryBatch(), row) : null;
          }
          if (entity === InventoryReceiptItem) {
            const [row] = await databaseRunner.query(
              `SELECT * FROM ${tables.receipts} WHERE id=$1`,
              [id],
            );
            return row
              ? Object.assign(new InventoryReceiptItem(), {
                  id: row.id,
                  receipt: { supplier_id: row.supplier_id },
                })
              : null;
          }
          if (entity === Product) return null;
          return null;
        },
        getRepository: (entity: Function) => {
          if (entity !== InventoryTransaction)
            throw new Error(`Unexpected repository ${entity.name}`);
          return {
            findOne: async (options: {
              where: { reference_type: string; reference_id: number };
            }) => {
              const [row] = await databaseRunner.query(
                `SELECT id FROM ${tables.transactions} WHERE reference_type=$1 AND reference_id=$2`,
                [options.where.reference_type, options.where.reference_id],
              );
              return row ?? null;
            },
          };
        },
        delete: async (
          entity: Function,
          criteria: { sales_invoice_item_id: number },
        ) => {
          if (entity !== SalesInvoiceItemStockAllocation)
            throw new Error(`Unexpected delete entity ${entity.name}`);
          return databaseRunner.query(
            `DELETE FROM ${tables.allocations} WHERE sales_invoice_item_id=$1`,
            [criteria.sales_invoice_item_id],
          );
        },
        save: async (entity: Function, value: Record<string, unknown>) => {
          if (entity !== SalesInvoiceItemStockAllocation)
            throw new Error(`Unexpected save entity ${entity.name}`);
          return databaseRunner.query(
            `INSERT INTO ${tables.allocations}
            (invoice_id,sales_invoice_item_id,product_id,inventory_batch_id,receipt_item_id,
             supplier_id,quantity,taxable_quantity,unit_cost,total_cost)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
              value.invoice_id,
              value.sales_invoice_item_id,
              value.product_id,
              value.inventory_batch_id ?? null,
              value.receipt_item_id ?? null,
              value.supplier_id ?? null,
              value.quantity,
              value.taxable_quantity,
              value.unit_cost,
              value.total_cost,
            ],
          );
        },
        update: async (
          entity: Function,
          id: number,
          values: Record<string, number | string>,
        ) => {
          if (entity !== SalesInvoiceItem)
            throw new Error(`Unexpected update entity ${entity.name}`);
          return databaseRunner.query(
            `UPDATE ${tables.items} SET taxable_quantity=$1,tax_selling_price=$2 WHERE id=$3`,
            [values.taxable_quantity, values.tax_selling_price, id],
          );
        },
      };
      const runner = {
        manager,
        isTransactionActive: true,
      } as unknown as QueryRunner;
      const processStockOut = jest.fn(async () => {
        await databaseRunner.query(
          `INSERT INTO ${tables.transactions} (reference_type,reference_id) VALUES ('SALE',7)`,
        );
        return {
          taxableQuantity: 25,
          taxSellingPrice: 1200,
          affectedBatches: [
            {
              batchId: 100,
              deductedQuantity: 25,
              taxableQuantity: 0,
              cost: 100,
            },
            {
              batchId: 101,
              deductedQuantity: 25,
              taxableQuantity: 25,
              cost: 120,
            },
          ],
        };
      });
      const service = Object.create(SalesService.prototype) as SalesService;
      Object.assign(service, {
        logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        inventoryService: { processStockOut },
      });
      jest.spyOn(service, 'findOne').mockResolvedValue(invoice);

      await expect(
        service.handleInventoryDeduction(7, 3, runner),
      ).resolves.toBe(true);
      await expect(
        service.handleInventoryDeduction(7, 3, runner),
      ).resolves.toBe(false);

      const allocations = await databaseRunner.query(
        `SELECT inventory_batch_id,receipt_item_id,supplier_id,quantity,taxable_quantity,
        unit_cost,total_cost FROM ${tables.allocations} ORDER BY inventory_batch_id`,
      );
      const [storedItem] = await databaseRunner.query(
        `SELECT taxable_quantity,tax_selling_price FROM ${tables.items} WHERE id=11`,
      );

      expect(allocations).toEqual([
        expect.objectContaining({
          inventory_batch_id: 100,
          receipt_item_id: 200,
          supplier_id: 70,
          quantity: '25',
          taxable_quantity: '0',
          unit_cost: '100',
          total_cost: '2500',
        }),
        expect.objectContaining({
          inventory_batch_id: 101,
          receipt_item_id: 201,
          supplier_id: 71,
          quantity: '25',
          taxable_quantity: '25',
          unit_cost: '120',
          total_cost: '3000',
        }),
      ]);
      expect(Number(storedItem.taxable_quantity)).toBe(0.5);
      expect(Number(storedItem.tax_selling_price)).toBe(60000);
      expect(processStockOut).toHaveBeenCalledTimes(1);
    });
  },
);
