import { BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SalesReturnService } from './sales-return.service';
import {
  SalesReturn,
  SalesReturnStatus,
} from '../../entities/sales-return.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';
import {
  SalesInvoice,
  SalesInvoiceStatus,
} from '../../entities/sales-invoices.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';
import { CustomerRewardInvoiceTracking } from '../../entities/customer-reward-invoice-tracking.entity';
import { CustomerRewardTracking } from '../../entities/customer-reward-tracking.entity';
import { InventoryService } from '../inventory/inventory.service';
import { CustomerRewardService } from '../customer-reward/customer-reward.service';
import { PromotionCampaignService } from '../promotion-campaign/promotion-campaign.service';
import { CreateSalesReturnDto } from './dto/create-sales-return.dto';

jest.mock('../inventory/inventory.service', () => ({
  InventoryService: class {},
}));
jest.mock('../customer-reward/customer-reward.service', () => ({
  CustomerRewardService: class {},
}));
jest.mock('../promotion-campaign/promotion-campaign.service', () => ({
  PromotionCampaignService: class {},
}));

function setup(
  overrides: Partial<SalesInvoiceItem> = {},
  rewardOverride?: (manager: any, invoiceId: number) => Promise<void>,
) {
  const invoiceItem = Object.assign(
    new SalesInvoiceItem(),
    {
      id: 11,
      product_id: 7,
      quantity: 10,
      conversion_factor: 10,
      base_quantity: 100,
      taxable_quantity: 0,
      cost_price: 2,
      unit_price: 100,
      total_price: 1000,
    },
    overrides,
  );
  const invoice = Object.assign(new SalesInvoice(), {
    id: 1,
    code: 'INV-1',
    status: SalesInvoiceStatus.CONFIRMED,
    payment_method: 'debt',
    total_amount: 1000,
    final_amount: 1000,
    remaining_amount: 1000,
    partial_payment_amount: 0,
    cost_of_goods_sold: 200,
    discount_amount: 0,
    items: [invoiceItem],
  });
  const returns: SalesReturn[] = [];
  const savedReturnItems: SalesReturnItem[] = [];
  const allocations: SalesInvoiceItemStockAllocation[] = [];
  const events: string[] = [];
  const invoiceRewardTracking = Object.assign(
    new CustomerRewardInvoiceTracking(),
    { invoice_id: 1, customer_id: 5, accumulated_amount: 1000 },
  );
  const customerRewardTracking = Object.assign(new CustomerRewardTracking(), {
    customer_id: 5,
    pending_amount: 1000,
    total_accumulated: 1000,
    reward_count: 0,
  });
  let hasWholeInvoiceRefund = false;
  let forcedRefundedCashAmount: number | null = null;
  let forcedPaidAllocationAmount: number | null = null;
  const refundQueryConditions: string[] = [];
  const manager: any = {
    create: jest.fn((_entity: unknown, data: Record<string, unknown>) => data),
    findOne: jest.fn(
      async (
        entity: unknown,
        options: {
          where: { id?: number; invoice_id?: number; customer_id?: number };
          lock?: unknown;
          relations?: string[];
        },
      ) => {
        events.push(
          `${entity === SalesInvoice ? 'invoice' : 'return'}:${options.lock ? 'lock' : options.relations ? 'relations' : 'read'}`,
        );
        if (entity === SalesInvoice) return invoice;
        if (entity === CustomerRewardInvoiceTracking)
          return invoiceRewardTracking;
        if (entity === CustomerRewardTracking) return customerRewardTracking;
        return returns.find((item) => item.id === options.where.id) || null;
      },
    ),
    find: jest.fn(async (entity: unknown) => {
      if (entity === SalesInvoiceItem) return invoice.items;
      if (entity === SalesReturn) return returns;
      return allocations;
    }),
    findOneOrFail: jest.fn(async () => customerRewardTracking),
    save: jest.fn(
      async (entity: SalesReturn | SalesReturnItem | SalesInvoice) => {
        if (entity instanceof SalesReturn && !entity.id) {
          entity.id = returns.length + 1;
          returns.push(entity);
        }
        if (entity instanceof SalesReturnItem) {
          savedReturnItems.push(entity);
        }
        return entity;
      },
    ),
    createQueryBuilder: jest.fn(() => {
      let invoiceItemId = 0;
      let selectedExpression = '';
      const query = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn(
          (_sql: string, params: { invoiceItemId?: number } = {}) => {
            refundQueryConditions.push(_sql);
            if (params.invoiceItemId) invoiceItemId = params.invoiceItemId;
            return query;
          },
        ),
        select: jest.fn((expression: string) => {
          selectedExpression = expression;
          return query;
        }),
        getOne: jest.fn(async () =>
          hasWholeInvoiceRefund ? { id: 99 } : null,
        ),
        getMany: jest.fn(async () =>
          savedReturnItems.filter((item) =>
            returns.some(
              (header) =>
                header.id === item.sales_return_id &&
                header.status === SalesReturnStatus.APPROVED,
            ),
          ),
        ),
        getRawOne: jest.fn(async () => ({
          total: selectedExpression.includes('allocation.amount')
            ? (forcedPaidAllocationAmount ?? 0)
            : (forcedRefundedCashAmount ??
              savedReturnItems
                .filter((item) =>
                  returns.some(
                    (header) =>
                      header.id === item.sales_return_id &&
                      header.status === SalesReturnStatus.APPROVED,
                  ),
                )
                .filter((item) => item.sales_invoice_item_id === invoiceItemId)
                .reduce(
                  (sum, item) =>
                    sum +
                    Number(
                      item.base_quantity ??
                        item.quantity * Number(item.conversion_factor ?? 1),
                    ),
                  0,
                )),
        })),
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      return query;
    }),
  };
  const runner = {
    manager,
    isTransactionActive: true,
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  };
  manager.queryRunner = runner;
  let nextBatchId = 100;
  const inventory = {
    processStockIn: jest.fn(async (..._args: unknown[]) => ({
      batch: { id: nextBatchId++ },
    })),
    processStockOut: jest.fn(),
    createSupplierSettlementReturnEntries: jest.fn(),
    removeSupplierSettlementForSalesReturn: jest.fn(),
  };
  const promotion = {
    processSalesReturnReversal: jest.fn(),
    processSalesReturnCancellationRestore: jest.fn(),
  };
  const reward = {
    syncInvoiceReward: jest
      .fn()
      .mockImplementation(rewardOverride || (async () => undefined)),
  };
  const service = new SalesReturnService(
    {
      create: (data: Partial<SalesReturn>) =>
        Object.assign(new SalesReturn(), data),
    } as Repository<SalesReturn>,
    {
      create: (data: Partial<SalesReturnItem>) =>
        Object.assign(new SalesReturnItem(), data),
    } as Repository<SalesReturnItem>,
    { createQueryRunner: () => runner } as unknown as DataSource,
    reward as unknown as CustomerRewardService,
    inventory as unknown as InventoryService,
    promotion as unknown as PromotionCampaignService,
  );
  const request = (
    quantity: number,
    salesInvoiceItemId = 11,
    productId = 7,
  ): CreateSalesReturnDto => ({
    invoice_id: 1,
    items: [
      {
        sales_invoice_item_id: salesInvoiceItemId,
        product_id: productId,
        quantity,
        unit_price: 100,
      },
    ],
  });
  return {
    service,
    invoice,
    invoiceItem,
    returns,
    savedReturnItems,
    allocations,
    events,
    manager,
    invoiceRewardTracking,
    customerRewardTracking,
    runner,
    inventory,
    reward,
    request,
    refundQueryConditions,
    setWholeInvoiceRefund: (value: boolean) => {
      hasWholeInvoiceRefund = value;
    },
    setRefundedCashAmount: (value: number) => {
      forcedRefundedCashAmount = value;
    },
    setPaidAllocationAmount: (value: number) => {
      forcedPaidAllocationAmount = value;
    },
  };
}

describe('SalesReturnService stock restoration', () => {
  it('trả hàng excluded giữ nguyên tích lũy đủ điều kiện sau khi phân bổ giảm giá chung', async () => {
    const RealCustomerRewardService = jest.requireActual(
      '../customer-reward/customer-reward.service',
    ).CustomerRewardService as typeof CustomerRewardService;
    const rewardService = Object.create(
      RealCustomerRewardService.prototype,
    ) as CustomerRewardService;
    const ctx = setup(
      { exclude_from_reward: false, unit_price: 60, total_price: 600 },
      async (manager, invoiceId) =>
        RealCustomerRewardService.prototype.syncInvoiceReward.call(
          rewardService,
          manager,
          invoiceId,
        ),
    );
    const excludedItem = Object.assign(new SalesInvoiceItem(), {
      id: 12,
      invoice_id: 1,
      product_id: 8,
      quantity: 10,
      conversion_factor: 1,
      base_quantity: 10,
      taxable_quantity: 0,
      cost_price: 2,
      unit_price: 40,
      total_price: 400,
      exclude_from_reward: true,
    });
    ctx.invoice.items.push(excludedItem);
    ctx.invoice.customer_id = 5;
    ctx.invoice.status = SalesInvoiceStatus.PAID;
    ctx.invoice.total_amount = 1000;
    ctx.invoice.discount_amount = 100;
    ctx.invoice.final_amount = 900;
    ctx.invoice.partial_payment_amount = 900;
    ctx.invoice.remaining_amount = 0;
    ctx.invoice.reward_policy_version = 1;
    ctx.invoiceRewardTracking.accumulated_amount = 540;
    ctx.customerRewardTracking.pending_amount = 2000;
    ctx.customerRewardTracking.total_accumulated = 2000;

    const salesReturn = await ctx.service.create(ctx.request(10, 12, 8), 1);

    expect(salesReturn.total_refund_amount).toBe(360);
    expect(ctx.invoice.final_amount).toBe(540);
    expect(ctx.invoice.partial_payment_amount).toBe(540);
    expect(ctx.invoiceRewardTracking.accumulated_amount).toBe(540);
    expect(ctx.customerRewardTracking.pending_amount).toBe(2000);
    expect(ctx.customerRewardTracking.total_accumulated).toBe(2000);
    expect(ctx.runner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      productExcluded: false,
      initialInvoiceAccumulated: 1000,
      expectedInvoiceAccumulated: 800,
      expectedCustomerAccumulated: 800,
    },
    {
      productExcluded: true,
      initialInvoiceAccumulated: 0,
      expectedInvoiceAccumulated: 0,
      expectedCustomerAccumulated: 1000,
    },
  ])(
    'đồng bộ tích lũy đúng khi trả một phần hàng (excluded=$productExcluded)',
    async ({
      productExcluded,
      initialInvoiceAccumulated,
      expectedInvoiceAccumulated,
      expectedCustomerAccumulated,
    }) => {
      const RealCustomerRewardService = jest.requireActual(
        '../customer-reward/customer-reward.service',
      ).CustomerRewardService as typeof CustomerRewardService;
      const rewardService = Object.create(
        RealCustomerRewardService.prototype,
      ) as CustomerRewardService;
      const ctx = setup(
        { exclude_from_reward: productExcluded },
        async (manager, invoiceId) =>
          RealCustomerRewardService.prototype.syncInvoiceReward.call(
            rewardService,
            manager,
            invoiceId,
          ),
      );
      ctx.invoiceRewardTracking.accumulated_amount = initialInvoiceAccumulated;
      ctx.invoice.customer_id = 5;
      ctx.invoice.status = SalesInvoiceStatus.PAID;
      ctx.invoice.final_amount = 1000;
      ctx.invoice.partial_payment_amount = 1000;
      ctx.invoice.remaining_amount = 0;
      ctx.invoice.reward_policy_version = 1;

      await ctx.service.create(ctx.request(2), 1);

      expect(ctx.invoice.final_amount).toBe(800);
      expect(ctx.invoice.partial_payment_amount).toBe(800);
      expect(ctx.invoiceRewardTracking.accumulated_amount).toBe(
        expectedInvoiceAccumulated,
      );
      expect(ctx.customerRewardTracking.pending_amount).toBe(
        expectedCustomerAccumulated,
      );
      expect(ctx.customerRewardTracking.total_accumulated).toBe(
        expectedCustomerAccumulated,
      );
      expect(ctx.runner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(ctx.runner.rollbackTransaction).not.toHaveBeenCalled();
    },
  );

  it('rollback phiếu trả hàng khi đối soát tích lũy thất bại', async () => {
    const ctx = setup();
    ctx.reward.syncInvoiceReward.mockRejectedValueOnce(
      new Error('Lỗi ghi tích lũy'),
    );
    await expect(ctx.service.create(ctx.request(1), 1)).rejects.toThrow(
      'Lỗi ghi tích lũy',
    );
    expect(ctx.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(ctx.runner.commitTransaction).not.toHaveBeenCalled();
  });

  it('persists each returned item with its parent return ID', async () => {
    const ctx = setup();

    await ctx.service.create(ctx.request(1), 1);
    expect(ctx.reward.syncInvoiceReward).toHaveBeenCalledWith(ctx.manager, 1);
    expect(
      ctx.reward.syncInvoiceReward.mock.invocationCallOrder[0],
    ).toBeGreaterThan(Math.max(...ctx.manager.save.mock.invocationCallOrder));

    const savedEntities = ctx.manager.save.mock.calls.map(([entity]) => entity);
    const savedHeader = savedEntities.find(
      (entity) => entity instanceof SalesReturn,
    );
    const savedItems = savedEntities.filter(
      (entity) => entity instanceof SalesReturnItem,
    );

    expect(savedHeader).not.toHaveProperty('items');
    expect(savedItems).toHaveLength(1);
    expect(ctx.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ sales_return_id: 1 }),
    );
  });

  it('locks the invoice without joins before loading relations', async () => {
    const ctx = setup();
    await ctx.service.create(ctx.request(1), 1);
    expect(ctx.events.slice(0, 2)).toEqual([
      'invoice:lock',
      'invoice:relations',
    ]);
    expect(ctx.manager.findOne).toHaveBeenNthCalledWith(1, SalesInvoice, {
      where: { id: 1 },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it.each([
    [1, 40, 10, 4],
    [50, 2, 1, 50],
    [0.5, 40, 10, 2],
  ])(
    'restores tax from source allocation snapshots with factor %s',
    async (factor, quantity, returned, _expectedTax) => {
      const ctx = setup({
        conversion_factor: factor,
        quantity,
        base_quantity: quantity * factor,
        taxable_quantity: factor === 50 ? 1 : 4,
      });
      ctx.allocations.push(
        Object.assign(new SalesInvoiceItemStockAllocation(), {
          id: 1,
          quantity: ctx.invoiceItem.base_quantity,
          taxable_quantity: _expectedTax,
        }),
      );
      await ctx.service.create(ctx.request(returned), 1);
      expect(ctx.inventory.processStockIn.mock.calls[0]?.[1]).toBe(
        returned * factor,
      );
      expect(ctx.inventory.processStockIn.mock.calls[0]?.[8]).toBeCloseTo(
        (_expectedTax * returned) / quantity,
      );
      expect(ctx.invoiceItem.taxable_quantity).toBe(factor === 50 ? 1 : 4);
    },
  );

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
    await expect(ctx.service.create(ctx.request(3), 1)).rejects.toThrow(
      'chỉ có thể trả tối đa 20',
    );
    expect(ctx.inventory.processStockIn).toHaveBeenCalledTimes(1);
    expect(ctx.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('restores the full converted quantity when legacy base_quantity is absent', async () => {
    const ctx = setup({
      conversion_factor: 50,
      quantity: 2,
      taxable_quantity: 2,
    });
    ctx.allocations.push(
      Object.assign(new SalesInvoiceItemStockAllocation(), {
        id: 1,
        quantity: 100,
        taxable_quantity: 100,
      }),
    );
    delete (ctx.invoiceItem as { base_quantity?: number }).base_quantity;
    await ctx.service.create(ctx.request(2), 1);
    expect(ctx.inventory.processStockIn.mock.calls[0]?.[1]).toBe(100);
    expect(ctx.inventory.processStockIn.mock.calls[0]?.[8]).toBe(100);
  });

  it('rejects duplicate invoice lines even when one omits the line ID', async () => {
    const ctx = setup();
    const dto = ctx.request(6);
    dto.items.push({ product_id: 7, quantity: 6, unit_price: 100 });
    await expect(ctx.service.create(dto, 1)).rejects.toThrow(
      'Không được lặp dòng',
    );
    expect(ctx.manager.save).not.toHaveBeenCalled();
    expect(ctx.inventory.processStockIn).not.toHaveBeenCalled();
  });

  it.each([0, -1, NaN, Infinity])(
    'rejects invalid quantity %s',
    async (quantity) => {
      const ctx = setup();
      await expect(
        ctx.service.create(ctx.request(quantity), 1),
      ).rejects.toThrow(BadRequestException);
      expect(ctx.manager.save).not.toHaveBeenCalled();
    },
  );

  it.each([0, -1, NaN])(
    'rejects invalid conversion factor %s',
    async (conversion_factor) => {
      const ctx = setup({ conversion_factor });
      await expect(ctx.service.create(ctx.request(1), 1)).rejects.toThrow(
        BadRequestException,
      );
      expect(ctx.manager.save).not.toHaveBeenCalled();
    },
  );

  it('rejects empty returns and ambiguous product-only selections', async () => {
    const ctx = setup();
    await expect(
      ctx.service.create({ invoice_id: 1, items: [] }, 1),
    ).rejects.toThrow(BadRequestException);
    ctx.invoice.items?.push(
      Object.assign(new SalesInvoiceItem(), ctx.invoiceItem, { id: 12 }),
    );
    const dto = ctx.request(1);
    delete dto.items[0]!.sales_invoice_item_id;
    await expect(ctx.service.create(dto, 1)).rejects.toThrow(
      'Cần chọn dòng hóa đơn',
    );
    expect(ctx.manager.save).not.toHaveBeenCalled();
  });

  it('preserves original allocation snapshots and proportionally restores physical stock', async () => {
    const ctx = setup();
    ctx.allocations.push(
      Object.assign(new SalesInvoiceItemStockAllocation(), {
        id: 1,
        quantity: 40,
        receipt_item_id: 21,
        supplier_id: 31,
      }),
      Object.assign(new SalesInvoiceItemStockAllocation(), {
        id: 2,
        quantity: 60,
        receipt_item_id: 22,
        supplier_id: 32,
      }),
    );
    const original = JSON.stringify(ctx.allocations);
    await ctx.service.create(ctx.request(3), 1);
    await ctx.service.create(ctx.request(7), 1);
    expect(
      ctx.inventory.processStockIn.mock.calls.map((call) => [
        call[1],
        call[4],
        call[8],
        call[9],
      ]),
    ).toEqual([
      [12, 21, 0, 31],
      [18, 22, 0, 32],
      [28, 21, 0, 31],
      [42, 22, 0, 32],
    ]);
    expect(JSON.stringify(ctx.allocations)).toBe(original);
  });

  it('restores taxable quantity from each source allocation snapshot', async () => {
    const ctx = setup();
    ctx.allocations.push(
      Object.assign(new SalesInvoiceItemStockAllocation(), {
        id: 1,
        quantity: 40,
        taxable_quantity: 40,
        receipt_item_id: 21,
      }),
      Object.assign(new SalesInvoiceItemStockAllocation(), {
        id: 2,
        quantity: 60,
        taxable_quantity: 0,
        receipt_item_id: 22,
      }),
    );
    await ctx.service.create(ctx.request(3), 1);
    expect(
      ctx.inventory.processStockIn.mock.calls.map((call) => [call[1], call[8]]),
    ).toEqual([
      [12, 12],
      [18, 0],
    ]);
    const savedReturnItem = ctx.manager.save.mock.calls
      .map(([entity]) => entity)
      .find((entity) => entity instanceof SalesReturnItem) as SalesReturnItem;
    expect(savedReturnItem.stock_allocations).toEqual([
      {
        batchId: 100,
        quantity: 12,
        taxableQuantity: 12,
        sourceReceiptItemId: 21,
      },
      {
        batchId: 101,
        quantity: 18,
        taxableQuantity: 0,
        sourceReceiptItemId: 22,
      },
    ]);
  });

  it.each([
    [40, 40, 80],
    [40, 70, 110],
  ])(
    'blocks a return when source lot allocations total %s + %s instead of the sold quantity',
    async (firstLotQuantity, secondLotQuantity, allocatedTotal) => {
      const ctx = setup();
      ctx.allocations.push(
        Object.assign(new SalesInvoiceItemStockAllocation(), {
          id: 1,
          quantity: firstLotQuantity,
          taxable_quantity: firstLotQuantity,
          receipt_item_id: 21,
        }),
        Object.assign(new SalesInvoiceItemStockAllocation(), {
          id: 2,
          quantity: secondLotQuantity,
          taxable_quantity: 0,
          receipt_item_id: 22,
        }),
      );

      await expect(ctx.service.create(ctx.request(1), 1)).rejects.toThrow(
        `hóa đơn INV-1: allocation theo lô của dòng #11 cộng ${allocatedTotal} đơn vị, ` +
          'nhưng số lượng gốc trên hóa đơn là 100',
      );
      expect(ctx.inventory.processStockIn).not.toHaveBeenCalled();
      expect(ctx.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    },
  );

  it('does not replace a rounded zero allocation share with its original quantity', async () => {
    const ctx = setup({
      quantity: 10000,
      conversion_factor: 0.0001,
      base_quantity: 1,
      taxable_quantity: 0,
    });
    ctx.allocations.push(
      Object.assign(new SalesInvoiceItemStockAllocation(), {
        id: 1,
        quantity: 0.0001,
        receipt_item_id: 21,
      }),
      Object.assign(new SalesInvoiceItemStockAllocation(), {
        id: 2,
        quantity: 0.9999,
        receipt_item_id: 22,
      }),
    );
    await ctx.service.create(ctx.request(1), 1);
    expect(ctx.inventory.processStockIn).toHaveBeenCalledTimes(1);
    expect(ctx.inventory.processStockIn.mock.calls[0]?.[1]).toBe(0.0001);
    expect(ctx.inventory.processStockIn.mock.calls[0]?.[4]).toBe(22);
  });

  it.each([SalesReturnStatus.CANCELLED, SalesReturnStatus.DRAFT])(
    'does not reverse a %s return',
    async (status) => {
      const ctx = setup();
      ctx.returns.push(
        Object.assign(new SalesReturn(), { id: 1, invoice_id: 1, status }),
      );
      await expect(ctx.service.cancel(1, 1)).rejects.toThrow(
        BadRequestException,
      );
      expect(ctx.events).toEqual([
        'return:read',
        'invoice:lock',
        'return:lock',
        'return:relations',
      ]);
      expect(ctx.manager.save).not.toHaveBeenCalled();
      expect(ctx.inventory.processStockOut).not.toHaveBeenCalled();
    },
  );

  it('does not resurrect a cancelled invoice by cancelling a return', async () => {
    const ctx = setup();
    ctx.invoice.status = SalesInvoiceStatus.CANCELLED;
    ctx.returns.push(
      Object.assign(new SalesReturn(), {
        id: 1,
        invoice_id: 1,
        status: SalesReturnStatus.APPROVED,
      }),
    );
    await expect(ctx.service.cancel(1, 1)).rejects.toThrow('hóa đơn đã hủy');
    expect(ctx.manager.save).not.toHaveBeenCalled();
  });

  it('blocks cancelling a return after the whole invoice was refunded', async () => {
    const ctx = setup();
    ctx.invoice.status = SalesInvoiceStatus.REFUNDED;
    ctx.returns.push(
      Object.assign(new SalesReturn(), {
        id: 1,
        code: 'SR-1',
        invoice_id: 1,
        status: SalesReturnStatus.APPROVED,
      }),
    );
    ctx.setWholeInvoiceRefund(true);

    await expect(ctx.service.cancel(1, 1)).rejects.toThrow(
      'Không thể hủy phiếu trả hàng SR-1: hóa đơn INV-1 đã được hoàn tiền toàn bộ',
    );
    expect(ctx.manager.save).not.toHaveBeenCalled();
    expect(ctx.inventory.processStockOut).not.toHaveBeenCalled();
    expect(ctx.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      productExcluded: false,
      invoiceRewardBeforeCancel: 800,
      invoiceRewardAfterCancel: 1000,
      customerRewardBeforeCancel: 800,
      customerRewardAfterCancel: 1000,
    },
    {
      productExcluded: true,
      invoiceRewardBeforeCancel: 0,
      invoiceRewardAfterCancel: 0,
      customerRewardBeforeCancel: 1000,
      customerRewardAfterCancel: 1000,
    },
  ])(
    'đồng bộ tích lũy đúng khi hủy phiếu trả (excluded=$productExcluded)',
    async ({
      productExcluded,
      invoiceRewardBeforeCancel,
      invoiceRewardAfterCancel,
      customerRewardBeforeCancel,
      customerRewardAfterCancel,
    }) => {
      const RealCustomerRewardService = jest.requireActual(
        '../customer-reward/customer-reward.service',
      ).CustomerRewardService as typeof CustomerRewardService;
      const rewardService = Object.create(
        RealCustomerRewardService.prototype,
      ) as CustomerRewardService;
      const ctx = setup(
        { exclude_from_reward: productExcluded },
        async (manager, invoiceId) =>
          RealCustomerRewardService.prototype.syncInvoiceReward.call(
            rewardService,
            manager,
            invoiceId,
          ),
      );
      ctx.invoice.customer_id = 5;
      ctx.invoice.status = SalesInvoiceStatus.PAID;
      ctx.invoice.final_amount = 800;
      ctx.invoice.partial_payment_amount = 800;
      ctx.invoice.remaining_amount = 0;
      ctx.invoice.cost_of_goods_sold = 160;
      ctx.invoice.reward_policy_version = 1;
      ctx.invoiceRewardTracking.accumulated_amount = invoiceRewardBeforeCancel;
      ctx.customerRewardTracking.pending_amount = customerRewardBeforeCancel;
      ctx.customerRewardTracking.total_accumulated = customerRewardBeforeCancel;
      ctx.setRefundedCashAmount(200);
      ctx.setPaidAllocationAmount(1000);
      const returnItem = Object.assign(new SalesReturnItem(), {
        id: 21,
        sales_return_id: 2,
        sales_invoice_item_id: 11,
        product_id: 7,
        quantity: 2,
        base_quantity: 20,
        conversion_factor: 10,
        stock_allocations: [{ batchId: 31, quantity: 20, taxableQuantity: 0 }],
      });
      const returnHeader = Object.assign(new SalesReturn(), {
        id: 2,
        code: 'SR-CANCEL-2',
        invoice_id: 1,
        invoice: ctx.invoice,
        customer_id: 5,
        status: SalesReturnStatus.APPROVED,
        total_refund_amount: 200,
        items: [returnItem],
      });
      ctx.returns.push(returnHeader);
      ctx.savedReturnItems.push(returnItem);

      await ctx.service.cancel(2, 1);

      expect(returnHeader.status).toBe(SalesReturnStatus.CANCELLED);
      expect(ctx.invoice.final_amount).toBe(1000);
      expect(ctx.invoiceRewardTracking.accumulated_amount).toBe(
        invoiceRewardAfterCancel,
      );
      expect(ctx.customerRewardTracking.pending_amount).toBe(
        customerRewardAfterCancel,
      );
      expect(ctx.customerRewardTracking.total_accumulated).toBe(
        customerRewardAfterCancel,
      );
      expect(ctx.reward.syncInvoiceReward).toHaveBeenCalledWith(
        ctx.manager,
        ctx.invoice.id,
      );
      expect(ctx.runner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(ctx.runner.rollbackTransaction).not.toHaveBeenCalled();
    },
  );

  it('still cancels an ordinary approved return on an active invoice', async () => {
    const ctx = setup();
    ctx.invoice.customer_id = 5;
    ctx.setRefundedCashAmount(100);
    ctx.returns.push(
      Object.assign(new SalesReturn(), {
        id: 1,
        code: 'SR-2',
        invoice_id: 1,
        invoice: ctx.invoice,
        customer_id: 5,
        status: SalesReturnStatus.APPROVED,
        total_refund_amount: 100,
        items: [
          {
            id: 2,
            product_id: 7,
            quantity: 1,
            base_quantity: 10,
            stock_allocations: [
              { batchId: 31, quantity: 10, taxableQuantity: 0 },
            ],
          } as SalesReturnItem,
        ],
      }),
    );

    await ctx.service.cancel(1, 1);

    expect(ctx.returns[0]?.status).toBe(SalesReturnStatus.CANCELLED);
    expect(ctx.inventory.processStockOut).toHaveBeenCalledWith(
      7,
      10,
      'RETURN_CANCEL',
      1,
      1,
      'Hủy phiếu trả hàng SR-2',
      expect.anything(),
      { batchId: 31, taxableQuantity: 0 },
    );
    expect(ctx.reward.syncInvoiceReward).toHaveBeenCalledWith(ctx.manager, 1);
    expect(ctx.runner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('still cancels a return when REFUNDED status came from returns, not a whole-invoice refund', async () => {
    const ctx = setup();
    ctx.invoice.status = SalesInvoiceStatus.REFUNDED;
    ctx.returns.push(
      Object.assign(new SalesReturn(), {
        id: 1,
        code: 'SR-3',
        invoice_id: 1,
        status: SalesReturnStatus.APPROVED,
        total_refund_amount: 100,
        items: [
          {
            id: 3,
            product_id: 7,
            quantity: 1,
            base_quantity: 10,
            stock_allocations: [
              { batchId: 32, quantity: 10, taxableQuantity: 0 },
            ],
          } as SalesReturnItem,
        ],
      }),
    );

    await ctx.service.cancel(1, 1);

    expect(ctx.returns[0]?.status).toBe(SalesReturnStatus.CANCELLED);
    expect(ctx.refundQueryConditions).toContain(
      'allocation.sales_return_id IS NULL',
    );
    expect(ctx.refundQueryConditions).toContain('payment.amount < 0');
    expect(ctx.refundQueryConditions).toContain(
      'payment.payment_method = :paymentMethod',
    );
    expect(ctx.runner.commitTransaction).toHaveBeenCalledTimes(1);
  });
});

const describePostgres = process.env.TAX_BACKFILL_TEST_URL
  ? describe
  : describe.skip;

describePostgres('SalesReturnService cancellation PostgreSQL rollback', () => {
  let connection: DataSource;
  let databaseRunner: ReturnType<DataSource['createQueryRunner']>;
  let tables: Record<string, string>;

  beforeAll(async () => {
    const suffix = `${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
    tables = {
      returns: `tax_sales_return_cancel_${suffix}`,
      items: `tax_sales_return_cancel_items_${suffix}`,
      invoices: `tax_sales_return_cancel_invoices_${suffix}`,
      invoiceItems: `tax_sales_return_cancel_invoice_items_${suffix}`,
      products: `tax_sales_return_cancel_products_${suffix}`,
      batches: `tax_sales_return_cancel_batches_${suffix}`,
      transactions: `tax_sales_return_cancel_transactions_${suffix}`,
    };
    const targetHost = new URL(process.env.TAX_BACKFILL_TEST_URL!).hostname;
    if (
      targetHost !==
      'ep-broad-pine-a1675nqi-pooler.ap-southeast-1.aws.neon.tech'
    ) {
      throw new Error(
        `Sales-return integration tests are restricted to the dev DB host, got ${targetHost}`,
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
    databaseRunner = connection.createQueryRunner();
    await databaseRunner.connect();
    await databaseRunner.query(`
      CREATE TEMP TABLE ${tables.returns} (
        id integer PRIMARY KEY, code text NOT NULL, invoice_id integer NOT NULL,
        status text NOT NULL, total_refund_amount numeric NOT NULL
      );
      CREATE TEMP TABLE ${tables.items} (
        id integer PRIMARY KEY, sales_return_id integer NOT NULL,
        sales_invoice_item_id integer NOT NULL, product_id integer NOT NULL,
        quantity numeric NOT NULL, base_quantity numeric NOT NULL,
        conversion_factor numeric NOT NULL, unit_price numeric NOT NULL,
        total_price numeric NOT NULL, stock_allocations jsonb NOT NULL
      );
      CREATE TEMP TABLE ${tables.invoices} (
        id integer PRIMARY KEY, code text NOT NULL, status text NOT NULL,
        payment_status text NOT NULL, total_amount numeric NOT NULL,
        discount_amount numeric NOT NULL, final_amount numeric NOT NULL,
        partial_payment_amount numeric NOT NULL, remaining_amount numeric NOT NULL,
        cost_of_goods_sold numeric NOT NULL, gross_profit numeric NOT NULL,
        gross_profit_margin numeric NOT NULL, customer_id integer
      );
      CREATE TEMP TABLE ${tables.invoiceItems} (
        id integer PRIMARY KEY, invoice_id integer NOT NULL, product_id integer NOT NULL,
        product_name text, quantity numeric NOT NULL, base_quantity numeric NOT NULL,
        conversion_factor numeric NOT NULL, taxable_quantity numeric NOT NULL,
        unit_price numeric NOT NULL, total_price numeric NOT NULL, cost_price numeric NOT NULL
      );
      CREATE TEMP TABLE ${tables.products} (
        id integer PRIMARY KEY, quantity numeric NOT NULL, taxable_quantity_stock numeric NOT NULL
      );
      CREATE TEMP TABLE ${tables.batches} (
        id integer PRIMARY KEY, product_id integer NOT NULL,
        remaining_quantity numeric NOT NULL, taxable_remaining_quantity numeric NOT NULL
      );
      CREATE TEMP TABLE ${tables.transactions} (
        id serial PRIMARY KEY, reference_type text NOT NULL, reference_id integer NOT NULL,
        product_id integer NOT NULL, quantity numeric NOT NULL, taxable_quantity numeric NOT NULL
      );
    `);
  });

  afterAll(async () => {
    if (databaseRunner?.isTransactionActive)
      await databaseRunner.rollbackTransaction();
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

  it('rolls return, invoice, exact-lot stock/tax, and stock log back after a late failure', async () => {
    await databaseRunner.query(`
      INSERT INTO ${tables.returns} VALUES (1, 'SR-1', 7, 'approved', 100);
      INSERT INTO ${tables.items} VALUES
        (2, 1, 11, 10, 1, 10, 10, 100, 100,
          '[{"batchId":31,"quantity":10,"taxableQuantity":3}]'::jsonb);
      INSERT INTO ${tables.invoices} VALUES
        (7, 'INV-7', 'confirmed', 'pending', 1000, 0, 900, 0, 900, 18, 882, 98, NULL);
      INSERT INTO ${tables.invoiceItems} VALUES
        (11, 7, 10, 'ITEM', 10, 100, 10, 6, 100, 1000, 2);
      INSERT INTO ${tables.products} VALUES (10, 20, 13);
      INSERT INTO ${tables.batches} VALUES (31, 10, 10, 3);
    `);

    const invoiceItems = async (invoiceId: number) => {
      const rows = await databaseRunner.query(
        `SELECT * FROM ${tables.invoiceItems} WHERE invoice_id=$1 ORDER BY id`,
        [invoiceId],
      );
      return rows.map((row: Record<string, unknown>) =>
        Object.assign(new SalesInvoiceItem(), row),
      );
    };
    const loadInvoice = async (id: number, withItems: boolean) => {
      const [row] = await databaseRunner.query(
        `SELECT * FROM ${tables.invoices} WHERE id=$1`,
        [id],
      );
      if (!row) return null;
      const invoice = Object.assign(new SalesInvoice(), row);
      if (withItems) invoice.items = await invoiceItems(id);
      return invoice;
    };
    const loadReturn = async (id: number, withRelations: boolean) => {
      const [row] = await databaseRunner.query(
        `SELECT * FROM ${tables.returns} WHERE id=$1`,
        [id],
      );
      if (!row) return null;
      const salesReturn = Object.assign(new SalesReturn(), row);
      if (withRelations) {
        const itemRows = await databaseRunner.query(
          `SELECT * FROM ${tables.items} WHERE sales_return_id=$1 ORDER BY id`,
          [id],
        );
        salesReturn.items = itemRows.map((item: Record<string, unknown>) =>
          Object.assign(new SalesReturnItem(), item),
        );
        salesReturn.invoice =
          (await loadInvoice(Number(salesReturn.invoice_id), true)) ??
          undefined;
      }
      return salesReturn;
    };
    const manager = {
      findOne: async (
        entity: Function,
        options: { where: { id: number }; relations?: string[] },
      ) => {
        if (entity === SalesReturn)
          return loadReturn(options.where.id, Boolean(options.relations));
        if (entity === SalesInvoice)
          return loadInvoice(options.where.id, Boolean(options.relations));
        return null;
      },
      find: async (
        entity: Function,
        options: { where: { invoice_id?: number } },
      ) => {
        if (entity === SalesReturn) {
          const rows = await databaseRunner.query(
            `SELECT * FROM ${tables.returns} WHERE invoice_id=$1 ORDER BY id`,
            [options.where.invoice_id],
          );
          return rows.map((row: Record<string, unknown>) =>
            Object.assign(new SalesReturn(), row),
          );
        }
        if (entity === SalesInvoiceItem)
          return invoiceItems(Number(options.where.invoice_id));
        return [];
      },
      createQueryBuilder: () => {
        const query = {
          innerJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
          getRawOne: jest.fn().mockResolvedValue({ total: 0 }),
        };
        return query;
      },
      save: async (value: SalesReturn | SalesInvoice) => {
        if (value instanceof SalesReturn) {
          await databaseRunner.query(
            `UPDATE ${tables.returns} SET status=$1 WHERE id=$2`,
            [value.status, value.id],
          );
        } else {
          await databaseRunner.query(
            `UPDATE ${tables.invoices} SET status=$1, payment_status=$2, final_amount=$3,
              partial_payment_amount=$4, remaining_amount=$5, cost_of_goods_sold=$6,
              gross_profit=$7, gross_profit_margin=$8 WHERE id=$9`,
            [
              value.status,
              value.payment_status,
              value.final_amount,
              value.partial_payment_amount,
              value.remaining_amount,
              value.cost_of_goods_sold,
              value.gross_profit,
              value.gross_profit_margin,
              value.id,
            ],
          );
        }
        return value;
      },
    };
    const transactionRunner = {
      manager,
      connect: async () => undefined,
      startTransaction: () => databaseRunner.startTransaction(),
      commitTransaction: () => databaseRunner.commitTransaction(),
      rollbackTransaction: () => databaseRunner.rollbackTransaction(),
      release: async () => undefined,
      query: (sql: string, parameters?: unknown[]) =>
        databaseRunner.query(sql, parameters),
    };
    const inventoryService = {
      removeSupplierSettlementForSalesReturn: jest
        .fn()
        .mockResolvedValue(undefined),
      processStockOut: jest.fn(
        async (
          productId: number,
          quantity: number,
          referenceType: string,
          _userId: number,
          referenceId: number,
          _notes: string,
          runner: {
            query: (sql: string, parameters?: unknown[]) => Promise<unknown[]>;
          },
          options: { batchId: number; taxableQuantity: number },
        ) => {
          await runner.query(
            `UPDATE ${tables.batches} SET remaining_quantity=remaining_quantity-$1,
            taxable_remaining_quantity=taxable_remaining_quantity-$2 WHERE id=$3 AND product_id=$4`,
            [quantity, options.taxableQuantity, options.batchId, productId],
          );
          await runner.query(
            `UPDATE ${tables.products} SET quantity=quantity-$1,
            taxable_quantity_stock=taxable_quantity_stock-$2 WHERE id=$3`,
            [quantity, options.taxableQuantity, productId],
          );
          await runner.query(
            `INSERT INTO ${tables.transactions}
            (reference_type, reference_id, product_id, quantity, taxable_quantity)
           VALUES ($1,$2,$3,$4,$5)`,
            [
              referenceType,
              referenceId,
              productId,
              quantity,
              options.taxableQuantity,
            ],
          );
        },
      ),
    };
    const service = Object.create(
      SalesReturnService.prototype,
    ) as SalesReturnService;
    Object.assign(service, {
      dataSource: { createQueryRunner: () => transactionRunner },
      inventoryService,
      customerRewardService: {
        syncInvoiceReward: jest.fn().mockResolvedValue(undefined),
      },
      promotionCampaignService: {
        processSalesReturnCancellationRestore: jest
          .fn()
          .mockRejectedValue(new Error('forced late cancellation failure')),
      },
      logger: { log: jest.fn(), error: jest.fn() },
    });

    await expect(service.cancel(1, 5)).rejects.toThrow(
      'forced late cancellation failure',
    );
    expect(inventoryService.processStockOut).toHaveBeenCalledWith(
      10,
      10,
      'RETURN_CANCEL',
      5,
      1,
      'Hủy phiếu trả hàng SR-1',
      transactionRunner,
      { batchId: 31, taxableQuantity: 3 },
    );

    const [returnRow] = await databaseRunner.query(
      `SELECT status FROM ${tables.returns} WHERE id=1`,
    );
    const [invoice] = await databaseRunner.query(
      `SELECT status, final_amount, cost_of_goods_sold FROM ${tables.invoices} WHERE id=7`,
    );
    const [product] = await databaseRunner.query(
      `SELECT quantity, taxable_quantity_stock FROM ${tables.products} WHERE id=10`,
    );
    const [batch] = await databaseRunner.query(
      `SELECT remaining_quantity, taxable_remaining_quantity FROM ${tables.batches} WHERE id=31`,
    );
    const [{ transactionCount }] = await databaseRunner.query(
      `SELECT COUNT(*)::int AS "transactionCount" FROM ${tables.transactions}`,
    );

    expect(returnRow.status).toBe('approved');
    expect(invoice.status).toBe('confirmed');
    expect(Number(invoice.final_amount)).toBe(900);
    expect(Number(invoice.cost_of_goods_sold)).toBe(18);
    expect(Number(product.quantity)).toBe(20);
    expect(Number(product.taxable_quantity_stock)).toBe(13);
    expect(Number(batch.remaining_quantity)).toBe(10);
    expect(Number(batch.taxable_remaining_quantity)).toBe(3);
    expect(Number(transactionCount)).toBe(0);
  });
});
