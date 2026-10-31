import { SalesService } from './sales.service';
import { SalesInvoice, SalesInvoiceStatus } from '../../entities/sales-invoices.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';
import { InventoryBatch } from '../../entities/inventories.entity';
import { InventoryTransaction } from '../../entities/inventory-transactions.entity';
import { Product } from '../../entities/products.entity';
import { DataSource, QueryRunner } from 'typeorm';

function setup(options: { returned?: number; returnTaxable?: number; factor?: number; allocations?: boolean; alreadyRestored?: boolean } = {}) {
  const factor = options.factor || 1;
  const item = { id: 1, product_id: 10, quantity: 10, base_quantity: 10 * factor, conversion_factor: factor, taxable_quantity: 6 };
  const invoice = {
    id: 7,
    code: 'TEST',
    created_by: 3,
    status: SalesInvoiceStatus.CONFIRMED,
    items: [item],
    gift_stock_allocations: undefined as Array<{
      batchId: number;
      quantity: number;
      taxableQuantity: number;
    }> | undefined,
  };
  const product = { id: 10, quantity: 20, taxable_quantity_stock: 2, average_cost_price: '100' };
  const batch = { id: 100, product_id: 10, remaining_quantity: 20, taxable_remaining_quantity: 2 };
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
    update: jest.fn().mockImplementation((entity, _id, values) => {
      if (entity === Product) Object.assign(product, values);
      if (entity === SalesInvoice) Object.assign(invoice, values);
      return Promise.resolve({});
    }),
    save: jest.fn().mockImplementation((value) => Promise.resolve(value)),
    delete: jest.fn().mockResolvedValue({}),
  };
  Object.assign(transRepo, { manager });
  const inventory = {
    removeSupplierSettlementForInvoice: jest.fn().mockResolvedValue(undefined),
    createTransaction: jest.fn().mockResolvedValue({ id: 22 }),
    processStockIn: jest.fn().mockResolvedValue({ transaction: { id: 23 } }),
    restoreStockToExistingBatch: jest.fn().mockResolvedValue({ id: 24 }),
  };
  const runner = { manager, isTransactionActive: true, connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(), rollbackTransaction: jest.fn(), release: jest.fn() };
  const service = Object.create(SalesService.prototype) as SalesService;
  Object.assign(service, {
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    inventoryService: inventory,
    customerRewardService: { syncInvoiceReward: jest.fn().mockResolvedValue(undefined) },
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
    const s = setup({ returned: 3, returnTaxable: 3 });
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
      taxableQuantity: 3,
      sourceBatchId: 100,
    }];
    await s.service.handleInventoryRestoration(7, 3, s.runner);
    expect(s.product.taxable_quantity_stock).toBe(3);
    expect(s.manager.update).toHaveBeenCalledWith(Product, 10, { taxable_quantity_stock: 3 });
  });

  it('restores a cancelled multi-lot sale to each original batch with its own tax amount', async () => {
    const s = setup();
    s.item.quantity = 3;
    s.item.base_quantity = 3;
    s.item.taxable_quantity = 1;
    s.product.quantity = 7;
    s.product.taxable_quantity_stock = 7;

    const batches = {
      100: { id: 100, product_id: 10, remaining_quantity: 0, taxable_remaining_quantity: 0 },
      101: { id: 101, product_id: 10, remaining_quantity: 7, taxable_remaining_quantity: 7 },
    };
    const allocations = [
      { ...s.allocation, quantity: 2, taxable_quantity: 0, inventory_batch_id: 100, receipt_item_id: 200 },
      { ...s.allocation, id: 2, quantity: 1, taxable_quantity: 1, inventory_batch_id: 101, receipt_item_id: 201 },
    ];
    s.manager.find.mockImplementation((entity) =>
      entity === SalesInvoiceItemStockAllocation ? allocations : [],
    );
    s.manager.findOne.mockImplementation((entity: unknown, options: any) => {
      if (entity === SalesInvoice) return Promise.resolve(s.invoice);
      if (entity === Product) return Promise.resolve(s.product);
      if (entity === InventoryBatch) {
        return Promise.resolve(batches[options.where.id as 100 | 101]);
      }
      return Promise.resolve(null);
    });

    await s.service.handleInventoryRestoration(7, 3, s.runner);

    expect(batches[100]).toEqual({
      id: 100,
      product_id: 10,
      remaining_quantity: 2,
      taxable_remaining_quantity: 0,
    });
    expect(batches[101]).toEqual({
      id: 101,
      product_id: 10,
      remaining_quantity: 8,
      taxable_remaining_quantity: 8,
    });
    expect(s.product.quantity).toBe(10);
    expect(s.product.taxable_quantity_stock).toBe(8);
    expect(s.inventory.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 2, receipt_item_id: 200, reference_type: 'STOCK_IN_CANCEL' }),
      s.runner,
    );
    expect(s.inventory.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 1, receipt_item_id: 201, reference_type: 'STOCK_IN_CANCEL' }),
      s.runner,
    );
  });

  it('cancels only the unreturned quantity after a taxable multi-lot customer return', async () => {
    const s = setup({ returned: 2, returnTaxable: 2 });
    s.item.quantity = 5;
    s.item.base_quantity = 5;
    s.item.taxable_quantity = 3;
    s.product.quantity = 7;
    s.product.taxable_quantity_stock = 7;
    s.returns[0]!.stock_allocations = [{
      batchId: 300,
      quantity: 2,
      taxableQuantity: 2,
      sourceBatchId: 101,
      sourceReceiptItemId: 201,
    }];

    const batches = {
      100: { id: 100, product_id: 10, remaining_quantity: 0, taxable_remaining_quantity: 0 },
      101: { id: 101, product_id: 10, remaining_quantity: 5, taxable_remaining_quantity: 5 },
    };
    const allocations = [
      { ...s.allocation, quantity: 2, taxable_quantity: 0, inventory_batch_id: 100, receipt_item_id: 200 },
      { ...s.allocation, id: 2, quantity: 3, taxable_quantity: 3, inventory_batch_id: 101, receipt_item_id: 201 },
    ];
    s.manager.find.mockImplementation((entity) =>
      entity === SalesInvoiceItemStockAllocation ? allocations : [],
    );
    s.manager.findOne.mockImplementation((entity: unknown, options: any) => {
      if (entity === SalesInvoice) return Promise.resolve(s.invoice);
      if (entity === Product) return Promise.resolve(s.product);
      if (entity === InventoryBatch) {
        return Promise.resolve(batches[options.where.id as 100 | 101]);
      }
      return Promise.resolve(null);
    });

    await s.service.handleInventoryRestoration(7, 3, s.runner);

    expect(batches[100]).toEqual({
      id: 100,
      product_id: 10,
      remaining_quantity: 2,
      taxable_remaining_quantity: 0,
    });
    expect(batches[101]).toEqual({
      id: 101,
      product_id: 10,
      remaining_quantity: 6,
      taxable_remaining_quantity: 6,
    });
    expect(s.product.quantity).toBe(10);
    expect(s.product.taxable_quantity_stock).toBe(8);
    expect(s.inventory.createTransaction).toHaveBeenCalledTimes(2);
    expect(s.inventory.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 2, receipt_item_id: 200 }),
      s.runner,
    );
    expect(s.inventory.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 1, receipt_item_id: 201 }),
      s.runner,
    );
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
    s.allocation.taxable_quantity = 2;
    await expect(s.service.handleInventoryRestoration(7, 3, s.runner)).rejects.toThrow('Phân bổ lô');
    expect(s.inventory.createTransaction).not.toHaveBeenCalled();
  });

  it('creates a stock batch when an old allocation has no batch reference', async () => {
    const s = setup();
    Object.assign(s.allocation, { inventory_batch_id: null });
    await s.service.handleInventoryRestoration(7, 3, s.runner);
    expect(s.inventory.processStockIn).toHaveBeenCalled();
    expect(s.transRepo.update).toHaveBeenCalledWith(23, expect.objectContaining({ reference_type: 'STOCK_IN_CANCEL' }));
    expect(s.manager.update).not.toHaveBeenCalledWith(Product, 10, expect.objectContaining({ taxable_quantity_stock: expect.anything() }));
  });

  it('owns a transaction when restoration is invoked without a query runner', async () => {
    const s = setup();
    await s.service.handleInventoryRestoration(7, 3);
    expect(s.runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(s.runner.release).toHaveBeenCalledTimes(1);
  });

  it('writes sale-unit tax snapshots after a base-unit deduction', async () => {
    const s = setup({ factor: 50 });
    Object.assign(s.inventory, { processStockOut: jest.fn().mockResolvedValue({ taxableQuantity: 300, taxSellingPrice: 2000, affectedBatches: [{ batchId: 100, deductedQuantity: 500, taxableQuantity: 300 }] }) });
    await s.service.handleInventoryDeduction(7, 3, s.runner);
    expect(s.manager.update).toHaveBeenCalledWith(SalesInvoiceItem, 1, { taxable_quantity: 6, tax_selling_price: '100000' });
  });

  it('persists each newly sold lot and its exact tax quantity from FIFO stock-out', async () => {
    const s = setup();
    s.item.quantity = 3;
    s.item.base_quantity = 3;
    const sourceBatches = {
      100: { id: 100, receipt_item_id: 200 },
      101: { id: 101, receipt_item_id: 201 },
    };
    s.manager.findOne.mockImplementation((entity: unknown, options: any) => {
      if (entity === InventoryBatch) {
        return Promise.resolve(sourceBatches[options.where.id as 100 | 101]);
      }
      if (entity === SalesInvoice) return Promise.resolve(s.invoice);
      if (entity === Product) return Promise.resolve(s.product);
      return Promise.resolve(null);
    });
    const processStockOut = jest.fn().mockResolvedValue({
      taxableQuantity: 2,
      taxSellingPrice: 1200,
      affectedBatches: [
        { batchId: 100, deductedQuantity: 1, taxableQuantity: 0, cost: 100 },
        { batchId: 101, deductedQuantity: 2, taxableQuantity: 2, cost: 120 },
      ],
    });
    Object.assign(s.inventory, { processStockOut });

    await s.service.handleInventoryDeduction(7, 3, s.runner);

    expect(processStockOut).toHaveBeenCalledWith(
      10,
      3,
      'SALE',
      3,
      7,
      'Bán hàng theo hóa đơn #TEST',
      s.runner,
      { requireBatchTaxSnapshot: true },
    );
    expect(s.manager.save).toHaveBeenCalledWith(
      SalesInvoiceItemStockAllocation,
      expect.objectContaining({
        invoice_id: 7,
        sales_invoice_item_id: 1,
        product_id: 10,
        inventory_batch_id: 100,
        receipt_item_id: 200,
        quantity: 1,
        taxable_quantity: 0,
        unit_cost: 100,
        total_cost: 100,
      }),
    );
    expect(s.manager.save).toHaveBeenCalledWith(
      SalesInvoiceItemStockAllocation,
      expect.objectContaining({
        invoice_id: 7,
        sales_invoice_item_id: 1,
        product_id: 10,
        inventory_batch_id: 101,
        receipt_item_id: 201,
        quantity: 2,
        taxable_quantity: 2,
        unit_cost: 120,
        total_cost: 240,
      }),
    );
    expect(s.manager.update).toHaveBeenCalledWith(SalesInvoiceItem, 1, {
      taxable_quantity: 2,
      tax_selling_price: '1200',
    });
  });

  it('stores lot allocations in base units and the invoice tax snapshot in sale units', async () => {
    const s = setup({ factor: 50 });
    s.item.quantity = 1;
    s.item.base_quantity = 50;
    const sourceBatches = {
      100: { id: 100, receipt_item_id: 200 },
      101: { id: 101, receipt_item_id: 201 },
    };
    s.manager.findOne.mockImplementation((entity: unknown, options: any) => {
      if (entity === InventoryBatch) {
        return Promise.resolve(sourceBatches[options.where.id as 100 | 101]);
      }
      if (entity === SalesInvoice) return Promise.resolve(s.invoice);
      if (entity === Product) return Promise.resolve(s.product);
      return Promise.resolve(null);
    });
    Object.assign(s.inventory, {
      processStockOut: jest.fn().mockResolvedValue({
        taxableQuantity: 25,
        taxSellingPrice: 1200,
        affectedBatches: [
          { batchId: 100, deductedQuantity: 25, taxableQuantity: 0, cost: 100 },
          { batchId: 101, deductedQuantity: 25, taxableQuantity: 25, cost: 120 },
        ],
      }),
    });

    await s.service.handleInventoryDeduction(7, 3, s.runner);

    expect(s.manager.save).toHaveBeenCalledWith(
      SalesInvoiceItemStockAllocation,
      expect.objectContaining({
        inventory_batch_id: 100,
        receipt_item_id: 200,
        quantity: 25,
        taxable_quantity: 0,
      }),
    );
    expect(s.manager.save).toHaveBeenCalledWith(
      SalesInvoiceItemStockAllocation,
      expect.objectContaining({
        inventory_batch_id: 101,
        receipt_item_id: 201,
        quantity: 25,
        taxable_quantity: 25,
      }),
    );
    expect(s.manager.update).toHaveBeenCalledWith(SalesInvoiceItem, 1, {
      taxable_quantity: 0.5,
      tax_selling_price: '60000',
    });
  });

  it.each([1000, 40])('rejects a sale-unit tax snapshot that numeric(15,2) would change (factor %s)', async (factor) => {
    const s = setup({ factor });
    Object.assign(s.inventory, { processStockOut: jest.fn().mockResolvedValue({ taxableQuantity: 1, taxSellingPrice: 2, affectedBatches: [{ batchId: 100, deductedQuantity: 10 * factor, taxableQuantity: 1 }] }) });
    await expect(s.service.handleInventoryDeduction(7, 3)).rejects.toThrow('2 chữ số thập phân');
    expect(s.manager.update).not.toHaveBeenCalledWith(SalesInvoiceItem, 1, expect.anything());
    expect(s.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(s.runner.commitTransaction).not.toHaveBeenCalled();
  });

  it('keeps a sale-unit tax snapshot that fits the database precision', async () => {
    const s = setup({ factor: 50 });
    Object.assign(s.inventory, { processStockOut: jest.fn().mockResolvedValue({ taxableQuantity: 1, taxSellingPrice: 2, affectedBatches: [{ batchId: 100, deductedQuantity: 500, taxableQuantity: 1 }] }) });
    await s.service.handleInventoryDeduction(7, 3, s.runner);
    expect(s.manager.update).toHaveBeenCalledWith(SalesInvoiceItem, 1, {
      taxable_quantity: 0.02,
      tax_selling_price: '100',
    });
  });

  it('restores source tax even when current product GBKT equals the sale-unit GBKT', async () => {
    const s = setup({ factor: 50 });
    Object.assign(s.item, { tax_selling_price: '100000', product: { tax_selling_price: '100000' } });
    await s.service.handleInventoryRestoration(7, 3, s.runner);
    expect(s.product.taxable_quantity_stock).toBe(302);
    expect(s.batch.taxable_remaining_quantity).toBe(302);
  });

  it('restores a legacy base-tax snapshot independently of changed GBKT', async () => {
    const s = setup({ factor: 50 });
    Object.assign(s.item, { tax_selling_price: '2000', product: { tax_selling_price: '2100' } });
    s.allocation.taxable_quantity = 6;
    await s.service.handleInventoryRestoration(7, 3, s.runner);
    expect(s.product.taxable_quantity_stock).toBe(8);
  });

  it.each([0, 0.03])('uses exact allocations even when an older rounded sale scalar is %s', async (roundedTax) => {
    const s = setup({ factor: 40 });
    s.item.taxable_quantity = roundedTax;
    s.allocation.taxable_quantity = 1;
    await s.service.handleInventoryRestoration(7, 3, s.runner);
    expect(s.product.taxable_quantity_stock).toBe(3);
  });

  it('restores a four-decimal fractional product tax balance', async () => {
    const s = setup();
    s.allocation.taxable_quantity = 0.001;
    await s.service.handleInventoryRestoration(7, 3, s.runner);
    expect(s.product.taxable_quantity_stock).toBe(2.001);
    expect(s.batch.taxable_remaining_quantity).toBe(2.001);
  });

  it('rolls back instead of rounding a sub-0.0001 product tax balance', async () => {
    const s = setup();
    s.allocation.taxable_quantity = 0.00001;
    await expect(s.service.handleInventoryRestoration(7, 3)).rejects.toThrow('4 chữ số thập phân');
    expect(s.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(s.runner.commitTransaction).not.toHaveBeenCalled();
  });

  it('rejects a missing batch tax balance instead of updating only product tax', async () => {
    const s = setup();
    Object.assign(s.batch, { taxable_remaining_quantity: null });
    await expect(s.service.handleInventoryRestoration(7, 3, s.runner)).rejects.toThrow('thiếu hoặc sai tồn thuế còn lại');
    expect(s.manager.update).not.toHaveBeenCalled();
    expect(s.inventory.createTransaction).not.toHaveBeenCalled();
  });

  it('locks the invoice before rechecking the SALE marker and skips an already-posted invoice', async () => {
    const s = setup();
    const processStockOut = jest.fn();
    Object.assign(s.inventory, { processStockOut });
    s.transRepo.findOne.mockResolvedValue({ id: 90 } as any);

    await expect(
      s.service.handleInventoryDeduction(7, 3, s.runner),
    ).resolves.toBe(false);

    expect(s.manager.findOne).toHaveBeenCalledWith(SalesInvoice, {
      where: { id: 7 },
      lock: { mode: 'pessimistic_write' },
    });
    expect(s.manager.findOne.mock.invocationCallOrder[0]!).toBeLessThan(
      s.transRepo.findOne.mock.invocationCallOrder[0]!,
    );
    expect(processStockOut).not.toHaveBeenCalled();
  });

  it('does not deduct stock if the locked invoice is no longer posted', async () => {
    const s = setup();
    s.invoice.status = SalesInvoiceStatus.CANCELLED;
    const processStockOut = jest.fn();
    Object.assign(s.inventory, { processStockOut });

    await expect(
      s.service.handleInventoryDeduction(7, 3, s.runner),
    ).resolves.toBe(false);

    expect(s.manager.findOne).toHaveBeenCalledWith(SalesInvoice, {
      where: { id: 7 },
      lock: { mode: 'pessimistic_write' },
    });
    expect(s.transRepo.findOne).not.toHaveBeenCalled();
    expect(processStockOut).not.toHaveBeenCalled();
  });

  it('does not issue gift stock if the locked invoice has already been cancelled', async () => {
    const s = setup();
    s.invoice.status = SalesInvoiceStatus.CANCELLED;
    Object.assign(s.invoice, { gift_product_id: 20, gift_quantity: 2 });
    const processStockOut = jest.fn();
    Object.assign(s.inventory, { processStockOut });

    await (s.service as any).handleInvoiceGiftStockOut(
      s.invoice,
      3,
      s.runner,
    );

    expect(s.manager.findOne).toHaveBeenCalledWith(SalesInvoice, {
      where: { id: 7 },
      lock: { mode: 'pessimistic_write' },
    });
    expect(processStockOut).not.toHaveBeenCalled();
  });

  it('requires a valid batch tax snapshot for invoice gift stock', async () => {
    const s = setup();
    Object.assign(s.invoice, { gift_product_id: 20, gift_quantity: 1 });
    const processStockOut = jest.fn().mockResolvedValue({
      transaction: { id: 30 },
      taxableQuantity: 0,
      taxSellingPrice: 0,
      affectedBatches: [{
        batchId: 50,
        deductedQuantity: 1,
        taxableQuantity: 0,
      }],
    });
    Object.assign(s.inventory, { processStockOut });

    await (s.service as any).handleInvoiceGiftStockOut(
      s.invoice,
      3,
      s.runner,
    );

    expect(processStockOut).toHaveBeenCalledWith(
      20,
      1,
      'INVOICE_GIFT',
      3,
      7,
      'Xuất kho quà tặng kèm hóa đơn #TEST',
      s.runner,
      { requireBatchTaxSnapshot: true },
    );
    expect(s.invoice.gift_stock_allocations).toEqual([
      { batchId: 50, quantity: 1, taxableQuantity: 0 },
    ]);
  });

  it('stores each FIFO batch and its own taxable quantity for invoice gifts', async () => {
    const s = setup();
    Object.assign(s.invoice, { gift_product_id: 20, gift_quantity: 3 });
    const processStockOut = jest.fn().mockResolvedValue({
      transaction: { id: 30 },
      taxableQuantity: 1,
      taxSellingPrice: 125,
      affectedBatches: [
        { batchId: 50, deductedQuantity: 2, taxableQuantity: 0 },
        { batchId: 51, deductedQuantity: 1, taxableQuantity: 1 },
      ],
    });
    Object.assign(s.inventory, { processStockOut });

    await (s.service as any).handleInvoiceGiftStockOut(s.invoice, 3, s.runner);

    expect(s.invoice.gift_stock_allocations).toEqual([
      { batchId: 50, quantity: 2, taxableQuantity: 0 },
      { batchId: 51, quantity: 1, taxableQuantity: 1 },
    ]);
    expect(s.manager.update).toHaveBeenCalledWith(SalesInvoice, 7, expect.objectContaining({
      gift_inventory_transaction_id: 30,
      gift_stock_allocations: s.invoice.gift_stock_allocations,
    }));
  });

  it('restores invoice gifts to their exact FIFO batches and tax allocations', async () => {
    const s = setup();
    Object.assign(s.invoice, {
      gift_product_id: 20,
      gift_quantity: 3,
      gift_stock_allocations: [
        { batchId: 50, quantity: 2, taxableQuantity: 0 },
        { batchId: 51, quantity: 1, taxableQuantity: 1 },
      ],
    });
    s.transRepo.findOne
      .mockResolvedValueOnce({ id: 30, unit_cost_price: '100', notes: 'taxable_quantity=1' })
      .mockResolvedValueOnce(null);

    await (s.service as any).handleInvoiceGiftStockRestoration(s.invoice, 3, s.runner);

    expect(s.inventory.restoreStockToExistingBatch).toHaveBeenNthCalledWith(
      1, 20, 50, 2, 0, 3, 7, 'TEST', s.runner, 'INVOICE_GIFT_CANCEL',
      'Hoàn quà về lô #50 từ hóa đơn hủy #TEST',
    );
    expect(s.inventory.restoreStockToExistingBatch).toHaveBeenNthCalledWith(
      2, 20, 51, 1, 1, 3, 7, 'TEST', s.runner, 'INVOICE_GIFT_CANCEL',
      'Hoàn quà về lô #51 từ hóa đơn hủy #TEST',
    );
    expect(s.inventory.processStockIn).not.toHaveBeenCalled();
  });

  it('does not restore invoice gift stock twice after a cancellation transaction exists', async () => {
    const s = setup();
    Object.assign(s.invoice, { gift_product_id: 20, gift_quantity: 1 });
    s.transRepo.findOne
      .mockResolvedValueOnce({ id: 30, notes: 'taxable_quantity=0' })
      .mockResolvedValueOnce({ id: 31 });

    await (s.service as any).handleInvoiceGiftStockRestoration(s.invoice, 3, s.runner);

    expect(s.inventory.restoreStockToExistingBatch).not.toHaveBeenCalled();
    expect(s.inventory.processStockIn).not.toHaveBeenCalled();
  });

  it('blocks cancellation of a legacy invoice gift without a source-lot snapshot', async () => {
    const s = setup();
    Object.assign(s.invoice, { gift_product_id: 20, gift_quantity: 1 });
    s.transRepo.findOne
      .mockResolvedValueOnce({ id: 30, notes: 'taxable_quantity=0' })
      .mockResolvedValueOnce(null);

    await expect(
      (s.service as any).handleInvoiceGiftStockRestoration(s.invoice, 3, s.runner),
    ).rejects.toThrow('thiếu snapshot phân bổ lô');

    expect(s.inventory.restoreStockToExistingBatch).not.toHaveBeenCalled();
    expect(s.inventory.processStockIn).not.toHaveBeenCalled();
  });

  it('rejects an invoice gift allocation whose taxable total disagrees with the stock-out transaction', async () => {
    const s = setup();
    Object.assign(s.invoice, {
      gift_product_id: 20,
      gift_quantity: 1,
      gift_stock_allocations: [{ batchId: 50, quantity: 1, taxableQuantity: 1 }],
    });
    s.transRepo.findOne
      .mockResolvedValueOnce({ id: 30, notes: 'taxable_quantity=0' })
      .mockResolvedValueOnce(null);

    await expect(
      (s.service as any).handleInvoiceGiftStockRestoration(s.invoice, 3, s.runner),
    ).rejects.toThrow('snapshot phân bổ lô không khớp');

    expect(s.inventory.restoreStockToExistingBatch).not.toHaveBeenCalled();
  });

  it('rejects a null taxable quantity instead of interpreting it as non-taxable', async () => {
    const s = setup();
    Object.assign(s.invoice, {
      gift_product_id: 20,
      gift_quantity: 1,
      gift_stock_allocations: [{ batchId: 50, quantity: 1, taxableQuantity: null }],
    });
    s.transRepo.findOne
      .mockResolvedValueOnce({ id: 30, notes: 'taxable_quantity=0' })
      .mockResolvedValueOnce(null);

    await expect(
      (s.service as any).handleInvoiceGiftStockRestoration(s.invoice, 3, s.runner),
    ).rejects.toThrow('thiếu mã lô, số lượng hoặc số lượng thuế');

    expect(s.inventory.restoreStockToExistingBatch).not.toHaveBeenCalled();
  });

  it('requires the stock-out transaction to contain an explicit taxable quantity snapshot', async () => {
    const s = setup();
    Object.assign(s.invoice, {
      gift_product_id: 20,
      gift_quantity: 1,
      gift_stock_allocations: [{ batchId: 50, quantity: 1, taxableQuantity: 0 }],
    });
    s.transRepo.findOne
      .mockResolvedValueOnce({ id: 30, notes: 'gift stock out' })
      .mockResolvedValueOnce(null);

    await expect(
      (s.service as any).handleInvoiceGiftStockRestoration(s.invoice, 3, s.runner),
    ).rejects.toThrow('snapshot phân bổ lô không khớp');

    expect(s.inventory.restoreStockToExistingBatch).not.toHaveBeenCalled();
  });

  it('rejects a malformed taxable quantity marker instead of parsing a numeric prefix', async () => {
    const s = setup();
    Object.assign(s.invoice, {
      gift_product_id: 20,
      gift_quantity: 1,
      gift_stock_allocations: [{ batchId: 50, quantity: 1, taxableQuantity: 1 }],
    });
    s.transRepo.findOne
      .mockResolvedValueOnce({ id: 30, notes: 'taxable_quantity=1oops' })
      .mockResolvedValueOnce(null);

    await expect(
      (s.service as any).handleInvoiceGiftStockRestoration(s.invoice, 3, s.runner),
    ).rejects.toThrow('snapshot phân bổ lô không khớp');

    expect(s.inventory.restoreStockToExistingBatch).not.toHaveBeenCalled();
  });

  it.each(['cancelInvoice', 'refundInvoice'] as const)('%s restores stock even without an explicit actor and is repeat-safe', async (method) => {
    const s = setup();
    s.invoice.status = method === 'refundInvoice' ? SalesInvoiceStatus.PAID : SalesInvoiceStatus.CONFIRMED;
    const restoreGift = jest.fn().mockResolvedValue(undefined);
    Object.assign(s.service, {
      createRefundPaymentForInvoice: jest.fn().mockResolvedValue(undefined),
      handleInvoiceGiftStockRestoration: restoreGift,
    });
    const restore = jest.spyOn(s.service, 'handleInventoryRestoration').mockResolvedValue(undefined);
    await s.service[method](7);
    await s.service[method](7);
    expect(restore).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledWith(7, 3, s.runner);
    expect(restoreGift).toHaveBeenCalledTimes(1);
    expect(restoreGift).toHaveBeenCalledWith(
      s.invoice,
      3,
      s.runner,
    );
    expect(s.manager.findOne).toHaveBeenCalledWith(SalesInvoice, { where: { id: 7 }, lock: { mode: 'pessimistic_write' } });
  });

  it.each(['cancelInvoice', 'refundInvoice'] as const)(
    '%s rolls back sale restoration when invoice gift restoration fails',
    async (method) => {
      const s = setup();
      s.invoice.status = method === 'refundInvoice'
        ? SalesInvoiceStatus.PAID
        : SalesInvoiceStatus.CONFIRMED;
      const createRefund = jest
        .spyOn(s.service as any, 'createRefundPaymentForInvoice')
        .mockResolvedValue(undefined);
      const restoreSale = jest
        .spyOn(s.service, 'handleInventoryRestoration')
        .mockResolvedValue(undefined);
      const restoreGift = jest
        .spyOn(s.service as any, 'handleInvoiceGiftStockRestoration')
        .mockRejectedValue(new Error('Không thể khôi phục snapshot quà'));

      await expect(s.service[method](7)).rejects.toThrow(
        'Không thể khôi phục snapshot quà',
      );

      expect(createRefund).toHaveBeenCalledTimes(1);
      expect(restoreSale).toHaveBeenCalledWith(7, 3, s.runner);
      expect(restoreGift).toHaveBeenCalledWith(s.invoice, 3, s.runner);
      expect(s.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(s.runner.commitTransaction).not.toHaveBeenCalled();
    },
  );

  it.each(['cancelInvoice', 'refundInvoice'] as const)(
    '%s rolls back the invoice when its original stock batch cannot be restored',
    async (method) => {
      const s = setup();
      s.invoice.status = method === 'refundInvoice'
        ? SalesInvoiceStatus.PAID
        : SalesInvoiceStatus.CONFIRMED;
      s.manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === SalesInvoice) return Promise.resolve(s.invoice);
        if (entity === Product) return Promise.resolve(s.product);
        if (entity === InventoryBatch) return Promise.resolve(null);
        return Promise.resolve(null);
      });
      jest.spyOn(s.service as any, 'createRefundPaymentForInvoice').mockResolvedValue(undefined);
      jest.spyOn(s.service as any, 'handleInvoiceGiftStockRestoration').mockResolvedValue(undefined);

      await expect(s.service[method](7)).rejects.toThrow('Không tìm thấy lô kho #100');

      expect(s.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(s.runner.commitTransaction).not.toHaveBeenCalled();
      expect(s.manager.update).not.toHaveBeenCalledWith(Product, 10, expect.anything());
    },
  );
});

const describePostgres = process.env.TAX_BACKFILL_TEST_URL ? describe : describe.skip;

describePostgres('invoice stock restoration PostgreSQL exact-lot behavior', () => {
  jest.setTimeout(30000);

  let connection: DataSource;
  let databaseRunner: ReturnType<DataSource['createQueryRunner']>;
  let tables: Record<string, string>;

  beforeAll(async () => {
    const targetHost = new URL(process.env.TAX_BACKFILL_TEST_URL!).hostname;
    if (targetHost !== 'ep-broad-pine-a1675nqi-pooler.ap-southeast-1.aws.neon.tech') {
      throw new Error(`Invoice-restoration integration tests are restricted to the dev DB host, got ${targetHost}`);
    }
    const suffix = `${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
    tables = {
      invoices: `tax_invoice_restore_invoices_${suffix}`,
      products: `tax_invoice_restore_products_${suffix}`,
      batches: `tax_invoice_restore_batches_${suffix}`,
      allocations: `tax_invoice_restore_allocations_${suffix}`,
      returnItems: `tax_invoice_restore_return_items_${suffix}`,
      transactions: `tax_invoice_restore_transactions_${suffix}`,
      giftSnapshots: `tax_invoice_restore_gift_snapshots_${suffix}`,
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
        id integer PRIMARY KEY, status text NOT NULL, payment_status text NOT NULL,
        final_amount numeric NOT NULL, partial_payment_amount numeric NOT NULL,
        remaining_amount numeric NOT NULL, cost_of_goods_sold numeric NOT NULL,
        gross_profit numeric NOT NULL, gross_profit_margin numeric NOT NULL,
        updated_at timestamptz
      );
      CREATE TEMP TABLE ${tables.products} (
        id integer PRIMARY KEY, quantity numeric NOT NULL,
        taxable_quantity_stock numeric NOT NULL, average_cost_price numeric NOT NULL
      );
      CREATE TEMP TABLE ${tables.batches} (
        id integer PRIMARY KEY, product_id integer NOT NULL, receipt_item_id integer,
        remaining_quantity numeric NOT NULL, taxable_remaining_quantity numeric NOT NULL
      );
      CREATE TEMP TABLE ${tables.allocations} (
        id integer PRIMARY KEY, invoice_id integer NOT NULL, sales_invoice_item_id integer NOT NULL,
        product_id integer NOT NULL, inventory_batch_id integer NOT NULL, receipt_item_id integer,
        quantity numeric NOT NULL, taxable_quantity numeric NOT NULL, unit_cost numeric NOT NULL
      );
      CREATE TEMP TABLE ${tables.returnItems} (
        id integer PRIMARY KEY, invoice_id integer NOT NULL, status text NOT NULL,
        sales_invoice_item_id integer NOT NULL, product_id integer NOT NULL,
        base_quantity numeric NOT NULL, stock_allocations jsonb NOT NULL
      );
      CREATE TEMP TABLE ${tables.transactions} (
        id serial PRIMARY KEY, product_id integer NOT NULL, type text NOT NULL,
        quantity numeric NOT NULL, reference_type text NOT NULL, reference_id integer NOT NULL,
        receipt_item_id integer, unit_cost_price numeric NOT NULL, notes text
      );
      CREATE TEMP TABLE ${tables.giftSnapshots} (
        invoice_id integer PRIMARY KEY, gift_inventory_transaction_id integer,
        gift_stock_allocations jsonb
      );
    `);
  });

  afterEach(async () => {
    if (databaseRunner?.isTransactionActive) await databaseRunner.rollbackTransaction();
    if (databaseRunner && tables) {
      await databaseRunner.query(`TRUNCATE TABLE
        ${tables.transactions}, ${tables.giftSnapshots}, ${tables.returnItems}, ${tables.allocations},
        ${tables.batches}, ${tables.products}, ${tables.invoices} RESTART IDENTITY`);
    }
  });

  afterAll(async () => {
    if (databaseRunner && tables) {
      const temporaryTables = Object.values(tables).map((table) => `pg_temp.${table}`).join(', ');
      await databaseRunner.query(`DROP TABLE IF EXISTS ${temporaryTables} CASCADE`);
      await databaseRunner.release();
    }
    if (connection?.isInitialized) await connection.destroy();
  });

  it.each([
    ['cancelInvoice', SalesInvoiceStatus.CONFIRMED, SalesInvoiceStatus.CANCELLED, 'pending', 0, 300],
    ['refundInvoice', SalesInvoiceStatus.PAID, SalesInvoiceStatus.REFUNDED, 'paid', 300, 0],
  ] as const)('%s does not restore a customer-returned unit again', async (
    method, initialStatus, expectedStatus, initialPaymentStatus, initialPaidAmount, initialRemainingAmount,
  ) => {
    const initialStatusText = initialStatus === SalesInvoiceStatus.PAID ? 'paid' : 'confirmed';
    await databaseRunner.query(`
      INSERT INTO ${tables.invoices} VALUES
        (7,'${initialStatusText}','${initialPaymentStatus}',300,${initialPaidAmount},${initialRemainingAmount},30,270,90,NULL);
      INSERT INTO ${tables.products} VALUES (10, 8, 8, 100);
      INSERT INTO ${tables.batches} VALUES
        (100, 10, 200, 0, 0), (101, 10, 201, 8, 8);
      INSERT INTO ${tables.allocations} VALUES
        (1, 7, 1, 10, 100, 200, 2, 0, 100),
        (2, 7, 1, 10, 101, 201, 1, 1, 100);
      INSERT INTO ${tables.returnItems} VALUES
        (5, 7, 'approved', 1, 10, 1,
          '[{"batchId":300,"sourceBatchId":101,"sourceReceiptItemId":201,"quantity":1,"taxableQuantity":1}]'::jsonb);
      INSERT INTO ${tables.transactions}
        (product_id,type,quantity,reference_type,reference_id,receipt_item_id,unit_cost_price)
        VALUES (10,'OUT',-3,'SALE',7,NULL,100), (10,'IN',1,'RETURN',55,201,100);
    `);

    const invoice = Object.assign(new SalesInvoice(), {
      id: 7,
      code: 'INV-7',
      created_by: 3,
      status: initialStatus,
      payment_status: initialPaymentStatus,
      final_amount: 300,
      partial_payment_amount: initialPaidAmount,
      remaining_amount: initialRemainingAmount,
      cost_of_goods_sold: 30,
      gross_profit: 270,
      gross_profit_margin: 90,
      customer_id: null,
      season_id: null,
      items: [Object.assign(new SalesInvoiceItem(), {
        id: 1, product_id: 10, quantity: 3, base_quantity: 3,
        conversion_factor: 1, taxable_quantity: 1,
      })],
    });
    const manager = {
      getRepository: jest.fn(),
      createQueryBuilder: jest.fn(() => {
        const query = {
          innerJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getMany: async () => {
            const rows = await databaseRunner.query(
              `SELECT * FROM ${tables.returnItems} WHERE invoice_id=7 AND status='approved' ORDER BY id`,
            );
            return rows.map((row: Record<string, unknown>) =>
              Object.assign(new SalesReturnItem(), row),
            );
          },
        };
        return query;
      }),
      find: async (entity: Function, options: { where: { invoice_id: number } }) => {
        if (entity !== SalesInvoiceItemStockAllocation) return [];
        const rows = await databaseRunner.query(
          `SELECT * FROM ${tables.allocations} WHERE invoice_id=$1 ORDER BY id`,
          [options.where.invoice_id],
        );
        return rows.map((row: Record<string, unknown>) =>
          Object.assign(new SalesInvoiceItemStockAllocation(), row),
        );
      },
      findOne: async (entity: Function, options: { where: { id: number } }) => {
        const id = options.where.id;
        if (entity === SalesInvoice) return invoice;
        if (entity === Product) {
          const [row] = await databaseRunner.query(`SELECT * FROM ${tables.products} WHERE id=$1`, [id]);
          return row ? Object.assign(new Product(), row) : null;
        }
        if (entity === InventoryBatch) {
          const [row] = await databaseRunner.query(`SELECT * FROM ${tables.batches} WHERE id=$1`, [id]);
          return row ? Object.assign(new InventoryBatch(), row) : null;
        }
        return null;
      },
      save: async (entity: InventoryBatch | SalesInvoice) => {
        if (entity instanceof InventoryBatch) {
          await databaseRunner.query(
            `UPDATE ${tables.batches} SET remaining_quantity=$1,
              taxable_remaining_quantity=$2 WHERE id=$3`,
            [entity.remaining_quantity, entity.taxable_remaining_quantity, entity.id],
          );
          return entity;
        }
        await databaseRunner.query(
          `UPDATE ${tables.invoices} SET status=$1,payment_status=$2,final_amount=$3,
            partial_payment_amount=$4,remaining_amount=$5,cost_of_goods_sold=$6,
            gross_profit=$7,gross_profit_margin=$8,updated_at=$9 WHERE id=$10`,
          [entity.status, entity.payment_status, entity.final_amount,
            entity.partial_payment_amount, entity.remaining_amount,
            entity.cost_of_goods_sold, entity.gross_profit, entity.gross_profit_margin,
            entity.updated_at, entity.id],
        );
        return entity;
      },
      update: async (entity: Function, id: number, values: Record<string, number>) => {
        if (entity !== Product) throw new Error(`Unexpected update entity ${entity.name}`);
        const quantity = values.quantity;
        const taxable = values.taxable_quantity_stock;
        if (quantity !== undefined) {
          await databaseRunner.query(`UPDATE ${tables.products} SET quantity=$1 WHERE id=$2`, [quantity, id]);
        }
        if (taxable !== undefined) {
          await databaseRunner.query(`UPDATE ${tables.products} SET taxable_quantity_stock=$1 WHERE id=$2`, [taxable, id]);
        }
      },
      delete: async (entity: Function, criteria: { invoice_id: number }) => {
        if (entity !== SalesInvoiceItemStockAllocation) throw new Error(`Unexpected delete entity ${entity.name}`);
        return databaseRunner.query(`DELETE FROM ${tables.allocations} WHERE invoice_id=$1`, [criteria.invoice_id]);
      },
    };
    const transactionRepository = {
      manager,
      find: async (options: { where: { reference_type: string; reference_id: number; type: string } }) =>
        databaseRunner.query(
          `SELECT * FROM ${tables.transactions}
           WHERE reference_type=$1 AND reference_id=$2 AND type=$3 ORDER BY id`,
          [options.where.reference_type, options.where.reference_id, options.where.type],
        ),
      findOne: async (options: { where: { reference_type: string; reference_id: number; type: string } }) => {
        const [row] = await databaseRunner.query(
          `SELECT * FROM ${tables.transactions}
           WHERE reference_type=$1 AND reference_id=$2 AND type=$3 ORDER BY id LIMIT 1`,
          [options.where.reference_type, options.where.reference_id, options.where.type],
        );
        return row ?? null;
      },
      update: async (id: number, values: Record<string, unknown>) =>
        databaseRunner.query(
          `UPDATE ${tables.transactions} SET reference_type=$1, reference_id=$2 WHERE id=$3`,
          [values.reference_type, values.reference_id, id],
        ),
    };
    manager.getRepository.mockReturnValue(transactionRepository);
    const transactionRunner = {
      manager,
      connect: async () => undefined,
      startTransaction: () => databaseRunner.startTransaction(),
      commitTransaction: () => databaseRunner.commitTransaction(),
      rollbackTransaction: () => databaseRunner.rollbackTransaction(),
      release: async () => undefined,
      query: (sql: string, parameters?: unknown[]) => databaseRunner.query(sql, parameters),
    } as unknown as QueryRunner;

    const service = Object.create(SalesService.prototype) as SalesService;
    Object.assign(service, {
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      inventoryService: {
        removeSupplierSettlementForInvoice: jest.fn().mockResolvedValue(undefined),
        createTransaction: async (dto: Record<string, unknown>, runner: QueryRunner) => {
          const [row] = await runner.query(
            `INSERT INTO ${tables.transactions}
              (product_id,type,quantity,reference_type,reference_id,receipt_item_id,unit_cost_price)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
            [dto.product_id, dto.transaction_type, dto.quantity, dto.reference_type,
              dto.reference_id, dto.receipt_item_id ?? null, dto.unit_cost_price],
          );
          return { id: row.id };
        },
      },
      createRefundPaymentForInvoice: jest.fn().mockResolvedValue(undefined),
      handleInvoiceGiftStockRestoration: jest.fn().mockResolvedValue(undefined),
      customerRewardService: {
        syncInvoiceReward: jest.fn().mockResolvedValue(undefined),
      },
      dataSource: { createQueryRunner: () => transactionRunner },
    });
    jest.spyOn(service, 'findOne').mockResolvedValue(invoice);

    await service[method](7);

    const [invoiceAfterCancel] = await databaseRunner.query(
      `SELECT status,payment_status,final_amount,remaining_amount FROM ${tables.invoices} WHERE id=7`,
    );
    const [product] = await databaseRunner.query(
      `SELECT quantity,taxable_quantity_stock FROM ${tables.products} WHERE id=10`,
    );
    const batchRows = await databaseRunner.query(
      `SELECT id,remaining_quantity,taxable_remaining_quantity FROM ${tables.batches} ORDER BY id`,
    );
    const restoredTransactions = await databaseRunner.query(
      `SELECT product_id,quantity,reference_type,reference_id,receipt_item_id
       FROM ${tables.transactions} WHERE reference_type='STOCK_IN_CANCEL' ORDER BY id`,
    );

    expect(invoiceAfterCancel.status).toBe(expectedStatus);
    expect(invoiceAfterCancel.payment_status).toBe(method === 'refundInvoice' ? 'refunded' : 'cancelled');
    expect(Number(invoiceAfterCancel.final_amount)).toBe(0);
    expect(Number(invoiceAfterCancel.remaining_amount)).toBe(0);
    expect(Number(product.quantity)).toBe(10);
    expect(Number(product.taxable_quantity_stock)).toBe(8);
    expect(batchRows.map((row: Record<string, unknown>) => [
      Number(row.id), Number(row.remaining_quantity), Number(row.taxable_remaining_quantity),
    ])).toEqual([[100, 2, 0], [101, 8, 8]]);
    expect(restoredTransactions.map((row: Record<string, unknown>) => [
      Number(row.quantity), row.reference_type, Number(row.reference_id), Number(row.receipt_item_id),
    ])).toEqual([[2, 'STOCK_IN_CANCEL', 7, 200]]);

    await service[method](7);
    const [productAfterRepeat] = await databaseRunner.query(
      `SELECT quantity,taxable_quantity_stock FROM ${tables.products} WHERE id=10`,
    );
    const [{ count }] = await databaseRunner.query(
      `SELECT COUNT(*)::int AS count FROM ${tables.transactions} WHERE reference_type='STOCK_IN_CANCEL'`,
    );
    expect(Number(productAfterRepeat.quantity)).toBe(10);
    expect(Number(productAfterRepeat.taxable_quantity_stock)).toBe(8);
    expect(Number(count)).toBe(1);
  });

  it('restores invoice gift stock to its exact taxed and non-taxed lots only once', async () => {
    await databaseRunner.query(`
      INSERT INTO ${tables.products} VALUES (20, 7, 5, 100);
      INSERT INTO ${tables.batches} VALUES
        (150, 20, 250, 0, 0), (151, 20, 251, 0, 0);
      INSERT INTO ${tables.transactions}
        (product_id,type,quantity,reference_type,reference_id,receipt_item_id,unit_cost_price,notes)
        VALUES (20,'OUT',-3,'INVOICE_GIFT',7,NULL,100,'taxable_quantity=2');
    `);

    const invoice = {
      id: 7,
      code: 'INV-GIFT-7',
      created_by: 3,
      gift_product_id: 20,
      gift_quantity: 3,
      gift_stock_allocations: [
        { batchId: 150, quantity: 2, taxableQuantity: 2 },
        { batchId: 151, quantity: 1, taxableQuantity: 0 },
      ],
    } as SalesInvoice;
    const transactionRepository = {
      findOne: jest.fn(async (options: {
        where: { reference_type: string; reference_id: number; type: string };
      }) => {
        const [row] = await databaseRunner.query(
          `SELECT * FROM ${tables.transactions}
           WHERE reference_type=$1 AND reference_id=$2 AND type=$3
           ORDER BY id DESC LIMIT 1`,
          [options.where.reference_type, options.where.reference_id, options.where.type],
        );
        return row ?? null;
      }),
    };
    const manager = { getRepository: jest.fn(() => transactionRepository) };
    const queryRunner = { manager } as unknown as QueryRunner;
    const restoreStockToExistingBatch = jest.fn(async (
      productId: number,
      batchId: number,
      quantity: number,
      taxableQuantity: number,
      _userId: number,
      invoiceId: number,
      invoiceCode: string,
    ) => {
      const [batch] = await databaseRunner.query(
        `UPDATE ${tables.batches}
         SET remaining_quantity=remaining_quantity+$2,
             taxable_remaining_quantity=taxable_remaining_quantity+$3
         WHERE id=$1 RETURNING receipt_item_id`,
        [batchId, quantity, taxableQuantity],
      );
      await databaseRunner.query(
        `UPDATE ${tables.products}
         SET quantity=quantity+$2, taxable_quantity_stock=taxable_quantity_stock+$3
         WHERE id=$1`,
        [productId, quantity, taxableQuantity],
      );
      await databaseRunner.query(
        `INSERT INTO ${tables.transactions}
          (product_id,type,quantity,reference_type,reference_id,receipt_item_id,unit_cost_price,notes)
         VALUES ($1,'IN',$2,'INVOICE_GIFT_CANCEL',$3,$4,100,$5)`,
        [
          productId,
          quantity,
          invoiceId,
          batch.receipt_item_id,
          `taxable_quantity=${taxableQuantity} | ${invoiceCode}`,
        ],
      );
    });
    const service = Object.create(SalesService.prototype) as SalesService;
    Object.assign(service, {
      inventoryService: { restoreStockToExistingBatch },
    });

    await (service as any).handleInvoiceGiftStockRestoration(invoice, 19, queryRunner);

    const batchRows = await databaseRunner.query(
      `SELECT id,remaining_quantity,taxable_remaining_quantity
       FROM ${tables.batches} WHERE product_id=20 ORDER BY id`,
    );
    const [product] = await databaseRunner.query(
      `SELECT quantity,taxable_quantity_stock FROM ${tables.products} WHERE id=20`,
    );
    expect(batchRows.map((row: Record<string, unknown>) => [
      Number(row.id), Number(row.remaining_quantity), Number(row.taxable_remaining_quantity),
    ])).toEqual([[150, 2, 2], [151, 1, 0]]);
    expect(Number(product.quantity)).toBe(10);
    expect(Number(product.taxable_quantity_stock)).toBe(7);
    expect(restoreStockToExistingBatch).toHaveBeenCalledTimes(2);

    await (service as any).handleInvoiceGiftStockRestoration(invoice, 19, queryRunner);

    const [afterRepeat] = await databaseRunner.query(
      `SELECT quantity,taxable_quantity_stock FROM ${tables.products} WHERE id=20`,
    );
    const [{ count }] = await databaseRunner.query(
      `SELECT COUNT(*)::int AS count FROM ${tables.transactions}
       WHERE reference_type='INVOICE_GIFT_CANCEL' AND reference_id=7 AND type='IN'`,
    );
    expect(Number(afterRepeat.quantity)).toBe(10);
    expect(Number(afterRepeat.taxable_quantity_stock)).toBe(7);
    expect(Number(count)).toBe(2);
    expect(restoreStockToExistingBatch).toHaveBeenCalledTimes(2);
  });

  it('deducts invoice gift stock and persists its per-lot tax snapshot once', async () => {
    await databaseRunner.startTransaction();
    await databaseRunner.query(`
      INSERT INTO ${tables.products} VALUES (20, 10, 7, 100);
      INSERT INTO ${tables.batches} VALUES
        (150, 20, 250, 2, 2), (151, 20, 251, 2, 0);
      INSERT INTO ${tables.giftSnapshots} VALUES (7, NULL, NULL);
    `);

    const invoice = {
      id: 7,
      code: 'INV-GIFT-7',
      status: SalesInvoiceStatus.CONFIRMED,
      gift_product_id: 20,
      gift_quantity: 3,
    } as SalesInvoice;
    const transactionRepository = {
      findOne: jest.fn(async (options: {
        where: { reference_type: string; reference_id: number; type?: string };
      }) => {
        const params: unknown[] = [options.where.reference_type, options.where.reference_id];
        const typeFilter = options.where.type ? ' AND type=$3' : '';
        if (options.where.type) params.push(options.where.type);
        const [row] = await databaseRunner.query(
          `SELECT * FROM ${tables.transactions}
           WHERE reference_type=$1 AND reference_id=$2${typeFilter}
           ORDER BY id DESC LIMIT 1`,
          params,
        );
        return row ?? null;
      }),
    };
    const manager = {
      findOne: jest.fn(async (entity: Function) => entity === SalesInvoice ? invoice : null),
      getRepository: jest.fn(() => transactionRepository),
      update: jest.fn(async (entity: Function, id: number, values: Record<string, unknown>) => {
        if (entity === InventoryTransaction) {
          await databaseRunner.query(
            `UPDATE ${tables.transactions} SET notes=$1 WHERE id=$2`,
            [values.notes, id],
          );
          return;
        }
        if (entity === SalesInvoice) {
          await databaseRunner.query(
            `UPDATE ${tables.giftSnapshots}
             SET gift_inventory_transaction_id=$1,gift_stock_allocations=$2::jsonb
             WHERE invoice_id=$3`,
            [values.gift_inventory_transaction_id, JSON.stringify(values.gift_stock_allocations), id],
          );
          return;
        }
        throw new Error(`Unexpected update entity ${entity.name}`);
      }),
    };
    const queryRunner = { manager } as unknown as QueryRunner;
    const processStockOut = jest.fn(async () => {
      await databaseRunner.query(`
        UPDATE ${tables.batches}
        SET remaining_quantity=remaining_quantity-2,
            taxable_remaining_quantity=taxable_remaining_quantity-2
        WHERE id=150;
        UPDATE ${tables.batches} SET remaining_quantity=remaining_quantity-1 WHERE id=151;
        UPDATE ${tables.products}
        SET quantity=quantity-3,taxable_quantity_stock=taxable_quantity_stock-2
        WHERE id=20;
      `);
      const [transaction] = await databaseRunner.query(
        `INSERT INTO ${tables.transactions}
          (product_id,type,quantity,reference_type,reference_id,receipt_item_id,unit_cost_price,notes)
         VALUES (20,'OUT',-3,'INVOICE_GIFT',7,NULL,100,'taxable_quantity=2') RETURNING id`,
      );
      return {
        transaction: { id: Number(transaction.id) },
        taxableQuantity: 2,
        taxSellingPrice: 250,
        affectedBatches: [
          { batchId: 150, deductedQuantity: 2, taxableQuantity: 2 },
          { batchId: 151, deductedQuantity: 1, taxableQuantity: 0 },
        ],
      };
    });
    const service = Object.create(SalesService.prototype) as SalesService;
    Object.assign(service, {
      inventoryService: { processStockOut },
    });

    await (service as any).handleInvoiceGiftStockOut(invoice, 12, queryRunner);

    const batchRows = await databaseRunner.query(
      `SELECT id,remaining_quantity,taxable_remaining_quantity
       FROM ${tables.batches} WHERE product_id=20 ORDER BY id`,
    );
    const [product] = await databaseRunner.query(
      `SELECT quantity,taxable_quantity_stock FROM ${tables.products} WHERE id=20`,
    );
    const [giftSnapshot] = await databaseRunner.query(
      `SELECT gift_inventory_transaction_id,gift_stock_allocations
       FROM ${tables.giftSnapshots} WHERE invoice_id=7`,
    );
    const [transaction] = await databaseRunner.query(
      `SELECT notes FROM ${tables.transactions}
       WHERE reference_type='INVOICE_GIFT' AND reference_id=7`,
    );
    expect(batchRows.map((row: Record<string, unknown>) => [
      Number(row.id), Number(row.remaining_quantity), Number(row.taxable_remaining_quantity),
    ])).toEqual([[150, 0, 0], [151, 1, 0]]);
    expect(Number(product.quantity)).toBe(7);
    expect(Number(product.taxable_quantity_stock)).toBe(5);
    expect(Number(giftSnapshot.gift_inventory_transaction_id)).toBe(1);
    expect(giftSnapshot.gift_stock_allocations).toEqual([
      { batchId: 150, quantity: 2, taxableQuantity: 2 },
      { batchId: 151, quantity: 1, taxableQuantity: 0 },
    ]);
    expect(transaction.notes).toContain('taxable_quantity=2');
    expect(transaction.notes).toContain('tax_selling_price=250');

    await (service as any).handleInvoiceGiftStockOut(invoice, 12, queryRunner);

    const [{ count }] = await databaseRunner.query(
      `SELECT COUNT(*)::int AS count FROM ${tables.transactions}
       WHERE reference_type='INVOICE_GIFT' AND reference_id=7 AND type='OUT'`,
    );
    expect(Number(count)).toBe(1);
    expect(processStockOut).toHaveBeenCalledTimes(1);
  });

  it('rolls back invoice gift stock-out when its lot snapshot is incomplete', async () => {
    await databaseRunner.query(`
      INSERT INTO ${tables.products} VALUES (20, 10, 7, 100);
      INSERT INTO ${tables.batches} VALUES
        (150, 20, 250, 2, 2), (151, 20, 251, 2, 0);
      INSERT INTO ${tables.giftSnapshots} VALUES (7, NULL, NULL);
    `);
    await databaseRunner.startTransaction();

    const invoice = {
      id: 7,
      code: 'INV-GIFT-ROLLBACK-7',
      status: SalesInvoiceStatus.CONFIRMED,
      gift_product_id: 20,
      gift_quantity: 3,
    } as SalesInvoice;
    const transactionRepository = {
      findOne: jest.fn(async () => {
        const [row] = await databaseRunner.query(
          `SELECT * FROM ${tables.transactions}
           WHERE reference_type='INVOICE_GIFT' AND reference_id=7 LIMIT 1`,
        );
        return row ?? null;
      }),
    };
    const manager = {
      findOne: jest.fn(async (entity: Function) => entity === SalesInvoice ? invoice : null),
      getRepository: jest.fn(() => transactionRepository),
      update: jest.fn(),
    };
    const queryRunner = { manager } as unknown as QueryRunner;
    const processStockOut = jest.fn(async () => {
      await databaseRunner.query(`
        UPDATE ${tables.batches}
        SET remaining_quantity=remaining_quantity-2,
            taxable_remaining_quantity=taxable_remaining_quantity-2
        WHERE id=150;
        UPDATE ${tables.products}
        SET quantity=quantity-2,taxable_quantity_stock=taxable_quantity_stock-2
        WHERE id=20;
      `);
      const [transaction] = await databaseRunner.query(
        `INSERT INTO ${tables.transactions}
          (product_id,type,quantity,reference_type,reference_id,receipt_item_id,unit_cost_price,notes)
         VALUES (20,'OUT',-2,'INVOICE_GIFT',7,NULL,100,'taxable_quantity=2') RETURNING id`,
      );
      return {
        transaction: { id: Number(transaction.id) },
        taxableQuantity: 2,
        taxSellingPrice: 250,
        affectedBatches: [{ batchId: 150, deductedQuantity: 2, taxableQuantity: 2 }],
      };
    });
    const service = Object.create(SalesService.prototype) as SalesService;
    Object.assign(service, {
      inventoryService: { processStockOut },
    });

    await expect(
      (service as any).handleInvoiceGiftStockOut(invoice, 12, queryRunner),
    ).rejects.toThrow('giao dịch xuất kho không trả về snapshot hợp lệ');
    await databaseRunner.rollbackTransaction();

    const batchRows = await databaseRunner.query(
      `SELECT id,remaining_quantity,taxable_remaining_quantity
       FROM ${tables.batches} WHERE product_id=20 ORDER BY id`,
    );
    const [product] = await databaseRunner.query(
      `SELECT quantity,taxable_quantity_stock FROM ${tables.products} WHERE id=20`,
    );
    const [{ count }] = await databaseRunner.query(
      `SELECT COUNT(*)::int AS count FROM ${tables.transactions}
       WHERE reference_type='INVOICE_GIFT' AND reference_id=7`,
    );
    const [giftSnapshot] = await databaseRunner.query(
      `SELECT gift_inventory_transaction_id,gift_stock_allocations
       FROM ${tables.giftSnapshots} WHERE invoice_id=7`,
    );
    expect(batchRows.map((row: Record<string, unknown>) => [
      Number(row.id), Number(row.remaining_quantity), Number(row.taxable_remaining_quantity),
    ])).toEqual([[150, 2, 2], [151, 2, 0]]);
    expect(Number(product.quantity)).toBe(10);
    expect(Number(product.taxable_quantity_stock)).toBe(7);
    expect(Number(count)).toBe(0);
    expect(giftSnapshot.gift_inventory_transaction_id).toBeNull();
    expect(giftSnapshot.gift_stock_allocations).toBeNull();
    expect(manager.update).not.toHaveBeenCalled();
  });
});
