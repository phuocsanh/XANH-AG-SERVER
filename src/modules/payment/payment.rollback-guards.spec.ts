import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { Payment } from '../../entities/payment.entity';
import { PaymentAllocation } from '../../entities/payment-allocation.entity';
import { PaymentRollbackHistory } from '../../entities/payment-rollback-history.entity';
import { Loan } from '../../entities/loan.entity';
import { DebtNoteClosure, DebtNoteClosureStatus } from '../../entities/debt-note-closure.entity';
import { SalesReturn } from '../../entities/sales-return.entity';
import { CustomerRewardResetHistory } from '../../entities/customer-reward-reset-history.entity';
import { CustomerRewardHistory } from '../../entities/customer-reward-history.entity';
import {
  SalesInvoice,
  SalesInvoiceStatus,
  SalesPaymentStatus,
} from '../../entities/sales-invoices.entity';
import { CustomerRewardService } from '../customer-reward/customer-reward.service';
import { PaymentService } from './payment.service';

/**
 * Dựng service với dữ liệu giả để kiểm tra guard hoàn tác mà không kết nối database.
 */
function createFixture(options?: {
  paymentMissing?: boolean;
  debtNoteStatus?: DebtNoteStatus;
  hasClosedClosure?: boolean;
  hasHistory?: boolean;
  allocationAmounts?: number[];
  legacy?: boolean;
  invoiceCustomerId?: number;
  debtCustomerId?: number;
  debtSeasonId?: number;
  missingDebt?: boolean;
  noDebtLink?: boolean;
  loan?: boolean;
  mixedLoan?: boolean;
  resetAfter?: boolean;
  giftAfter?: boolean;
}) {
  const payment = Object.assign(new Payment(), {
    id: 5,
    code: 'PT-TEST',
    customer_id: 7,
    amount: 100,
    allocated_amount: 100,
    payment_method: 'cash',
    payment_date: new Date('2026-10-01'),
    created_at: new Date('2026-10-01T08:00:00Z'),
  });
  const invoice = Object.assign(new SalesInvoice(), {
    id: 11,
    code: 'INV-TEST',
    customer_id: options?.invoiceCustomerId ?? 7,
    season_id: 4,
    final_amount: 100,
    partial_payment_amount: 100,
    remaining_amount: 0,
    status: SalesInvoiceStatus.PAID,
    payment_status: SalesPaymentStatus.PAID,
  });
  const debtNote = Object.assign(new DebtNote(), {
    id: 21,
    code: 'DN-TEST',
    customer_id: options?.debtCustomerId ?? 7,
    season_id: options?.debtSeasonId ?? 4,
    amount: 100,
    paid_amount: 100,
    remaining_amount: 0,
    status: options?.debtNoteStatus ?? DebtNoteStatus.ACTIVE,
  });
  const allocation = Object.assign(new PaymentAllocation(), {
    id: 31,
    payment_id: 5,
    invoice_id: 11,
    debt_note_id: 21,
    allocation_type: 'invoice' as const,
    amount: 100,
  });
  const allocations = options?.loan && !options.mixedLoan ? []
    : (options?.allocationAmounts ?? [100]).map((amount, index) => Object.assign(new PaymentAllocation(), allocation, {
      id: 31 + index, amount,
      invoice_id: options?.legacy ? null : 11,
      debt_note_id: options?.noDebtLink ? null : 21,
      allocation_type: options?.legacy ? 'debt_note' : 'invoice',
    }));
  const loan = options?.loan ? Object.assign(new Loan(), {
    id: 41, code: 'LOAN-TEST', customer_id: 7, payment_id: 5,
    principal_amount: 100, paid_amount: 100, total_amount: 100, remaining_amount: 0, status: 'paid',
  }) : null;
  const closures = options?.hasClosedClosure
    ? [Object.assign(new DebtNoteClosure(), {
      debt_note_id: 21,
      status: DebtNoteClosureStatus.CLOSED,
      closed_at: new Date('2026-10-05'),
    })]
    : [];

  const manager = {
    findOne: jest.fn(async (entity: unknown) => {
      if (entity === Payment) return options?.paymentMissing ? null : payment;
      if (entity === Loan) return null;
      if (entity === SalesInvoice) return Object.assign(new SalesInvoice(), invoice);
      if (entity === DebtNote) return options?.missingDebt ? null : debtNote;
      return null;
    }),
    find: jest.fn(async (entity: unknown) => {
      if (entity === PaymentAllocation) return allocations;
      if (entity === Loan) return loan ? [loan] : [];
      if (entity === DebtNote) return options?.missingDebt ? [] : [debtNote];
      if (entity === DebtNoteClosure) return closures;
      if (entity === SalesReturn) return [];
      return [];
    }),
    createQueryBuilder: jest.fn((entity: unknown) => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
      getExists: jest.fn().mockResolvedValue(
        entity === CustomerRewardResetHistory ? options?.resetAfter ?? false
          : entity === CustomerRewardHistory ? options?.giftAfter ?? false : false,
      ),
    })),
    create: jest.fn((entity: new () => object, data: object) => Object.assign(new entity(), data)),
    save: jest.fn(async (entity: unknown) => {
      if (entity instanceof SalesInvoice) Object.assign(invoice, entity);
      return entity;
    }),
    delete: jest.fn(),
  } as unknown as EntityManager;
  const queryRunner = {
    manager,
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  };
  const dataSource = { createQueryRunner: jest.fn(() => queryRunner) } as unknown as DataSource;
  const paymentRepository = {
    manager: Object.assign(manager, { connection: dataSource }),
    findOne: jest.fn(async () => options?.paymentMissing ? null : payment),
  } as unknown as Repository<Payment>;
  const historyRepository = {
    findOne: jest.fn().mockResolvedValue(
      options?.hasHistory
        ? { payment_id: 5, payment_code: 'PT-TEST', rolled_back_at: new Date('2026-10-02') }
        : null,
    ),
  } as unknown as Repository<PaymentRollbackHistory>;
  const rewardService = {
    lockTrackingForPaymentRollback: jest.fn().mockResolvedValue(undefined),
    previewInvoiceRewardDelta: jest.fn().mockResolvedValue({
      delta: -100,
      pending_before: 100,
      total_before: 100,
    }),
    syncInvoiceReward: jest.fn(),
  };

  const service = new PaymentService(
    paymentRepository,
    {} as Repository<PaymentAllocation>,
    historyRepository,
    rewardService as unknown as CustomerRewardService,
  );

  return { service, queryRunner, manager, invoice, debtNote, allocations, rewardService };
}

describe('PaymentService.rollbackPayment - guard an toàn', () => {
  it('trả 409 khi phiếu thu đã được hoàn tác trước đó', async () => {
    const fixture = createFixture({ paymentMissing: true, hasHistory: true });

    await expect(
      fixture.service.rollbackPayment(5, { reason: 'Nhập sai số tiền' }, 9),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(fixture.queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('chặn hoàn tác khi phiếu công nợ đã hủy', async () => {
    const fixture = createFixture({ debtNoteStatus: DebtNoteStatus.CANCELLED });

    await expect(
      fixture.service.rollbackPayment(5, { reason: 'Nhập sai số tiền' }, 9),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fixture.queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(fixture.queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('chặn hoàn tác khi phiếu công nợ đã chốt sổ', async () => {
    const fixture = createFixture({ hasClosedClosure: true });

    await expect(
      fixture.service.rollbackPayment(5, { reason: 'Nhập sai số tiền' }, 9),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fixture.queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('bắt buộc nhập lý do hoàn tác', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.rollbackPayment(5, { reason: '   ' }, 9),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('gom các phân bổ cùng hóa đơn, lưu và đồng bộ tích lũy một lần', async () => {
    const fixture = createFixture({ allocationAmounts: [40, 60] });
    const preview = await fixture.service.getRollbackPreview(5);
    expect(preview.invoice_restores).toHaveLength(1);
    expect(preview.invoice_restores[0]?.restore_amount).toBe(100);
    const result = await fixture.service.rollbackPayment(5, { reason: 'Thu trùng', preview_token: preview.preview_token }, 9);
    expect(fixture.invoice.partial_payment_amount).toBe(0);
    expect(fixture.invoice.remaining_amount).toBe(100);
    expect(result.affected_invoices).toBe(1);
    expect(fixture.rewardService.syncInvoiceReward).toHaveBeenCalledTimes(1);
    const history = (fixture.manager.save as jest.Mock).mock.calls.map(([value]) => value)
      .find((value) => value instanceof PaymentRollbackHistory) as PaymentRollbackHistory;
    expect(history.affected_invoices).toBe(1);
    expect(history.allocations_snapshot.map((item) => item.amount)).toEqual([40, 60]);
    expect(history.allocations_snapshot.map((item) => item.allocation_id)).toEqual([31, 32]);
  });

  it.each([
    ['khác khách hóa đơn', { invoiceCustomerId: 8 }],
    ['khác khách phiếu nợ', { debtCustomerId: 8 }],
    ['khác mùa vụ phiếu nợ', { debtSeasonId: 8 }],
    ['mất phiếu nợ được tham chiếu', { missingDebt: true }],
    ['mất nguồn phiếu nợ của hóa đơn', { noDebtLink: true, missingDebt: true }],
    ['legacy không có nguồn hóa đơn', { legacy: true }],
    ['phiếu vừa trả vay vừa phân bổ hóa đơn', { loan: true, mixedLoan: true }],
    ['reset sau thu dù còn đủ điểm', { resetAfter: true }],
    ['phát quà sau thu dù còn đủ điểm', { giftAfter: true }],
    ['tổng phân bổ vượt tiền đã trả', { allocationAmounts: [60, 60] }],
  ])('chặn %s và không ghi dữ liệu', async (_name, options) => {
    const fixture = createFixture(options);
    await expect(fixture.service.rollbackPayment(5, { reason: 'Đối soát' }, 9)).rejects.toBeInstanceOf(BadRequestException);
    expect(fixture.manager.save).not.toHaveBeenCalled();
    expect(fixture.manager.delete).not.toHaveBeenCalled();
  });

  it('khóa tích lũy trước khi đọc số dư và lịch sử reset/quà', async () => {
    const fixture = createFixture();
    await fixture.service.rollbackPayment(5, { reason: 'Thu nhầm' }, 9);
    const lockOrder = fixture.rewardService.lockTrackingForPaymentRollback.mock.invocationCallOrder[0]!;
    expect(lockOrder).toBeLessThan(fixture.rewardService.previewInvoiceRewardDelta.mock.invocationCallOrder[0]!);
    const queryCalls = (fixture.manager.createQueryBuilder as jest.Mock).mock;
    queryCalls.calls.forEach(([entity], index) => {
      if (entity === CustomerRewardResetHistory || entity === CustomerRewardHistory) {
        expect(lockOrder).toBeLessThan(queryCalls.invocationCallOrder[index]!);
      }
    });
  });

  it('từ chối preview cũ trước khi ghi khi số dư đã thay đổi', async () => {
    const fixture = createFixture();
    const preview = await fixture.service.getRollbackPreview(5);
    fixture.invoice.final_amount = 120;
    fixture.invoice.remaining_amount = 20;
    await expect(fixture.service.rollbackPayment(5, { reason: 'Thu nhầm', preview_token: preview.preview_token }, 9))
      .rejects.toBeInstanceOf(ConflictException);
    expect(fixture.manager.save).not.toHaveBeenCalled();
    expect(fixture.manager.delete).not.toHaveBeenCalled();
  });

  it('phiếu trả vay hợp lệ vẫn được mở lại và có lịch sử', async () => {
    const fixture = createFixture({ loan: true });
    const result = await fixture.service.rollbackPayment(5, { reason: 'Thu nhầm' }, 9);
    expect(result.payment_kind).toBe('loan');
    expect(fixture.rewardService.syncInvoiceReward).not.toHaveBeenCalled();
    expect(fixture.manager.save).toHaveBeenCalledWith(expect.objectContaining({ payment_id: null, status: 'active' }));
  });

  it('đợi khóa tracking rồi mới phát hiện reset vừa hoàn tất, không trừ trên số dư cũ', async () => {
    const options = { resetAfter: false };
    const fixture = createFixture(options);
    let unlock!: () => void;
    let entered!: () => void;
    const held = new Promise<void>((resolve) => { unlock = resolve });
    const waiting = new Promise<void>((resolve) => { entered = resolve });
    fixture.rewardService.lockTrackingForPaymentRollback.mockImplementation(async () => {
      entered();
      await held;
    });
    const outcome = expect(fixture.service.rollbackPayment(5, { reason: 'Thu nhầm' }, 9))
      .rejects.toBeInstanceOf(BadRequestException);
    await waiting;
    expect(fixture.rewardService.previewInvoiceRewardDelta).not.toHaveBeenCalled();
    // Mô phỏng reset commit trước khi nhả hàng tracking đang được khóa.
    options.resetAfter = true;
    unlock();
    await outcome;
    expect(fixture.manager.save).not.toHaveBeenCalled();
    expect(fixture.manager.delete).not.toHaveBeenCalled();
  });
});
