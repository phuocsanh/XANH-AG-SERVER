import { BadRequestException } from '@nestjs/common';
import { InventoryReceipt } from '../../entities/inventory-receipts.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import {
  InventoryBorrow,
  InventoryBorrowStatus,
} from '../../entities/inventory-borrows.entity';
import { InventoryBorrowItem } from '../../entities/inventory-borrow-items.entity';
import { InventoryBatch } from '../../entities/inventories.entity';
import { Product } from '../../entities/products.entity';
import { SalesInvoice, SalesInvoiceStatus } from '../../entities/sales-invoices.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';
import { SalesReturn, SalesReturnStatus } from '../../entities/sales-return.entity';
import { InventoryTransaction } from '../../entities/inventory-transactions.entity';
import { InventoryService } from './inventory.service';
import { ReceiptStatus } from './enums/receipt-status.enum';

type SetupOptions = {
  initialStatus?: ReceiptStatus;
  lockedStatus?: ReceiptStatus;
  plan?: {
    batch_id: number;
    new_batch_tax: number;
    new_product_tax: number;
  } | null;
};

function setup(options: SetupOptions = {}) {
  const initialStatus = options.initialStatus ?? ReceiptStatus.APPROVED;
  const item = Object.assign(new InventoryReceiptItem(), {
    id: 11,
    receipt_id: 7,
    product_id: 3,
    quantity: 10,
    taxable_quantity: 2,
    tax_selling_price: 25,
    receipt: { id: 7, status: initialStatus, code: 'R-7' },
  });
  const receipt = { id: 7, status: options.lockedStatus ?? initialStatus };
  const product = Object.assign(new Product(), {
    id: 3,
    quantity: 10,
    taxable_quantity_stock: 2,
  });
  const batch = Object.assign(new InventoryBatch(), {
    id: 19,
    receipt_item_id: 11,
    remaining_quantity: 10,
    taxable_remaining_quantity: 2,
  });
  const queryRunner = {
    isTransactionActive: false,
    manager: {
      find: jest.fn(async (entity: Function) => entity === InventoryReceiptItem ? [item] : []),
      findOne: jest.fn(async (entity: Function) => {
        if (entity === InventoryReceipt) return receipt;
        if (entity === Product) return product;
        if (entity === InventoryReceiptItem) return item;
        return null;
      }),
      query: jest.fn(async (_sql: string, parameters: unknown[]) => {
        if (parameters.length === 1) return [];
        return options.plan === null
          ? []
          : [
              options.plan ?? {
                batch_id: 19,
                new_batch_tax: 5,
                new_product_tax: 5,
              },
            ];
      }),
      update: jest.fn(async (entity: Function, id: number, values: object) => {
        if (entity === InventoryReceiptItem && id === item.id)
          Object.assign(item, values);
        return undefined;
      }),
    },
    connect: jest.fn(async () => undefined),
    startTransaction: jest.fn(async () => {
      queryRunner.isTransactionActive = true;
    }),
    commitTransaction: jest.fn(async () => {
      queryRunner.isTransactionActive = false;
    }),
    rollbackTransaction: jest.fn(async () => {
      queryRunner.isTransactionActive = false;
    }),
    release: jest.fn(async () => undefined),
  };
  const createQueryRunner = jest.fn(() => queryRunner);
  const receiptItemRepository = {
    findOne: jest.fn(async () => item),
    update: jest.fn(async () => undefined),
  };
  const service = Object.create(InventoryService.prototype) as InventoryService;
  Object.assign(service, {
    inventoryReceiptItemRepository: receiptItemRepository,
    inventoryReceiptRepository: {
      manager: { connection: { createQueryRunner } },
    },
    inventoryReceiptLogRepository: { save: jest.fn(async (value) => value) },
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
  });
  const logChanges = jest
    .spyOn(service as any, 'logReceiptItemChanges')
    .mockResolvedValue(undefined);
  const recalculateVat = jest
    .spyOn(service as any, 'recalculateAverageVatInputCost')
    .mockResolvedValue(0);

  return {
    service,
    item,
    receipt,
    product,
    batch,
    queryRunner,
    createQueryRunner,
    receiptItemRepository,
    logChanges,
    recalculateVat,
  };
}

describe('InventoryService.updateReceiptItem tax edits', () => {
  it('updates approved item, batch, and product in the same runner and recalculates VAT history', async () => {
    const h = setup();
    await h.service.updateReceiptItem(11, { taxable_quantity: 5 }, 42);

    expect(
      h.queryRunner.manager.findOne.mock.calls.map(([entity]) => entity),
    ).toEqual([
      InventoryReceipt,
      Product,
      InventoryReceiptItem,
      InventoryReceiptItem,
    ]);
    expect(h.queryRunner.manager.update).toHaveBeenNthCalledWith(
      1,
      InventoryBatch,
      19,
      { taxable_remaining_quantity: 5 },
    );
    expect(h.queryRunner.manager.update).toHaveBeenNthCalledWith(
      2,
      Product,
      3,
      { taxable_quantity_stock: 5 },
    );
    expect(h.queryRunner.manager.update).toHaveBeenNthCalledWith(
      3,
      InventoryReceiptItem,
      11,
      { taxable_quantity: 5 },
    );
    expect(h.logChanges).toHaveBeenCalledWith(
      h.item,
      { taxable_quantity: 5 },
      42,
      h.queryRunner,
    );
    expect(h.recalculateVat).toHaveBeenCalledWith(3, h.queryRunner);
    expect(h.queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('applies converted base-unit tax values once when editing a fertilizer receipt', async () => {
    const h = setup({
      plan: { batch_id: 19, new_batch_tax: 400, new_product_tax: 400 },
    });
    h.item.quantity = 10;
    h.item.taxable_quantity = 6;
    h.item.conversion_factor = 50;
    h.item.base_quantity = 500;
    h.product.quantity = 500;
    h.product.taxable_quantity_stock = 300;
    h.batch.remaining_quantity = 500;
    h.batch.taxable_remaining_quantity = 300;

    await h.service.updateReceiptItem(11, { taxable_quantity: 8 }, 42);

    expect(h.queryRunner.manager.query).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      [11, 8],
    );
    expect(h.queryRunner.manager.update).toHaveBeenNthCalledWith(
      1,
      InventoryBatch,
      19,
      { taxable_remaining_quantity: 400 },
    );
    expect(h.queryRunner.manager.update).toHaveBeenNthCalledWith(
      2,
      Product,
      3,
      { taxable_quantity_stock: 400 },
    );
    expect(h.queryRunner.manager.update).toHaveBeenNthCalledWith(
      3,
      InventoryReceiptItem,
      11,
      { taxable_quantity: 8 },
    );
  });

  it('allows an unchanged tax value with existing stock history while updating notes', async () => {
    const h = setup();
    await h.service.updateReceiptItem(
      11,
      { taxable_quantity: 2, notes: 'reviewed' } as never,
      42,
    );

    expect(h.queryRunner.manager.query).not.toHaveBeenCalled();
    expect(h.queryRunner.manager.update).toHaveBeenCalledWith(
      InventoryReceiptItem,
      11,
      { taxable_quantity: 2, notes: 'reviewed' },
    );
    expect(h.logChanges).toHaveBeenCalled();
    expect(h.recalculateVat).toHaveBeenCalledWith(3, h.queryRunner);
  });

  it('rejects an invalid requested tax before starting a transaction', async () => {
    const h = setup();
    await expect(
      h.service.updateReceiptItem(11, { taxable_quantity: -1 }, 42),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.createQueryRunner).not.toHaveBeenCalled();
    expect(h.queryRunner.manager.update).not.toHaveBeenCalled();
  });

  it('rejects a used or unproven lot without writing records', async () => {
    const h = setup({ plan: null });
    const backfill = jest.spyOn(h.service as any, 'backfillSoldReceiptTax')
      .mockRejectedValue(new BadRequestException('Không đủ dữ liệu nguồn lô.'));
    await expect(
      h.service.updateReceiptItem(11, { taxable_quantity: 5 }, 42),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(backfill).toHaveBeenCalledWith(h.item, 5, h.queryRunner);
    expect(h.queryRunner.manager.update).not.toHaveBeenCalled();
    expect(h.queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(h.queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('updates only the receipt item for a draft receipt', async () => {
    const h = setup({ initialStatus: ReceiptStatus.DRAFT });
    await h.service.updateReceiptItem(11, { taxable_quantity: 5 }, 42);

    expect(
      h.queryRunner.manager.findOne.mock.calls.map(([entity]) => entity),
    ).toEqual([InventoryReceipt, InventoryReceiptItem, InventoryReceiptItem]);
    expect(h.queryRunner.manager.query).not.toHaveBeenCalled();
    expect(h.queryRunner.manager.update).toHaveBeenCalledTimes(1);
    expect(h.queryRunner.manager.update).toHaveBeenCalledWith(
      InventoryReceiptItem,
      11,
      { taxable_quantity: 5 },
    );
    expect(h.recalculateVat).not.toHaveBeenCalled();
  });

  it('đồng bộ GBKT hóa đơn cũ cùng giao dịch khi chỉ sửa giá khai thuế', async () => {
    const h = setup();
    const sync = jest.spyOn(h.service as any, 'syncSoldInvoiceTaxSnapshotsForReceiptItem')
      .mockResolvedValue(undefined);
    await h.service.updateReceiptItem(11, { tax_selling_price: 30 }, 42);

    expect(h.createQueryRunner).toHaveBeenCalledTimes(1);
    expect(h.queryRunner.manager.update).toHaveBeenCalledWith(InventoryReceiptItem, 11, {
      tax_selling_price: 30,
    });
    expect(sync).toHaveBeenCalledWith(11, h.queryRunner);
    expect(h.queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(h.recalculateVat).not.toHaveBeenCalled();
  });

  it('rollback cả giá phiếu nhập khi snapshot hóa đơn không đối soát được', async () => {
    const h = setup();
    jest.spyOn(h.service as any, 'syncSoldInvoiceTaxSnapshotsForReceiptItem')
      .mockRejectedValue(new BadRequestException('Phân bổ lô không khớp.'));
    await expect(h.service.updateReceiptItem(11, { tax_selling_price: 30 }, 42))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(h.queryRunner.manager.update).toHaveBeenCalledWith(InventoryReceiptItem, 11, { tax_selling_price: 30 });
    expect(h.queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it.each([ReceiptStatus.CANCELLED, ReceiptStatus.DRAFT])(
    'rejects a receipt whose locked status changed to %s',
    async (lockedStatus) => {
      const h = setup({ lockedStatus });
      await expect(
        h.service.updateReceiptItem(11, { taxable_quantity: 5 }, 42),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(h.queryRunner.manager.update).not.toHaveBeenCalled();
      expect(h.queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    },
  );

  it('rolls back earlier batch and product writes when a later operation fails', async () => {
    const h = setup();
    h.queryRunner.manager.update.mockImplementation(
      async (entity: Function) => {
        if (entity === InventoryReceiptItem)
          throw new Error('item update failed');
        return undefined;
      },
    );

    await expect(
      h.service.updateReceiptItem(11, { taxable_quantity: 5 }, 42),
    ).rejects.toThrow('item update failed');

    expect(h.queryRunner.manager.update).toHaveBeenCalledTimes(3);
    expect(h.queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(h.queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.queryRunner.release).toHaveBeenCalledTimes(1);
  });
});

describe('InventoryService đồng bộ thuế phiếu nhập đã bán và trả', () => {
  it('tính GBKT bình quân theo lượng thuế của mọi lô trong cùng dòng bán', async () => {
    const salesItem = Object.assign(new SalesInvoiceItem(), {
      id: 51, invoice_id: 41, product_id: 3, quantity: 10,
      base_quantity: 10, conversion_factor: 1, taxable_quantity: 5,
    });
    const invoice = Object.assign(new SalesInvoice(), { id: 41, status: SalesInvoiceStatus.PAID });
    const product = Object.assign(new Product(), { id: 3, tax_selling_price: '50' });
    const allocations = [
      { id: 1, invoice_id: 41, sales_invoice_item_id: 51, product_id: 3,
        receipt_item_id: 11, quantity: 6, taxable_quantity: 3,
        receipt_item: { id: 11, product_id: 3, tax_selling_price: 200, conversion_factor: 1 } },
      { id: 2, invoice_id: 41, sales_invoice_item_id: 51, product_id: 3,
        receipt_item_id: 12, quantity: 4, taxable_quantity: 2,
        receipt_item: { id: 12, product_id: 3, tax_selling_price: 100, conversion_factor: 1 } },
    ];
    const manager = {
      find: jest.fn(async (_entity: Function, options: { where: Record<string, number> }) =>
        options.where.receipt_item_id ? [allocations[0]] : allocations),
      findOne: jest.fn(async (entity: Function) => {
        if (entity === SalesInvoiceItem) return salesItem;
        if (entity === SalesInvoice) return invoice;
        if (entity === Product) return product;
        return null;
      }),
      update: jest.fn(),
    };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    await (service as any).syncSoldInvoiceTaxSnapshotsForReceiptItem(11, { manager }, false);
    expect(manager.update).toHaveBeenCalledWith(SalesInvoiceItem, 51, { tax_selling_price: '160' });
    await (service as any).syncSoldInvoiceTaxSnapshotsForReceiptItem(11, { manager }, true);
    expect(manager.update).toHaveBeenLastCalledWith(SalesInvoiceItem, 51, {
      taxable_quantity: 5, tax_selling_price: '160',
    });
    invoice.status = SalesInvoiceStatus.REFUNDED;
    manager.update.mockClear();
    await (service as any).syncSoldInvoiceTaxSnapshotsForReceiptItem(11, { manager }, true);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it.each([false, true])('cập nhật bán/trả và tồn thuế cùng giao dịch, lô hoàn mới=%s', async (newReturnBatch) => {
    const receipt = { id: 7, status: ReceiptStatus.APPROVED, code: 'R-7' };
    const item = Object.assign(new InventoryReceiptItem(), {
      id: 11, receipt_id: 7, product_id: 3, quantity: 100,
      taxable_quantity: 0, tax_selling_price: 200, conversion_factor: 1,
      batch_number: 'LOT-7', receipt,
    });
    const product = Object.assign(new Product(), {
      id: 3, quantity: 80, taxable_quantity_stock: 0, tax_selling_price: '100',
    });
    const batch = Object.assign(new InventoryBatch(), {
      id: 19, receipt_item_id: 11, product_id: 3, code: 'LOT-7',
      original_quantity: 100, remaining_quantity: newReturnBatch ? 70 : 80, taxable_remaining_quantity: 0,
    });
    const returnBatch = newReturnBatch ? Object.assign(new InventoryBatch(), {
      id: 20, receipt_item_id: 11, product_id: 3, code: 'RETURN-R-61',
      original_quantity: 10, remaining_quantity: 10, taxable_remaining_quantity: 0,
    }) : null;
    const invoice = Object.assign(new SalesInvoice(), { id: 41, status: SalesInvoiceStatus.CONFIRMED });
    const salesItem = Object.assign(new SalesInvoiceItem(), {
      id: 51, invoice_id: 41, product_id: 3, quantity: 30,
      base_quantity: 30, conversion_factor: 1, taxable_quantity: 0, tax_selling_price: '0',
    });
    const allocation = Object.assign(new SalesInvoiceItemStockAllocation(), {
      id: 31, invoice_id: 41, sales_invoice_item_id: 51, product_id: 3,
      inventory_batch_id: 19, receipt_item_id: 11, quantity: 30, taxable_quantity: 0,
      created_at: new Date('2026-10-01T00:00:00Z'), receipt_item: item,
      inventory_batch: batch,
    });
    const returned = Object.assign(new SalesReturn(), {
      id: 61, invoice_id: 41, status: SalesReturnStatus.APPROVED,
      created_at: new Date('2026-10-02T00:00:00Z'),
      items: [{ id: 71, product_id: 3, sales_invoice_item_id: 51,
        stock_allocations: [{ batchId: newReturnBatch ? 20 : 19, sourceBatchId: 19, sourceReceiptItemId: 11,
          quantity: 10, taxableQuantity: 0 }] }],
    });
    const manager = {
      findOne: jest.fn(async (entity: Function) => {
        if (entity === InventoryReceipt) return receipt;
        if (entity === InventoryReceiptItem) return item;
        if (entity === Product) return product;
        if (entity === SalesInvoice) return invoice;
        if (entity === SalesInvoiceItem) return salesItem;
        return null;
      }),
      find: jest.fn(async (entity: Function) => {
        if (entity === InventoryReceiptItem) return [item];
        if (entity === InventoryBatch) return returnBatch ? [batch, returnBatch] : [batch];
        if (entity === SalesInvoiceItemStockAllocation) return [allocation];
        if (entity === SalesInvoiceItem) return [salesItem];
        if (entity === SalesInvoice) return [invoice];
        if (entity === SalesReturn) return [returned];
        if (entity === InventoryTransaction) return [{ id: 2, quantity: -30 }];
        return [];
      }),
      query: jest.fn(async (sql: string, parameters: unknown[]) => {
        if (parameters.length === 4 && sql.includes('reference_type=\'STOCK_IN\'')) return [{ id: 1 }];
        if (parameters.length === 1) return [];
        return [];
      }),
      update: jest.fn(async (entity: Function, id: number, values: Record<string, unknown>) => {
        if (entity === InventoryReceiptItem) Object.assign(item, values);
        if (entity === InventoryBatch) Object.assign(id === 19 ? batch : returnBatch!, values);
        if (entity === Product) Object.assign(product, values);
        if (entity === SalesInvoiceItemStockAllocation) Object.assign(allocation, values);
        if (entity === SalesInvoiceItem) Object.assign(salesItem, values);
      }),
    };
    const runner = {
      manager, isTransactionActive: false,
      connect: jest.fn(),
      startTransaction: jest.fn(async () => { runner.isTransactionActive = true; }),
      commitTransaction: jest.fn(async () => { runner.isTransactionActive = false; }),
      rollbackTransaction: jest.fn(async () => { runner.isTransactionActive = false; }),
      release: jest.fn(),
    };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, {
      inventoryReceiptItemRepository: { findOne: jest.fn(async () => item) },
      inventoryReceiptRepository: { manager: { connection: { createQueryRunner: () => runner } } },
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });
    jest.spyOn(service as any, 'logReceiptItemChanges').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'recalculateAverageVatInputCost').mockResolvedValue(0);

    await service.updateReceiptItem(11, { taxable_quantity: 100 }, 42);

    expect(allocation.taxable_quantity).toBe(30);
    expect(returned.items![0]!.stock_allocations![0]!.taxableQuantity).toBe(10);
    expect(batch.taxable_remaining_quantity).toBe(newReturnBatch ? 70 : 80);
    if (returnBatch) expect(returnBatch.taxable_remaining_quantity).toBe(10);
    expect(product.taxable_quantity_stock).toBe(80);
    expect(salesItem.taxable_quantity).toBe(30);
    expect(salesItem.tax_selling_price).toBe('200');
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('InventoryService return stock lock order', () => {
  function setupRestore() {
    const product = Object.assign(new Product(), {
      id: 3,
      quantity: 4,
      taxable_quantity_stock: 1,
    });
    const batch = Object.assign(new InventoryBatch(), {
      id: 19,
      product_id: 3,
      receipt_item_id: null,
      quantity: 4,
      remaining_quantity: 2,
      taxable_remaining_quantity: 0,
      unit_cost_price: '10',
    });
    const manager = {
      findOne: jest.fn(async (entity: Function) =>
        entity === Product ? product : entity === InventoryBatch ? batch : null,
      ),
      save: jest.fn(async (value) => value),
      update: jest.fn(async () => undefined),
    };
    const runner = { manager } as never;
    const service = Object.create(InventoryService.prototype) as InventoryService;
    jest.spyOn(service as any, 'getWeightedAverageCost').mockResolvedValue(10);
    jest.spyOn(service as any, 'createTransaction').mockResolvedValue(undefined);
    return { service, manager, runner };
  }

  it('locks product before batch when cancelling a customer return', async () => {
    const h = setupRestore();
    await (h.service as any).restoreStockToExistingBatch(
      3,
      19,
      1,
      0,
      42,
      8,
      'RET-8',
      h.runner,
    );

    expect(h.manager.findOne.mock.calls.map(([entity]) => entity)).toEqual([
      Product,
      InventoryBatch,
    ]);
  });

  it('locks product before batch when returning borrowed stock', async () => {
    const h = setupRestore();
    await (h.service as any).restoreBorrowItemStock(
      { id: 8, code: 'BOR-8' },
      {
        id: 12,
        batch_id: 19,
        product_id: 3,
        quantity: 1,
        taxable_quantity: 0,
      },
      1,
      42,
      'BORROW_RETURN',
      'return',
      h.runner,
      0,
    );

    expect(h.manager.findOne.mock.calls.map(([entity]) => entity)).toEqual([
      Product,
      InventoryBatch,
    ]);
  });

  it('locks product before batch when cancelling a borrow', async () => {
    const borrow = Object.assign(new InventoryBorrow(), {
      id: 8,
      code: 'BOR-8',
      status: InventoryBorrowStatus.APPROVED,
    });
    const item = Object.assign(new InventoryBorrowItem(), {
      id: 12,
      product_id: 3,
      batch_id: 19,
      quantity: 1,
      taxable_quantity: 1,
      returned_quantity: 0,
      converted_to_sale_quantity: 0,
    });
    const { service, manager } = setupRestore();
    manager.findOne.mockImplementation(async (entity: Function): Promise<any> =>
      entity === InventoryBorrow
        ? borrow
        : entity === Product
          ? Object.assign(new Product(), { id: 3, quantity: 4, taxable_quantity_stock: 1 })
          : entity === InventoryBatch
            ? Object.assign(new InventoryBatch(), {
                id: 19,
                product_id: 3,
                receipt_item_id: null,
                remaining_quantity: 2,
                taxable_remaining_quantity: 0,
                unit_cost_price: '10',
              })
            : null,
    );
    jest
      .spyOn(service as any, 'getWeightedAverageCost')
      .mockResolvedValue(10);
    jest
      .spyOn(service as any, 'createTransaction')
      .mockResolvedValue(undefined);
    jest.spyOn(service, 'findBorrowById').mockResolvedValue(borrow);
    const queryRunner = {
      manager: {
        ...manager,
        find: jest.fn(async () => [item]),
      },
      connect: jest.fn(async () => undefined),
      startTransaction: jest.fn(async () => undefined),
      commitTransaction: jest.fn(async () => undefined),
      rollbackTransaction: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
    };
    (service as any).inventoryBorrowRepository = {
      manager: { connection: { createQueryRunner: () => queryRunner } },
    };

    await service.cancelBorrow(8, 42);

    expect(manager.findOne.mock.calls.map(([entity]) => entity)).toEqual([
      InventoryBorrow,
      Product,
      InventoryBatch,
    ]);
    expect(queryRunner.manager.update).toHaveBeenCalledWith(
      Product,
      3,
      { quantity: 5, taxable_quantity_stock: 2 },
    );
  });
});
