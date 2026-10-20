import { StoreProfitReportService } from './store-profit-report.service';
import { StoreProfitReportController } from './store-profit-report.controller';

describe('StoreProfitReportController date ranges', () => {
  it('includes the full Vietnam calendar day for customer report filters', async () => {
    const getCustomerProfitReport = jest.fn().mockResolvedValue({});
    const controller = new StoreProfitReportController({
      getCustomerProfitReport,
    } as unknown as StoreProfitReportService);

    await controller.getCustomerReport(
      15,
      undefined,
      undefined,
      '2026-10-31',
      '2026-10-31',
    );

    expect(getCustomerProfitReport).toHaveBeenCalledWith(
      15,
      undefined,
      undefined,
      new Date('2026-10-31T00:00:00+07:00'),
      new Date('2026-10-31T23:59:59.999+07:00'),
    );
  });

  it('includes the full Vietnam calendar day for period report filters', async () => {
    const getPeriodProfitReport = jest.fn().mockResolvedValue({});
    const controller = new StoreProfitReportController({
      getPeriodProfitReport,
    } as unknown as StoreProfitReportService);

    await controller.getPeriodReport('2026-10-31', '2026-10-31');

    expect(getPeriodProfitReport).toHaveBeenCalledWith(
      new Date('2026-10-31T00:00:00+07:00'),
      new Date('2026-10-31T23:59:59.999+07:00'),
      'all',
      undefined,
      'sale_date',
      'DESC',
    );
  });
});
