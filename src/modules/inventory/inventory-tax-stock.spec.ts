import { QueryRunner } from 'typeorm';
import { InventoryService } from './inventory.service';
import { Product } from '../../entities/products.entity';
import { InventoryBatch } from '../../entities/inventories.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { InventoryReturnItem } from '../../entities/inventory-return-items.entity';
import { InventoryTransaction } from '../../entities/inventory-transactions.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';
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
    base_quantity: quantity * factor, tax_selling_price: String(30 * factor),
  });
}

function allocation(quantity: number, taxable: number) {
  return Object.assign(new SalesInvoiceItemStockAllocation(), {
    id: 1, sales_invoice_item_id: 10, invoice_id: 20, product_id: 1,
    inventory_batch_id: 1, quantity, taxable_quantity: taxable,
  });
}

function harness() {
  const product = Object.assign(new Product(), {
    id: 1, quantity: 10, taxable_quantity_stock: 6, tax_selling_price: '20',
    average_cost_price: '5',
  });
  const receipts: InventoryReceiptItem[] = [receipt(1, 10, 6)];
  const sales: SalesInvoiceItem[] = [];
  const allocations: SalesInvoiceItemStockAllocation[] = [];
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
  const allocationRepo = {
    find: jest.fn(async (options: {
      where: { sales_invoice_item_id: { value: number[] } };
    }) => allocations.filter((row) =>
      options.where.sales_invoice_item_id.value.includes(Number(row.sales_invoice_item_id)),
    )),
  };
  const manager = {
    findOne: jest.fn(async () => ({ ...product })),
    update: jest.fn(async (entity: Function, _id: number, data: Partial<Product>) => {
      expect(entity).toBe(Product);
      Object.assign(product, data);
    }),
    getRepository: jest.fn((entity: Function) => {
      if (entity === InventoryBatch) return batchRepo;
      if (entity === SalesInvoiceItemStockAllocation) return allocationRepo;
      return {
        createQueryBuilder: () => queries.get(entity),
        findOne: async () => ({ ...product }),
        find: async () => entity === InventoryReceiptItem ? receipts : [],
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
  return { service, product, receipts, sales, allocations, allocationRepo, customerReturns, supplierReturns,
    batches, batchRepo, manager, runner, createQueryRunner, queries, logger };
}

describe('Inventory tax stock sync', () => {
  it('preserves original sale-unit tax and price snapshots across repeated syncs', async () => {
    const h = harness();
    h.sales.push(sale(1, 0.2, 10));
    h.allocations.push(allocation(10, 2));
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

  it.each([
    [20, 20, 20], [999, 1, 999], [0, 600, 0],
  ])('uses exact allocation tax regardless of product/receipt/sale prices %s/%s/%s', async (productPrice, receiptPrice, salePrice) => {
    const h = harness();
    h.receipts[0] = receipt(1, 2, 1, 10);
    h.sales.push(sale(1, 2, 10));
    h.allocations.push(allocation(4, 0.5), Object.assign(allocation(6, 1.5), { id: 2 }));
    h.product.quantity = 10;
    h.product.taxable_quantity_stock = 0;
    const snapshot = { ...h.sales[0], tax_selling_price: String(salePrice) };
    h.sales[0]!.tax_selling_price = String(salePrice);
    h.receipts[0]!.tax_selling_price = receiptPrice;
    h.product.tax_selling_price = String(productPrice);

    expect(await h.service.syncTaxableDataForProduct(1))
      .toEqual({ productUpdated: true, salesItemsUpdated: 0 });
    expect(h.product.taxable_quantity_stock).toBe(8);
    expect(h.sales[0]).toEqual(snapshot);
    expect(h.allocationRepo.find).toHaveBeenCalledWith({
      where: { sales_invoice_item_id: expect.objectContaining({ value: [10] }) },
      order: { id: 'ASC' },
    });

    h.product.tax_selling_price = String(productPrice + 17);
    h.receipts[0]!.tax_selling_price = receiptPrice + 31;
    expect(await h.service.syncTaxableDataForProduct(1))
      .toEqual({ productUpdated: false, salesItemsUpdated: 0 });
    expect(h.product.taxable_quantity_stock).toBe(8);
    expect(h.manager.update).toHaveBeenCalledTimes(1);
  });

  it.each([0.2, 2])('skips the entire product for converted legacy tax %s without allocations', async (taxable) => {
    const h = harness();
    h.receipts[0] = receipt(1, 2, 1, 10);
    h.sales.push(sale(1, taxable, 10), Object.assign(sale(1, 0), { id: 11 }));
    h.sales[0]!.tax_selling_price = h.product.tax_selling_price;
    h.product.quantity = 9;
    h.product.taxable_quantity_stock = 0;
    expect(await h.service.syncTaxableDataForProduct(1))
      .toEqual({ productUpdated: false, salesItemsUpdated: 0 });
    expect(h.manager.update).not.toHaveBeenCalled();
    expect(h.batchRepo.save).not.toHaveBeenCalled();
    h.product.tax_selling_price = '999';
    await h.service.syncTaxableDataForProduct(1);
    expect(h.manager.update).not.toHaveBeenCalled();
  });

  it.each([[1, 2, 4], [10, 0, 6]])('allows unambiguous legacy factor %s tax %s', async (factor, taxable, expected) => {
    const h = harness();
    h.sales.push(sale(1, taxable, factor));
    if (factor === 1) h.sales[0]!.quantity = h.sales[0]!.base_quantity = 2;
    if (factor === 10) h.receipts[0] = receipt(1, 20, 6);
    h.product.quantity = Number(h.receipts[0]!.base_quantity) - Number(h.sales[0]!.base_quantity);
    h.product.taxable_quantity_stock = 0;
    await h.service.syncTaxableDataForProduct(1);
    expect(h.product.taxable_quantity_stock).toBe(expected);
  });

  it.each([
    { quantity: 9 }, { quantity: 11 }, { quantity: 0 }, { quantity: -1 },
    { quantity: NaN }, { quantity: Infinity }, { quantity: null },
    { taxable_quantity: null }, { taxable_quantity: undefined },
    { taxable_quantity: NaN }, { taxable_quantity: Infinity },
    { taxable_quantity: -1 }, { taxable_quantity: 11 },
    { product_id: 2 }, { invoice_id: 21 }, { sales_invoice_item_id: 11 },
  ])('skips malformed sale allocation %p without writes or legacy fallback', async (patch) => {
    const h = harness();
    h.sales.push(sale(10, 0));
    h.product.quantity = 0;
    h.product.taxable_quantity_stock = 0;
    h.allocationRepo.find.mockResolvedValueOnce([Object.assign(allocation(10, 6), patch)]);
    expect(await h.service.syncTaxableDataForProduct(1))
      .toEqual({ productUpdated: false, salesItemsUpdated: 0 });
    expect(h.manager.update).not.toHaveBeenCalled();
    expect(h.batchRepo.save).not.toHaveBeenCalled();
    expect(h.logger.warn).toHaveBeenCalled();
  });

  it('requires tax snapshots for every allocation even when physical coverage is complete', async () => {
    const h = harness();
    h.sales.push(sale(2, 1));
    h.allocations.push(allocation(1, 1), Object.assign(allocation(1, 0), {
      id: 2, taxable_quantity: null,
    }));
    h.product.quantity = 8;
    h.product.taxable_quantity_stock = 0;
    await h.service.syncTaxableDataForProduct(1);
    expect(h.manager.update).not.toHaveBeenCalled();
  });

  it.each([0.0001, 0.001, 0.005, 0.9999])('rejects product tax precision loss from allocation tax %s', async (taxable) => {
    const h = harness();
    h.sales.push(sale(1, 0));
    h.allocations.push(allocation(1, taxable));
    h.product.quantity = 9;
    h.product.taxable_quantity_stock = 0;
    await h.service.syncTaxableDataForProduct(1);
    expect(h.manager.update).not.toHaveBeenCalled();
    expect(h.logger.warn).toHaveBeenCalledWith(expect.stringContaining('numeric(15,2)'));
  });

  it('rejects product tax overflow for numeric(15,2)', async () => {
    const h = harness();
    h.receipts[0] = receipt(1, 10000000000000, 10000000000000);
    h.product.quantity = 10000000000000;
    h.product.taxable_quantity_stock = 0;
    await h.service.syncTaxableDataForProduct(1);
    expect(h.manager.update).not.toHaveBeenCalled();
    expect(h.logger.warn).toHaveBeenCalledWith(expect.stringContaining('numeric(15,2)'));
  });

  it('accepts two-decimal stock after harmless floating-point arithmetic', async () => {
    const h = harness();
    h.receipts[0] = receipt(1, 1, 0.3);
    h.sales.push(sale(0.2, 0.1));
    h.allocations.push(allocation(0.2, 0.1));
    h.product.quantity = 0.8;
    h.product.taxable_quantity_stock = 0;
    await h.service.syncTaxableDataForProduct(1);
    expect(h.product.taxable_quantity_stock).toBe(0.2);
  });

  it('rejects fractional tax hidden by floating-point cancellation at large stock totals', async () => {
    const h = harness();
    h.receipts.splice(0, 1, ...Array.from({ length: 100 }, (_, i) =>
      receipt(i + 1, 99999999, 99999998, 1000),
    ));
    h.sales.push(sale(1, 0));
    h.allocations.push(allocation(1, 0.0001));
    h.product.quantity = 9999999900000 - 1;
    h.product.taxable_quantity_stock = 0;
    await h.service.syncTaxableDataForProduct(1);
    expect(h.manager.update).not.toHaveBeenCalled();
    expect(h.logger.warn).toHaveBeenCalledWith(expect.stringContaining('numeric(15,2)'));
  });

  it('multiplies receipt conversion snapshots without floating-point precision loss', async () => {
    const h = harness();
    h.receipts[0] = receipt(1, 3, 3, 0.1);
    h.product.quantity = 0.3;
    h.product.taxable_quantity_stock = 0;
    await h.service.syncTaxableDataForProduct(1);
    expect(h.product.taxable_quantity_stock).toBe(0.3);
  });

  it.each(['customer', 'supplier'])('rejects malformed %s return snapshots instead of defaulting to zero', async (kind) => {
    for (const invalid of [null, undefined, NaN, Infinity, -1, 4]) {
      const h = harness();
      if (kind === 'customer') {
        h.sales.push(sale(10, 6));
        h.product.quantity = 3;
        h.customerReturns.push(Object.assign(new SalesReturnItem(), {
          sales_invoice_item_id: 10, sales_return: { invoice_id: 20 },
          quantity: 3, base_quantity: 3, conversion_factor: 1,
          stock_allocations: [{ batchId: 1, quantity: 3, taxableQuantity: invalid }],
        }));
      } else {
        h.product.quantity = 7;
        h.supplierReturns.push(Object.assign(new InventoryReturnItem(), {
          receipt_item_id: 1, quantity: 3, base_quantity: 3, conversion_factor: 1,
          stock_allocations: [{ batchId: 1, quantity: 3, taxableQuantity: invalid }],
        }));
      }
      h.product.taxable_quantity_stock = 0;
      await h.service.syncTaxableDataForProduct(1);
      expect(h.manager.update).not.toHaveBeenCalled();
      expect(h.logger.warn).toHaveBeenCalledWith(expect.stringContaining('snapshot lô'));
    }
  });

  it.each(['customer', 'supplier'])('rejects %s returns leaving more tax than physical source stock', async (kind) => {
    const h = harness();
    if (kind === 'customer') {
      h.sales.push(sale(10, 6));
      h.customerReturns.push(Object.assign(new SalesReturnItem(), {
        sales_invoice_item_id: 10, sales_return: { invoice_id: 20 },
        quantity: 5, base_quantity: 5,
        stock_allocations: [{ batchId: 1, quantity: 5, taxableQuantity: 0 }],
      }));
    } else {
      h.receipts.push(receipt(2, 10, 0));
      h.supplierReturns.push(Object.assign(new InventoryReturnItem(), {
        receipt_item_id: 1, quantity: 5, base_quantity: 5,
        stock_allocations: [{ batchId: 1, quantity: 5, taxableQuantity: 0 }],
      }));
    }
    h.product.quantity = kind === 'customer' ? 5 : 15;
    h.product.taxable_quantity_stock = 0;
    await h.service.syncTaxableDataForProduct(1);
    expect(h.manager.update).not.toHaveBeenCalled();
    expect(h.logger.warn).toHaveBeenCalled();
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

  it('rejects multiple supplier returns whose combined quantity exceeds the receipt item', async () => {
    const h = harness();
    for (const id of [1, 2]) {
      h.supplierReturns.push(Object.assign(new InventoryReturnItem(), {
        id,
        receipt_item_id: 1,
        quantity: 6,
        conversion_factor: 1,
        base_quantity: 6,
        stock_allocations: [{ batchId: 1, quantity: 6, taxableQuantity: 0 }],
      }));
    }
    h.product.quantity = 0;
    h.product.taxable_quantity_stock = 0;

    await h.service.syncTaxableDataForProduct(1);

    expect(h.manager.update).not.toHaveBeenCalled();
    expect(h.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('số lượng nhập hoặc trả NCC không hợp lệ'),
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
  it('rejects stock-in tax that numeric(15,2) would round away before writing', async () => {
    const h = harness();
    await expect(h.service.processStockIn(
      1, 1, 5, 1, undefined, undefined, undefined, undefined, 0.001,
    )).rejects.toThrow('numeric(15,2)');
    expect(h.product.quantity).toBe(10);
    expect(h.product.taxable_quantity_stock).toBe(6);
    expect(h.manager.update).not.toHaveBeenCalled();
    expect(h.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('rejects a stock-out that would leave an unrepresentable product tax balance', async () => {
    const h = harness();
    await expect(h.service.processStockOut(
      1, 1, 'RETURN_CANCEL', 1, undefined, undefined, undefined,
      { taxableQuantity: 0.001 },
    )).rejects.toThrow('numeric(15,2)');
    expect(h.product.quantity).toBe(10);
    expect(h.product.taxable_quantity_stock).toBe(6);
    expect(h.manager.update).not.toHaveBeenCalled();
    expect(h.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

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

  it('deducts the taxed source batch over four 250ml mixture runs', async () => {
    const h = harness();
    h.receipts[0] = receipt(1, 1000, 1000);
    Object.assign(h.batches[0]!, {
      original_quantity: 1000,
      remaining_quantity: 1000,
      taxable_remaining_quantity: 1000,
    });
    h.product.quantity = 1000;
    h.product.taxable_quantity_stock = 1000;

    for (let run = 0; run < 4; run += 1) {
      const result = await h.service.processStockOut(1, 250, 'MIXTURE_OUT', 1);
      expect(result.taxableQuantity).toBe(250);
    }

    expect(h.batches[0]!).toMatchObject({
      remaining_quantity: 0,
      taxable_remaining_quantity: 0,
    });
    expect(h.product).toMatchObject({
      quantity: 0,
      taxable_quantity_stock: 0,
    });
    expect(h.service.createTransaction).toHaveBeenCalledTimes(4);
    for (let run = 1; run <= 4; run += 1) {
      expect(h.service.createTransaction).toHaveBeenNthCalledWith(
        run,
        expect.objectContaining({
          product_id: 1,
          transaction_type: 'OUT',
          quantity: -250,
          reference_type: 'MIXTURE_OUT',
        }),
        h.runner,
      );
    }
  });

  it('rolls back a mixture deduction when its inventory transaction cannot be written', async () => {
    const h = harness();
    h.receipts[0] = receipt(1, 1000, 1000);
    Object.assign(h.batches[0]!, {
      original_quantity: 1000,
      remaining_quantity: 1000,
      taxable_remaining_quantity: 1000,
    });
    h.product.quantity = 1000;
    h.product.taxable_quantity_stock = 1000;
    jest.spyOn(h.service, 'createTransaction')
      .mockRejectedValueOnce(new Error('ledger write failed'));

    await expect(
      h.service.processStockOut(1, 250, 'MIXTURE_OUT', 1),
    ).rejects.toThrow('ledger write failed');

    expect(h.service.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: 1,
        transaction_type: 'OUT',
        quantity: -250,
        reference_type: 'MIXTURE_OUT',
      }),
      h.runner,
    );
    expect(h.batchRepo.save).toHaveBeenCalledTimes(1);
    expect(h.manager.update).not.toHaveBeenCalled();
    expect(h.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.runner.commitTransaction).not.toHaveBeenCalled();
    expect(h.runner.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back a mixture ledger when the product balance update fails', async () => {
    const h = harness();
    h.receipts[0] = receipt(1, 1000, 1000);
    Object.assign(h.batches[0]!, {
      original_quantity: 1000,
      remaining_quantity: 1000,
      taxable_remaining_quantity: 1000,
    });
    h.product.quantity = 1000;
    h.product.taxable_quantity_stock = 1000;
    h.manager.update.mockRejectedValueOnce(new Error('product write failed'));

    await expect(
      h.service.processStockOut(1, 250, 'MIXTURE_OUT', 1),
    ).rejects.toThrow('product write failed');

    expect(h.service.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: 1,
        transaction_type: 'OUT',
        quantity: -250,
        reference_type: 'MIXTURE_OUT',
      }),
      h.runner,
    );
    expect(h.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.runner.commitTransaction).not.toHaveBeenCalled();
    expect(h.runner.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back all mixture batches when saving a later FIFO batch fails', async () => {
    const h = harness();
    h.receipts.splice(0, 1, receipt(1, 500, 0));
    h.receipts.push(receipt(2, 900, 900));
    Object.assign(h.batches[0]!, {
      original_quantity: 500,
      remaining_quantity: 100,
      taxable_remaining_quantity: 0,
      created_at: new Date('2026-01-01T00:00:00Z'),
    });
    h.batches.push(Object.assign(new InventoryBatch(), {
      id: 2,
      receipt_item_id: 2,
      product_id: 1,
      original_quantity: 900,
      remaining_quantity: 900,
      taxable_remaining_quantity: 900,
      unit_cost_price: '7',
      created_at: new Date('2026-01-02T00:00:00Z'),
    }));
    h.product.quantity = 1000;
    h.product.taxable_quantity_stock = 900;
    h.batchRepo.find.mockImplementation(async () =>
      h.batches
        .filter((batch) => Number(batch.remaining_quantity) > 0)
        .map((batch) => ({ ...batch })),
    );
    h.batchRepo.save
      .mockImplementationOnce(async (batch: InventoryBatch) => {
        Object.assign(h.batches.find((current) => current.id === batch.id)!, batch);
        return batch;
      })
      .mockRejectedValueOnce(new Error('second batch write failed'));

    await expect(
      h.service.processStockOut(1, 250, 'MIXTURE_OUT', 1),
    ).rejects.toThrow('second batch write failed');

    expect(h.batchRepo.save).toHaveBeenCalledTimes(2);
    expect(h.service.createTransaction).not.toHaveBeenCalled();
    expect(h.manager.update).not.toHaveBeenCalled();
    expect(h.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.runner.commitTransaction).not.toHaveBeenCalled();
    expect(h.runner.release).toHaveBeenCalledTimes(1);
  });

  it('rejects another mixture run after the taxable source batch is exhausted', async () => {
    const h = harness();
    h.receipts[0] = receipt(1, 1000, 1000);
    Object.assign(h.batches[0]!, {
      original_quantity: 1000,
      remaining_quantity: 1000,
      taxable_remaining_quantity: 1000,
    });
    h.product.quantity = 1000;
    h.product.taxable_quantity_stock = 1000;

    for (let run = 0; run < 4; run += 1) {
      await h.service.processStockOut(1, 250, 'MIXTURE_OUT', 1);
    }

    const batchSavesBefore = h.batchRepo.save.mock.calls.length;
    const productUpdatesBefore = h.manager.update.mock.calls.length;
    const transactionsBefore = h.service.createTransaction.mock.calls.length;

    await expect(
      h.service.processStockOut(1, 250, 'MIXTURE_OUT', 1),
    ).rejects.toThrow('Không đủ tồn kho');

    expect(h.batches[0]!).toMatchObject({
      remaining_quantity: 0,
      taxable_remaining_quantity: 0,
    });
    expect(h.product).toMatchObject({ quantity: 0, taxable_quantity_stock: 0 });
    expect(h.batchRepo.save).toHaveBeenCalledTimes(batchSavesBefore);
    expect(h.manager.update).toHaveBeenCalledTimes(productUpdatesBefore);
    expect(h.service.createTransaction).toHaveBeenCalledTimes(transactionsBefore);
    expect(h.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('reconstructs missing source-batch tax from its receipt before mixture deductions', async () => {
    const h = harness();
    h.receipts[0] = receipt(1, 1000, 1000);
    Object.assign(h.batches[0]!, {
      original_quantity: 1000,
      remaining_quantity: 1000,
      taxable_remaining_quantity: null,
    });
    h.product.quantity = 1000;
    h.product.taxable_quantity_stock = 1000;

    for (let run = 0; run < 4; run += 1) {
      const result = await h.service.processStockOut(1, 250, 'MIXTURE_OUT', 1);
      expect(result.taxableQuantity).toBe(250);
    }

    expect(h.batches[0]!).toMatchObject({
      remaining_quantity: 0,
      taxable_remaining_quantity: 0,
    });
    expect(h.product).toMatchObject({ quantity: 0, taxable_quantity_stock: 0 });
    expect(h.batchRepo.save).toHaveBeenCalledTimes(4);
  });

  it('uses the legacy product tax pool when a mixture batch has no receipt snapshot', async () => {
    const h = harness();
    Object.assign(h.batches[0]!, {
      receipt_item_id: null,
      original_quantity: 1000,
      remaining_quantity: 1000,
      taxable_remaining_quantity: null,
    });
    h.product.quantity = 1000;
    h.product.taxable_quantity_stock = 500;

    const taxablePerRun: number[] = [];
    for (let run = 0; run < 4; run += 1) {
      const result = await h.service.processStockOut(1, 250, 'MIXTURE_OUT', 1);
      taxablePerRun.push(result.taxableQuantity);
    }

    expect(taxablePerRun).toEqual([0, 0, 250, 250]);
    expect(h.batches[0]).toMatchObject({
      remaining_quantity: 0,
      taxable_remaining_quantity: 0,
    });
    expect(h.product).toMatchObject({ quantity: 0, taxable_quantity_stock: 0 });
  });

  it('converts two taxed 500ml receipt units before four 250ml mixture runs', async () => {
    const h = harness();
    h.receipts[0] = receipt(1, 2, 2, 500);
    Object.assign(h.batches[0]!, {
      original_quantity: 1000,
      remaining_quantity: 1000,
      taxable_remaining_quantity: null,
    });
    h.product.quantity = 1000;
    h.product.taxable_quantity_stock = 1000;

    for (let run = 0; run < 4; run += 1) {
      const result = await h.service.processStockOut(1, 250, 'MIXTURE_OUT', 1);
      expect(result.taxableQuantity).toBe(250);
    }

    expect(h.receipts[0]).toMatchObject({
      quantity: 2,
      taxable_quantity: 2,
      conversion_factor: 500,
      base_quantity: 1000,
    });
    expect(h.batches[0]!).toMatchObject({
      remaining_quantity: 0,
      taxable_remaining_quantity: 0,
    });
    expect(h.product).toMatchObject({ quantity: 0, taxable_quantity_stock: 0 });
  });

  it('converts one taxable 500ml receipt unit within two 500ml bottles', async () => {
    const h = harness();
    h.receipts[0] = receipt(1, 2, 1, 500);
    Object.assign(h.batches[0]!, {
      original_quantity: 1000,
      remaining_quantity: 1000,
      taxable_remaining_quantity: null,
    });
    h.product.quantity = 1000;
    h.product.taxable_quantity_stock = 500;

    const taxablePerRun: number[] = [];
    for (let run = 0; run < 4; run += 1) {
      const result = await h.service.processStockOut(1, 250, 'MIXTURE_OUT', 1);
      taxablePerRun.push(result.taxableQuantity);
    }

    expect(taxablePerRun).toEqual([0, 0, 250, 250]);
    expect(h.batches[0]!).toMatchObject({
      remaining_quantity: 0,
      taxable_remaining_quantity: 0,
    });
    expect(h.product).toMatchObject({ quantity: 0, taxable_quantity_stock: 0 });
  });

  it('reconstructs legacy mixture tax after earlier non-taxable stock was consumed', async () => {
    const h = harness();
    h.receipts[0] = receipt(1, 1000, 500);
    Object.assign(h.batches[0]!, {
      original_quantity: 1000,
      remaining_quantity: 750,
      taxable_remaining_quantity: null,
    });
    h.product.quantity = 750;
    h.product.taxable_quantity_stock = 500;

    const taxablePerRun: number[] = [];
    for (let run = 0; run < 3; run += 1) {
      const result = await h.service.processStockOut(1, 250, 'MIXTURE_OUT', 1);
      taxablePerRun.push(result.taxableQuantity);
    }

    expect(taxablePerRun).toEqual([0, 250, 250]);
    expect(h.batches[0]!).toMatchObject({
      remaining_quantity: 0,
      taxable_remaining_quantity: 0,
    });
    expect(h.product).toMatchObject({ quantity: 0, taxable_quantity_stock: 0 });
  });

  it('uses non-taxable quantity first within one partially taxable mixture batch', async () => {
    const h = harness();
    h.receipts[0] = receipt(1, 1000, 500);
    Object.assign(h.batches[0]!, {
      original_quantity: 1000,
      remaining_quantity: 1000,
      taxable_remaining_quantity: 500,
    });
    h.product.quantity = 1000;
    h.product.taxable_quantity_stock = 500;

    const taxablePerRun: number[] = [];
    for (let run = 0; run < 4; run += 1) {
      const result = await h.service.processStockOut(1, 250, 'MIXTURE_OUT', 1);
      taxablePerRun.push(result.taxableQuantity);
    }

    expect(taxablePerRun).toEqual([0, 0, 250, 250]);
    expect(h.batches[0]!).toMatchObject({
      remaining_quantity: 0,
      taxable_remaining_quantity: 0,
    });
    expect(h.product).toMatchObject({ quantity: 0, taxable_quantity_stock: 0 });
  });

  it('consumes non-taxable mixture stock first, then decrements the taxable source batch', async () => {
    const h = harness();
    h.receipts.splice(0, 1, receipt(1, 500, 0));
    h.receipts.push(receipt(2, 500, 500));
    Object.assign(h.batches[0]!, {
      original_quantity: 500,
      remaining_quantity: 500,
      taxable_remaining_quantity: 0,
      created_at: new Date('2026-01-01T00:00:00Z'),
    });
    h.batches.push(Object.assign(new InventoryBatch(), {
      id: 2,
      receipt_item_id: 2,
      product_id: 1,
      original_quantity: 500,
      remaining_quantity: 500,
      taxable_remaining_quantity: 500,
      unit_cost_price: '7',
      created_at: new Date('2026-01-02T00:00:00Z'),
    }));
    h.product.quantity = 1000;
    h.product.taxable_quantity_stock = 500;
    h.batchRepo.find.mockImplementation(async () =>
      h.batches
        .filter((batch) => Number(batch.remaining_quantity) > 0)
        .map((batch) => ({ ...batch })),
    );

    const taxablePerRun: number[] = [];
    const lotsPerRun: Array<
      Array<{ batchId: number; deductedQuantity: number; taxableQuantity: number }>
    > = [];
    for (let run = 0; run < 4; run += 1) {
      const result = await h.service.processStockOut(1, 250, 'MIXTURE_OUT', 1);
      taxablePerRun.push(result.taxableQuantity);
      lotsPerRun.push(result.affectedBatches.map((batch) => ({
        batchId: batch.batchId,
        deductedQuantity: batch.deductedQuantity,
        taxableQuantity: batch.taxableQuantity,
      })));
    }

    expect(taxablePerRun).toEqual([0, 0, 250, 250]);
    expect(lotsPerRun).toEqual([
      [{ batchId: 1, deductedQuantity: 250, taxableQuantity: 0 }],
      [{ batchId: 1, deductedQuantity: 250, taxableQuantity: 0 }],
      [{ batchId: 2, deductedQuantity: 250, taxableQuantity: 250 }],
      [{ batchId: 2, deductedQuantity: 250, taxableQuantity: 250 }],
    ]);
    expect(h.batches.map((batch) => ({
      remaining: batch.remaining_quantity,
      taxable: batch.taxable_remaining_quantity,
    }))).toEqual([
      { remaining: 0, taxable: 0 },
      { remaining: 0, taxable: 0 },
    ]);
    expect(h.product).toMatchObject({ quantity: 0, taxable_quantity_stock: 0 });
  });

  it('allocates one mixture run across the remaining non-taxable lot and the next taxable lot', async () => {
    const h = harness();
    h.receipts.splice(0, 1, receipt(1, 500, 0));
    h.receipts.push(receipt(2, 900, 900));
    Object.assign(h.batches[0]!, {
      original_quantity: 500,
      remaining_quantity: 100,
      taxable_remaining_quantity: 0,
      created_at: new Date('2026-01-01T00:00:00Z'),
    });
    h.batches.push(Object.assign(new InventoryBatch(), {
      id: 2,
      receipt_item_id: 2,
      product_id: 1,
      original_quantity: 900,
      remaining_quantity: 900,
      taxable_remaining_quantity: 900,
      unit_cost_price: '7',
      created_at: new Date('2026-01-02T00:00:00Z'),
    }));
    h.product.quantity = 1000;
    h.product.taxable_quantity_stock = 900;
    h.batchRepo.find.mockImplementation(async () =>
      h.batches
        .filter((batch) => Number(batch.remaining_quantity) > 0)
        .map((batch) => ({ ...batch })),
    );

    const lotsPerRun: Array<
      Array<{ batchId: number; deductedQuantity: number; taxableQuantity: number }>
    > = [];
    for (let run = 0; run < 4; run += 1) {
      const batchSavesBeforePreview = h.batchRepo.save.mock.calls.length;
      const productUpdatesBeforePreview = h.manager.update.mock.calls.length;
      const transactionsBeforePreview = h.service.createTransaction.mock.calls.length;
      const [preview] = (await h.service.previewStockOutItems([
        { productId: 1, quantity: 250 },
      ])).items;
      expect(h.batchRepo.save).toHaveBeenCalledTimes(batchSavesBeforePreview);
      expect(h.manager.update).toHaveBeenCalledTimes(productUpdatesBeforePreview);
      expect(h.service.createTransaction).toHaveBeenCalledTimes(transactionsBeforePreview);
      const result = await h.service.processStockOut(1, 250, 'MIXTURE_OUT', 1);
      expect(preview!.taxableQuantity).toBe(result.taxableQuantity);
      expect(preview!.affectedBatches.map((batch) => ({
        batchId: batch.batchId,
        deductedQuantity: batch.deductedQuantity,
        taxableQuantity: batch.taxableQuantity,
      }))).toEqual(result.affectedBatches.map((batch) => ({
        batchId: batch.batchId,
        deductedQuantity: batch.deductedQuantity,
        taxableQuantity: batch.taxableQuantity,
      })));
      lotsPerRun.push(result.affectedBatches.map((batch) => ({
        batchId: batch.batchId,
        deductedQuantity: batch.deductedQuantity,
        taxableQuantity: batch.taxableQuantity,
      })));
    }

    expect(lotsPerRun).toEqual([
      [
        { batchId: 1, deductedQuantity: 100, taxableQuantity: 0 },
        { batchId: 2, deductedQuantity: 150, taxableQuantity: 150 },
      ],
      [{ batchId: 2, deductedQuantity: 250, taxableQuantity: 250 }],
      [{ batchId: 2, deductedQuantity: 250, taxableQuantity: 250 }],
      [{ batchId: 2, deductedQuantity: 250, taxableQuantity: 250 }],
    ]);
    expect(h.batches.map((batch) => ({
      remaining: batch.remaining_quantity,
      taxable: batch.taxable_remaining_quantity,
    }))).toEqual([
      { remaining: 0, taxable: 0 },
      { remaining: 0, taxable: 0 },
    ]);
    expect(h.product).toMatchObject({ quantity: 0, taxable_quantity_stock: 0 });
  });

  it('consumes an older non-taxable batch before allocating tax from the next batch', async () => {
    const h = harness();
    h.receipts[0] = receipt(1, 2, 0);
    h.receipts.push(receipt(2, 8, 8));
    Object.assign(h.batches[0]!, {
      original_quantity: 2,
      remaining_quantity: 2,
      taxable_remaining_quantity: 0,
      created_at: new Date('2026-01-01T00:00:00Z'),
    });
    h.batches.push(Object.assign(new InventoryBatch(), {
      id: 2,
      receipt_item_id: 2,
      product_id: 1,
      original_quantity: 8,
      remaining_quantity: 8,
      taxable_remaining_quantity: 8,
      unit_cost_price: '7',
      created_at: new Date('2026-01-02T00:00:00Z'),
    }));
    h.product.quantity = 10;
    h.product.taxable_quantity_stock = 8;

    const result = await h.service.processStockOut(1, 3, 'SALE', 1);

    expect(result.affectedBatches.map((batch: any) => ({
      batchId: batch.batchId,
      deductedQuantity: batch.deductedQuantity,
      taxableQuantity: batch.taxableQuantity,
    }))).toEqual([
      { batchId: 1, deductedQuantity: 2, taxableQuantity: 0 },
      { batchId: 2, deductedQuantity: 1, taxableQuantity: 1 },
    ]);
    expect(result.taxableQuantity).toBe(1);
    expect(h.batches[0]!.remaining_quantity).toBe(0);
    expect(h.batches[0]!.taxable_remaining_quantity).toBe(0);
    expect(h.batches[1]!.remaining_quantity).toBe(7);
    expect(h.batches[1]!.taxable_remaining_quantity).toBe(7);
    expect(h.product.quantity).toBe(7);
    expect(h.product.taxable_quantity_stock).toBe(7);
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

  it('blocks borrow approval when the selected batch tax exceeds product tax stock', async () => {
    const h = harness();
    h.product.quantity = 3;
    h.product.taxable_quantity_stock = 1;
    Object.assign(h.batches[0]!, {
      original_quantity: 3,
      remaining_quantity: 3,
      taxable_remaining_quantity: 2,
    });

    await expect(h.service.processStockOut(
      1,
      3,
      'BORROW_OUT',
      1,
      undefined,
      undefined,
      undefined,
      { batchId: 1, requireBatchTaxSnapshot: true },
    )).rejects.toThrow('tồn thuế sản phẩm chỉ còn 1');

    expect(h.batchRepo.save).not.toHaveBeenCalled();
    expect(h.manager.update).not.toHaveBeenCalled();
    expect(h.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
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

  it('stores incoming taxable quantity on the exact new receipt batch', async () => {
    const h = harness();
    const result = await h.service.processStockIn(
      1, 2, 5, 1, 9, 'REC-TEST', undefined, undefined, 1,
    );

    expect(result.batch).toMatchObject({
      product_id: 1,
      receipt_item_id: 9,
      original_quantity: 2,
      remaining_quantity: 2,
      taxable_remaining_quantity: 1,
    });
    expect(h.product.quantity).toBe(12);
    expect(h.product.taxable_quantity_stock).toBe(7);
    expect(h.service.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        transaction_type: 'IN',
        quantity: 2,
        reference_type: 'STOCK_IN',
        reference_id: result.batch.id,
        receipt_item_id: 9,
      }),
      expect.anything(),
    );
  });

  it('keeps existing tax stock unchanged when receiving a non-taxable batch', async () => {
    const h = harness();
    const result = await h.service.processStockIn(
      1, 2, 5, 1, 9, 'REC-NON-TAX',
    );

    expect(result.batch).toMatchObject({
      receipt_item_id: 9,
      original_quantity: 2,
      remaining_quantity: 2,
      taxable_remaining_quantity: 0,
    });
    expect(h.product.quantity).toBe(12);
    expect(h.product.taxable_quantity_stock).toBe(6);
    expect(h.manager.update).toHaveBeenCalledWith(
      Product,
      1,
      expect.not.objectContaining({ taxable_quantity_stock: expect.anything() }),
    );
  });

  it('restores promotion gift stock and tax to the original lot after a later taxable sale', async () => {
    const product = Object.assign(new Product(), {
      id: 1,
      quantity: 7,
      taxable_quantity_stock: 2,
      average_cost_price: '5',
    });
    const batch = Object.assign(new InventoryBatch(), {
      id: 31,
      product_id: 1,
      receipt_item_id: 10,
      remaining_quantity: 7,
      taxable_remaining_quantity: 2,
      unit_cost_price: '5',
    });
    const manager = {
      findOne: jest.fn(async (entity: Function) =>
        entity === Product ? product : entity === InventoryBatch ? batch : null,
      ),
      save: jest.fn(async (entity: unknown) => entity),
      update: jest.fn(async (_entity: Function, _id: number, values: object) => {
        Object.assign(product, values);
      }),
    };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    jest.spyOn(service, 'getWeightedAverageCost').mockResolvedValue(5);
    jest.spyOn(service, 'createTransaction').mockResolvedValue(new InventoryTransaction());

    await service.restoreStockToExistingBatch(
      1,
      31,
      2,
      1,
      12,
      70,
      'PROMO-70',
      { manager } as never,
      'PROMOTION_REWARD_GIFT_CANCEL',
    );

    expect(batch).toMatchObject({
      remaining_quantity: 9,
      taxable_remaining_quantity: 3,
    });
    expect(product).toMatchObject({ quantity: 9, taxable_quantity_stock: 3 });
    expect(manager.save).toHaveBeenCalledWith(batch);
    expect(manager.update).toHaveBeenCalledWith(Product, 1, {
      quantity: 9,
      taxable_quantity_stock: 3,
    });
    expect(service.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 2,
        reference_type: 'PROMOTION_REWARD_GIFT_CANCEL',
        reference_id: 70,
        receipt_item_id: 10,
      }),
      expect.anything(),
    );
  });

  it.each([0, -1, NaN, Infinity])('rejects invalid shared stock quantity %s', async (quantity) => {
    const h = harness();
    await expect(h.service.processStockIn(1, quantity, 5, 1)).rejects.toThrow();
    await expect(h.service.processStockOut(1, quantity, 'SALE', 1)).rejects.toThrow();
    expect(h.manager.update).not.toHaveBeenCalled();
    expect(h.createQueryRunner).not.toHaveBeenCalled();
  });
});
