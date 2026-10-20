import { QueryRunner } from 'typeorm';
import { InventoryBatch } from '../../entities/inventories.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { InventoryTransaction } from '../../entities/inventory-transactions.entity';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import {
  SalesInvoice,
  SalesInvoiceStatus,
} from '../../entities/sales-invoices.entity';
import { SalesService } from './sales.service';

describe('SalesService.handleInventoryDeduction tax snapshots', () => {
  const createHarness = (existingSale = false) => {
    const invoice = Object.assign(new SalesInvoice(), {
      id: 7,
      code: 'INV-7',
      created_by: 3,
      status: SalesInvoiceStatus.CONFIRMED,
    });
    const item = Object.assign(new SalesInvoiceItem(), {
      id: 18,
      invoice_id: 7,
      product_id: 10,
      quantity: 5,
      base_quantity: 250,
      conversion_factor: 50,
      taxable_quantity: 0,
      tax_selling_price: '0',
    });
    const batches = new Map([
      [
        101,
        Object.assign(new InventoryBatch(), {
          id: 101,
          product_id: 10,
          receipt_item_id: 201,
          supplier_id: 301,
        }),
      ],
      [
        102,
        Object.assign(new InventoryBatch(), {
          id: 102,
          product_id: 10,
          receipt_item_id: 202,
        }),
      ],
    ]);
    const receiptItems = new Map([
      [
        201,
        Object.assign(new InventoryReceiptItem(), { id: 201, product_id: 10 }),
      ],
      [
        202,
        Object.assign(new InventoryReceiptItem(), {
          id: 202,
          product_id: 10,
          receipt: { supplier_id: 302 },
        }),
      ],
    ]);
    const savedAllocations: Record<string, unknown>[] = [];
    const updatedItems: Record<string, unknown>[] = [];
    const inventoryTransactionRepository = {
      findOne: jest.fn().mockResolvedValue(existingSale ? { id: 99 } : null),
    };
    const manager = {
      findOne: jest.fn(async (entity: Function, options: any) => {
        if (entity === SalesInvoice) return invoice;
        if (entity === InventoryBatch)
          return batches.get(options.where.id) ?? null;
        if (entity === InventoryReceiptItem)
          return receiptItems.get(options.where.id) ?? null;
        return null;
      }),
      getRepository: jest.fn((entity: Function) => {
        if (entity !== InventoryTransaction)
          throw new Error(`Unexpected repository ${entity.name}`);
        return inventoryTransactionRepository;
      }),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
      save: jest.fn(
        async (entity: Function, value: Record<string, unknown>) => {
          if (entity !== SalesInvoiceItemStockAllocation)
            throw new Error(`Unexpected save ${entity.name}`);
          savedAllocations.push(value);
          return value;
        },
      ),
      update: jest.fn(
        async (
          entity: Function,
          _id: number,
          value: Record<string, unknown>,
        ) => {
          if (entity !== SalesInvoiceItem)
            throw new Error(`Unexpected update ${entity.name}`);
          updatedItems.push(value);
          return { affected: 1 };
        },
      ),
    };
    const queryRunner = {
      manager,
      isTransactionActive: true,
    } as unknown as QueryRunner;
    const processStockOut = jest.fn().mockResolvedValue({
      taxableQuantity: 50,
      taxSellingPrice: 1200,
      affectedBatches: [
        { batchId: 101, deductedQuantity: 200, taxableQuantity: 0, cost: 100 },
        { batchId: 102, deductedQuantity: 50, taxableQuantity: 50, cost: 120 },
      ],
    });
    const service = Object.create(SalesService.prototype) as SalesService;
    Object.assign(service, {
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      inventoryService: { processStockOut },
    });
    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue(Object.assign(invoice, { items: [item] }));

    return {
      service,
      queryRunner,
      manager,
      inventoryTransactionRepository,
      processStockOut,
      savedAllocations,
      updatedItems,
    };
  };

  it('persists each sold lot allocation and converts taxable quantity to the invoice unit', async () => {
    const h = createHarness();

    await expect(
      h.service.handleInventoryDeduction(7, 3, h.queryRunner),
    ).resolves.toBe(true);

    expect(h.processStockOut).toHaveBeenCalledWith(
      10,
      250,
      'SALE',
      3,
      7,
      'Bán hàng theo hóa đơn #INV-7',
      h.queryRunner,
      { requireBatchTaxSnapshot: true },
    );
    expect(h.savedAllocations).toEqual([
      expect.objectContaining({
        invoice_id: 7,
        sales_invoice_item_id: 18,
        product_id: 10,
        inventory_batch_id: 101,
        receipt_item_id: 201,
        supplier_id: 301,
        quantity: 200,
        taxable_quantity: 0,
        unit_cost: 100,
        total_cost: 20000,
      }),
      expect.objectContaining({
        invoice_id: 7,
        sales_invoice_item_id: 18,
        product_id: 10,
        inventory_batch_id: 102,
        receipt_item_id: 202,
        supplier_id: 302,
        quantity: 50,
        taxable_quantity: 50,
        unit_cost: 120,
        total_cost: 6000,
      }),
    ]);
    expect(h.updatedItems).toEqual([
      expect.objectContaining({
        taxable_quantity: 1,
        tax_selling_price: '60000',
      }),
    ]);
  });

  it('does not deduct or create allocations again when a SALE transaction already exists', async () => {
    const h = createHarness(true);

    await expect(
      h.service.handleInventoryDeduction(7, 3, h.queryRunner),
    ).resolves.toBe(false);

    expect(h.processStockOut).not.toHaveBeenCalled();
    expect(h.savedAllocations).toHaveLength(0);
    expect(h.manager.update).not.toHaveBeenCalled();
  });

  it('does not write allocation or invoice tax snapshots if stock deduction fails', async () => {
    const h = createHarness();
    h.processStockOut.mockRejectedValue(new Error('stock deduction failed'));

    await expect(
      h.service.handleInventoryDeduction(7, 3, h.queryRunner),
    ).rejects.toThrow('stock deduction failed');

    expect(h.savedAllocations).toHaveLength(0);
    expect(h.updatedItems).toHaveLength(0);
  });
});
