import { QueryRunner } from 'typeorm';
import { Product, ProductCostingMethod } from '../../entities/products.entity';
import {
  SalesInvoice,
  SalesInvoiceStatus,
} from '../../entities/sales-invoices.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';
import { CustomerRewardInvoiceTracking } from '../../entities/customer-reward-invoice-tracking.entity';
import { CustomerRewardTracking } from '../../entities/customer-reward-tracking.entity';
import { CustomerRewardService } from '../customer-reward/customer-reward.service';
import { SalesService } from './sales.service';

describe('SalesService.create response', () => {
  it('returns the taxable quantity written by inventory deduction', async () => {
    let createdInvoice: any;
    let createdItem: any;
    let persistedTaxableQuantity = 0;
    let transactionCommitted = false;
    const operationOrder: string[] = [];

    const product = {
      id: 190,
      name: 'TILMIL SUPER 550SE (250ml)',
      unit_id: 1,
      unit: { name: 'Chai' },
      unit_conversions: [],
      costing_method: ProductCostingMethod.FIXED,
      average_cost_price: '100000',
      tax_selling_price: '0',
      exclude_from_reward: true,
    };
    const customerTracking = Object.assign(new CustomerRewardTracking(), {
      customer_id: 7,
      pending_amount: 100,
      total_accumulated: 100,
      reward_count: 0,
    });
    const invoiceTracking = new Map<number, CustomerRewardInvoiceTracking>();
    const returnQuery = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const insertQuery = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    };

    const manager = {
      queryRunner: { isTransactionActive: true },
      find: jest.fn().mockImplementation(async (entity: unknown) => {
        if (entity === Product) return [product];
        if (entity === SalesInvoiceItem && createdItem) return [createdItem];
        return [];
      }),
      findOne: jest
        .fn()
        .mockImplementation(async (entity: unknown, options: any) => {
          if (entity === Product) return product;
          if (entity === SalesInvoice) return createdInvoice;
          if (entity === CustomerRewardInvoiceTracking) {
            return invoiceTracking.get(options.where.invoice_id) || null;
          }
          if (entity === CustomerRewardTracking) return customerTracking;
          return null;
        }),
      findOneOrFail: jest.fn().mockResolvedValue(customerTracking),
      create: jest.fn().mockImplementation((entity: unknown, values: any) => {
        if (entity === SalesInvoice) {
          createdInvoice = { ...values, id: 792 };
          return createdInvoice;
        }
        if (entity === CustomerRewardInvoiceTracking) {
          return Object.assign(new CustomerRewardInvoiceTracking(), values);
        }
        createdItem = { ...values, id: 1892, taxable_quantity: 0 };
        return createdItem;
      }),
      save: jest.fn().mockImplementation(async (value: any) => {
        if (value instanceof CustomerRewardInvoiceTracking) {
          invoiceTracking.set(value.invoice_id, value);
        }
        return value;
      }),
      createQueryBuilder: jest.fn((entity?: unknown) =>
        entity === SalesReturnItem ? returnQuery : insertQuery,
      ),
      update: jest
        .fn()
        .mockImplementation(
          async (entity: unknown, _id: number, values: any) => {
            if (entity === SalesInvoiceItem) {
              Object.assign(createdItem, values);
              if ('taxable_quantity' in values) {
                persistedTaxableQuantity = values.taxable_quantity;
              }
            }
            return { affected: 1 };
          },
        ),
    };

    const queryRunner = {
      manager,
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockImplementation(async () => {
        transactionCommitted = true;
      }),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    } as unknown as QueryRunner;
    const customerRewardService = Object.assign(
      Object.create(CustomerRewardService.prototype),
      {},
    ) as CustomerRewardService;
    const snapshotInvoiceRewardPolicy = jest
      .spyOn(customerRewardService, 'snapshotInvoiceRewardPolicy')
      .mockImplementation(async (snapshotManager, snapshotInvoice) => {
        expect(transactionCommitted).toBe(false);
        operationOrder.push('snapshot');
        await CustomerRewardService.prototype.snapshotInvoiceRewardPolicy.call(
          customerRewardService,
          snapshotManager,
          snapshotInvoice,
        );
      });

    const service = Object.create(SalesService.prototype) as SalesService;
    Object.assign(service, {
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      salesInvoiceRepository: {
        manager: {
          connection: {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
          },
        },
      },
      dataSource: {},
      inventoryService: {
        syncSupplierSettlementForPostedInvoice: jest.fn(),
      },
      promotionCampaignService: { processInvoiceAccrual: jest.fn() },
      customerRewardService,
    });

    jest
      .spyOn(service as any, 'assertInvoiceProductMixingAllowed')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'postInvoiceFinancialEntries')
      .mockImplementation(async () => {
        operationOrder.push('financial-entries');
      });
    jest
      .spyOn(service as any, 'handleInventoryDeduction')
      .mockImplementation(async () => {
        persistedTaxableQuantity = 15;
        return true;
      });
    jest
      .spyOn(service as any, 'handleInvoiceGiftStockOut')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'syncPostedInvoiceCostSnapshot')
      .mockResolvedValue(undefined);
    jest.spyOn(service, 'findOne').mockImplementation(async () => {
      expect(transactionCommitted).toBe(false);
      return {
        ...createdInvoice,
        items: [{ ...createdItem, taxable_quantity: persistedTaxableQuantity }],
      } as SalesInvoice;
    });

    const invoice = await service.create(
      {
        status: SalesInvoiceStatus.CONFIRMED,
        customer_id: 7,
        season_id: 4,
        customer_name: 'Test',
        total_amount: 140000,
        final_amount: 140000,
        payment_method: 'cash',
        partial_payment_amount: 140000,
        items: [{ product_id: 190, quantity: 1, unit_price: 140000 }],
      },
      2,
    );

    expect(invoice.items?.[0]?.taxable_quantity).toBe(15);
    expect(createdItem.exclude_from_reward).toBe(true);
    expect(invoiceTracking.get(792)?.accumulated_amount).toBe(0);
    expect(customerTracking.pending_amount).toBe(100);
    expect(customerTracking.total_accumulated).toBe(100);
    expect(service.findOne).toHaveBeenCalledWith(792, queryRunner);
    expect(snapshotInvoiceRewardPolicy).toHaveBeenCalledWith(
      queryRunner.manager,
      expect.objectContaining({
        id: 792,
        status: SalesInvoiceStatus.CONFIRMED,
      }),
    );
    expect(snapshotInvoiceRewardPolicy).toHaveBeenCalledTimes(1);
    expect(operationOrder.indexOf('snapshot')).toBeLessThan(
      operationOrder.indexOf('financial-entries'),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it.each([
    { productExcluded: true, expectedContribution: 0, expectedPending: 100 },
    { productExcluded: false, expectedContribution: 500, expectedPending: 600 },
  ])(
    'chụp cờ và ghi đúng tích lũy khi xác nhận hóa đơn nháp (excluded=$productExcluded)',
    async ({ productExcluded, expectedContribution, expectedPending }) => {
      const sequence: string[] = [];
      const invoice = Object.assign(new SalesInvoice(), {
        id: 901,
        customer_id: 7,
        status: SalesInvoiceStatus.DRAFT,
        reward_policy_version: 1,
        final_amount: 1000,
        partial_payment_amount: 500,
      });
      const invoiceItems = [
        Object.assign(new SalesInvoiceItem(), {
          id: 1901,
          invoice_id: 901,
          product_id: 190,
          quantity: 10,
          base_quantity: 10,
          total_price: 1000,
          exclude_from_reward: false,
        }),
      ];
      const product = Object.assign(new Product(), {
        id: 190,
        exclude_from_reward: productExcluded,
      });
      const customerTracking = Object.assign(new CustomerRewardTracking(), {
        customer_id: 7,
        pending_amount: 100,
        total_accumulated: 100,
        reward_count: 0,
      });
      const invoiceTracking = new Map<number, CustomerRewardInvoiceTracking>();
      const returnQuery = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      const insertQuery = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      const manager = {
        queryRunner: { isTransactionActive: true },
        findOne: jest
          .fn()
          .mockImplementation(async (entity: unknown, options: any) => {
            if (entity === SalesInvoice) return invoice;
            if (entity === CustomerRewardInvoiceTracking) {
              return invoiceTracking.get(options.where.invoice_id) || null;
            }
            if (entity === CustomerRewardTracking) return customerTracking;
            return null;
          }),
        find: jest.fn(async (entity: unknown) => {
          if (entity === SalesInvoiceItem) return invoiceItems;
          if (entity === Product) return [product];
          return [];
        }),
        findOneOrFail: jest.fn().mockResolvedValue(customerTracking),
        create: jest.fn((entity: new () => object, values: object) =>
          Object.assign(new entity(), values),
        ),
        update: jest.fn(
          async (_entity: unknown, id: number, values: object) => {
            Object.assign(invoiceItems.find((item) => item.id === id)!, values);
            return { affected: 1 };
          },
        ),
        save: jest.fn(async (value: object) => {
          if (value === invoice) sequence.push('save');
          if (value instanceof CustomerRewardInvoiceTracking) {
            invoiceTracking.set(value.invoice_id, value);
          }
          return value;
        }),
        createQueryBuilder: jest.fn((entity?: unknown) =>
          entity === SalesReturnItem ? returnQuery : insertQuery,
        ),
      };
      const queryRunner = {
        manager,
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
      } as unknown as QueryRunner;
      const customerRewardService = Object.create(
        CustomerRewardService.prototype,
      ) as CustomerRewardService;
      const snapshotInvoiceRewardPolicy = jest
        .spyOn(customerRewardService, 'snapshotInvoiceRewardPolicy')
        .mockImplementation(async (snapshotManager, snapshotInvoice) => {
          sequence.push('snapshot');
          expect(invoice.status).toBe(SalesInvoiceStatus.DRAFT);
          await CustomerRewardService.prototype.snapshotInvoiceRewardPolicy.call(
            customerRewardService,
            snapshotManager,
            snapshotInvoice,
          );
        });
      const syncInvoiceReward = jest
        .spyOn(customerRewardService, 'syncInvoiceReward')
        .mockImplementation(async (syncManager, invoiceId) => {
          sequence.push('sync');
          await CustomerRewardService.prototype.syncInvoiceReward.call(
            customerRewardService,
            syncManager,
            invoiceId,
          );
        });
      const service = Object.create(SalesService.prototype) as SalesService;
      Object.assign(service, {
        dataSource: {
          createQueryRunner: jest.fn().mockReturnValue(queryRunner),
        },
        customerRewardService,
        logger: { error: jest.fn() },
      });
      jest
        .spyOn(service as any, 'assertInvoiceProductMixingAllowed')
        .mockResolvedValue(undefined);

      Object.assign(service, {
        promotionCampaignService: { processInvoiceAccrual: jest.fn() },
        inventoryService: { syncSupplierSettlementForPostedInvoice: jest.fn() },
      });
      jest.spyOn(service as any, 'postInvoiceFinancialEntries').mockResolvedValue(undefined);
      jest.spyOn(service, 'handleInventoryDeduction').mockResolvedValue(true);
      jest.spyOn(service as any, 'handleInvoiceGiftStockOut').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'syncPostedInvoiceCostSnapshot').mockResolvedValue(undefined);
      const confirmed = await service.confirmInvoice(901, 1);

      expect(confirmed?.status).toBe(SalesInvoiceStatus.CONFIRMED);
      expect(manager.find).toHaveBeenCalledWith(SalesInvoiceItem, {
        where: { invoice_id: 901 },
      });
      expect(snapshotInvoiceRewardPolicy).toHaveBeenCalledWith(
        manager,
        invoice,
      );
      expect(syncInvoiceReward).toHaveBeenCalledWith(manager, 901);
      expect(sequence).toEqual(['snapshot', 'save', 'sync']);
      expect(invoiceItems[0]?.exclude_from_reward).toBe(productExcluded);
      expect(invoiceTracking.get(901)?.accumulated_amount).toBe(
        expectedContribution,
      );
      expect(customerTracking.pending_amount).toBe(expectedPending);
      expect(customerTracking.total_accumulated).toBe(expectedPending);
      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    },
  );

  it('không xác nhận hóa đơn khi thiếu người thao tác', async () => {
    const invoice = { id: 950, status: SalesInvoiceStatus.DRAFT };
    const runner = { manager: { findOne: jest.fn().mockResolvedValue(invoice), find: jest.fn().mockResolvedValue([]), save: jest.fn() },
      connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(), rollbackTransaction: jest.fn(), release: jest.fn() };
    const service = Object.create(SalesService.prototype) as SalesService;
    Object.assign(service, { dataSource: { createQueryRunner: () => runner }, logger: { error: jest.fn() },
      assertInvoiceProductMixingAllowed: jest.fn() });
    await expect(service.confirmInvoice(950)).rejects.toThrow('Cần xác định người thao tác');
    expect(runner.manager.save).not.toHaveBeenCalled();
    expect(runner.rollbackTransaction).toHaveBeenCalled();
  });

  it('không chụp lại cờ sản phẩm khi xác nhận lặp hóa đơn đã CONFIRMED', async () => {
    const invoice = Object.assign(new SalesInvoice(), {
      id: 902,
      customer_id: 7,
      status: SalesInvoiceStatus.CONFIRMED,
      reward_policy_version: 1,
    });
    const manager = {
      findOne: jest.fn().mockResolvedValue(invoice),
      find: jest.fn(),
      save: jest.fn(),
    };
    const queryRunner = {
      manager,
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    } as unknown as QueryRunner;
    const snapshotInvoiceRewardPolicy = jest.fn().mockResolvedValue(undefined);
    const syncInvoiceReward = jest.fn().mockResolvedValue(undefined);
    const service = Object.create(SalesService.prototype) as SalesService;
    Object.assign(service, {
      dataSource: { createQueryRunner: jest.fn().mockReturnValue(queryRunner) },
      customerRewardService: {
        snapshotInvoiceRewardPolicy,
        syncInvoiceReward,
      },
      logger: { error: jest.fn() },
    });

    const result = await service.confirmInvoice(902);

    expect(result).toBe(invoice);
    expect(snapshotInvoiceRewardPolicy).not.toHaveBeenCalled();
    expect(syncInvoiceReward).not.toHaveBeenCalled();
    expect(manager.find).not.toHaveBeenCalled();
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('rollback xác nhận khi sản phẩm của dòng hóa đơn không còn tồn tại', async () => {
    const invoice = Object.assign(new SalesInvoice(), {
      id: 903,
      customer_id: 7,
      status: SalesInvoiceStatus.DRAFT,
      reward_policy_version: 1,
    });
    const invoiceItems = [
      Object.assign(new SalesInvoiceItem(), {
        id: 1903,
        invoice_id: 903,
        product_id: 999,
      }),
    ];
    const manager = {
      queryRunner: { isTransactionActive: true },
      findOne: jest
        .fn()
        .mockImplementation(async (entity: unknown) =>
          entity === SalesInvoice ? invoice : null,
        ),
      find: jest
        .fn()
        .mockImplementation(async (entity: unknown) =>
          entity === SalesInvoiceItem ? invoiceItems : [],
        ),
    };
    const queryRunner = {
      manager,
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    } as unknown as QueryRunner;
    const customerRewardService = Object.create(
      CustomerRewardService.prototype,
    ) as CustomerRewardService;
    const service = Object.create(SalesService.prototype) as SalesService;
    Object.assign(service, {
      dataSource: { createQueryRunner: jest.fn().mockReturnValue(queryRunner) },
      customerRewardService,
      logger: { error: jest.fn() },
    });
    jest
      .spyOn(service as any, 'assertInvoiceProductMixingAllowed')
      .mockResolvedValue(undefined);

    await expect(service.confirmInvoice(903, 1)).rejects.toThrow(
      'Không tìm thấy sản phẩm #999 để chốt tích lũy',
    );

    expect(invoice.status).toBe(SalesInvoiceStatus.DRAFT);
    expect(manager.find).toHaveBeenCalledWith(
      Product,
      expect.objectContaining({
        where: expect.objectContaining({ id: expect.anything() }),
      }),
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('rollback xác nhận hóa đơn không có dòng sản phẩm để chụp tích lũy', async () => {
    const invoice = Object.assign(new SalesInvoice(), {
      id: 904,
      customer_id: 7,
      status: SalesInvoiceStatus.DRAFT,
      reward_policy_version: 1,
    });
    const manager = {
      queryRunner: { isTransactionActive: true },
      findOne: jest.fn().mockResolvedValue(invoice),
      find: jest.fn().mockResolvedValue([]),
    };
    const queryRunner = {
      manager,
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    } as unknown as QueryRunner;
    const customerRewardService = Object.create(
      CustomerRewardService.prototype,
    ) as CustomerRewardService;
    const service = Object.create(SalesService.prototype) as SalesService;
    Object.assign(service, {
      dataSource: { createQueryRunner: jest.fn().mockReturnValue(queryRunner) },
      customerRewardService,
      logger: { error: jest.fn() },
    });
    jest
      .spyOn(service as any, 'assertInvoiceProductMixingAllowed')
      .mockResolvedValue(undefined);

    await expect(service.confirmInvoice(904, 1)).rejects.toThrow(
      'Hóa đơn chưa có sản phẩm để chốt tích lũy',
    );

    expect(invoice.status).toBe(SalesInvoiceStatus.DRAFT);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('hủy hóa đơn lúa giống vẫn chạy luồng đảo kho và quyết toán NCC', async () => {
    const invoice = Object.assign(new SalesInvoice(), {
      id: 905,
      customer_id: 7,
      status: SalesInvoiceStatus.CONFIRMED,
      reward_policy_version: 1,
      final_amount: 1000,
      partial_payment_amount: 500,
      remaining_amount: 500,
      code: 'TEST-905',
    });
    const items = [
      Object.assign(new SalesInvoiceItem(), {
        id: 1905,
        invoice_id: 905,
        product_id: 190,
        quantity: 1,
        base_quantity: 1,
        total_price: 500,
        exclude_from_reward: true,
        costing_method_snapshot: ProductCostingMethod.BY_PRICE_TYPE,
      }),
      Object.assign(new SalesInvoiceItem(), {
        id: 1906,
        invoice_id: 905,
        product_id: 191,
        quantity: 1,
        base_quantity: 1,
        total_price: 500,
        exclude_from_reward: false,
      }),
    ];
    const invoiceTracking = Object.assign(new CustomerRewardInvoiceTracking(), {
      invoice_id: 905,
      customer_id: 7,
      accumulated_amount: 250,
    });
    const customerTracking = Object.assign(new CustomerRewardTracking(), {
      customer_id: 7,
      pending_amount: 300,
      total_accumulated: 1000,
      reward_count: 0,
    });
    const insertQuery = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    };
    const returnQuery = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const manager = {
      queryRunner: { isTransactionActive: true },
      findOne: jest.fn().mockImplementation(async (entity: unknown) => {
        if (entity === SalesInvoice) return invoice;
        if (entity === CustomerRewardInvoiceTracking) return invoiceTracking;
        if (entity === CustomerRewardTracking) return customerTracking;
        return null;
      }),
      find: jest
        .fn()
        .mockImplementation(async (entity: unknown) =>
          entity === SalesInvoiceItem ? items : [],
        ),
      findOneOrFail: jest.fn().mockResolvedValue(customerTracking),
      save: jest.fn().mockImplementation(async (value: object) => value),
      createQueryBuilder: jest.fn((entity?: unknown) =>
        entity === SalesReturnItem ? returnQuery : insertQuery,
      ),
    };
    const queryRunner = {
      manager,
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    } as unknown as QueryRunner;
    const customerRewardService = Object.create(
      CustomerRewardService.prototype,
    ) as CustomerRewardService;
    const syncInvoiceReward = jest.spyOn(
      customerRewardService,
      'syncInvoiceReward',
    );
    const service = Object.create(SalesService.prototype) as SalesService;
    Object.assign(service, {
      dataSource: { createQueryRunner: jest.fn().mockReturnValue(queryRunner) },
      customerRewardService,
      debtNoteService: { removeInvoiceFromDebtNote: jest.fn() },
      logger: { error: jest.fn() },
    });
    jest
      .spyOn(service as any, 'createRefundPaymentForInvoice')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'handleInventoryRestoration')
      .mockResolvedValue(undefined);
    const restoreInventory = jest.spyOn(service as any, 'handleInventoryRestoration');
    jest
      .spyOn(service as any, 'handleInvoiceGiftStockRestoration')
      .mockResolvedValue(undefined);

    const cancelled = await service.cancelInvoice(905);

    expect(cancelled?.status).toBe(SalesInvoiceStatus.CANCELLED);
    expect(restoreInventory).toHaveBeenCalledWith(905, undefined, queryRunner);
    expect(syncInvoiceReward).toHaveBeenCalledWith(manager, 905);
    expect(invoiceTracking.accumulated_amount).toBe(0);
    expect(customerTracking.pending_amount).toBe(50);
    expect(customerTracking.total_accumulated).toBe(750);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('thu hồi phần tích lũy đủ điều kiện khi hoàn tiền hóa đơn đã thanh toán', async () => {
    const invoice = Object.assign(new SalesInvoice(), {
      id: 906,
      customer_id: 7,
      status: SalesInvoiceStatus.PAID,
      reward_policy_version: 1,
      final_amount: 1000,
      partial_payment_amount: 1000,
      remaining_amount: 0,
      code: 'TEST-906',
    });
    const items = [
      Object.assign(new SalesInvoiceItem(), {
        id: 1907,
        invoice_id: 906,
        product_id: 190,
        quantity: 1,
        base_quantity: 1,
        total_price: 500,
        exclude_from_reward: true,
      }),
      Object.assign(new SalesInvoiceItem(), {
        id: 1908,
        invoice_id: 906,
        product_id: 191,
        quantity: 1,
        base_quantity: 1,
        total_price: 500,
        exclude_from_reward: false,
      }),
    ];
    const invoiceTracking = Object.assign(new CustomerRewardInvoiceTracking(), {
      invoice_id: 906,
      customer_id: 7,
      accumulated_amount: 500,
    });
    const customerTracking = Object.assign(new CustomerRewardTracking(), {
      customer_id: 7,
      pending_amount: 700,
      total_accumulated: 1700,
      reward_count: 0,
    });
    const insertQuery = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    };
    const returnQuery = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const manager = {
      queryRunner: { isTransactionActive: true },
      findOne: jest.fn().mockImplementation(async (entity: unknown) => {
        if (entity === SalesInvoice) return invoice;
        if (entity === CustomerRewardInvoiceTracking) return invoiceTracking;
        if (entity === CustomerRewardTracking) return customerTracking;
        return null;
      }),
      find: jest
        .fn()
        .mockImplementation(async (entity: unknown) =>
          entity === SalesInvoiceItem ? items : [],
        ),
      findOneOrFail: jest.fn().mockResolvedValue(customerTracking),
      save: jest.fn().mockImplementation(async (value: object) => value),
      createQueryBuilder: jest.fn((entity?: unknown) =>
        entity === SalesReturnItem ? returnQuery : insertQuery,
      ),
    };
    const queryRunner = {
      manager,
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    } as unknown as QueryRunner;
    const customerRewardService = Object.create(
      CustomerRewardService.prototype,
    ) as CustomerRewardService;
    const syncInvoiceReward = jest.spyOn(
      customerRewardService,
      'syncInvoiceReward',
    );
    const service = Object.create(SalesService.prototype) as SalesService;
    Object.assign(service, {
      dataSource: { createQueryRunner: jest.fn().mockReturnValue(queryRunner) },
      customerRewardService,
      debtNoteService: { removeInvoiceFromDebtNote: jest.fn() },
      logger: { error: jest.fn() },
    });
    jest
      .spyOn(service as any, 'createRefundPaymentForInvoice')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'handleInventoryRestoration')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'handleInvoiceGiftStockRestoration')
      .mockResolvedValue(undefined);

    const refunded = await service.refundInvoice(906);

    expect(refunded?.status).toBe(SalesInvoiceStatus.REFUNDED);
    expect(syncInvoiceReward).toHaveBeenCalledWith(manager, 906);
    expect(invoiceTracking.accumulated_amount).toBe(0);
    expect(customerTracking.pending_amount).toBe(200);
    expect(customerTracking.total_accumulated).toBe(1200);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });
});
