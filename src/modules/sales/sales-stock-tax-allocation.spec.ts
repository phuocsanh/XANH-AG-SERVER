import { QueryRunner } from 'typeorm';
import { ProductCostingMethod } from '../../entities/products.entity';
import { ProductType } from '../../entities/product-types.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';
import { StoreProfitReportService } from '../store-profit-report/store-profit-report.service';
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

describe('SalesService giá vốn theo nhiều lô', () => {
  it('cộng chính xác giá từng lô thay vì nhân giá bình quân đã làm tròn', async () => {
    const item = Object.assign(new SalesInvoiceItem(), {
      id: 18,
      product_id: 10,
      quantity: 3,
      base_quantity: 3,
      cost_price: 90,
      costing_method_snapshot: ProductCostingMethod.BY_BATCH,
    });
    const invoice = Object.assign(new SalesInvoice(), {
      id: 7,
      code: 'INV-7',
      final_amount: 500,
      items: [item],
    });
    const allocations = [
      { inventory_batch_id: 101, quantity: 2, unit_cost: 100, total_cost: 200 },
      { inventory_batch_id: 102, quantity: 1, unit_cost: 120, total_cost: 120 },
    ];
    const manager = {
      find: jest.fn().mockResolvedValue(allocations),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = Object.create(SalesService.prototype) as SalesService;
    jest.spyOn(service, 'findOne').mockResolvedValue(invoice);

    await (service as any).syncPostedInvoiceCostSnapshot(7, {
      manager,
    } as unknown as QueryRunner);

    expect(manager.update).toHaveBeenCalledWith(SalesInvoiceItem, 18, {
      cost_price: 106.67,
    });
    expect(manager.update).toHaveBeenCalledWith(SalesInvoice, 7, {
      cost_of_goods_sold: 320,
      gross_profit: 180,
      gross_profit_margin: 36,
    });
  });

  it('chặn chốt giá vốn khi thiếu một phần phân bổ lô', async () => {
    const invoice = Object.assign(new SalesInvoice(), {
      id: 7,
      code: 'INV-7',
      items: [Object.assign(new SalesInvoiceItem(), {
        id: 18,
        quantity: 3,
        base_quantity: 3,
        costing_method_snapshot: ProductCostingMethod.BY_BATCH,
      })],
    });
    const manager = {
      find: jest.fn().mockResolvedValue([
        { inventory_batch_id: 101, quantity: 2, unit_cost: 100, total_cost: 200 },
      ]),
      update: jest.fn(),
    };
    const service = Object.create(SalesService.prototype) as SalesService;
    jest.spyOn(service, 'findOne').mockResolvedValue(invoice);

    await expect((service as any).syncPostedInvoiceCostSnapshot(7, {
      manager,
    } as unknown as QueryRunner)).rejects.toThrow('thiếu phân bổ lô hợp lệ');
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('hủy hóa đơn hoàn đúng hai lô và giữ lịch sử phân bổ', async () => {
    const item = Object.assign(new SalesInvoiceItem(), {
      id: 18, invoice_id: 7, product_id: 10, quantity: 3,
      base_quantity: 3, conversion_factor: 1, taxable_quantity: 0,
      costing_method_snapshot: ProductCostingMethod.BY_BATCH,
    });
    const invoice = Object.assign(new SalesInvoice(), {
      id: 7, code: 'INV-7', created_by: 3, items: [item],
    });
    const allocations = [
      Object.assign(new SalesInvoiceItemStockAllocation(), {
        id: 1, invoice_id: 7, sales_invoice_item_id: 18, product_id: 10,
        inventory_batch_id: 101, quantity: 2, taxable_quantity: 0,
        unit_cost: 100, total_cost: 200,
      }),
      Object.assign(new SalesInvoiceItemStockAllocation(), {
        id: 2, invoice_id: 7, sales_invoice_item_id: 18, product_id: 10,
        inventory_batch_id: 102, quantity: 1, taxable_quantity: 0,
        unit_cost: 120, total_cost: 120,
      }),
    ];
    const batches = new Map([
      [101, Object.assign(new InventoryBatch(), {
        id: 101, product_id: 10, remaining_quantity: 0,
        taxable_remaining_quantity: 0,
      })],
      [102, Object.assign(new InventoryBatch(), {
        id: 102, product_id: 10, remaining_quantity: 0,
        taxable_remaining_quantity: 0,
      })],
    ]);
    const product = { id: 10, quantity: 0, taxable_quantity_stock: 0 };
    const transRepo = {
      manager: null as unknown,
      find: jest.fn().mockResolvedValue([{ id: 8, product_id: 10 }]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    const returnQuery = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(transRepo),
      createQueryBuilder: jest.fn().mockReturnValue(returnQuery),
      find: jest.fn().mockResolvedValue(allocations),
      findOne: jest.fn(async (entity: Function, options: { where: { id: number } }) => {
        if (entity === SalesInvoice) return invoice;
        if (entity === InventoryBatch) return batches.get(options.where.id);
        return product;
      }),
      save: jest.fn().mockImplementation(async (value) => value),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn(),
    };
    transRepo.manager = manager;
    const service = Object.create(SalesService.prototype) as SalesService;
    Object.assign(service, {
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      inventoryService: {
        removeSupplierSettlementForInvoice: jest.fn(),
        createTransaction: jest.fn().mockResolvedValue({ id: 20 }),
      },
    });
    jest.spyOn(service, 'findOne').mockResolvedValue(invoice);

    await service.handleInventoryRestoration(7, 3, { manager } as unknown as QueryRunner);

    expect(batches.get(101)?.remaining_quantity).toBe(2);
    expect(batches.get(102)?.remaining_quantity).toBe(1);
    expect(manager.delete).not.toHaveBeenCalled();
    expect(service['inventoryService'].createTransaction).toHaveBeenCalledTimes(2);
  });
});

describe('Báo cáo lợi nhuận theo giá vốn lô', () => {
  it('trừ giá vốn của đúng lô khách đã trả', async () => {
    const returnQuery = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{
        id: 4, sales_invoice_item_id: 18, base_quantity: 1,
        stock_allocations: [{ sourceBatchId: 101, quantity: 1 }],
      }]),
    };
    const manager = {
      getRepository: jest.fn((entity: Function) => {
        if (entity === ProductType) return { find: jest.fn().mockResolvedValue([{ id: 1, name: 'Thuốc' }]) };
        if (entity === SalesReturnItem) return { createQueryBuilder: jest.fn().mockReturnValue(returnQuery) };
        if (entity === SalesInvoiceItemStockAllocation) return { find: jest.fn().mockResolvedValue([
          { sales_invoice_item_id: 18, inventory_batch_id: 101, quantity: 2, unit_cost: 100, total_cost: 200 },
          { sales_invoice_item_id: 18, inventory_batch_id: 102, quantity: 1, unit_cost: 120, total_cost: 120 },
        ]) };
        throw new Error('Repository không được hỗ trợ');
      }),
    };
    const service = Object.create(StoreProfitReportService.prototype) as StoreProfitReportService;
    const invoice = {
      id: 7, code: 'INV-7', final_amount: 400, discount_amount: 0, gift_value: 10, cost_of_goods_sold: 999,
      status: SalesInvoiceStatus.CONFIRMED,
      items: [{
        id: 18, product_id: 10, product: { type: 1 }, quantity: 3,
        base_quantity: 3, total_price: 500, cost_price: 106.67,
        costing_method_snapshot: ProductCostingMethod.BY_BATCH,
      }],
    };
    Object.assign(service, {
      logger: { log: jest.fn(), error: jest.fn() },
      deliveryLogRepository: { findOne: jest.fn().mockResolvedValue({ total_cost: 25 }), find: jest.fn().mockResolvedValue([]) },
      farmServiceCostRepository: { find: jest.fn().mockResolvedValue([]) },
      operatingCostRepository: { find: jest.fn().mockResolvedValue([]) },
      getFarmGiftCostsBasic: jest.fn().mockResolvedValue([]),
      seasonRepository: { findOne: jest.fn().mockResolvedValue({ id: 1, name: 'Vụ 1' }) },
      salesInvoiceRepository: {
        manager,
        find: jest.fn().mockResolvedValue([invoice]),
        findOne: jest.fn().mockResolvedValue(invoice),
      },
      getApprovedReturnStats: jest.fn().mockResolvedValue(new Map([
        ['7:item:18', { returnedQuantity: 1, returnedBaseQuantity: 1, returnedAmount: 100 }],
      ])),
    });

    const report = await service.getProductTypesSeasonProfit(1, [1]);

    expect(report.revenue).toBe(400);
    expect(report.cost_of_goods_sold).toBe(220);
    expect(report.gross_profit).toBe(180);
    const invoiceReport = await service.calculateInvoiceProfit(7);
    expect(invoiceReport.cost_of_goods_sold).toBe(220);
    expect(invoiceReport.gross_profit).toBe(180);
    expect(invoiceReport.net_profit).toBe(145);
    const fieldReport = await service.getRiceCropProfitReport(1);
    expect(fieldReport.summary.cost_of_goods_sold).toBe(220);
    invoice.status = SalesInvoiceStatus.CANCELLED;
    await expect(service.calculateInvoiceProfit(7)).rejects.toThrow('Chỉ hóa đơn đã xác nhận');
  });
});
