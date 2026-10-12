import { BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SalesReturnService } from './sales-return.service';
import { SalesReturn, SalesReturnStatus } from '../../entities/sales-return.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';
import { SalesInvoice, SalesInvoiceStatus } from '../../entities/sales-invoices.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';
import { InventoryService } from '../inventory/inventory.service';
import { CustomerRewardService } from '../customer-reward/customer-reward.service';
import { PromotionCampaignService } from '../promotion-campaign/promotion-campaign.service';
import { CreateSalesReturnDto } from './dto/create-sales-return.dto';

jest.mock('../inventory/inventory.service', () => ({ InventoryService: class {} }));
jest.mock('../customer-reward/customer-reward.service', () => ({ CustomerRewardService: class {} }));
jest.mock('../promotion-campaign/promotion-campaign.service', () => ({ PromotionCampaignService: class {} }));

function setup(overrides: Partial<SalesInvoiceItem> = {}) {
  const invoiceItem = Object.assign(new SalesInvoiceItem(), {
    id: 11, product_id: 7, quantity: 10, conversion_factor: 10,
    base_quantity: 100, taxable_quantity: 0, cost_price: 2,
    unit_price: 100, total_price: 1000,
  }, overrides);
  const invoice = Object.assign(new SalesInvoice(), {
    id: 1, code: 'INV-1', status: SalesInvoiceStatus.CONFIRMED,
    payment_method: 'debt', total_amount: 1000, final_amount: 1000,
    remaining_amount: 1000, partial_payment_amount: 0,
    cost_of_goods_sold: 200, discount_amount: 0, items: [invoiceItem],
  });
  const returns: SalesReturn[] = [];
  const allocations: SalesInvoiceItemStockAllocation[] = [];
  const events: string[] = [];
  const manager = {
    findOne: jest.fn(async (entity: unknown, options: {
      where: { id: number }; lock?: unknown; relations?: string[];
    }) => {
      events.push(`${entity === SalesInvoice ? 'invoice' : 'return'}:${options.lock ? 'lock' : options.relations ? 'relations' : 'read'}`);
      if (entity === SalesInvoice) return invoice;
      return returns.find((item) => item.id === options.where.id) || null;
    }),
    find: jest.fn(async () => allocations),
    save: jest.fn(async (entity: SalesReturn | SalesInvoice) => {
      if (entity instanceof SalesReturn && !entity.id) {
        entity.id = returns.length + 1;
        returns.push(entity);
      }
      return entity;
    }),
    createQueryBuilder: jest.fn(() => {
      let invoiceItemId = 0;
      const query = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn((_sql: string, params: { invoiceItemId?: number }) => {
          if (params.invoiceItemId) invoiceItemId = params.invoiceItemId;
          return query;
        }),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(async () => ({ total: returns
          .filter((item) => item.status === SalesReturnStatus.APPROVED)
          .flatMap((item) => item.items || [])
          .filter((item) => item.sales_invoice_item_id === invoiceItemId)
          .reduce((sum, item) => sum + Number(item.base_quantity ??
            item.quantity * Number(item.conversion_factor ?? 1)), 0),
        })),
      };
      return query;
    }),
  };
  const runner = {
    manager, connect: jest.fn(), startTransaction: jest.fn(),
    commitTransaction: jest.fn(), rollbackTransaction: jest.fn(), release: jest.fn(),
  };
  let nextBatchId = 100;
  const inventory = {
    processStockIn: jest.fn(async (..._args: unknown[]) => ({ batch: { id: nextBatchId++ } })),
    processStockOut: jest.fn(),
    createSupplierSettlementReturnEntries: jest.fn(),
    removeSupplierSettlementForSalesReturn: jest.fn(),
  };
  const promotion = {
    processSalesReturnReversal: jest.fn(),
    processSalesReturnCancellationRestore: jest.fn(),
  };
  const service = new SalesReturnService(
    { create: (data: Partial<SalesReturn>) => Object.assign(new SalesReturn(), data) } as Repository<SalesReturn>,
    { create: (data: Partial<SalesReturnItem>) => Object.assign(new SalesReturnItem(), data) } as Repository<SalesReturnItem>,
    { createQueryRunner: () => runner } as unknown as DataSource,
    {} as CustomerRewardService,
    inventory as unknown as InventoryService,
    promotion as unknown as PromotionCampaignService,
  );
  const request = (quantity: number): CreateSalesReturnDto => ({
    invoice_id: 1,
    items: [{ sales_invoice_item_id: 11, product_id: 7, quantity, unit_price: 100 }],
  });
  return { service, invoice, invoiceItem, returns, allocations, events, manager, runner, inventory, request };
}

describe('SalesReturnService stock restoration', () => {
  it('locks the invoice without joins before loading relations', async () => {
    const ctx = setup();
    await ctx.service.create(ctx.request(1), 1);
    expect(ctx.events.slice(0, 2)).toEqual(['invoice:lock', 'invoice:relations']);
    expect(ctx.manager.findOne).toHaveBeenNthCalledWith(1, SalesInvoice, {
      where: { id: 1 }, lock: { mode: 'pessimistic_write' },
    });
  });

  it.each([
    [1, 40, 10, 4],
    [50, 2, 1, 50],
    [0.5, 40, 10, 2],
  ])('restores tax from source allocation snapshots with factor %s', async (factor, quantity, returned, _expectedTax) => {
    const ctx = setup({ conversion_factor: factor, quantity,
      base_quantity: quantity * factor, taxable_quantity: factor === 50 ? 1 : 4 });
    ctx.allocations.push(Object.assign(new SalesInvoiceItemStockAllocation(), {
      id: 1,
      quantity: ctx.invoiceItem.base_quantity,
      taxable_quantity: _expectedTax,
    }));
    await ctx.service.create(ctx.request(returned), 1);
    expect(ctx.inventory.processStockIn.mock.calls[0]?.[1]).toBe(returned * factor);
    expect(ctx.inventory.processStockIn.mock.calls[0]?.[8]).toBeCloseTo(
      (_expectedTax * returned) / quantity,
    );
    expect(ctx.invoiceItem.taxable_quantity).toBe(factor === 50 ? 1 : 4);
  });

  it('rejects a taxable legacy return without source allocation snapshots', async () => {
    const ctx = setup({ taxable_quantity: 4 });
    await expect(ctx.service.create(ctx.request(2), 1)).rejects.toThrow(
      'thiếu snapshot thuế theo lô',
    );
    expect(ctx.inventory.processStockIn).not.toHaveBeenCalled();
  });

  it('caps a subsequent return by the remaining physical quantity', async () => {
    const ctx = setup();
    await ctx.service.create(ctx.request(8), 1);
    await expect(ctx.service.create(ctx.request(3), 1)).rejects.toThrow('chỉ có thể trả tối đa 20');
    expect(ctx.inventory.processStockIn).toHaveBeenCalledTimes(1);
    expect(ctx.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('restores the full converted quantity when legacy base_quantity is absent', async () => {
    const ctx = setup({ conversion_factor: 50, quantity: 2, taxable_quantity: 2 });
    ctx.allocations.push(Object.assign(new SalesInvoiceItemStockAllocation(), {
      id: 1, quantity: 100, taxable_quantity: 100,
    }));
    delete (ctx.invoiceItem as { base_quantity?: number }).base_quantity;
    await ctx.service.create(ctx.request(2), 1);
    expect(ctx.inventory.processStockIn.mock.calls[0]?.[1]).toBe(100);
    expect(ctx.inventory.processStockIn.mock.calls[0]?.[8]).toBe(100);
  });

  it('rejects duplicate invoice lines even when one omits the line ID', async () => {
    const ctx = setup();
    const dto = ctx.request(6);
    dto.items.push({ product_id: 7, quantity: 6, unit_price: 100 });
    await expect(ctx.service.create(dto, 1)).rejects.toThrow('Không được lặp dòng');
    expect(ctx.manager.save).not.toHaveBeenCalled();
    expect(ctx.inventory.processStockIn).not.toHaveBeenCalled();
  });

  it.each([0, -1, NaN, Infinity])('rejects invalid quantity %s', async (quantity) => {
    const ctx = setup();
    await expect(ctx.service.create(ctx.request(quantity), 1)).rejects.toThrow(BadRequestException);
    expect(ctx.manager.save).not.toHaveBeenCalled();
  });

  it.each([0, -1, NaN])('rejects invalid conversion factor %s', async (conversion_factor) => {
    const ctx = setup({ conversion_factor });
    await expect(ctx.service.create(ctx.request(1), 1)).rejects.toThrow(BadRequestException);
    expect(ctx.manager.save).not.toHaveBeenCalled();
  });

  it('rejects empty returns and ambiguous product-only selections', async () => {
    const ctx = setup();
    await expect(ctx.service.create({ invoice_id: 1, items: [] }, 1)).rejects.toThrow(BadRequestException);
    ctx.invoice.items?.push(Object.assign(new SalesInvoiceItem(), ctx.invoiceItem, { id: 12 }));
    const dto = ctx.request(1);
    delete dto.items[0]!.sales_invoice_item_id;
    await expect(ctx.service.create(dto, 1)).rejects.toThrow('Cần chọn dòng hóa đơn');
    expect(ctx.manager.save).not.toHaveBeenCalled();
  });

  it('preserves original allocation snapshots and proportionally restores physical stock', async () => {
    const ctx = setup();
    ctx.allocations.push(
      Object.assign(new SalesInvoiceItemStockAllocation(), { id: 1, quantity: 40, receipt_item_id: 21, supplier_id: 31 }),
      Object.assign(new SalesInvoiceItemStockAllocation(), { id: 2, quantity: 60, receipt_item_id: 22, supplier_id: 32 }),
    );
    const original = JSON.stringify(ctx.allocations);
    await ctx.service.create(ctx.request(3), 1);
    await ctx.service.create(ctx.request(7), 1);
    expect(ctx.inventory.processStockIn.mock.calls.map((call) => [call[1], call[4], call[8], call[9]]))
      .toEqual([[12, 21, 0, 31], [18, 22, 0, 32], [28, 21, 0, 31], [42, 22, 0, 32]]);
    expect(JSON.stringify(ctx.allocations)).toBe(original);
  });

  it('restores taxable quantity from each source allocation snapshot', async () => {
    const ctx = setup();
    ctx.allocations.push(
      Object.assign(new SalesInvoiceItemStockAllocation(), {
        id: 1, quantity: 40, taxable_quantity: 40, receipt_item_id: 21,
      }),
      Object.assign(new SalesInvoiceItemStockAllocation(), {
        id: 2, quantity: 60, taxable_quantity: 0, receipt_item_id: 22,
      }),
    );
    await ctx.service.create(ctx.request(3), 1);
    expect(ctx.inventory.processStockIn.mock.calls.map((call) => [call[1], call[8]]))
      .toEqual([[12, 12], [18, 0]]);
    const savedReturnItem = ctx.manager.save.mock.calls
      .map(([entity]) => entity)
      .find((entity) => entity instanceof SalesReturnItem) as SalesReturnItem;
    expect(savedReturnItem.stock_allocations).toEqual([
      { batchId: 100, quantity: 12, taxableQuantity: 12, sourceReceiptItemId: 21 },
      { batchId: 101, quantity: 18, taxableQuantity: 0, sourceReceiptItemId: 22 },
    ]);
  });

  it('does not replace a rounded zero allocation share with its original quantity', async () => {
    const ctx = setup({ quantity: 10000, conversion_factor: 0.0001, base_quantity: 1, taxable_quantity: 0 });
    ctx.allocations.push(
      Object.assign(new SalesInvoiceItemStockAllocation(), { id: 1, quantity: 0.0001, receipt_item_id: 21 }),
      Object.assign(new SalesInvoiceItemStockAllocation(), { id: 2, quantity: 0.9999, receipt_item_id: 22 }),
    );
    await ctx.service.create(ctx.request(1), 1);
    expect(ctx.inventory.processStockIn).toHaveBeenCalledTimes(1);
    expect(ctx.inventory.processStockIn.mock.calls[0]?.[1]).toBe(0.0001);
    expect(ctx.inventory.processStockIn.mock.calls[0]?.[4]).toBe(22);
  });

  it.each([SalesReturnStatus.CANCELLED, SalesReturnStatus.DRAFT])('does not reverse a %s return', async (status) => {
    const ctx = setup();
    ctx.returns.push(Object.assign(new SalesReturn(), { id: 1, invoice_id: 1, status }));
    await expect(ctx.service.cancel(1, 1)).rejects.toThrow(BadRequestException);
    expect(ctx.events).toEqual(['return:read', 'invoice:lock', 'return:lock', 'return:relations']);
    expect(ctx.manager.save).not.toHaveBeenCalled();
    expect(ctx.inventory.processStockOut).not.toHaveBeenCalled();
  });

  it('does not resurrect a cancelled invoice by cancelling a return', async () => {
    const ctx = setup();
    ctx.invoice.status = SalesInvoiceStatus.CANCELLED;
    ctx.returns.push(Object.assign(new SalesReturn(), { id: 1, invoice_id: 1, status: SalesReturnStatus.APPROVED }));
    await expect(ctx.service.cancel(1, 1)).rejects.toThrow('hóa đơn đã hủy');
    expect(ctx.manager.save).not.toHaveBeenCalled();
  });
});
