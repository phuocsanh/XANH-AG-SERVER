import { DataSource, EntityManager, Repository } from 'typeorm';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { Payment } from '../../entities/payment.entity';
import { PaymentAllocation } from '../../entities/payment-allocation.entity';
import { PaymentRollbackHistory } from '../../entities/payment-rollback-history.entity';
import {
  SalesInvoice,
  SalesInvoiceStatus,
  SalesPaymentStatus,
} from '../../entities/sales-invoices.entity';
import { CustomerRewardService } from '../customer-reward/customer-reward.service';
import { PaymentService } from './payment.service';
import { SettleDebtDto } from './dto/settle-debt.dto';

/** Mô phỏng query runner để kiểm tra chốt công nợ mà không kết nối database. */
function createFixture() {
  const invoice = Object.assign(new SalesInvoice(), {
    id: 11,
    code: 'INV-TEST',
    customer_id: 7,
    season_id: 4,
    final_amount: 1000,
    partial_payment_amount: 300,
    remaining_amount: 700,
    status: SalesInvoiceStatus.CONFIRMED,
    payment_status: SalesPaymentStatus.PARTIAL,
  });
  const debtNote = Object.assign(new DebtNote(), {
    id: 21,
    code: 'DN-TEST',
    customer_id: 7,
    season_id: 4,
    amount: 1000,
    paid_amount: 100,
    remaining_amount: 900,
    status: DebtNoteStatus.ACTIVE,
  });

  const invoiceQuery = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([invoice]),
  };
  const debtNoteQuery = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(debtNote),
  };
  const manager = {
    createQueryBuilder: jest.fn((entity: unknown) =>
      entity === SalesInvoice ? invoiceQuery : debtNoteQuery,
    ),
    create: jest.fn((entity: new () => object, values: object) =>
      Object.assign(new entity(), values),
    ),
    save: jest.fn(async (entityOrTarget: unknown, maybeEntity?: unknown) => {
      if (entityOrTarget === Payment) {
        return Object.assign(new Payment(), maybeEntity, { id: 80 });
      }
      return maybeEntity ?? entityOrTarget;
    }),
  } as unknown as EntityManager;
  const queryRunner = {
    manager,
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  };
  const dataSource = {
    createQueryRunner: jest.fn(() => queryRunner),
  } as unknown as DataSource;
  const paymentRepository = {
    manager: { connection: dataSource },
  } as unknown as Repository<Payment>;
  const rewardService = {
    handleDebtNoteSettlement: jest.fn().mockResolvedValue({
      payment_received: 400,
      accumulation_contribution: 240,
    }),
  };
  const service = new PaymentService(
    paymentRepository,
    {} as Repository<PaymentAllocation>,
    {} as Repository<PaymentRollbackHistory>,
    rewardService as unknown as CustomerRewardService,
  );

  return { service, invoice, debtNote, manager, queryRunner, rewardService };
}

describe('PaymentService.settleDebt tích lũy các hóa đơn đã thu', () => {
  it('gửi đúng hóa đơn được thanh toán và số tiền thu sang xử lý tích lũy công nợ', async () => {
    const fixture = createFixture();
    const dto: SettleDebtDto = {
      customer_id: 7,
      season_id: 4,
      amount: 400,
      payment_method: 'cash',
    };

    const result = await fixture.service.settleDebt(dto, 3);

    expect(result.settled_invoices).toEqual([fixture.invoice]);
    expect(fixture.invoice.partial_payment_amount).toBe(700);
    expect(fixture.invoice.remaining_amount).toBe(300);
    expect(fixture.invoice.status).toBe(SalesInvoiceStatus.CONFIRMED);
    expect(fixture.invoice.payment_status).toBe(SalesPaymentStatus.PARTIAL);
    expect(fixture.debtNote.paid_amount).toBe(500);
    expect(fixture.debtNote.remaining_amount).toBe(300);
    expect(fixture.rewardService.handleDebtNoteSettlement).toHaveBeenCalledWith(
      fixture.manager,
      fixture.debtNote,
      expect.objectContaining({ payment_amount: 400, invoice_ids: [11] }),
      3,
      false,
    );
    expect(fixture.queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(fixture.queryRunner.rollbackTransaction).not.toHaveBeenCalled();
  });
});
