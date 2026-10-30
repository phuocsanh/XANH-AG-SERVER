import { FarmServiceCost } from '../../entities/farm-service-cost.entity';
import { SalesInvoiceStatus } from '../../entities/sales-invoices.entity';
import { DashboardService } from './dashboard.service';

/** Kiểm tra tổng quan chỉ ghi nhận hóa đơn bán đã post và đủ các chi phí. */
describe('Dashboard doanh thu, giá vốn và lợi nhuận', () => {
  it('loại hóa đơn nháp và trừ chi phí giao hàng, dịch vụ khỏi lợi nhuận ròng', async () => {
    const queries: Array<{ alias: string; where: jest.Mock }> = [];
    const builder = (alias: string, total = 0) => {
      const qb: Record<string, jest.Mock> = {};
      for (const method of ['where', 'andWhere', 'select', 'addSelect', 'setParameter', 'setParameters',
        'leftJoin', 'leftJoinAndSelect', 'innerJoin', 'groupBy', 'orderBy', 'limit']) qb[method] = jest.fn(() => qb);
      qb.clone = jest.fn(() => qb);
      qb.getRawOne = jest.fn(async () => alias === 'invoice' ? {
        total_revenue: 1000, total_cost: 600, total_profit: 400,
        total_count: 1, total_gift_value: 10,
      } : { total });
      qb.getRawMany = jest.fn().mockResolvedValue([]);
      qb.getMany = jest.fn().mockResolvedValue([]);
      qb.getCount = jest.fn().mockResolvedValue(0);
      queries.push({ alias, where: qb.where! });
      return qb;
    };
    const repo = (amount = 0) => ({ createQueryBuilder: jest.fn((alias: string) => builder(alias, amount)) });
    const service = Object.create(DashboardService.prototype) as DashboardService;
    Object.assign(service, {
      salesInvoiceRepo: { ...repo(), manager: { getRepository: jest.fn((entity) => repo(entity === FarmServiceCost ? 30 : 20)) } },
      debtNoteRepo: repo(), customerRepo: repo(), productRepo: repo(), inventoryBatchRepo: repo(),
      operatingCostRepo: repo(40), farmGiftCostRepo: repo(), customerRewardHistoryRepo: repo(),
      promotionRewardReservationRepo: repo(), loanRepo: repo(),
      getPeriodRange: jest.fn().mockReturnValue({ start: null, end: null }),
      getSeasonRange: jest.fn().mockResolvedValue({ start: null, end: null }),
      getDebtOverdueAfterMonths: jest.fn().mockResolvedValue(4),
    });

    const report = await service.getStats({});
    expect(queries.find((query) => query.alias === 'invoice')?.where).toHaveBeenCalledWith(
      'invoice.status IN (:...postedStatuses)', {
        postedStatuses: [SalesInvoiceStatus.CONFIRMED, SalesInvoiceStatus.PAID],
      },
    );
    expect(report.stats.totalCost).toBe(600);
    expect(report.stats.grossProfit).toBe(400);
    expect(report.stats.serviceCost).toBe(30);
    expect(report.stats.deliveryCost).toBe(20);
    expect(report.stats.netProfit).toBe(300);
  });
});
