import { EntityManager } from 'typeorm';
import { Payment } from '../../entities/payment.entity';
import { PaymentAllocation } from '../../entities/payment-allocation.entity';
import { CustomerRewardService } from './customer-reward.service';
import { PaymentAllocationService } from '../payment-allocation/payment-allocation.service';
import { CreatePaymentAllocationDto } from '../payment-allocation/dto/create-payment-allocation.dto';
import { CustomerRewardTracking } from '../../entities/customer-reward-tracking.entity';
import { CustomerRewardInvoiceTracking } from '../../entities/customer-reward-invoice-tracking.entity';
import {
  SalesInvoice,
  SalesInvoiceStatus,
} from '../../entities/sales-invoices.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';
import { Product } from '../../entities/products.entity';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';

/** Mô phỏng repository cục bộ; các phép tính/ghi chênh lệch chạy bằng service thật. */
function setup() {
  const payment = Object.assign(new Payment(), {
    id: 3,
    customer_id: 7,
    amount: 500,
    allocated_amount: 0,
    created_by: 9,
  });
  const bill: SalesInvoice = Object.assign(new SalesInvoice(), {
    id: 1,
    customer_id: 7,
    season_id: 3,
    reward_policy_version: 1,
    status: SalesInvoiceStatus.CONFIRMED,
    final_amount: 1000,
    partial_payment_amount: 500,
    remaining_amount: 500,
  });
  const invoices = [bill];
  const debtNote = Object.assign(new DebtNote(), {
    id: 9,
    code: 'DN-TEST',
    customer_id: 7,
    season_id: 3,
    amount: 1000,
    paid_amount: 0,
    remaining_amount: 1000,
    source_invoices: [1],
    status: DebtNoteStatus.ACTIVE,
  });
  const items = [
    Object.assign(new SalesInvoiceItem(), {
      id: 11,
      invoice_id: 1,
      product_id: 1,
      quantity: 10,
      base_quantity: 10,
      total_price: 600,
      exclude_from_reward: false,
    }),
    Object.assign(new SalesInvoiceItem(), {
      id: 12,
      invoice_id: 1,
      product_id: 2,
      quantity: 10,
      base_quantity: 10,
      total_price: 400,
      exclude_from_reward: true,
    }),
  ];
  const products = [
    Object.assign(new Product(), { id: 1, exclude_from_reward: false }),
    Object.assign(new Product(), { id: 2, exclude_from_reward: true }),
  ];
  const tracking = Object.assign(new CustomerRewardTracking(), {
    customer_id: 7,
    pending_amount: 100,
    total_accumulated: 100,
    reward_count: 0,
  });
  const ledger = new Map<number, CustomerRewardInvoiceTracking>();
  const returns: SalesReturnItem[] = [];
  const query = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getMany: jest.fn(async () => returns),
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({}),
  };
  const invoiceAllocationQuery = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getMany: jest.fn(async () => [bill]),
  };
  const state = {
    queryRunner: { isTransactionActive: true },
    findOne: jest.fn(
      async (
        entity: unknown,
        options: { where: { id?: number; invoice_id?: number } },
      ) => {
        if (entity === Payment) return payment;
        if (entity === SalesInvoice)
          return (
            invoices.find((invoice) => invoice.id === options.where.id) || null
          );
        if (entity === DebtNote) return debtNote;
        if (entity === CustomerRewardInvoiceTracking)
          return ledger.get(options.where.invoice_id || 0) || null;
        if (entity === CustomerRewardTracking) return tracking;
        return null;
      },
    ),
    findOneOrFail: jest.fn(async () => tracking),
    find: jest.fn(
      async (entity: unknown, options?: { where: { invoice_id?: number } }) => {
        if (entity === SalesInvoiceItem)
          return items.filter(
            (item) => item.invoice_id === options?.where.invoice_id,
          );
        if (entity === Product) return products;
        if (entity === SalesInvoice) return invoices;
        if (entity === CustomerRewardInvoiceTracking)
          return [...ledger.values()];
        return [];
      },
    ),
    create: jest.fn((entity: new () => object, values: object) =>
      Object.assign(new entity(), values),
    ),
    save: jest.fn(async (value: object) => {
      if (value instanceof CustomerRewardInvoiceTracking)
        ledger.set(value.invoice_id, value);
      return value;
    }),
    update: jest.fn(async (entity: unknown, id: number, values: object) => {
      if (entity === SalesInvoiceItem)
        Object.assign(items.find((row) => row.id === id)!, values);
      return { affected: 1 };
    }),
    getRepository: jest.fn((entity: unknown) => ({
      findOne: jest.fn(async () =>
        entity === CustomerRewardTracking ? tracking : null,
      ),
    })),
    createQueryBuilder: jest.fn((entity: unknown) =>
      entity === SalesInvoice ? invoiceAllocationQuery : query,
    ),
  };
  const manager = state as unknown as EntityManager;
  const service = Object.assign(
    Object.create(CustomerRewardService.prototype),
    {
      DEFAULT_REWARD_THRESHOLD: 70000000,
      rewardTrackingRepository: { findOne: jest.fn(async () => tracking) },
      debtNoteRepository: { manager, find: jest.fn().mockResolvedValue([]) },
      rewardHistoryRepository: { find: jest.fn().mockResolvedValue([]) },
      systemSettingRepository: { findOne: jest.fn().mockResolvedValue(null) },
    },
  ) as CustomerRewardService;
  return {
    service,
    payment,
    debtNote,
    invoices,
    manager,
    state,
    bill,
    items,
    products,
    tracking,
    ledger,
    returns,
    query,
  };
}

describe('Ghi tích lũy hóa đơn trong CustomerRewardService', () => {
  it('cộng 300 khi thu 500 của đơn có 600/1000 tiền hàng đủ điều kiện; gọi lặp không cộng lại', async () => {
    const t = setup();
    await t.service.syncInvoiceReward(t.manager, 1);
    await t.service.syncInvoiceReward(t.manager, 1);
    expect(t.tracking.pending_amount).toBe(400);
    expect(t.tracking.total_accumulated).toBe(400);
    expect(t.ledger.get(1)?.accumulated_amount).toBe(300);
    expect(t.state.findOneOrFail).toHaveBeenCalledTimes(1);
  });

  it('chỉ cộng phần mới khi trả tiếp, rồi thu hồi đúng 600 khi hoàn toàn bộ', async () => {
    const t = setup();
    await t.service.syncInvoiceReward(t.manager, 1);
    t.bill.partial_payment_amount = 1000;
    await t.service.syncInvoiceReward(t.manager, 1);
    expect(t.tracking.pending_amount).toBe(700);
    t.bill.status = SalesInvoiceStatus.REFUNDED;
    t.bill.partial_payment_amount = 0;
    await t.service.syncInvoiceReward(t.manager, 1);
    expect(t.tracking.pending_amount).toBe(100);
    expect(t.tracking.total_accumulated).toBe(100);
    expect(t.ledger.get(1)?.accumulated_amount).toBe(0);
  });

  it('loại hết sản phẩm thì không thay đổi tích lũy khách hàng', async () => {
    const t = setup();
    t.items.forEach((item) => {
      item.exclude_from_reward = true;
    });
    await t.service.syncInvoiceReward(t.manager, 1);
    expect(t.tracking.pending_amount).toBe(100);
    expect(t.state.findOneOrFail).not.toHaveBeenCalled();
  });

  it('giữ snapshot khi đổi checkbox của sản phẩm sau lúc xác nhận', async () => {
    const t = setup();
    t.items.forEach((item) => {
      item.exclude_from_reward = false;
    });
    await t.service.snapshotInvoiceRewardPolicy(t.manager, t.bill);
    t.products[1]!.exclude_from_reward = false;
    await t.service.syncInvoiceReward(t.manager, 1);
    expect(t.items[1]!.exclude_from_reward).toBe(true);
    expect(t.tracking.pending_amount).toBe(400);
  });

  it('không snapshot lại hóa đơn cũ', async () => {
    const t = setup();
    t.bill.reward_policy_version = 0;
    await t.service.snapshotInvoiceRewardPolicy(t.manager, t.bill);
    expect(t.state.update).not.toHaveBeenCalled();
  });

  it('hóa đơn cũ thiếu mốc đối chiếu bị chặn trước khi ghi tiền tích lũy', async () => {
    const t = setup();
    t.bill.reward_policy_version = 0;
    await expect(t.service.syncInvoiceReward(t.manager, 1)).rejects.toThrow(
      /mốc đối chiếu/,
    );
    expect(t.state.save).not.toHaveBeenCalled();
  });

  it('hóa đơn cũ đã có mốc chỉ cộng 100 tiền mới, giữ tổng lịch sử', async () => {
    const t = setup();
    t.bill.reward_policy_version = 0;
    t.ledger.set(
      1,
      Object.assign(new CustomerRewardInvoiceTracking(), {
        invoice_id: 1,
        customer_id: 7,
        accumulated_amount: 400,
      }),
    );
    await t.service.syncInvoiceReward(t.manager, 1);
    expect(t.tracking.pending_amount).toBe(200);
  });

  it('khách vãng lai không phát sinh tích lũy', async () => {
    const t = setup();
    delete t.bill.customer_id;
    await t.service.syncInvoiceReward(t.manager, 1);
    expect(t.state.save).not.toHaveBeenCalled();
  });

  it('khách đăng ký có hóa đơn mới không gắn mùa vụ vẫn được tính đúng', async () => {
    const t = setup();
    delete t.bill.season_id;
    await t.service.syncInvoiceReward(t.manager, 1);
    expect(t.tracking.pending_amount).toBe(400);
  });

  it('không tự khởi tạo tích lũy lịch sử cho hóa đơn cũ không có mùa vụ', async () => {
    const t = setup();
    delete t.bill.season_id;
    t.bill.reward_policy_version = 0;
    await t.service.syncInvoiceReward(t.manager, 1);
    expect(t.state.save).not.toHaveBeenCalled();
  });

  it('từ chối ghi sổ khi không có transaction hoặc khách không khớp hóa đơn', async () => {
    const t = setup();
    t.state.queryRunner.isTransactionActive = false;
    await expect(
      t.service.collectInvoiceRewardDelta(t.manager, 7, [1]),
    ).rejects.toThrow(/transaction/);
    expect(t.state.save).not.toHaveBeenCalled();
    t.state.queryRunner.isTransactionActive = true;
    await expect(
      t.service.collectInvoiceRewardDelta(t.manager, 8, [1]),
    ).rejects.toThrow(/không thuộc khách/);
  });

  it('hoàn tiền hàng bị loại giữ nguyên tích lũy; trả hàng đủ điều kiện mới thu hồi', async () => {
    const t = setup();
    t.bill.partial_payment_amount = 1000;
    await t.service.syncInvoiceReward(t.manager, 1);
    t.returns.push(
      Object.assign(new SalesReturnItem(), {
        sales_invoice_item_id: 12,
        base_quantity: 10,
      }),
    );
    t.bill.final_amount = 600;
    t.bill.partial_payment_amount = 600;
    await t.service.syncInvoiceReward(t.manager, 1);
    expect(t.tracking.pending_amount).toBe(700);
    t.returns.push(
      Object.assign(new SalesReturnItem(), {
        sales_invoice_item_id: 11,
        base_quantity: 10,
      }),
    );
    t.bill.final_amount = 0;
    t.bill.partial_payment_amount = 0;
    t.bill.status = SalesInvoiceStatus.REFUNDED;
    await t.service.syncInvoiceReward(t.manager, 1);
    expect(t.tracking.pending_amount).toBe(100);
  });

  it('thu hồi tích lũy theo từng phần khi trả một dòng đủ điều kiện nhiều đợt', async () => {
    const t = setup();
    t.bill.partial_payment_amount = 1000;
    await t.service.syncInvoiceReward(t.manager, 1);
    expect(t.tracking.pending_amount).toBe(700);

    t.returns.push(
      Object.assign(new SalesReturnItem(), {
        sales_invoice_item_id: 11,
        base_quantity: 5,
      }),
    );
    t.bill.final_amount = 700;
    t.bill.partial_payment_amount = 700;
    await t.service.syncInvoiceReward(t.manager, 1);
    expect(t.ledger.get(1)?.accumulated_amount).toBe(300);
    expect(t.tracking.pending_amount).toBe(400);

    t.returns.push(
      Object.assign(new SalesReturnItem(), {
        sales_invoice_item_id: 11,
        base_quantity: 5,
      }),
    );
    t.bill.final_amount = 400;
    t.bill.partial_payment_amount = 400;
    await t.service.syncInvoiceReward(t.manager, 1);
    expect(t.ledger.get(1)?.accumulated_amount).toBe(0);
    expect(t.tracking.pending_amount).toBe(100);
    expect(t.tracking.total_accumulated).toBe(100);
  });

  it('preview không cộng lại khoản đã ghi, chỉ cộng thêm 300 từ lần trả tiếp', async () => {
    const t = setup();
    await t.service.syncInvoiceReward(t.manager, 1);
    const debt = Object.assign(new DebtNote(), {
      id: 9,
      customer_id: 7,
      source_invoices: [1],
      paid_amount: 500,
      remaining_amount: 500,
    });
    const unchanged = await t.service.getRewardPreview(debt, 0);
    const next = await t.service.getRewardPreview(debt, 500);
    expect(unchanged.summary.total_after_close).toBe(400);
    expect(next.summary.additional_contribution).toBe(300);
    expect(next.summary.total_after_close).toBe(700);
    expect(t.tracking.pending_amount).toBe(400);
  });

  it('summary phân biệt tiền thu 500 với phần tích lũy 300; chốt lại không cộng thêm', async () => {
    const t = setup();
    const debt = Object.assign(new DebtNote(), {
      id: 9,
      customer_id: 7,
      source_invoices: [1],
    });
    const result = await t.service.handleDebtNoteSettlement(
      t.manager,
      debt,
      { payment_amount: 500, invoice_ids: [1] },
      1,
      false,
    );
    expect(result).toMatchObject({
      payment_received: 500,
      accumulation_contribution: 300,
      total_accumulated_after: 400,
    });
    const finalized = await t.service.handleDebtNoteSettlement(
      t.manager,
      debt,
      { payment_amount: 0, invoice_ids: [] },
      1,
    );
    expect(finalized?.total_accumulated_after).toBe(400);
  });

  it('thu công nợ hóa đơn chỉ có hàng bị loại không cộng tiền thanh toán vào tích lũy', async () => {
    const t = setup();
    t.items.forEach((item) => {
      item.exclude_from_reward = true;
    });
    const debt = Object.assign(new DebtNote(), {
      id: 9,
      customer_id: 7,
      source_invoices: [1],
    });

    const result = await t.service.handleDebtNoteSettlement(
      t.manager,
      debt,
      { payment_amount: 500, invoice_ids: [1] },
      1,
    );

    expect(result).toMatchObject({
      payment_received: 500,
      accumulation_contribution: 0,
      total_accumulated_after: 100,
    });
    expect(t.tracking.pending_amount).toBe(100);
    expect(t.tracking.total_accumulated).toBe(100);
  });

  it('thu hai đợt hóa đơn không mùa vụ sau giảm chung chỉ cộng delta eligible', async () => {
    const t = setup();
    t.payment.amount = 900;
    t.bill.final_amount = 900;
    delete t.bill.season_id;
    t.bill.partial_payment_amount = 0;
    t.bill.remaining_amount = 900;
    const queryRunner = {
      manager: t.manager,
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };
    const allocationService = Object.assign(
      Object.create(PaymentAllocationService.prototype),
      {
        allocationRepository: {
          create: jest.fn((values: Partial<PaymentAllocation>) =>
            Object.assign(new PaymentAllocation(), values),
          ),
        },
        dataSource: { createQueryRunner: jest.fn(() => queryRunner) },
        customerRewardService: t.service,
      },
    ) as PaymentAllocationService;
    const dto: CreatePaymentAllocationDto = {
      payment_id: 3,
      allocation_type: 'invoice',
      invoice_id: 1,
      amount: 450,
    };

    await allocationService.create(dto);

    expect(t.bill.partial_payment_amount).toBe(450);
    expect(t.payment.allocated_amount).toBe(450);
    expect(t.ledger.get(1)?.accumulated_amount).toBe(270);
    expect(t.tracking.pending_amount).toBe(370);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);

    await allocationService.create(dto);

    expect(t.bill.partial_payment_amount).toBe(900);
    expect(t.payment.allocated_amount).toBe(900);
    expect(t.ledger.get(1)?.accumulated_amount).toBe(540);
    expect(t.tracking.pending_amount).toBe(640);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(2);
    expect(
      t.state.findOne.mock.calls.filter(([entity]) => entity === DebtNote),
    ).toHaveLength(0);
  });

  it('thu qua phiếu công nợ rồi chỉ tích lũy phần hàng đủ điều kiện của hóa đơn', async () => {
    const t = setup();
    t.payment.amount = 1000;
    t.bill.partial_payment_amount = 0;
    t.bill.remaining_amount = 1000;
    const queryRunner = {
      manager: t.manager,
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };
    const allocationService = Object.assign(
      Object.create(PaymentAllocationService.prototype),
      {
        allocationRepository: {
          create: jest.fn((values: Partial<PaymentAllocation>) =>
            Object.assign(new PaymentAllocation(), values),
          ),
        },
        dataSource: { createQueryRunner: jest.fn(() => queryRunner) },
        customerRewardService: t.service,
      },
    ) as PaymentAllocationService;
    const dto: CreatePaymentAllocationDto = {
      payment_id: 3,
      allocation_type: 'debt_note',
      debt_note_id: 9,
      amount: 500,
    };

    await allocationService.create(dto);

    expect(t.bill.partial_payment_amount).toBe(500);
    expect(t.payment.allocated_amount).toBe(500);
    expect(t.debtNote.paid_amount).toBe(500);
    expect(t.ledger.get(1)?.accumulated_amount).toBe(300);
    expect(t.tracking.pending_amount).toBe(400);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);

    await allocationService.create({ ...dto, amount: 500 });

    expect(t.bill.partial_payment_amount).toBe(1000);
    expect(t.payment.allocated_amount).toBe(1000);
    expect(t.debtNote.paid_amount).toBe(1000);
    expect(t.debtNote.remaining_amount).toBe(0);
    expect(t.ledger.get(1)?.accumulated_amount).toBe(600);
    expect(t.tracking.pending_amount).toBe(700);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(2);
  });

  it('rollback phân bổ công nợ khi hóa đơn legacy thiếu snapshot tích lũy', async () => {
    const t = setup();
    t.bill.reward_policy_version = 0;
    t.bill.partial_payment_amount = 0;
    t.bill.remaining_amount = 1000;
    const queryRunner = {
      manager: t.manager,
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };
    const allocationService = Object.assign(
      Object.create(PaymentAllocationService.prototype),
      {
        allocationRepository: {
          create: jest.fn((values: Partial<PaymentAllocation>) =>
            Object.assign(new PaymentAllocation(), values),
          ),
        },
        dataSource: { createQueryRunner: jest.fn(() => queryRunner) },
        customerRewardService: t.service,
      },
    ) as PaymentAllocationService;

    await expect(
      allocationService.create({
        payment_id: 3,
        allocation_type: 'debt_note',
        debt_note_id: 9,
        amount: 500,
      }),
    ).rejects.toThrow(/mốc đối chiếu/);

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
    expect(t.tracking.pending_amount).toBe(100);
  });

  it('chỉ cộng phần đủ điều kiện khi một khoản thu chạy qua nhiều hóa đơn công nợ', async () => {
    const t = setup();
    t.payment.amount = 2000;
    t.bill.partial_payment_amount = 0;
    t.bill.remaining_amount = 1000;
    t.debtNote.amount = 2000;
    t.debtNote.remaining_amount = 2000;
    t.debtNote.source_invoices = [1, 2];
    const secondInvoice = Object.assign(new SalesInvoice(), {
      id: 2,
      customer_id: 7,
      season_id: 3,
      reward_policy_version: 1,
      status: SalesInvoiceStatus.CONFIRMED,
      final_amount: 1000,
      partial_payment_amount: 0,
      remaining_amount: 1000,
    });
    const secondEligibleLine = Object.assign(new SalesInvoiceItem(), {
      id: 21,
      invoice_id: 2,
      product_id: 3,
      quantity: 6,
      base_quantity: 6,
      total_price: 600,
      exclude_from_reward: false,
    });
    const secondExcludedLine = Object.assign(new SalesInvoiceItem(), {
      id: 22,
      invoice_id: 2,
      product_id: 4,
      quantity: 4,
      base_quantity: 4,
      total_price: 400,
      exclude_from_reward: true,
    });
    t.invoices.push(secondInvoice);
    t.items.push(secondEligibleLine, secondExcludedLine);
    t.products.push(
      Object.assign(new Product(), { id: 3, exclude_from_reward: false }),
      Object.assign(new Product(), { id: 4, exclude_from_reward: true }),
    );
    t.state.createQueryBuilder.mockImplementation((entity: unknown) =>
      entity === SalesInvoice
        ? {
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            addOrderBy: jest.fn().mockReturnThis(),
            setLock: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([t.bill, secondInvoice]),
          }
        : t.query,
    );
    const queryRunner = {
      manager: t.manager,
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };
    const allocationService = Object.assign(
      Object.create(PaymentAllocationService.prototype),
      {
        allocationRepository: {
          create: jest.fn((values: Partial<PaymentAllocation>) =>
            Object.assign(new PaymentAllocation(), values),
          ),
        },
        dataSource: { createQueryRunner: jest.fn(() => queryRunner) },
        customerRewardService: t.service,
      },
    ) as PaymentAllocationService;

    await allocationService.create({
      payment_id: 3,
      allocation_type: 'debt_note',
      debt_note_id: 9,
      amount: 1500,
    });

    expect(t.bill.partial_payment_amount).toBe(1000);
    expect(t.bill.status).toBe(SalesInvoiceStatus.PAID);
    expect(secondInvoice.partial_payment_amount).toBe(500);
    expect(secondInvoice.remaining_amount).toBe(500);
    expect(t.debtNote.paid_amount).toBe(1500);
    expect(t.debtNote.remaining_amount).toBe(500);
    expect(t.ledger.get(1)?.accumulated_amount).toBe(600);
    expect(t.ledger.get(2)?.accumulated_amount).toBe(300);
    expect(t.tracking.pending_amount).toBe(1000);
    expect(t.payment.allocated_amount).toBe(1500);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);

    await allocationService.create({
      payment_id: 3,
      allocation_type: 'debt_note',
      debt_note_id: 9,
      amount: 250,
    });

    expect(secondInvoice.partial_payment_amount).toBe(750);
    expect(secondInvoice.remaining_amount).toBe(250);
    expect(t.debtNote.paid_amount).toBe(1750);
    expect(t.debtNote.remaining_amount).toBe(250);
    expect(t.ledger.get(1)?.accumulated_amount).toBe(600);
    expect(t.ledger.get(2)?.accumulated_amount).toBe(450);
    expect(t.tracking.pending_amount).toBe(1150);
    expect(t.payment.allocated_amount).toBe(1750);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(2);
  });
});
