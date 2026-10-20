import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CustomerRewardService } from './customer-reward.service';
import { CustomerRewardTracking } from '../../entities/customer-reward-tracking.entity';
import { Customer } from '../../entities/customer.entity';
import {
  CustomerRewardResetHistory,
  CustomerRewardResetStatus,
} from '../../entities/customer-reward-reset-history.entity';

/** Tạo dữ liệu tích lũy giả lập cho một khách hàng. */
function buildTracking(
  customerId: number,
  pendingAmount: number,
  totalAccumulated: number,
  rewardCount = 0,
): CustomerRewardTracking {
  return Object.assign(new CustomerRewardTracking(), {
    customer_id: customerId,
    pending_amount: pendingAmount,
    total_accumulated: totalAccumulated,
    reward_count: rewardCount,
  });
}

/** Tạo khách hàng giả lập. */
function buildCustomer(id: number, name: string, phone: string): Customer {
  return Object.assign(new Customer(), {
    id,
    code: `KH${id}`,
    name,
    phone,
  });
}

/** Query builder giả lập cho phần tìm kiếm lịch sử xóa. */
function createResetQueryBuilder(
  records: CustomerRewardResetHistory[],
  total: number,
) {
  const queryBuilder: Record<string, jest.Mock> = {} as Record<string, jest.Mock>;
  const chain = () => queryBuilder;
  queryBuilder.leftJoinAndSelect = jest.fn(chain);
  queryBuilder.orderBy = jest.fn(chain);
  queryBuilder.addOrderBy = jest.fn(chain);
  queryBuilder.andWhere = jest.fn(chain);
  queryBuilder.skip = jest.fn(chain);
  queryBuilder.take = jest.fn(chain);
  queryBuilder.getManyAndCount = jest.fn(async () => [records, total]);
  return queryBuilder;
}

/**
 * Khởi tạo service với EntityManager giả lập (không kết nối DB).
 * Mọi thao tác ghi đều nằm trong `manager.transaction` như code thật.
 */
function createHarness() {
  const state = {
    trackings: [] as CustomerRewardTracking[],
    customers: [] as Customer[],
    resets: [] as CustomerRewardResetHistory[],
    nextResetId: 1,
    resetQueryBuilder: createResetQueryBuilder([], 0),
  };

  const manager: Record<string, any> = {
    queryRunner: { isTransactionActive: true },
    findOne: jest.fn(
      async (entity: unknown, options: { where: Record<string, any> }) => {
        if (entity === CustomerRewardTracking) {
          return (
            state.trackings.find(
              (item) => item.customer_id === options.where.customer_id,
            ) || null
          );
        }
        if (entity === Customer) {
          return state.customers.find((item) => item.id === options.where.id) || null;
        }
        if (entity === CustomerRewardResetHistory) {
          return state.resets.find((item) => item.id === options.where.id) || null;
        }
        return null;
      },
    ),
    findOneOrFail: jest.fn(
      async (entity: unknown, options: { where: Record<string, any> }) => {
        const found = await manager.findOne(entity, options);
        if (!found) throw new Error('Không tìm thấy bản ghi tích lũy');
        return found;
      },
    ),
    create: jest.fn((entity: new () => object, values: object) =>
      Object.assign(new entity(), values),
    ),
    save: jest.fn(async (value: any) => {
      if (value instanceof CustomerRewardResetHistory) {
        if (!value.id) {
          value.id = state.nextResetId;
          state.nextResetId += 1;
          state.resets.push(value);
        }
      }
      return value;
    }),
    createQueryBuilder: jest.fn(() => ({
      insert: () => ({
        into: () => ({
          values: () => ({
            orIgnore: () => ({ execute: async () => ({}) }),
          }),
        }),
      }),
    })),
    getRepository: jest.fn(() => ({
      createQueryBuilder: () => state.resetQueryBuilder,
    })),
  };
  manager.transaction = jest.fn(async (callback: (m: unknown) => unknown) =>
    callback(manager),
  );

  const rewardTrackingRepository = { manager } as any;
  const service = new CustomerRewardService(
    rewardTrackingRepository,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  return { state, manager, service };
}

describe('CustomerRewardService - xóa tích lũy hiện tại', () => {
  let harness: ReturnType<typeof createHarness>;

  const resetDto = (customer_ids: number[], reason = 'Sai số liệu') =>
    ({ customer_ids, reason }) as any;

  beforeEach(() => {
    harness = createHarness();
  });

  it('chỉ xóa pending_amount, giữ nguyên tổng tích lũy và số lần nhận quà', async () => {
    harness.state.customers.push(
      buildCustomer(7, 'Nguyễn Văn A', '0901234567'),
      buildCustomer(8, 'Trần Thị B', '0912345678'),
    );
    const tracking7 = buildTracking(7, 500000, 3000000, 2);
    const tracking8 = buildTracking(8, 0, 1000000, 1);
    harness.state.trackings.push(tracking7, tracking8);

    const result = await harness.service.resetCustomerAccumulation(
      resetDto([7, 8, 9, 7]),
      99,
    );

    expect(result.reset_count).toBe(1);
    expect(result.skipped_count).toBe(2);
    expect(result.total_reset_amount).toBe(500000);

    expect(tracking7.pending_amount).toBe(0);
    expect(Number(tracking7.total_accumulated)).toBe(3000000);
    expect(tracking7.reward_count).toBe(2);
    expect(tracking8.pending_amount).toBe(0);

    expect(harness.state.resets).toHaveLength(1);
    const record = harness.state.resets[0]!;
    expect(record.customer_name).toBe('Nguyễn Văn A');
    expect(record.customer_phone).toBe('0901234567');
    expect(Number(record.pending_before)).toBe(500000);
    expect(Number(record.pending_reset)).toBe(500000);
    expect(Number(record.total_accumulated_snapshot)).toBe(3000000);
    expect(record.reward_count_snapshot).toBe(2);
    expect(record.reason).toBe('Sai số liệu');
    expect(record.status).toBe(CustomerRewardResetStatus.ACTIVE);
    expect(record.created_by).toBe(99);
  });

  it('bỏ qua khách hàng chưa có tích lũy', async () => {
    const result = await harness.service.resetCustomerAccumulation(
      resetDto([404]),
      7,
    );

    expect(result.reset_count).toBe(0);
    expect(result.skipped_count).toBe(1);
    expect(result.message).toContain('Không có khách hàng nào');
    expect(harness.state.resets).toHaveLength(0);
  });

  it('bắt buộc nhập lý do và danh sách khách hàng hợp lệ', async () => {
    await expect(
      harness.service.resetCustomerAccumulation(resetDto([7], '   '), 1),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      harness.service.resetCustomerAccumulation(resetDto([], ''), 1),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(harness.state.resets).toHaveLength(0);
  });
});

describe('CustomerRewardService - khôi phục tích lũy đã xóa', () => {
  let harness: ReturnType<typeof createHarness>;

  /** Tạo sẵn 1 bản ghi xóa tích lũy và tracking tương ứng của khách hàng */
  const seedReset = (pendingReset = 500000) => {
    const tracking = buildTracking(7, 0, 3000000, 2);
    harness.state.trackings.push(tracking);
    const record = Object.assign(new CustomerRewardResetHistory(), {
      id: 11,
      customer_id: 7,
      customer_name: 'Nguyễn Văn A',
      pending_before: pendingReset,
      pending_reset: pendingReset,
      total_accumulated_snapshot: 3000000,
      reward_count_snapshot: 2,
      reason: 'Sai số liệu',
      status: CustomerRewardResetStatus.ACTIVE,
    });
    harness.state.resets.push(record);
    return { tracking, record };
  };

  beforeEach(() => {
    harness = createHarness();
  });

  it('cộng bù đúng số tiền đã xóa vào tích lũy hiện tại', async () => {
    const { tracking, record } = seedReset();

    const result = await harness.service.restoreCustomerAccumulation(11, 99);

    expect(result.restored_amount).toBe(500000);
    expect(Number(tracking.pending_amount)).toBe(500000);
    expect(Number(tracking.total_accumulated)).toBe(3000000);
    expect(record.status).toBe(CustomerRewardResetStatus.RESTORED);
    expect(Number(record.restored_pending_amount)).toBe(500000);
    expect(record.restored_by).toBe(99);
    expect(record.restored_at).toBeInstanceOf(Date);
  });

  it('không làm mất tích lũy phát sinh sau khi xóa', async () => {
    const { tracking } = seedReset(400000);
    tracking.pending_amount = 250000;

    const result = await harness.service.restoreCustomerAccumulation(11, 99);

    expect(result.restored_amount).toBe(400000);
    expect(Number(tracking.pending_amount)).toBe(650000);
  });

  it('chặn khôi phục hai lần trên cùng một bản ghi', async () => {
    seedReset();
    await harness.service.restoreCustomerAccumulation(11, 99);

    await expect(
      harness.service.restoreCustomerAccumulation(11, 99),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('báo lỗi khi không tìm thấy lịch sử xóa', async () => {
    await expect(
      harness.service.restoreCustomerAccumulation(999, 99),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('CustomerRewardService - tìm kiếm lịch sử xóa tích lũy', () => {
  let harness: ReturnType<typeof createHarness>;

  beforeEach(() => {
    harness = createHarness();
  });

  it('trả về dữ liệu đã chuẩn hóa số và tên người thao tác', async () => {
    const record = Object.assign(new CustomerRewardResetHistory(), {
      id: 3,
      customer_id: 7,
      customer_name: 'Tên lưu lúc xóa',
      customer_phone: '0900000000',
      pending_before: '500000.00',
      pending_reset: '500000.00',
      total_accumulated_snapshot: '3000000.00',
      reward_count_snapshot: 2,
      status: CustomerRewardResetStatus.ACTIVE,
      restored_pending_amount: null,
      customer: buildCustomer(7, 'Nguyễn Văn A', '0901234567'),
      created_by_user: { account: 'ketoan1' },
      restored_by_user: null,
    });
    harness.state.resetQueryBuilder = createResetQueryBuilder([record], 1);

    const result = await harness.service.searchRewardResetHistory({
      page: 2,
      limit: 20,
      customer_name: 'Nguyễn',
      status: CustomerRewardResetStatus.ACTIVE,
      from_date: '2026-01-01',
      to_date: '2026-01-31',
    });

    expect(result.total).toBe(1);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(20);
    expect(result.items[0]!).toMatchObject({
      pending_before: 500000,
      pending_reset: 500000,
      total_accumulated_snapshot: 3000000,
      customer_display_name: 'Nguyễn Văn A',
      customer_display_phone: '0901234567',
      created_by_name: 'ketoan1',
      restored_by_name: null,
      restored_pending_amount: null,
    });
    expect(harness.state.resetQueryBuilder.skip).toHaveBeenCalledWith(20);
    expect(harness.state.resetQueryBuilder.take).toHaveBeenCalledWith(20);
    // Lọc theo trạng thái, từ khóa khách hàng, từ ngày và đến ngày
    expect(harness.state.resetQueryBuilder.andWhere).toHaveBeenCalledTimes(4);
  });

  it('mặc định trang 1 và giới hạn tối đa 100 bản ghi mỗi trang', async () => {
    harness.state.resetQueryBuilder = createResetQueryBuilder([], 0);

    const result = await harness.service.searchRewardResetHistory({
      page: 0,
      limit: 500,
    });

    expect(result.page).toBe(1);
    expect(result.limit).toBe(100);
    expect(harness.state.resetQueryBuilder.skip).toHaveBeenCalledWith(0);
    expect(harness.state.resetQueryBuilder.take).toHaveBeenCalledWith(100);
  });
});
