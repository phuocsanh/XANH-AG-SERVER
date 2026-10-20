import { BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryReturn } from '../../entities/inventory-returns.entity';
import { InventoryReturnRefund } from '../../entities/inventory-return-refunds.entity';
import { InventoryReturnItem } from '../../entities/inventory-return-items.entity';
import { InventoryReceipt } from '../../entities/inventory-receipts.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { InventoryBatch } from '../../entities/inventories.entity';
import { Product } from '../../entities/products.entity';
import { ReturnStatus } from './enums/return-status.enum';
import { DataSource } from 'typeorm';

describe('supplier return source-batch restoration', () => {
  it('rejects a supplier refund for a cancelled return before reading or writing refund records', async () => {
    const returnDoc = {
      id: 41,
      code: 'RT-CANCELLED-41',
      status: ReturnStatus.CANCELLED,
    };
    const manager = {
      findOne: jest.fn().mockResolvedValue(returnDoc),
      getRepository: jest.fn(),
    };
    const runner = {
      manager,
      connect: jest.fn(),
      startTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
    const service = Object.create(InventoryService.prototype) as any;
    service.inventoryReturnRepository = {
      manager: { connection: { createQueryRunner: () => runner } },
    };

    await expect(
      service.addRefund(
        41,
        { amount: 100, refund_method: 'cash' } as any,
        7,
      ),
    ).rejects.toThrow(
      'Không thể hoàn tiền hoặc cấn trừ cho phiếu trả nhà cung cấp RT-CANCELLED-41 vì phiếu đã hủy',
    );

    expect(manager.findOne).toHaveBeenCalledWith(InventoryReturn, {
      where: { id: 41 },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.getRepository).not.toHaveBeenCalled();
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('still records a refund for an active approved supplier return', async () => {
    const returnDoc = {
      id: 42,
      code: 'RT-APPROVED-42',
      status: ReturnStatus.APPROVED,
      receipt_id: 55,
      receipt: { supplier_amount: 1000, paid_amount: 1500 },
      total_amount: 500,
      refund_amount: 0,
    };
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    };
    const refund = { id: 77, return_id: 42, amount: 200 };
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(returnDoc)
        .mockResolvedValueOnce(returnDoc.receipt),
      getRepository: jest.fn((entity: Function) => {
        if (entity === InventoryReturn) {
          return { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) };
        }
        if (entity === InventoryReturnRefund) {
          return {
            create: jest.fn().mockReturnValue(refund),
            save: jest.fn().mockResolvedValue(refund),
          };
        }
        return {};
      }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const runner = {
      manager,
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
    const service = Object.create(InventoryService.prototype) as any;
    service.inventoryReturnRepository = {
      manager: { connection: { createQueryRunner: () => runner } },
    };
    service.logger = { log: jest.fn() };

    await expect(
      service.addRefund(
        42,
        { amount: 200, refund_method: 'cash' } as any,
        7,
      ),
    ).resolves.toBe(refund);

    expect(manager.update).toHaveBeenCalledWith(InventoryReturn, 42, {
      refund_amount: 200,
      refund_status: 'partial',
    });
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('restores each persisted batch allocation with its taxable quantity on cancellation', async () => {
    const returnDoc = Object.assign(new InventoryReturn(), {
      id: 9,
      code: 'RT-9',
      status: ReturnStatus.APPROVED,
    });
    const item = Object.assign(new InventoryReturnItem(), {
      id: 10,
      return_id: 9,
      product_id: 1,
      quantity: 5,
      base_quantity: 5,
      stock_allocations: [
        { batchId: 101, quantity: 3, taxableQuantity: 2 },
        { batchId: 102, quantity: 2, taxableQuantity: 0 },
      ],
    });
    const manager = {
      findOne: jest.fn().mockResolvedValue(returnDoc),
      find: jest.fn().mockResolvedValue([item]),
      save: jest.fn().mockResolvedValue(returnDoc),
    };
    const runner = {
      manager,
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
    const service = Object.create(InventoryService.prototype) as any;
    service.logger = { error: jest.fn(), log: jest.fn() };
    service.inventoryReturnRepository = {
      manager: { connection: { createQueryRunner: () => runner } },
    };
    service.restoreStockToExistingBatch = jest.fn().mockResolvedValue(undefined);
    service.recalculateAverageCostPriceForProducts = jest.fn().mockResolvedValue(undefined);

    await service.cancelReturn(9, 'test', 3);

    expect(manager.findOne).toHaveBeenCalledWith(InventoryReturn, {
      where: { id: 9 },
      lock: { mode: 'pessimistic_write' },
    });
    expect(service.restoreStockToExistingBatch.mock.calls).toEqual([
      [1, 101, 3, 2, 3, 9, 'RT-9', runner],
      [1, 102, 2, 0, 3, 9, 'RT-9', runner],
    ]);
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('restores supplier-return stock and tax totals on the exact allocated batches', async () => {
    const returnDoc = Object.assign(new InventoryReturn(), {
      id: 9,
      code: 'RT-9',
      status: ReturnStatus.APPROVED,
    });
    const item = Object.assign(new InventoryReturnItem(), {
      id: 10,
      return_id: 9,
      product_id: 1,
      quantity: 5,
      base_quantity: 5,
      stock_allocations: [
        { batchId: 101, quantity: 3, taxableQuantity: 2 },
        { batchId: 102, quantity: 2, taxableQuantity: 0 },
      ],
    });
    const product = { id: 1, quantity: 10, taxable_quantity_stock: 4, average_cost_price: '12' };
    const batches = {
      101: { id: 101, product_id: 1, receipt_item_id: 201, unit_cost_price: '10', remaining_quantity: 7, taxable_remaining_quantity: 4 },
      102: { id: 102, product_id: 1, receipt_item_id: 202, unit_cost_price: '8', remaining_quantity: 3, taxable_remaining_quantity: 0 },
    };
    const manager = {
      findOne: jest.fn(async (entity: Function, options: any) => {
        if (entity === InventoryReturn) return returnDoc;
        if (entity === Product) return product;
        if (entity === InventoryBatch) return batches[options.where.id as 101 | 102];
        return null;
      }),
      find: jest.fn().mockResolvedValue([item]),
      update: jest.fn(async (_entity, _id, values) => Object.assign(product, values)),
      save: jest.fn(async (value) => value),
    };
    const runner = {
      manager,
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
    const service = Object.create(InventoryService.prototype) as any;
    service.logger = { error: jest.fn(), log: jest.fn() };
    service.inventoryReturnRepository = {
      manager: { connection: { createQueryRunner: () => runner } },
    };
    service.getWeightedAverageCost = jest.fn().mockResolvedValue(12);
    service.createTransaction = jest.fn().mockResolvedValue({ id: 20 });
    service.recalculateAverageCostPriceForProducts = jest.fn().mockResolvedValue(undefined);

    await service.cancelReturn(9, 'test', 3);

    expect(batches[101]).toEqual({
      id: 101,
      product_id: 1,
      receipt_item_id: 201,
      unit_cost_price: '10',
      remaining_quantity: 10,
      taxable_remaining_quantity: 6,
    });
    expect(batches[102]).toEqual({
      id: 102,
      product_id: 1,
      receipt_item_id: 202,
      unit_cost_price: '8',
      remaining_quantity: 5,
      taxable_remaining_quantity: 0,
    });
    expect(product).toMatchObject({ quantity: 15, taxable_quantity_stock: 6 });
    expect(service.createTransaction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        product_id: 1,
        quantity: 3,
        reference_type: 'RETURN_CANCEL',
        receipt_item_id: 201,
      }),
      runner,
    );
    expect(service.createTransaction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        product_id: 1,
        quantity: 2,
        reference_type: 'RETURN_CANCEL',
        receipt_item_id: 202,
      }),
      runner,
    );
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('reverses linked receipt balances when an approved supplier return is cancelled', async () => {
    const returnDoc = Object.assign(new InventoryReturn(), {
      id: 9,
      code: 'RT-9',
      receipt_id: 55,
      total_amount: 100,
      refund_amount: 0,
      status: ReturnStatus.APPROVED,
    });
    const receipt = {
      id: 55,
      total_amount: 500,
      adjusted_amount: 20,
      returned_amount: 100,
      final_amount: 420,
      supplier_amount: 400,
      paid_amount: 100,
      supplier_settlement_mode: 'standard',
    };
    const item = Object.assign(new InventoryReturnItem(), {
      id: 10,
      return_id: 9,
      product_id: 1,
      stock_allocations: [{ batchId: 101, quantity: 1, taxableQuantity: 1 }],
    });
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(returnDoc)
        .mockResolvedValueOnce(receipt),
      find: jest.fn(async (entity: Function) => {
        if (entity === InventoryReturnItem) return [item];
        if (entity === InventoryReturnRefund) return [];
        if (entity === InventoryReturn) return [returnDoc];
        return [];
      }),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(returnDoc),
    };
    const runner = {
      manager,
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
    const service = Object.create(InventoryService.prototype) as any;
    service.logger = { error: jest.fn(), log: jest.fn() };
    service.inventoryReturnRepository = {
      manager: { connection: { createQueryRunner: () => runner } },
    };
    service.restoreStockToExistingBatch = jest.fn().mockResolvedValue(undefined);
    service.recalculateAverageCostPriceForProducts = jest
      .fn()
      .mockResolvedValue(undefined);

    await service.cancelReturn(9, 'test', 3);

    expect(manager.findOne).toHaveBeenNthCalledWith(2, InventoryReceipt, {
      where: { id: 55 },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.findOne.mock.invocationCallOrder[1]).toBeLessThan(
      service.restoreStockToExistingBatch.mock.invocationCallOrder[0],
    );
    expect(manager.update).toHaveBeenCalledWith(InventoryReceipt, 55, {
      returned_amount: 0,
      final_amount: 520,
      supplier_amount: 500,
      debt_amount: 400,
      payment_status: 'partial',
      has_returns: false,
    });
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('blocks cancellation before stock restoration when a supplier refund exists', async () => {
    const returnDoc = Object.assign(new InventoryReturn(), {
      id: 9,
      code: 'RT-9',
      receipt_id: 55,
      total_amount: 100,
      refund_amount: 50,
      status: ReturnStatus.APPROVED,
    });
    const manager = {
      findOne: jest.fn().mockResolvedValue(returnDoc),
      find: jest.fn().mockResolvedValue([{ id: 1, amount: 50 }]),
      update: jest.fn(),
      save: jest.fn(),
    };
    const runner = {
      manager,
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
    const service = Object.create(InventoryService.prototype) as any;
    service.logger = { error: jest.fn(), log: jest.fn() };
    service.inventoryReturnRepository = {
      manager: { connection: { createQueryRunner: () => runner } },
    };
    service.restoreStockToExistingBatch = jest.fn();

    await expect(service.cancelReturn(9, 'test', 3)).rejects.toThrow(
      'Không thể hủy phiếu trả nhà cung cấp RT-9 vì đã ghi nhận hoàn tiền 50đ. Hãy xử lý đảo chứng từ hoàn tiền trước.',
    );

    expect(service.restoreStockToExistingBatch).not.toHaveBeenCalled();
    expect(manager.update).not.toHaveBeenCalled();
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('reverses draft-return receipt accounting while preserving another active return', async () => {
    const returnDoc = Object.assign(new InventoryReturn(), {
      id: 9,
      code: 'RT-9',
      receipt_id: 55,
      total_amount: 100,
      refund_amount: 0,
      status: ReturnStatus.DRAFT,
    });
    const receipt = {
      id: 55,
      total_amount: 500,
      adjusted_amount: 0,
      returned_amount: 150,
      final_amount: 350,
      supplier_amount: 350,
      paid_amount: 0,
      supplier_settlement_mode: 'standard',
    };
    const otherReturn = Object.assign(new InventoryReturn(), {
      id: 11,
      receipt_id: 55,
      status: ReturnStatus.DRAFT,
    });
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(returnDoc)
        .mockResolvedValueOnce(receipt),
      find: jest.fn(async (entity: Function) => {
        if (entity === InventoryReturnRefund) return [];
        if (entity === InventoryReturn) return [returnDoc, otherReturn];
        return [];
      }),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(returnDoc),
    };
    const runner = {
      manager,
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
    const service = Object.create(InventoryService.prototype) as any;
    service.logger = { error: jest.fn(), log: jest.fn() };
    service.inventoryReturnRepository = {
      manager: { connection: { createQueryRunner: () => runner } },
    };
    service.restoreStockToExistingBatch = jest.fn();

    await service.cancelReturn(9, 'test', 3);

    expect(service.restoreStockToExistingBatch).not.toHaveBeenCalled();
    expect(manager.update).toHaveBeenCalledWith(InventoryReceipt, 55, {
      returned_amount: 50,
      final_amount: 450,
      supplier_amount: 450,
      debt_amount: 450,
      payment_status: 'unpaid',
      has_returns: true,
    });
  });

  it('blocks cancellation when the linked receipt has no matching returned amount', async () => {
    const returnDoc = Object.assign(new InventoryReturn(), {
      id: 9,
      code: 'RT-9',
      receipt_id: 55,
      total_amount: 100,
      refund_amount: 0,
      status: ReturnStatus.DRAFT,
    });
    const receipt = {
      id: 55,
      total_amount: 500,
      returned_amount: 0,
      supplier_amount: 500,
      paid_amount: 0,
    };
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(returnDoc)
        .mockResolvedValueOnce(receipt),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      save: jest.fn(),
    };
    const runner = {
      manager,
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
    const service = Object.create(InventoryService.prototype) as any;
    service.logger = { error: jest.fn(), log: jest.fn() };
    service.inventoryReturnRepository = {
      manager: { connection: { createQueryRunner: () => runner } },
    };

    await expect(service.cancelReturn(9, 'test', 3)).rejects.toThrow(
      'giá trị trả 100đ lớn hơn số đã ghi nhận trên phiếu nhập (0đ). Cần đối soát công nợ trước khi hủy.',
    );

    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('blocks cancellation with a precise error when a historical item has no allocations', async () => {
    const returnDoc = Object.assign(new InventoryReturn(), {
      id: 9,
      code: 'RT-9',
      status: ReturnStatus.APPROVED,
    });
    const item = Object.assign(new InventoryReturnItem(), {
      id: 10,
      return_id: 9,
      product_id: 42,
      quantity: 5,
      stock_allocations: [],
    });
    const manager = {
      findOne: jest.fn().mockResolvedValue(returnDoc),
      find: jest.fn().mockResolvedValue([item]),
      save: jest.fn().mockResolvedValue(returnDoc),
    };
    const runner = {
      manager,
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
    const service = Object.create(InventoryService.prototype) as any;
    service.logger = { error: jest.fn(), log: jest.fn() };
    service.inventoryReturnRepository = {
      manager: { connection: { createQueryRunner: () => runner } },
    };
    service.restoreStockToExistingBatch = jest.fn();
    service.processStockIn = jest.fn();

    await expect(service.cancelReturn(9, 'test', 3)).rejects.toThrow(
      'Không thể hủy phiếu trả nhà cung cấp RT-9: các dòng #10 (sản phẩm #42) thiếu dữ liệu phân bổ lô (stock_allocations). Để tránh hoàn sai lô và tồn thuế, vui lòng đối soát thủ công trước khi hủy.',
    );

    expect(service.restoreStockToExistingBatch).not.toHaveBeenCalled();
    expect(service.processStockIn).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
    expect(runner.commitTransaction).not.toHaveBeenCalled();
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it.each([null, undefined, Number.NaN])(
    'rejects an unknown cancellation tax snapshot (%s) instead of restoring zero tax',
    async (taxableQuantity) => {
      const returnDoc = Object.assign(new InventoryReturn(), {
        id: 9, code: 'RT-NULL-TAX', status: ReturnStatus.APPROVED,
      });
      const item = Object.assign(new InventoryReturnItem(), {
        id: 10, return_id: 9, product_id: 42, quantity: 5,
        stock_allocations: [{ batchId: 101, quantity: 5, taxableQuantity }],
      });
      const manager = {
        findOne: jest.fn().mockResolvedValue(returnDoc),
        find: jest.fn().mockResolvedValue([item]),
        save: jest.fn().mockResolvedValue(returnDoc),
      };
      const runner = {
        manager, connect: jest.fn(), startTransaction: jest.fn(),
        commitTransaction: jest.fn(), rollbackTransaction: jest.fn(), release: jest.fn(),
      };
      const service = Object.create(InventoryService.prototype) as any;
      service.logger = { error: jest.fn(), log: jest.fn() };
      service.inventoryReturnRepository = {
        manager: { connection: { createQueryRunner: () => runner } },
      };
      service.restoreStockToExistingBatch = jest.fn().mockResolvedValue(undefined);
      service.recalculateAverageCostPriceForProducts = jest.fn().mockResolvedValue(undefined);

      await expect(service.cancelReturn(9, 'test', 3)).rejects.toThrow(
        'Allocation thuế của phiếu trả hàng RT-NULL-TAX không hợp lệ',
      );

      expect(service.restoreStockToExistingBatch).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
      expect(runner.commitTransaction).not.toHaveBeenCalled();
      expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    },
  );

  it('locks the return row before checking whether approval is already complete', async () => {
    const returnDoc = Object.assign(new InventoryReturn(), {
      id: 9,
      code: 'RT-9',
      status: ReturnStatus.APPROVED,
    });
    const manager = {
      findOne: jest.fn().mockResolvedValue(returnDoc),
    };
    const runner = {
      manager,
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
    const service = Object.create(InventoryService.prototype) as any;
    service.logger = { error: jest.fn(), log: jest.fn() };
    service.inventoryReturnRepository = {
      manager: { connection: { createQueryRunner: () => runner } },
    };

    await service.approveReturn(9, 3);

    expect(manager.findOne).toHaveBeenCalledWith(InventoryReturn, {
      where: { id: 9 },
      lock: { mode: 'pessimistic_write' },
    });
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(runner.release).toHaveBeenCalledTimes(1);
  });
});

describe('supplier return lifecycle locking', () => {
  function setup(status: ReturnStatus) {
    const returnDoc = Object.assign(new InventoryReturn(), {
      id: 9,
      code: 'RT-9',
      status,
    });
    const manager = {
      findOne: jest.fn().mockResolvedValue(returnDoc),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((_entity, data) => data),
      save: jest.fn().mockResolvedValue(returnDoc),
    };
    const runner = {
      manager,
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
    const service = Object.create(InventoryService.prototype) as any;
    service.inventoryReturnRepository = {
      manager: { connection: { createQueryRunner: () => runner } },
    };
    service.findReturnById = jest.fn().mockResolvedValue(returnDoc);
    service.handleInventoryImageUpdate = jest.fn().mockResolvedValue(undefined);
    return { returnDoc, manager, runner, service };
  }

  it('rechecks draft status under a row lock before editing', async () => {
    const h = setup(ReturnStatus.APPROVED);

    await expect(
      h.service.updateReturn(9, { notes: 'late edit' }, 3),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(h.manager.findOne).toHaveBeenCalledWith(InventoryReturn, {
      where: { id: 9 },
      lock: { mode: 'pessimistic_write' },
    });
    expect(h.manager.update).not.toHaveBeenCalled();
    expect(h.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('locks and rechecks status before deleting a return', async () => {
    const h = setup(ReturnStatus.APPROVED);

    await expect(h.service.removeReturn(9)).rejects.toThrow(
      'Không thể xóa phiếu xuất trả hàng đã được duyệt.',
    );

    expect(h.manager.findOne).toHaveBeenCalledWith(InventoryReturn, {
      where: { id: 9 },
      lock: { mode: 'pessimistic_write' },
    });
    expect(h.manager.delete).not.toHaveBeenCalled();
    expect(h.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('deletes a draft return and its items in one transaction', async () => {
    const h = setup(ReturnStatus.DRAFT);

    await h.service.removeReturn(9);

    expect(h.manager.delete).toHaveBeenNthCalledWith(1, InventoryReturnItem, {
      return_id: 9,
    });
    expect(h.manager.delete).toHaveBeenNthCalledWith(2, InventoryReturn, 9);
    expect(h.runner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it.each(['approveReturn', 'cancelReturn'] as const)(
    'ends the transaction before returning when %s finds no return',
    async (operation) => {
      const manager = { findOne: jest.fn().mockResolvedValue(null) };
      const runner = {
        manager,
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };
      const service = Object.create(InventoryService.prototype) as any;
      service.logger = { error: jest.fn(), log: jest.fn() };
      service.inventoryReturnRepository = {
        manager: { connection: { createQueryRunner: () => runner } },
      };

      if (operation === 'approveReturn') {
        await service.approveReturn(99, 3);
      } else {
        await service.cancelReturn(99, 'missing', 3);
      }

      expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(runner.rollbackTransaction).not.toHaveBeenCalled();
      expect(runner.release).toHaveBeenCalledTimes(1);
    },
  );
});

const describePostgres = process.env.TAX_BACKFILL_TEST_URL ? describe : describe.skip;

describePostgres('supplier return cancellation PostgreSQL rollback', () => {
  let connection: DataSource;
  let databaseRunner: ReturnType<DataSource['createQueryRunner']>;
  let tables: Record<string, string>;

  beforeAll(async () => {
    const suffix = `${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
    tables = {
      returns: `tax_supplier_return_${suffix}`,
      items: `tax_supplier_return_items_${suffix}`,
      refunds: `tax_supplier_return_refunds_${suffix}`,
      receipts: `tax_supplier_return_receipts_${suffix}`,
      products: `tax_supplier_return_products_${suffix}`,
      batches: `tax_supplier_return_batches_${suffix}`,
      transactions: `tax_supplier_return_transactions_${suffix}`,
    };
    const targetHost = new URL(process.env.TAX_BACKFILL_TEST_URL!).hostname;
    if (targetHost !== 'ep-broad-pine-a1675nqi-pooler.ap-southeast-1.aws.neon.tech') {
      throw new Error(`Supplier-return integration tests are restricted to the dev DB host, got ${targetHost}`);
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
    // Pin TEMP fixtures to one Neon pooler session and roll back the whole suite.
    await databaseRunner.startTransaction();
    await databaseRunner.query(`
      CREATE TEMP TABLE ${tables.returns} (
        id integer PRIMARY KEY, code text NOT NULL, status text NOT NULL
          CHECK (status <> 'cancelled'), receipt_id integer,
        total_amount numeric NOT NULL, refund_amount numeric NOT NULL DEFAULT 0,
        cancelled_at timestamptz, cancelled_reason text
      );
      CREATE TEMP TABLE ${tables.items} (
        id integer PRIMARY KEY, return_id integer NOT NULL, product_id integer NOT NULL,
        stock_allocations jsonb NOT NULL
      );
      CREATE TEMP TABLE ${tables.refunds} (return_id integer NOT NULL, amount numeric NOT NULL);
      CREATE TEMP TABLE ${tables.receipts} (
        id integer PRIMARY KEY, total_amount numeric NOT NULL, adjusted_amount numeric NOT NULL,
        returned_amount numeric NOT NULL, final_amount numeric NOT NULL,
        supplier_amount numeric NOT NULL, paid_amount numeric NOT NULL,
        supplier_settlement_mode text NOT NULL, debt_amount numeric NOT NULL,
        payment_status text NOT NULL, has_returns boolean NOT NULL
      );
      CREATE TEMP TABLE ${tables.products} (
        id integer PRIMARY KEY, quantity numeric NOT NULL, taxable_quantity_stock numeric NOT NULL
      );
      CREATE TEMP TABLE ${tables.batches} (
        id integer PRIMARY KEY, product_id integer NOT NULL, receipt_item_id integer,
        unit_cost_price numeric NOT NULL, remaining_quantity numeric NOT NULL,
        taxable_remaining_quantity numeric NOT NULL
      );
      CREATE TEMP TABLE ${tables.transactions} (
        id serial PRIMARY KEY, reference_type text NOT NULL, reference_id integer NOT NULL,
        product_id integer NOT NULL, quantity numeric NOT NULL, receipt_item_id integer
      );
    `);
  });

  afterAll(async () => {
    if (databaseRunner?.isTransactionActive) {
      await databaseRunner.rollbackTransaction();
    }
    if (databaseRunner && tables) {
      await databaseRunner.release();
    }
    if (connection?.isInitialized) await connection.destroy();
  });

  it('rolls lot, product tax, and receipt accounting back if final cancellation save fails', async () => {
    await databaseRunner.query(`
      INSERT INTO ${tables.returns}
        (id, code, status, receipt_id, total_amount, refund_amount)
      VALUES (9, 'RT-9', 'approved', 55, 100, 0);
      INSERT INTO ${tables.items} VALUES
        (10, 9, 1, '[{"batchId":101,"quantity":3,"taxableQuantity":2}]'::jsonb);
      INSERT INTO ${tables.receipts} VALUES
        (55, 500, 20, 100, 420, 400, 100, 'standard', 300, 'partial', true);
      INSERT INTO ${tables.products} VALUES (1, 10, 4);
      INSERT INTO ${tables.batches} VALUES (101, 1, 201, 10, 7, 4);
    `);

    const manager = {
      findOne: async (entity: Function, options: { where: { id: number } }) => {
        const id = options.where.id;
        if (entity === InventoryReturn) {
          const [row] = await databaseRunner.query(
            `SELECT * FROM ${tables.returns} WHERE id=$1`, [id],
          );
          return row ? Object.assign(new InventoryReturn(), row) : null;
        }
        if (entity === InventoryReceipt) {
          const [row] = await databaseRunner.query(
            `SELECT * FROM ${tables.receipts} WHERE id=$1`, [id],
          );
          return row ? Object.assign(new InventoryReceipt(), row) : null;
        }
        if (entity === Product) {
          const [row] = await databaseRunner.query(
            `SELECT * FROM ${tables.products} WHERE id=$1`, [id],
          );
          return row ? Object.assign(new Product(), row) : null;
        }
        if (entity === InventoryBatch) {
          const [row] = await databaseRunner.query(
            `SELECT * FROM ${tables.batches} WHERE id=$1`, [id],
          );
          return row ? Object.assign(new InventoryBatch(), row) : null;
        }
        return null;
      },
      find: async (entity: Function, options: { where: { return_id?: number; receipt_id?: number } }) => {
        if (entity === InventoryReturnItem) {
          const rows = await databaseRunner.query(
            `SELECT * FROM ${tables.items} WHERE return_id=$1 ORDER BY id`,
            [options.where.return_id],
          );
          return rows.map((row: Record<string, unknown>) =>
            Object.assign(new InventoryReturnItem(), row),
          );
        }
        if (entity === InventoryReturnRefund) return [];
        if (entity === InventoryReturn) {
          const rows = await databaseRunner.query(
            `SELECT * FROM ${tables.returns} WHERE receipt_id=$1 ORDER BY id`,
            [options.where.receipt_id],
          );
          return rows.map((row: Record<string, unknown>) =>
            Object.assign(new InventoryReturn(), row),
          );
        }
        return [];
      },
      update: async (entity: Function, id: number, values: Record<string, unknown>) => {
        if (entity === Product) {
          return databaseRunner.query(
            `UPDATE ${tables.products} SET quantity=$1, taxable_quantity_stock=$2 WHERE id=$3`,
            [values.quantity, values.taxable_quantity_stock, id],
          );
        }
        if (entity === InventoryReceipt) {
          return databaseRunner.query(
            `UPDATE ${tables.receipts} SET returned_amount=$1, final_amount=$2,
              supplier_amount=$3, debt_amount=$4, payment_status=$5, has_returns=$6 WHERE id=$7`,
            [values.returned_amount, values.final_amount, values.supplier_amount,
              values.debt_amount, values.payment_status, values.has_returns, id],
          );
        }
        throw new Error(`Unexpected update entity ${entity.name}`);
      },
      save: async (value: InventoryBatch | InventoryReturn) => {
        if (value instanceof InventoryBatch) {
          await databaseRunner.query(
            `UPDATE ${tables.batches} SET remaining_quantity=$1,
              taxable_remaining_quantity=$2 WHERE id=$3`,
            [value.remaining_quantity, value.taxable_remaining_quantity, value.id],
          );
          return value;
        }
        return databaseRunner.query(
          `UPDATE ${tables.returns} SET status=$1, cancelled_at=$2,
            cancelled_reason=$3 WHERE id=$4`,
          [value.status, value.cancelled_at, value.cancelled_reason, value.id],
        );
      },
    };
    const transactionRunner = {
      manager,
      connect: async () => undefined,
      startTransaction: () => databaseRunner.startTransaction(),
      commitTransaction: () => databaseRunner.commitTransaction(),
      rollbackTransaction: () => databaseRunner.rollbackTransaction(),
      release: async () => undefined,
      query: (sql: string, parameters?: unknown[]) => databaseRunner.query(sql, parameters),
    };
    const service = Object.create(InventoryService.prototype) as InventoryService;
    (service as any).logger = { error: jest.fn(), log: jest.fn() };
    (service as any).inventoryReturnRepository = {
      manager: { connection: { createQueryRunner: () => transactionRunner } },
    };
    jest.spyOn(service, 'getWeightedAverageCost').mockResolvedValue(10);
    const createTransaction = jest.spyOn(service, 'createTransaction').mockImplementation(async (dto, runner) => {
      const [row] = await runner!.query(
        `INSERT INTO ${tables.transactions}
          (reference_type, reference_id, product_id, quantity, receipt_item_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [dto.reference_type, dto.reference_id, dto.product_id, dto.quantity, dto.receipt_item_id ?? null],
      );
      return row as never;
    });
    (service as any).recalculateAverageCostPriceForProducts = jest.fn().mockResolvedValue(undefined);

    await expect(service.cancelReturn(9, 'integration failure', 3)).rejects.toMatchObject({
      driverError: expect.objectContaining({ code: '23514' }),
    });
    expect(createTransaction).toHaveBeenCalledTimes(1);

    const [batch] = await databaseRunner.query(
      `SELECT remaining_quantity, taxable_remaining_quantity FROM ${tables.batches} WHERE id=101`,
    );
    const [product] = await databaseRunner.query(
      `SELECT quantity, taxable_quantity_stock FROM ${tables.products} WHERE id=1`,
    );
    const [receipt] = await databaseRunner.query(
      `SELECT returned_amount, final_amount, supplier_amount, debt_amount, payment_status, has_returns
       FROM ${tables.receipts} WHERE id=55`,
    );
    const [returnRow] = await databaseRunner.query(
      `SELECT status FROM ${tables.returns} WHERE id=9`,
    );
    const [{ transactionCount }] = await databaseRunner.query(
      `SELECT COUNT(*)::int AS "transactionCount" FROM ${tables.transactions}`,
    );

    expect(Number(batch.remaining_quantity)).toBe(7);
    expect(Number(batch.taxable_remaining_quantity)).toBe(4);
    expect(Number(product.quantity)).toBe(10);
    expect(Number(product.taxable_quantity_stock)).toBe(4);
    expect(Number(receipt.returned_amount)).toBe(100);
    expect(Number(receipt.final_amount)).toBe(420);
    expect(Number(receipt.supplier_amount)).toBe(400);
    expect(Number(receipt.debt_amount)).toBe(300);
    expect(receipt.payment_status).toBe('partial');
    expect(receipt.has_returns).toBe(true);
    expect(returnRow.status).toBe('approved');
    expect(Number(transactionCount)).toBe(0);
  });
});

describe('supplier return source resolution on approval', () => {
  function setupApproval(
    receiptItems: InventoryReceiptItem[],
    itemData: Partial<InventoryReturnItem> = {},
  ) {
    const returnDoc = Object.assign(new InventoryReturn(), {
      id: 9,
      code: 'RT-9',
      receipt_id: 55,
      status: ReturnStatus.DRAFT,
    });
    const item = Object.assign(new InventoryReturnItem(), {
      id: 10,
      return_id: 9,
      product_id: 1,
      quantity: 5,
      unit_id: 2,
      unit_cost: 10,
      ...itemData,
    });
    const manager = {
      findOne: jest.fn().mockResolvedValue(returnDoc),
      find: jest.fn(async (entity: Function) => {
        if (entity === InventoryReturnItem) return [item];
        if (entity === InventoryReceiptItem) return receiptItems;
        return [];
      }),
      save: jest.fn(async (value) => value),
    };
    const runner = {
      manager,
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
    const service = Object.create(InventoryService.prototype) as any;
    service.logger = { error: jest.fn(), log: jest.fn() };
    service.inventoryReturnRepository = {
      manager: { connection: { createQueryRunner: () => runner } },
    };
    service.processStockOut = jest.fn().mockResolvedValue({
      affectedBatches: [
        { batchId: 501, deductedQuantity: 5, taxableQuantity: 2 },
      ],
    });
    service.recalculateAverageCostPriceForProducts = jest
      .fn()
      .mockResolvedValue(undefined);
    return { item, manager, runner, service };
  }

  function receiptLine(id: number): InventoryReceiptItem {
    return Object.assign(new InventoryReceiptItem(), {
      id,
      receipt_id: 55,
      product_id: 1,
      quantity: 20,
      base_quantity: 20,
      unit_id: 2,
      unit_name: 'Chai',
      conversion_factor: 1,
      unit_cost: 10,
      final_unit_cost: 10,
    });
  }

  it('resolves and persists the unique source for a legacy return item', async () => {
    const h = setupApproval([receiptLine(101)]);

    await h.service.approveReturn(9, 3);

    expect(h.service.processStockOut).toHaveBeenCalledWith(
      1,
      5,
      'RETURN',
      3,
      9,
      'Trả hàng cho nhà cung cấp - Phiếu RT-9',
      h.runner,
      { receiptItemId: 101 },
    );
    expect(h.item.receipt_item_id).toBe(101);
    expect(h.item.base_quantity).toBe(5);
    expect(h.item.stock_allocations).toEqual([
      { batchId: 501, quantity: 5, taxableQuantity: 2 },
    ]);
  });

  it('honors the explicitly selected receipt line when a product has multiple lines', async () => {
    const h = setupApproval([receiptLine(101), receiptLine(102)], {
      receipt_item_id: 102,
    });

    await h.service.approveReturn(9, 3);

    expect(h.service.processStockOut).toHaveBeenCalledWith(
      1,
      5,
      'RETURN',
      3,
      9,
      'Trả hàng cho nhà cung cấp - Phiếu RT-9',
      h.runner,
      { receiptItemId: 102 },
    );
  });

  it('persists an explicit zero-tax snapshot when approving a non-taxable supplier return', async () => {
    const h = setupApproval([receiptLine(101)], { receipt_item_id: 101 });
    h.service.processStockOut.mockResolvedValue({
      affectedBatches: [{
        batchId: 501,
        deductedQuantity: 5,
        taxableQuantity: 0,
      }],
    });

    await h.service.approveReturn(9, 3);

    expect(h.item.stock_allocations).toEqual([
      { batchId: 501, quantity: 5, taxableQuantity: 0 },
    ]);
    expect(h.manager.save).toHaveBeenCalledWith(h.item);
    expect(h.runner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it.each([1, 50])(
    'uses receipt factor %s instead of submitted conversion and preserves stock-out tax',
    async (factor) => {
      const source = receiptLine(101);
      source.conversion_factor = factor;
      source.base_quantity = 20 * factor;
      const h = setupApproval([source], {
        receipt_item_id: 101,
        conversion_factor: 7,
        base_quantity: 999,
      });
      h.service.processStockOut.mockResolvedValue({
        affectedBatches: [{
          batchId: 501,
          deductedQuantity: 5 * factor,
          taxableQuantity: 3 * factor,
        }],
      });

      await h.service.approveReturn(9, 3);

      expect(h.service.processStockOut).toHaveBeenCalledWith(
        1, 5 * factor, 'RETURN', 3, 9,
        'Trả hàng cho nhà cung cấp - Phiếu RT-9',
        h.runner, { receiptItemId: 101 },
      );
      expect(h.item.conversion_factor).toBe(factor);
      expect(h.item.base_quantity).toBe(5 * factor);
      expect(h.item.stock_allocations).toEqual([{
        batchId: 501, quantity: 5 * factor, taxableQuantity: 3 * factor,
      }]);
      expect(h.manager.save).toHaveBeenCalledWith(h.item);
      expect(h.runner.commitTransaction).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { receipt_item_id: 999 },
    { receipt_item_id: 101, product_id: 2 },
  ])('rejects a mismatched selected source before stock-out: %j', async (item) => {
    const h = setupApproval([receiptLine(101)], item);

    await expect(h.service.approveReturn(9, 3)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(h.service.processStockOut).not.toHaveBeenCalled();
    expect(h.manager.save).not.toHaveBeenCalled();
    expect(h.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.runner.commitTransaction).not.toHaveBeenCalled();
  });

  it('blocks a legacy return when its source line is ambiguous', async () => {
    const h = setupApproval([receiptLine(101), receiptLine(102)]);

    await expect(h.service.approveReturn(9, 3)).rejects.toThrow(
      'không xác định được duy nhất dòng nhập',
    );

    expect(h.service.processStockOut).not.toHaveBeenCalled();
    expect(h.runner.commitTransaction).not.toHaveBeenCalled();
    expect(h.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('supplier return quantity budget per receipt line', () => {
  function setup(
    requested: Array<{ receiptItemId: number; quantity: number }>,
    existingReturns: InventoryReturn[] = [],
  ) {
    const receiptItems = [101, 102].map((id) => Object.assign(new InventoryReceiptItem(), {
      id, receipt_id: 55, product_id: 1, quantity: 10, base_quantity: 10,
      conversion_factor: 1, unit_id: 2, unit_cost: 10, final_unit_cost: 10,
    }));
    const items = requested.map((row, index) => Object.assign(new InventoryReturnItem(), {
      id: index + 10, return_id: 9, product_id: 1, receipt_item_id: row.receiptItemId,
      unit_id: 2, quantity: row.quantity, unit_cost: 10, total_price: row.quantity * 10,
    }));
    const returnDoc = Object.assign(new InventoryReturn(), {
      id: 9, code: 'RT-BUDGET', receipt_id: 55, status: ReturnStatus.DRAFT,
    });
    const manager = {
      findOne: jest.fn().mockResolvedValue(returnDoc),
      find: jest.fn(async (entity: Function) => {
        if (entity === InventoryReceiptItem) return receiptItems;
        if (entity === InventoryReturnItem) return items;
        if (entity === InventoryReturn) return existingReturns;
        return [];
      }),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((_entity, data) => data),
      save: jest.fn(async (value) => value),
    };
    const runner = {
      manager, connect: jest.fn(), startTransaction: jest.fn(),
      commitTransaction: jest.fn(), rollbackTransaction: jest.fn(), release: jest.fn(),
    };
    const createQueryRunner = jest.fn(() => runner);
    const service = Object.create(InventoryService.prototype) as any;
    service.logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
    service.inventoryReturnRepository = {
      manager: { ...manager, connection: { createQueryRunner } },
    };
    service.processStockOut = jest.fn(async (_productId: number, quantity: number) => ({
      affectedBatches: [{ batchId: 501, deductedQuantity: quantity, taxableQuantity: quantity }],
    }));
    service.recalculateAverageCostPriceForProducts = jest.fn().mockResolvedValue(undefined);
    service.findReturnById = jest.fn().mockResolvedValue(returnDoc);
    service.handleInventoryImageUpdate = jest.fn().mockResolvedValue(undefined);
    return { service, manager, runner, items, createQueryRunner };
  }

  it('rejects duplicate receipt lines exceeding the received quantity before creating a return', async () => {
    const h = setup([{ receiptItemId: 101, quantity: 6 }, { receiptItemId: 101, quantity: 6 }]);

    await expect(h.service.createReturn({
      return_code: 'RT-BUDGET', receipt_id: 55, supplier_id: 1,
      total_amount: 120, reason: 'test', created_by: 3, items: h.items,
    }, 3)).rejects.toThrow('Tổng số lượng trả quy đổi (12) vượt quá số lượng nhập quy đổi (10)');

    expect(h.createQueryRunner).not.toHaveBeenCalled();
    expect(h.manager.save).not.toHaveBeenCalled();
  });

  it('rejects cumulative duplicate lines before approving or deducting any stock', async () => {
    const h = setup([{ receiptItemId: 101, quantity: 6 }, { receiptItemId: 101, quantity: 6 }]);

    await expect(h.service.approveReturn(9, 3)).rejects.toThrow('Tổng số lượng trả quy đổi (12)');

    expect(h.service.processStockOut).not.toHaveBeenCalled();
    expect(h.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.runner.commitTransaction).not.toHaveBeenCalled();
  });

  it('includes previous active returns when summing duplicate lines of the new return', async () => {
    const prior = Object.assign(new InventoryReturn(), {
      id: 8, receipt_id: 55, status: ReturnStatus.APPROVED,
      items: [Object.assign(new InventoryReturnItem(), {
        product_id: 1, receipt_item_id: 101, unit_id: 2, quantity: 2, unit_cost: 10,
      })],
    });
    const h = setup([{ receiptItemId: 101, quantity: 4 }, { receiptItemId: 101, quantity: 5 }], [prior]);

    await expect(h.service.approveReturn(9, 3)).rejects.toThrow('Tổng số lượng trả quy đổi (11)');
    expect(h.service.processStockOut).not.toHaveBeenCalled();
  });

  it('allows duplicate lines whose combined quantity exactly matches the receipt line', async () => {
    const h = setup([{ receiptItemId: 101, quantity: 4 }, { receiptItemId: 101, quantity: 6 }]);

    await h.service.approveReturn(9, 3);

    expect(h.service.processStockOut.mock.calls.map((call: unknown[]) => call[1])).toEqual([4, 6]);
    expect(h.runner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('keeps separate receipt-line budgets for the same product', async () => {
    const h = setup([{ receiptItemId: 101, quantity: 6 }, { receiptItemId: 102, quantity: 6 }]);

    await h.service.approveReturn(9, 3);

    expect(h.service.processStockOut.mock.calls.map((call: unknown[]) => call[7])).toEqual([
      { receiptItemId: 101 }, { receiptItemId: 102 },
    ]);
    expect(h.runner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('does not count the current return or cancelled returns against the available budget', async () => {
    const existing = [
      Object.assign(new InventoryReturn(), { id: 9, status: ReturnStatus.DRAFT }),
      Object.assign(new InventoryReturn(), { id: 8, status: ReturnStatus.CANCELLED }),
    ].map((doc) => Object.assign(doc, {
      receipt_id: 55, items: [Object.assign(new InventoryReturnItem(), {
        product_id: 1, receipt_item_id: 101, unit_id: 2, quantity: 10, unit_cost: 10,
      })],
    }));
    const h = setup([{ receiptItemId: 101, quantity: 4 }, { receiptItemId: 101, quantity: 6 }], existing);

    await h.service.approveReturn(9, 3);
    expect(h.runner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('checks the combined quantity again when editing a draft return', async () => {
    const h = setup([{ receiptItemId: 101, quantity: 6 }, { receiptItemId: 101, quantity: 6 }]);

    await expect(h.service.updateReturn(9, { items: h.items }, 3)).rejects.toThrow(
      'Tổng số lượng trả quy đổi (12)',
    );

    expect(h.manager.delete).not.toHaveBeenCalled();
    expect(h.manager.save).not.toHaveBeenCalled();
    expect(h.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.runner.commitTransaction).not.toHaveBeenCalled();
  });

  it.each([undefined, []])('rejects switching the receipt without replacement items (%s)', async (items) => {
    const h = setup([{ receiptItemId: 101, quantity: 4 }]);

    await expect(h.service.updateReturn(9, { receipt_id: 56, items }, 3)).rejects.toThrow(
      'chọn lại danh sách hàng trả',
    );

    expect(h.manager.update).not.toHaveBeenCalled();
    expect(h.manager.delete).not.toHaveBeenCalled();
    expect(h.runner.commitTransaction).not.toHaveBeenCalled();
    expect(h.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('allows switching the receipt with explicitly selected replacement source lines', async () => {
    const h = setup([{ receiptItemId: 101, quantity: 4 }]);
    const replacementSource = Object.assign(new InventoryReceiptItem(), {
      id: 201, receipt_id: 56, product_id: 1, quantity: 10, base_quantity: 10,
      conversion_factor: 1, unit_id: 2, unit_cost: 10, final_unit_cost: 10,
    });
    h.manager.find.mockImplementation(async (entity: Function) =>
      entity === InventoryReceiptItem ? [replacementSource] : [],
    );
    const replacement = { ...h.items[0], receipt_item_id: 201 };

    await h.service.updateReturn(9, { receipt_id: 56, items: [replacement] }, 3);

    expect(h.manager.update).toHaveBeenCalledWith(InventoryReturn, 9, {
      receipt_id: 56, updated_by: 3,
    });
    expect(h.manager.create).toHaveBeenCalledWith(InventoryReturnItem, expect.objectContaining({
      receipt_item_id: 201, product_id: 1, quantity: 4,
    }));
    expect(h.runner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('preserves the existing source lines when editing notes on the same receipt', async () => {
    const h = setup([{ receiptItemId: 101, quantity: 4 }]);

    await h.service.updateReturn(9, { receipt_id: 55, notes: 'Updated draft note' }, 3);

    expect(h.manager.delete).not.toHaveBeenCalled();
    expect(h.manager.save).not.toHaveBeenCalled();
    expect(h.runner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  function setupDraftWaitingForReceipt(receiptId: number, requestedQuantity: number) {
    const receiptItemId = receiptId === 55 ? 101 : 201;
    const h = setup([{ receiptItemId, quantity: requestedQuantity }]);
    const trace: string[] = [];
    let receiptLocked = false;
    const current = Object.assign(new InventoryReturn(), {
      id: 9, code: 'RT-BUDGET', receipt_id: 55, status: ReturnStatus.DRAFT,
    });
    const source = Object.assign(new InventoryReceiptItem(), {
      id: receiptItemId, receipt_id: receiptId, product_id: 1, quantity: 10, base_quantity: 10,
      conversion_factor: 1, unit_id: 2, unit_cost: 10, final_unit_cost: 10,
    });
    const competingReturn = Object.assign(new InventoryReturn(), {
      id: 8, receipt_id: receiptId, status: ReturnStatus.DRAFT,
      items: [Object.assign(new InventoryReturnItem(), {
        product_id: 1, receipt_item_id: receiptItemId, quantity: 6, unit_id: 2, unit_cost: 10,
      })],
    });
    h.manager.findOne.mockImplementation(async (entity: Function, options: { where: { id: number } }) => {
      if (entity === InventoryReceipt) {
        receiptLocked = options.where.id === receiptId;
        trace.push('receipt-lock');
        return Object.assign(new InventoryReceipt(), { id: receiptId });
      }
      return current;
    });
    h.manager.find.mockImplementation(async (entity: Function) => {
      if (entity === InventoryReceiptItem) return [source];
      if (entity === InventoryReturn) {
        trace.push('budget-read');
        return receiptLocked ? [competingReturn] : [];
      }
      return [];
    });
    h.manager.update.mockImplementation(async () => { trace.push('write'); });
    return { ...h, trace };
  }

  it.each([55, 56])('rejects a draft increase exceeding the budget committed before receipt #%s was locked', async (receiptId) => {
    const h = setupDraftWaitingForReceipt(receiptId, 6);

    await expect(h.service.updateReturn(9, { receipt_id: receiptId, items: h.items }, 3))
      .rejects.toBeInstanceOf(BadRequestException);

    expect(h.manager.findOne).toHaveBeenCalledWith(InventoryReceipt, {
      where: { id: receiptId }, lock: { mode: 'pessimistic_write' },
    });
    expect(h.trace).toEqual(['receipt-lock', 'budget-read']);
    expect(h.manager.update).not.toHaveBeenCalled();
    expect(h.manager.delete).not.toHaveBeenCalled();
    expect(h.manager.save).not.toHaveBeenCalled();
    expect(h.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.runner.commitTransaction).not.toHaveBeenCalled();
  });

  it.each([55, 56])('accepts the exact remaining draft quantity only after receipt #%s is locked and checked', async (receiptId) => {
    const h = setupDraftWaitingForReceipt(receiptId, 4);

    await h.service.updateReturn(9, { receipt_id: receiptId, items: h.items }, 3);

    expect(h.manager.findOne).toHaveBeenCalledWith(InventoryReceipt, {
      where: { id: receiptId }, lock: { mode: 'pessimistic_write' },
    });
    expect(h.trace).toEqual(['receipt-lock', 'budget-read', 'write']);
    expect(h.runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(h.runner.rollbackTransaction).not.toHaveBeenCalled();
  });
});

describe('supplier return receipt budget after waiting for the source lock', () => {
  function setup(requestedQuantity: number, priorStatus = ReturnStatus.DRAFT) {
    const trace: string[] = [];
    const source = Object.assign(new InventoryReceiptItem(), {
      id: 101, receipt_id: 55, product_id: 1, quantity: 10, base_quantity: 10,
      conversion_factor: 1, unit_id: 2, unit_cost: 10,
    });
    const prior = Object.assign(new InventoryReturn(), {
      id: 8, receipt_id: 55, status: priorStatus,
      items: [Object.assign(new InventoryReturnItem(), {
        product_id: 1, receipt_item_id: 101, quantity: 6, unit_id: 2, unit_cost: 10,
      })],
    });
    const activeAmount = priorStatus === ReturnStatus.CANCELLED ? 0 : 60;
    const receipt = Object.assign(new InventoryReceipt(), {
      id: 55, total_amount: 100, supplier_amount: 100 - activeAmount,
      final_amount: 100 - activeAmount, returned_amount: activeAmount, paid_amount: 0,
    });
    let savedReturn: InventoryReturn | undefined;
    const manager = {
      findOne: jest.fn(async (entity: Function) => {
        if (entity === InventoryReceipt) {
          trace.push('receipt-locked-after-competing-return-committed');
          return receipt;
        }
        return null;
      }),
      find: jest.fn(async (entity: Function) => {
        if (entity === InventoryReceiptItem) return [source];
        if (entity === InventoryReturn) {
          trace.push('locked-budget-read');
          return [prior];
        }
        return [];
      }),
      create: jest.fn((entity: new () => object, data: object) => Object.assign(new entity(), data)),
      save: jest.fn(async (value: InventoryReturn | InventoryReturnItem) => {
        if (value instanceof InventoryReturn) {
          value.id = 9;
          savedReturn = value;
        } else {
          value.id = 10;
        }
        return value;
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const runner = {
      manager, connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(), release: jest.fn(),
    };
    const outsideManager = {
      find: jest.fn(async (entity: Function) => {
        if (entity === InventoryReceiptItem) return [source];
        trace.push('initial-budget-read');
        return [];
      }),
      connection: { createQueryRunner: () => runner },
    };
    const service = Object.create(InventoryService.prototype) as any;
    service.inventoryReturnRepository = {
      manager: outsideManager,
      findOne: jest.fn(async () => savedReturn),
    };
    service.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    service.markInventoryImagesAsUsed = jest.fn().mockResolvedValue(undefined);
    service.processStockOut = jest.fn();
    const dto = {
      return_code: 'RT-CONTENTION', receipt_id: 55, supplier_id: 1,
      total_amount: requestedQuantity * 10, reason: 'test', created_by: 3,
      items: [{ product_id: 1, receipt_item_id: 101, unit_id: 2,
        quantity: requestedQuantity, unit_cost: 10, total_price: requestedQuantity * 10 }],
    };
    return { service, manager, runner, dto, trace };
  }

  it('rechecks the committed quantity under the receipt lock and rejects with HTTP 400 before writing', async () => {
    const h = setup(6);

    await expect(h.service.createReturn(h.dto, 3)).rejects.toBeInstanceOf(BadRequestException);

    expect(h.manager.findOne).toHaveBeenCalledWith(InventoryReceipt, {
      where: { id: 55 }, lock: { mode: 'pessimistic_write' },
    });
    expect(h.trace).toEqual([
      'initial-budget-read', 'receipt-locked-after-competing-return-committed', 'locked-budget-read',
    ]);
    expect(h.manager.create).not.toHaveBeenCalled();
    expect(h.manager.save).not.toHaveBeenCalled();
    expect(h.manager.update).not.toHaveBeenCalled();
    expect(h.service.processStockOut).not.toHaveBeenCalled();
    expect(h.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.runner.commitTransaction).not.toHaveBeenCalled();
  });

  it('allows the exact remaining quantity after rechecking the committed competing return', async () => {
    const h = setup(4);

    await h.service.createReturn(h.dto, 3);

    expect(h.trace).toEqual([
      'initial-budget-read', 'receipt-locked-after-competing-return-committed', 'locked-budget-read',
    ]);
    expect(h.runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(h.runner.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('allows stock released by a competing return that was cancelled before the lock was acquired', async () => {
    const h = setup(10, ReturnStatus.CANCELLED);

    await h.service.createReturn(h.dto, 3);

    expect(h.trace).toContain('locked-budget-read');
    expect(h.runner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('still rolls back and reports unexpected write failures', async () => {
    const h = setup(4);
    h.manager.save.mockRejectedValue(new Error('write failed'));

    await expect(h.service.createReturn(h.dto, 3)).rejects.toThrow('Không thể tạo phiếu trả hàng: write failed');
    expect(h.runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(h.runner.commitTransaction).not.toHaveBeenCalled();
  });
});
