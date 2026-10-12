import { SalesService } from './sales.service';
import { SalesInvoice, SalesInvoiceStatus } from '../../entities/sales-invoices.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';
import { InventoryBatch } from '../../entities/inventories.entity';
import { Product } from '../../entities/products.entity';
import { QueryRunner } from 'typeorm';

function setup(options: { returned?: number; returnTaxable?: number; factor?: number; allocations?: boolean; alreadyRestored?: boolean } = {}) {
  const factor = options.factor || 1;
  const item = { id: 1, product_id: 10, quantity: 10, base_quantity: 10 * factor, conversion_factor: factor, taxable_quantity: 6 };
  const invoice = { id: 7, code: 'TEST', created_by: 3, status: SalesInvoiceStatus.CONFIRMED, items: [item] };
  const product = { id: 10, quantity: 20, taxable_quantity_stock: 2, average_cost_price: '100' };
  const batch = { id: 100, remaining_quantity: 20 };
  const allocation: {
    id: number; invoice_id: number; sales_invoice_item_id: number;
    product_id: number; quantity: number; taxable_quantity?: number;
    inventory_batch_id: number; unit_cost: number;
  } = {
    id: 1,
    invoice_id: 7,
    sales_invoice_item_id: 1,
    product_id: 10,
    quantity: 10 * factor,
    taxable_quantity: 6 * factor,
    inventory_batch_id: 100,
    unit_cost: 100,
  };
  const returns: Array<{
    id: number;
    product_id: number;
    sales_invoice_item_id: number;
    base_quantity: number;
    stock_allocations: Array<{
      batchId: number;
      quantity: number;
      taxableQuantity: number;
      sourceBatchId?: number;
      sourceReceiptItemId?: number;
    }>;
  }> = options.returned ? [{
    id: 1,
    product_id: 10,
    sales_invoice_item_id: 1,
    base_quantity: options.returned,
    stock_allocations: [{
      batchId: 200,
      quantity: options.returned,
      taxableQuantity: options.returnTaxable ?? options.returned * 0.6,
    }],
  }] : [];
  const qb = { innerJoin: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue(returns) };
  const transRepo = {
    find: jest.fn().mockResolvedValue([{ product_id: 10, unit_cost_price: '100' }]),
    findOne: jest.fn().mockResolvedValue(options.alreadyRestored ? { id: 99 } : null),
    update: jest.fn().mockResolvedValue({}),
  };
  const manager = {
    getRepository: jest.fn().mockReturnValue(transRepo),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    find: jest.fn().mockImplementation((entity) => entity === SalesInvoiceItemStockAllocation ? (options.allocations === false ? [] : [allocation]) : []),
    findOne: jest.fn().mockImplementation((entity) => {
      if (entity === Product) return Promise.resolve(product);
      if (entity === InventoryBatch) return Promise.resolve(batch);
      if (entity === SalesInvoice) return Promise.resolve(invoice);
      return Promise.resolve(null);
    }),
    update: jest.fn().mockImplementation((entity, _id, values) => { if (entity === Product) Object.assign(product, values); return Promise.resolve({}); }),
    save: jest.fn().mockImplementation((value) => Promise.resolve(value)),
    delete: jest.fn().mockResolvedValue({}),
  };
  Object.assign(transRepo, { manager });
  const inventory = {
    removeSupplierSettlementForInvoice: jest.fn().mockResolvedValue(undefined),
    createTransaction: jest.fn().mockResolvedValue({ id: 22 }),
    processStockIn: jest.fn().mockResolvedValue({ transaction: { id: 23 } }),
  };
  const runner = { manager, isTransactionActive: true, connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(), rollbackTransaction: jest.fn(), release: jest.fn() };
  const service = Object.create(SalesService.prototype) as SalesService;
  Object.assign(service, {
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    inventoryService: inventory,
    dataSource: { createQueryRunner: jest.fn().mockReturnValue(runner) },
  });
  jest.spyOn(service, 'findOne').mockResolvedValue(invoice as SalesInvoice);
  return { service, manager, runner: runner as unknown as QueryRunner, inventory, product, batch, item, invoice, allocation, returns, transRepo };
}

describe('invoice tax stock restoration', () => {
  it('restores only unreturned goods and unreturned tax after a partial return', async () => {
    const s = setup({ returned: 3 });
    await s.service.handleInventoryRestoration(7, 3, s.runner);
    expect(s.product.quantity).toBe(27);
    expect(s.product.taxable_quantity_stock).toBe(6.2);
    expect(s.batch.remaining_quantity).toBe(27);
    expect(s.inventory.createTransaction).toHaveBeenCalledWith(expect.objectContaining({ quantity: 7, reference_type: 'STOCK_IN_CANCEL' }), s.runner);
    expect(s.manager.findOne).toHaveBeenNthCalledWith(1, SalesInvoice, expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
  });

  it('converts tax from sale units to base units exactly once', async () => {
    const s = setup({ returned: 100, factor: 50 });
    await s.service.handleInventoryRestoration(7, 3, s.runner);
    expect(s.product.quantity).toBe(420);
    expect(s.product.taxable_quantity_stock).toBe(242);
  });

  it('does not restore tax again after all taxed goods have been returned', async () => {
    const s = setup({ returned: 8 });
    await s.service.handleInventoryRestoration(7, 3, s.runner);
    expect(s.product.quantity).toBe(22);
    expect(s.product.taxable_quantity_stock).toBe(3.2);
  });

  it('restores tax from the exact source allocation instead of tax-first product totals', async () => {
    const s = setup({ returned: 3, returnTaxable: 1.2 });
    s.item.taxable_quantity = 4;
    const secondAllocation = {
      ...s.allocation,
      id: 2,
      quantity: 6,
      taxable_quantity: 0,
      inventory_batch_id: 101,
    };
    s.allocation.quantity = 4;
    s.allocation.taxable_quantity = 4;
    s.manager.find.mockImplementation((entity) =>
      entity === SalesInvoiceItemStockAllocation
        ? [s.allocation, secondAllocation]
        : [],
    );
    s.returns[0]!.stock_allocations = [{
      batchId: 200,
      quantity: 3,
      taxableQuantity: 1.2,
      sourceBatchId: 100,
    }];
    await s.service.handleInventoryRestoration(7, 3, s.runner);
    expect(s.product.taxable_quantity_stock).toBe(3);
    expect(s.manager.update).toHaveBeenCalledWith(Product, 10, { taxable_quantity_stock: 3 });
  });

  it('does nothing to stock for an already restored invoice', async () => {
    const s = setup({ alreadyRestored: true });
    await s.service.handleInventoryRestoration(7, 3, s.runner);
    expect(s.inventory.createTransaction).not.toHaveBeenCalled();
    expect(s.inventory.processStockIn).not.toHaveBeenCalled();
    expect(s.manager.update).not.toHaveBeenCalled();
  });

  it('rejects taxable legacy fallback without a source allocation snapshot', async () => {
    const s = setup({ returned: 3, allocations: false });
    await expect(s.service.handleInventoryRestoration(7, 3, s.runner)).rejects.toThrow('thiếu snapshot thuế theo lô');
    expect(s.inventory.processStockIn).not.toHaveBeenCalled();
    expect(s.transRepo.update).not.toHaveBeenCalled();
  });

  it('restores all remaining tax when a customer returned only non-taxable stock', async () => {
    const s = setup({ returned: 3, returnTaxable: 0 });
    await s.service.handleInventoryRestoration(7, 3, s.runner);
    expect(s.product.quantity).toBe(27);
    expect(s.product.taxable_quantity_stock).toBe(8);
  });

  it('restores tax by the original source batch when a customer returned from the second batch', async () => {
    const s = setup({ returned: 3, returnTaxable: 0 });
    const secondAllocation = {
      ...s.allocation,
      id: 2,
      quantity: 6,
      taxable_quantity: 2,
      inventory_batch_id: 101,
    };
    s.allocation.quantity = 4;
    s.allocation.taxable_quantity = 4;
    s.manager.find.mockImplementation((entity) =>
      entity === SalesInvoiceItemStockAllocation
        ? [s.allocation, secondAllocation]
        : [],
    );
    s.returns[0]!.stock_allocations = [{
      batchId: 201,
      quantity: 3,
      taxableQuantity: 0,
      sourceBatchId: 101,
    }];
    await s.service.handleInventoryRestoration(7, 3, s.runner);
    expect(s.product.quantity).toBe(27);
    expect(s.product.taxable_quantity_stock).toBe(8);
  });

  it('rejects incomplete allocation history rather than restoring an incorrect amount', async () => {
    const s = setup();
    s.allocation.quantity = 4;
    await expect(s.service.handleInventoryRestoration(7, 3, s.runner)).rejects.toThrow('Phân bổ lô');
    expect(s.inventory.createTransaction).not.toHaveBeenCalled();
  });

  it('creates a stock batch when an old allocation has no batch reference', async () => {
    const s = setup();
    Object.assign(s.allocation, { inventory_batch_id: null });
    await s.service.handleInventoryRestoration(7, 3, s.runner);
    expect(s.inventory.processStockIn).toHaveBeenCalled();
    expect(s.transRepo.update).toHaveBeenCalledWith(23, expect.objectContaining({ reference_type: 'STOCK_IN_CANCEL' }));
  });

  it('owns a transaction when restoration is invoked without a query runner', async () => {
    const s = setup();
    await s.service.handleInventoryRestoration(7, 3);
    expect(s.runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(s.runner.release).toHaveBeenCalledTimes(1);
  });

  it('writes sale-unit tax snapshots after a base-unit deduction', async () => {
    const s = setup({ factor: 50 });
    Object.assign(s.inventory, { processStockOut: jest.fn().mockResolvedValue({ taxableQuantity: 300, taxSellingPrice: 2000, affectedBatches: [] }) });
    await s.service.handleInventoryDeduction(7, 3, s.runner);
    expect(s.manager.update).toHaveBeenCalledWith(SalesInvoiceItem, 1, { taxable_quantity: 6, tax_selling_price: '100000' });
  });

  it('keeps a sale-unit tax snapshot that fits the database precision', async () => {
    const s = setup({ factor: 1000 });
    Object.assign(s.inventory, { processStockOut: jest.fn().mockResolvedValue({ taxableQuantity: 1, taxSellingPrice: 2, affectedBatches: [] }) });
    await s.service.handleInventoryDeduction(7, 3, s.runner);
    expect(s.manager.update).toHaveBeenCalledWith(SalesInvoiceItem, 1, {
      taxable_quantity: 0.001,
      tax_selling_price: '2000',
    });
  });

  it.each(['cancelInvoice', 'refundInvoice'] as const)('%s restores stock even without an explicit actor and is repeat-safe', async (method) => {
    const s = setup();
    s.invoice.status = method === 'refundInvoice' ? SalesInvoiceStatus.PAID : SalesInvoiceStatus.CONFIRMED;
    Object.assign(s.service, {
      createRefundPaymentForInvoice: jest.fn().mockResolvedValue(undefined),
      handleInvoiceGiftStockRestoration: jest.fn().mockResolvedValue(undefined),
    });
    const restore = jest.spyOn(s.service, 'handleInventoryRestoration').mockResolvedValue(undefined);
    await s.service[method](7);
    await s.service[method](7);
    expect(restore).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledWith(7, 3, s.runner);
    expect(s.manager.findOne).toHaveBeenCalledWith(SalesInvoice, { where: { id: 7 }, lock: { mode: 'pessimistic_write' } });
  });
});
