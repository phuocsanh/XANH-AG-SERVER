import { DataSource, EntityManager, Repository } from 'typeorm';
import { Payment } from '../../entities/payment.entity';
import { PaymentAllocation } from '../../entities/payment-allocation.entity';
import {
  SalesInvoice,
  SalesInvoiceStatus,
} from '../../entities/sales-invoices.entity';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { CustomerRewardService } from '../customer-reward/customer-reward.service';
import { OperatingCostService } from '../operating-cost/operating-cost.service';
import { OperatingCostCategoryService } from '../operating-cost-category/operating-cost-category.service';
import { PaymentAllocationService } from './payment-allocation.service';
import { CreatePaymentAllocationDto } from './dto/create-payment-allocation.dto';

/** Tạo service với query runner giả để xác minh nối luồng thanh toán tới tích lũy. */
function createFixture(target: 'invoice' | 'debt_note') {
  const payment = Object.assign(new Payment(), {
    id: 1,
    customer_id: 7,
    amount: 500,
    allocated_amount: 0,
    created_by: 3,
  });
  const invoice = Object.assign(new SalesInvoice(), {
    id: 11,
    customer_id: 7,
    season_id: 4,
    final_amount: 1000,
    partial_payment_amount: 0,
    remaining_amount: 1000,
    status: SalesInvoiceStatus.CONFIRMED,
  });
  const debtNote = Object.assign(new DebtNote(), {
    id: 21,
    code: 'DN-TEST',
    customer_id: 7,
    amount: 1000,
    paid_amount: 0,
    remaining_amount: 1000,
    status: DebtNoteStatus.ACTIVE,
  });
  const distributedAllocation = Object.assign(new PaymentAllocation(), {
    id: 31,
    payment_id: 1,
    invoice_id: 11,
    debt_note_id: 21,
    allocation_type: 'invoice' as const,
    amount: 500,
  });

  const rewardService = {
    syncInvoiceReward: jest.fn().mockResolvedValue(undefined),
    allocateDebtNotePayment: jest.fn().mockResolvedValue({
      allocations: target === 'debt_note' ? [distributedAllocation] : [],
      snapshots: [],
    }),
    handleDebtNoteSettlement: jest.fn().mockResolvedValue(undefined),
  };
  const manager = {
    findOne: jest.fn(async (entity: unknown) => {
      if (entity === Payment) return payment;
      if (entity === SalesInvoice) return invoice;
      if (entity === DebtNote) return target === 'debt_note' ? debtNote : null;
      return null;
    }),
    save: jest.fn(async (entity: unknown) => entity),
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
  const allocationRepository = {
    create: jest.fn((values: Partial<PaymentAllocation>) =>
      Object.assign(new PaymentAllocation(), values),
    ),
  } as unknown as Repository<PaymentAllocation>;
  const service = new PaymentAllocationService(
    allocationRepository,
    dataSource,
    {} as OperatingCostService,
    {} as OperatingCostCategoryService,
    rewardService as unknown as CustomerRewardService,
  );

  return {
    service,
    payment,
    invoice,
    debtNote,
    manager,
    queryRunner,
    rewardService,
  };
}

describe('PaymentAllocationService cập nhật tích lũy khi thu tiền', () => {
  it('đồng bộ tích lũy sau khi phân bổ thanh toán trực tiếp cho hóa đơn', async () => {
    const fixture = createFixture('invoice');
    const dto: CreatePaymentAllocationDto = {
      payment_id: 1,
      allocation_type: 'invoice',
      invoice_id: 11,
      amount: 500,
    };

    await fixture.service.create(dto);

    expect(fixture.invoice.partial_payment_amount).toBe(500);
    expect(fixture.rewardService.syncInvoiceReward).toHaveBeenCalledWith(
      fixture.manager,
      11,
    );
    expect(fixture.queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(fixture.queryRunner.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('chuyển các hóa đơn được phân bổ sang xử lý tích lũy khi thu theo phiếu công nợ', async () => {
    const fixture = createFixture('debt_note');
    const dto: CreatePaymentAllocationDto = {
      payment_id: 1,
      allocation_type: 'debt_note',
      debt_note_id: 21,
      amount: 500,
    };

    await fixture.service.create(dto);

    expect(fixture.rewardService.allocateDebtNotePayment).toHaveBeenCalledWith(
      fixture.manager,
      fixture.debtNote,
      500,
      1,
    );
    expect(fixture.rewardService.handleDebtNoteSettlement).toHaveBeenCalledWith(
      fixture.manager,
      fixture.debtNote,
      expect.objectContaining({ payment_amount: 500, invoice_ids: [11] }),
      3,
      false,
    );
    expect(fixture.queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(fixture.queryRunner.rollbackTransaction).not.toHaveBeenCalled();
  });
});
