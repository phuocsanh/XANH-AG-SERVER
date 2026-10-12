import { QueryRunner } from 'typeorm';
import { InventoryService } from './inventory.service';
import { Product } from '../../entities/products.entity';
import { InventoryBatch } from '../../entities/inventories.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { InventoryReturnItem } from '../../entities/inventory-return-items.entity';
import { InventoryTransaction } from '../../entities/inventory-transactions.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';

function receipt(id: number, quantity: number, taxable: number, factor = 1) {
  return Object.assign(new InventoryReceiptItem(), {
    id, receipt_id: id, product_id: 1, quantity,
    taxable_quantity: taxable, conversion_factor: factor,
    base_quantity: quantity * factor, tax_selling_price: 20 * factor,
  });
}

function sale(quantity: number, taxable: number, factor = 1) {
  return Object.assign(new SalesInvoiceItem(), {
    id: 10, invoice_id: 20, product_id: 1, quantity,
    taxable_quantity: taxable, conversion_factor: factor,
    base_quantity: quantity * factor, tax_selling_price: 30 * factor,
  });
}

function harness() {
  const product = Object.assign(new Product(), {
    id: 1, quantity: 10, taxable_quantity_stock: 6, tax_selling_price: 20,
    average_cost_price: '5',
  });
  const receipts: InventoryReceiptItem[] = [receipt(1, 10, 6)];
  const sales: SalesInvoiceItem[] = [];
  const customerReturns: SalesReturnItem[] = [];
  const supplierReturns: InventoryReturnItem[] = [];
  const batches: InventoryBatch[] = [Object.assign(new InventoryBatch(), {
    id: 1, receipt_item_id: 1, product_id: 1,
    original_quantity: 10, remaining_quantity: 10, unit_cost_price: '5',
  })];
  const queries = new Map<Function, ReturnType<typeof query>>();
  const query = (rows: unknown[]) => ({
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(async () => rows),
    getCount: jest.fn(async () => 0),
  });
  queries.set(InventoryReceiptItem, query(receipts));
  queries.set(SalesInvoiceItem, query(sales));
  queries.set(SalesReturnItem, query(customerReturns));
  queries.set(InventoryReturnItem, query(supplierReturns));
  queries.set(InventoryTransaction, query([]));
  const batchRepo = {
    find: jest.fn(async () => batches.map((batch) => ({ ...batch }))),
    save: jest.fn(async (batch: InventoryBatch) => {
      Object.assign(batches.find((current) => current.id === batch.id)!, batch);
      return batch;
    }),
  };
  const manager = {
    findOne: jest.fn(async () => ({ ...product })),
    update: jest.fn(async (entity: Function, _id: number, data: Partial<Product>) => {
      expect(entity).toBe(Product);
      Object.assign(product, data);
    }),
    getRepository: jest.fn((entity: Function) => {
      if (entity === InventoryBatch) return batchRepo;
      return {
        createQueryBuilder: () => queries.get(entity),
        findOne: async () => ({ ...product }),
        find: async () => receipts,
      };
    }),
  };
  const runner = {
    manager, isTransactionActive: false,
    connect: jest.fn(async () => undefined),
    startTransaction: jest.fn(async () => { runner.isTransactionActive = true; }),
    commitTransaction: jest.fn(async () => { runner.isTransactionActive = false; }),
    rollbackTransaction: jest.fn(async () => { runner.isTransactionActive = false; }),
    release: jest.fn(async () => undefined),
  };
  const createQueryRunner = jest.fn(() => runner);
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const service = Object.create(InventoryService.prototype) as any;
  Object.assign(service, {
    inventoryReceiptRepository: { manager: { connection: { createQueryRunner } } },
    inventoryBatchRepository: batchRepo,
    inventoryReceiptItemRepository: { find: async () => receipts },
    productService: { productRepository: { findOne: async () => ({ ...product }) } },
    logger,
  });
  jest.spyOn(service, 'getWeightedAverageCost').mockResolvedValue(5);
  jest.spyOn(service, 'getInventorySummary').mockImplementation(async () => ({
    productId: 1, totalQuantity: Number(product.quantity),
    batchTotalQuantity: batches.reduce((sum, batch) => sum + Number(batch.remaining_quantity), 0),
    batches: batches.length,
  }));
  jest.spyOn(service, 'createTransaction').mockResolvedValue(new InventoryTransaction());
  jest.spyOn(service, 'createBatch').mockImplementation(async (data) => {
    const batch = Object.assign(new InventoryBatch(), data, { id: batches.length + 1 });
    batches.push(batch);
    return batch;
  });
  return { service, product, receipts, sales, customerReturns, supplierReturns,
    batches, batchRepo, manager, runner, createQueryRunner, queries, logger };
}

describe('Inventory tax stock sync', () => {
  it('preserves original sale-unit tax and price snapshots across repeated syncs', async () => {
    const h = harness();
    h.sales.push(sale(1, 0.2, 10));
    h.receipts[0] = receipt(1, 2, 1, 10);
    h.product.quantity = 10;
    h.product.taxable_quantity_stock = 0;
    const snapshot = { ...h.sales[0] };
    expect(await h.service.syncTaxableDataForProduct(1, '2026-01-01'))
      .toEqual({ productUpdated: true, salesItemsUpdated: 0 });
    expect(h.product.taxable_quantity_stock).toBe(8);
    expect(await h.service.syncTaxableDataForProduct(1))
      .toEqual({ productUpdated: false, salesItemsUpdated: 0 });
    expect(h.sales[0]).toEqual(snapshot);
    expect(h.manager.update).toHaveBeenCalledTimes(1);
    expect(h.manager.findOne).toHaveBeenCalledWith(Product, {
      where: { id: 1 }, lock: { mode: 'pessimistic_write' },
    });
  });

  it.each([2, 6, 10])('does not guess tax for legacy customer returns without allocations for %s base units', async (returned) => {
    const h = harness();
    h.sales.push(sale(2, 1.2, 5));
    h.customerReturns.push(Object.assign(new SalesReturnItem(), {
      sales_invoice_item_id: 10, sales_return: { invoice_id: 20 },
      quantity: returned / 2, conversion_factor: 2, base_quantity: returned,
    }));
    h.product.quantity = returned;
    h.product.taxable_quantity_stock = 0;
    await h.service.syncTaxableDataForProduct(1);
    expect(h.product.taxable_quantity_stock).toBe(0);
    expect(h.manager.update).not.toHaveBeenCalled();
    await h.service.syncTaxableDataForProduct(1);
    expect(h.product.taxable_quantity_stock).toBe(0);
    expect(h.sales[0]!.taxable_quantity).toBe(1.2);
    expect(h.queries.get(SalesReturnItem)!.andWhere).toHaveBeenCalledWith(
      'sr.status = :approved', { approved: 'approved' },
    );
  });

  it('excludes cancelled invoices and does not add their customer returns again', async () => {
    const h = harness();
    h.product.taxable_quantity_stock = 0;
    h.customerReturns.push(Object.assign(new SalesReturnItem(), {
      sales_return: { invoice_id: 20 }, quantity: 3, conversion_factor: 1,
    }));
    await h.service.syncTaxableDataForProduct(1);
    expect(h.product.taxable_quantity_stock).toBe(6);
    expect(h.queries.get(SalesInvoiceItem)!.andWhere).toHaveBeenCalledWith(
      'si.status IN (:...statuses)', { statuses: ['confirmed', 'paid'] },
    );
  });

  it('uses the customer-return batch snapshot instead of treating returns as tax-first', async () => {
    const h = harness();
    h.sales.push(sale(10, 6));
    h.customerReturns.push(Object.assign(new SalesReturnItem(), {
      sales_invoice_item_id: 10, sales_return: { invoice_id: 20 },
      quantity: 3, conversion_factor: 1, base_quantity: 3,
      stock_allocations: [{ batchId: 20, quantity: 3, taxableQuantity: 0 }],
    }));
    h.product.quantity = 3;
    h.product.taxable_quantity_stock = 3;
    await h.service.syncTaxableDataForProduct(1);
    expect(h.product.taxable_quantity_stock).toBe(0);
  });

  it('subtracts supplier returns from their source, not the oldest receipt', async () => {
    const h = harness();
    h.receipts.splice(0, 1, receipt(1, 10, 0), receipt(2, 10, 10));
    h.supplierReturns.push(Object.assign(new InventoryReturnItem(), {
      receipt_item_id: 2, quantity: 3, conversion_factor: 2, base_quantity: 6,
    }));
    h.product.quantity = 14;
    h.product.taxable_quantity_stock = 10;
    await h.service.syncTaxableDataForProduct(1);
    expect(h.product.taxable_quantity_stock).toBe(4);
    expect(h.queries.get(InventoryReturnItem)!.andWhere).toHaveBeenCalledWith(
      'ir.status = :approved', { approved: 'approved' },
    );
  });

  it('keeps current stock when a mixed supplier return has no tax snapshot', async () => {
    const h = harness();
    h.supplierReturns.push(Object.assign(new InventoryReturnItem(), {
      receipt_item_id: 1, quantity: 2, conversion_factor: 1,
    }));
    h.product.quantity = 8;
    await h.service.syncTaxableDataForProduct(1);
    expect(h.manager.update).not.toHaveBeenCalled();
    expect(h.logger.warn).toHaveBeenCalledWith(expect.stringContaining('lô trộn'));
  });

  it('uses the supplier-return batch snapshot for a partial mixed-tax receipt', async () => {
    const h = harness();
    h.supplierReturns.push(Object.assign(new InventoryReturnItem(), {
      receipt_item_id: 1, quantity: 3, conversion_factor: 1, base_quantity: 3,
      stock_allocations: [{ batchId: 1, quantity: 3, taxableQuantity: 0 }],
      return: { receipt_id: 1 },
    }));
    h.product.quantity = 7;
    h.product.taxable_quantity_stock = 3;
    await h.service.syncTaxableDataForProduct(1);
    expect(h.product.taxable_quantity_stock).toBe(6);
  });

  it('does not guess a legacy return source when an invoice repeats a product', async () => {
    const h = harness();
    h.sales.push(sale(2, 1), Object.assign(sale(2, 1), { id: 11 }));
    h.customerReturns.push(Object.assign(new SalesReturnItem(), {
      sales_return: { invoice_id: 20 }, quantity: 1, conversion_factor: 1,
    }));
    await h.service.syncTaxableDataForProduct(1);
    expect(h.manager.update).not.toHaveBeenCalled();
    expect(h.logger.warn).toHaveBeenCalledWith(expect.stringContaining('dòng bán gốc'));
  });

  it('does not turn loans, adjustments or unexplained physical stock into tax stock', async () => {
    const h = harness();
    h.queries.get(InventoryTransaction)!.getCount.mockResolvedValue(1);
    await h.service.syncTaxableDataForProduct(1);
    expect(h.manager.update).not.toHaveBeenCalled();
    h.queries.get(InventoryTransaction)!.getCount.mockResolvedValue(0);
    h.product.quantity = 8;
    await h.service.syncTaxableDataForProduct(1);
    expect(h.manager.update).not.toHaveBeenCalled();
  });

  it('rolls back and releases its transaction if persistence fails', async () => {
    const h = harness();
    h.product.taxable_quantity_stock = 0;
    h.manager.update.mockRejectedValueOnce(new Error('write failed'));
    await expect(h.service.syncTaxableDataForProduct(1)).rejects.toThrow('write failed');
    expect(h.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.runner.release).toHaveBeenCalledTimes(1);
    expect(h.runner.commitTransaction).not.toHaveBeenCalled();
  });
});

describe('Inventory stock mutations', () => {
  it.each(['SALE', 'BORROW_OUT'])('caps %s tax to the pool for a returned batch sharing its original receipt', async (reference) => {
    const h = harness();
    h.product.quantity = 3;
    h.product.taxable_quantity_stock = 0.25;
    Object.assign(h.batches[0]!, { original_quantity: 3, remaining_quantity: 3 });
    const preview = await h.service.previewStockOutItems([{ productId: 1, quantity: 2 }]);
    const result = await h.service.processStockOut(1, 2, reference, 1);
    expect(result.taxableQuantity).toBe(0.25);
    expect(result.affectedBatches[0].taxableQuantity).toBe(0.25);
    expect(result.taxSellingPrice).toBe(20);
    expect(h.product.taxable_quantity_stock).toBe(0);
    expect(preview.items[0]!.taxableQuantity).toBe(result.taxableQuantity);
  });

  it('sells non-taxable units before taxable units within a mixed FIFO batch', async () => {
    const h = harness();
    h.product.quantity = 10;
    h.product.taxable_quantity_stock = 6;
    Object.assign(h.batches[0]!, {
      original_quantity: 10,
      remaining_quantity: 10,
      taxable_remaining_quantity: 6,
    });

    const first = await h.service.processStockOut(1, 3, 'SALE', 1);
    const second = await h.service.processStockOut(1, 3, 'SALE', 1);

    expect(first.taxableQuantity).toBe(0);
    expect(second.taxableQuantity).toBe(2);
    expect(h.batches[0]!.taxable_remaining_quantity).toBe(4);
    expect(h.product.taxable_quantity_stock).toBe(4);
  });

  it.each([0, 0.25])('uses explicit RETURN_CANCEL tax %s exactly, including zero', async (taxableQuantity) => {
    const h = harness();
    h.product.quantity = 3;
    h.product.taxable_quantity_stock = 0.25;
    Object.assign(h.batches[0]!, { original_quantity: 3, remaining_quantity: 3 });
    const result = await h.service.processStockOut(1, 2, 'RETURN_CANCEL', 1,
      undefined, undefined, undefined, { batchId: 1, taxableQuantity });
    expect(result.taxableQuantity).toBe(taxableQuantity);
    expect(result.affectedBatches[0].taxableQuantity).toBe(taxableQuantity);
    expect(h.product.taxable_quantity_stock).toBe(0.25 - taxableQuantity);
  });

  it('rejects an explicit tax snapshot that cannot be allocated from the selected batch', async () => {
    const h = harness();
    h.product.quantity = 3;
    h.product.taxable_quantity_stock = 2;
    Object.assign(h.batches[0]!, {
      original_quantity: 3,
      remaining_quantity: 3,
      taxable_remaining_quantity: 1,
    });

    await expect(
      h.service.processStockOut(
        1,
        2,
        'RETURN_CANCEL',
        1,
        undefined,
        undefined,
        undefined,
        { batchId: 1, taxableQuantity: 2 },
      ),
    ).rejects.toThrow('Không đủ tồn thuế');
    expect(h.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.manager.update).not.toHaveBeenCalled();
  });

  it.each([-1, NaN, Infinity, 0.5, 3])('rejects invalid tax override %s without clamping or stock writes', async (taxableQuantity) => {
    const h = harness();
    h.product.taxable_quantity_stock = 0.25;
    await expect(h.service.processStockOut(1, 2, 'RETURN_CANCEL', 1,
      undefined, undefined, undefined, { taxableQuantity })).rejects.toThrow();
    expect(h.batchRepo.save).not.toHaveBeenCalled();
    expect(h.manager.update).not.toHaveBeenCalled();
    expect(h.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it.each(['in', 'out'])('waits for the product lock before reading %s stock', async (direction) => {
    const h = harness();
    let unlock!: () => void;
    h.manager.findOne.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => { unlock = resolve; });
      return { ...h.product };
    });
    h.runner.isTransactionActive = true;
    const runner = h.runner as unknown as QueryRunner;
    const pending = direction === 'in'
      ? h.service.processStockIn(1, 2, 5, 1, undefined, undefined, undefined, runner, 1)
      : h.service.processStockOut(1, 2, 'SALE', 1, undefined, undefined, runner);
    expect(h.manager.findOne).toHaveBeenCalledWith(Product, {
      where: { id: 1 }, lock: { mode: 'pessimistic_write' },
    });
    expect(h.service.getInventorySummary).not.toHaveBeenCalled();
    expect(h.service.getWeightedAverageCost).not.toHaveBeenCalled();
    unlock();
    await pending;
    expect(h.service.getInventorySummary).toHaveBeenCalled();
    expect(h.createQueryRunner).not.toHaveBeenCalled();
    expect(h.runner.commitTransaction).not.toHaveBeenCalled();
    expect(h.runner.release).not.toHaveBeenCalled();
  });

  it('owns a transaction for a standalone stock-in and adds numeric quantities', async () => {
    const h = harness();
    h.product.quantity = '10' as unknown as number;
    await h.service.processStockIn(1, 2, 5, 1, undefined, undefined, undefined, undefined, 1);
    expect(h.product.quantity).toBe(12);
    expect(h.product.taxable_quantity_stock).toBe(7);
    expect(h.runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(h.runner.release).toHaveBeenCalledTimes(1);
  });

  it.each([0, -1, NaN, Infinity])('rejects invalid shared stock quantity %s', async (quantity) => {
    const h = harness();
    await expect(h.service.processStockIn(1, quantity, 5, 1)).rejects.toThrow();
    await expect(h.service.processStockOut(1, quantity, 'SALE', 1)).rejects.toThrow();
    expect(h.manager.update).not.toHaveBeenCalled();
    expect(h.createQueryRunner).not.toHaveBeenCalled();
  });
});
