import { DataSource, EntityManager, Repository } from 'typeorm';
import { CustomerRewardTracking } from '../../entities/customer-reward-tracking.entity';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { Payment } from '../../entities/payment.entity';
import { PaymentAllocation } from '../../entities/payment-allocation.entity';
import { SystemSetting } from '../../entities/system-setting.entity';
import { CustomerRewardService } from '../customer-reward/customer-reward.service';
import { InventoryService } from '../inventory/inventory.service';
import { DebtNoteService } from './debt-note.service';
import { CloseSeasonDebtNoteDto } from './dto/close-season-debt-note.dto';

/** Mô phỏng transaction manager để kiểm tra chốt công nợ mà không kết nối database. */
function createFixture() {
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
  const allocations = [
    Object.assign(new PaymentAllocation(), {
      id: 31,
      payment_id: 80,
      invoice_id: 11,
      debt_note_id: 21,
      allocation_type: 'invoice' as const,
      amount: 400,
    }),
  ];
  const snapshots = [
    {
      invoice_id: 11,
      before: { partial_payment_amount: 300, remaining_amount: 700 },
      after: { partial_payment_amount: 700, remaining_amount: 300 },
    },
  ];
  const rewardService = {
    allocateDebtNotePayment: jest
      .fn()
      .mockResolvedValue({ allocations, snapshots }),
    handleDebtNoteSettlement: jest.fn().mockResolvedValue({
      reward_given: false,
      reward_count: 0,
      reward_history_ids: [],
      inventory_transaction_ids: [],
      gift_cost_ids: [],
    }),
  };
  const manager = {
    findOne: jest.fn(async (entity: unknown) => {
      if (entity === DebtNote) return debtNote;
      if (entity === CustomerRewardTracking) return null;
      return null;
    }),
    create: jest.fn((entity: new () => object, values: object) =>
      Object.assign(new entity(), values),
    ),
    save: jest.fn(async (entity: unknown) => {
      if (entity instanceof Payment) Object.assign(entity, { id: 80 });
      return entity;
    }),
  } as unknown as EntityManager;
  const dataSource = {
    transaction: jest.fn(
      async (callback: (transactionManager: EntityManager) => unknown) =>
        callback(manager),
    ),
  } as unknown as DataSource;
  const service = new DebtNoteService(
    {} as Repository<DebtNote>,
    {} as Repository<SystemSetting>,
    dataSource,
    rewardService as unknown as CustomerRewardService,
    {} as InventoryService,
  );

  return { service, debtNote, allocations, manager, dataSource, rewardService };
}

describe('DebtNoteService.closeSeasonDebtNote tích lũy tiền thu theo hóa đơn', () => {
  it('chuyển các hóa đơn được thanh toán tại thời điểm chốt sổ sang xử lý tích lũy', async () => {
    const fixture = createFixture();
    const closeData: CloseSeasonDebtNoteDto = { payment_amount: 400 };

    await fixture.service.closeSeasonDebtNote(21, closeData, 3);

    expect(fixture.rewardService.allocateDebtNotePayment).toHaveBeenCalledWith(
      fixture.manager,
      fixture.debtNote,
      400,
      80,
    );
    expect(fixture.debtNote.paid_amount).toBe(500);
    expect(fixture.debtNote.remaining_amount).toBe(500);
    expect(fixture.debtNote.status).toBe(DebtNoteStatus.PAID);
    expect(fixture.rewardService.handleDebtNoteSettlement).toHaveBeenCalledWith(
      fixture.manager,
      fixture.debtNote,
      expect.objectContaining({ payment_amount: 400, invoice_ids: [11] }),
      3,
    );
    expect(fixture.dataSource.transaction).toHaveBeenCalledTimes(1);
  });
});
