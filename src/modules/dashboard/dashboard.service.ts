import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesInvoice, SalesInvoiceStatus } from '../../entities/sales-invoices.entity';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { Customer } from '../../entities/customer.entity';
import { Product } from '../../entities/products.entity';
import { InventoryBatch } from '../../entities/inventories.entity';
import { SystemSetting } from '../../entities/system-setting.entity';
import { OperatingCost } from '../../entities/operating-costs.entity';
import { FarmServiceCost } from '../../entities/farm-service-cost.entity';
import { DeliveryLog } from '../../entities/delivery-log.entity';
import { FarmGiftCost } from '../../entities/farm-gift-cost.entity';
import { CustomerRewardHistory } from '../../entities/customer-reward-history.entity';
import { PromotionRewardReservation } from '../../entities/promotion-reward-reservation.entity';
import { Season } from '../../entities/season.entity';
import { Loan, LoanStatus } from '../../entities/loan.entity';
import { loadSupplierRebates } from '../store-profit-report/supplier-rebate';
import { DashboardQueryDto, DashboardPeriod } from './dto/dashboard-query.dto';

@Injectable()
export class DashboardService {
  private readonly DEFAULT_DEBT_OVERDUE_AFTER_MONTHS = 4;
  private readonly DEBT_OVERDUE_AFTER_MONTHS_KEY = 'debt_overdue_after_months';

  constructor(
    @InjectRepository(SalesInvoice)
    private readonly salesInvoiceRepo: Repository<SalesInvoice>,
    @InjectRepository(DebtNote)
    private readonly debtNoteRepo: Repository<DebtNote>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(InventoryBatch)
    private readonly inventoryBatchRepo: Repository<InventoryBatch>,
    @InjectRepository(SystemSetting)
    private readonly systemSettingRepo: Repository<SystemSetting>,
    @InjectRepository(OperatingCost)
    private readonly operatingCostRepo: Repository<OperatingCost>,
    @InjectRepository(FarmGiftCost)
    private readonly farmGiftCostRepo: Repository<FarmGiftCost>,
    @InjectRepository(CustomerRewardHistory)
    private readonly customerRewardHistoryRepo: Repository<CustomerRewardHistory>,
    @InjectRepository(PromotionRewardReservation)
    private readonly promotionRewardReservationRepo: Repository<PromotionRewardReservation>,
    @InjectRepository(Season)
    private readonly seasonRepo: Repository<Season>,
    @InjectRepository(Loan)
    private readonly loanRepo: Repository<Loan>,
  ) {}

  private toNumber(value: unknown): number {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private formatDate(date: Date | string | undefined): string | null {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().split('T')[0] ?? null;
  }

  private async getDebtOverdueAfterMonths(): Promise<number> {
    const setting = await this.systemSettingRepo.findOne({
      where: { key: this.DEBT_OVERDUE_AFTER_MONTHS_KEY },
    });
    const months = Number(setting?.value);
    return Number.isInteger(months) && months > 0
      ? months
      : this.DEFAULT_DEBT_OVERDUE_AFTER_MONTHS;
  }

  private getDebtOverdueCutoffDate(months: number): Date {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setMonth(cutoff.getMonth() - months);
    return cutoff;
  }

  private getDebtDueDate(debtNote: DebtNote, months: number): Date {
    const dueDate = new Date(debtNote.created_at);
    dueDate.setMonth(dueDate.getMonth() + months);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate;
  }

  private isDebtNoteOverdue(debtNote: DebtNote, months: number, today: Date): boolean {
    return (
      this.toNumber(debtNote.remaining_amount) > 0 &&
      this.getDebtDueDate(debtNote, months).getTime() < today.getTime()
    );
  }

  private getMonthRange(year: number, month: number): { start: string; end: string } {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    return {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    };
  }

  private async getSeasonRange(seasonId?: number): Promise<{ start: string | null; end: string | null }> {
    if (!seasonId) {
      return { start: null, end: null };
    }

    const season = await this.seasonRepo.findOne({ where: { id: seasonId } });
    if (!season?.start_date || !season?.end_date) {
      return { start: null, end: null };
    }

    return {
      start: new Date(season.start_date).toISOString(),
      end: new Date(new Date(season.end_date).setHours(23, 59, 59, 999)).toISOString(),
    };
  }

  private getPeriodRange(dto: DashboardQueryDto): { start: string | null; end: string | null } {
    if (dto.start_date && dto.end_date) {
      return { start: dto.start_date, end: dto.end_date };
    }

    if (
      dto.season_id &&
      !dto.start_date &&
      !dto.end_date &&
      !dto.year &&
      !dto.month &&
      !dto.quarter
    ) {
      return { start: null, end: null };
    }

    const now = new Date();
    const year = dto.year || now.getFullYear();
    const month = dto.month || now.getMonth() + 1;

    switch (dto.period) {
      case DashboardPeriod.ALL:
        return { start: null, end: null };
      case DashboardPeriod.DAY:
        return {
          start: new Date(year, month - 1, now.getDate()).toISOString(),
          end: new Date(year, month - 1, now.getDate(), 23, 59, 59).toISOString(),
        };
      case DashboardPeriod.WEEK: {
        const dayOfWeek = now.getDay();
        const startWeek = new Date(now);
        startWeek.setDate(now.getDate() - dayOfWeek);
        startWeek.setHours(0, 0, 0, 0);
        const endWeek = new Date(startWeek);
        endWeek.setDate(startWeek.getDate() + 6);
        endWeek.setHours(23, 59, 59, 999);
        return { start: startWeek.toISOString(), end: endWeek.toISOString() };
      }
      case DashboardPeriod.MONTH: {
        const range = this.getMonthRange(year, month);
        return { start: range.start, end: range.end };
      }
      case DashboardPeriod.QUARTER: {
        const q = dto.quarter || Math.floor((now.getMonth() / 3) + 1);
        const startMonth = (q - 1) * 3 + 1;
        const endMonth = startMonth + 2;
        const startDate = new Date(year, startMonth - 1, 1);
        const endDate = new Date(year, endMonth, 0);
        return { start: startDate.toISOString(), end: endDate.toISOString() };
      }
      case DashboardPeriod.YEAR:
        return {
          start: new Date(year, 0, 1).toISOString(),
          end: new Date(year, 11, 31, 23, 59, 59).toISOString(),
        };
      default:
        return { start: dto.start_date || null, end: dto.end_date || null };
    }
  }

  async getStats(dto: DashboardQueryDto) {
    const { start, end } = this.getPeriodRange(dto);
    const { start: seasonStart, end: seasonEnd } = await this.getSeasonRange(dto.season_id);
    const costStart = seasonStart || start;
    const costEnd = seasonEnd || end;
    const overdueAfterMonths = await this.getDebtOverdueAfterMonths();
    const overdueCutoffDate = this.getDebtOverdueCutoffDate(overdueAfterMonths);

    const invoiceQb = this.salesInvoiceRepo.createQueryBuilder('invoice');
    invoiceQb.where('invoice.status IN (:...postedStatuses)', {
      postedStatuses: [SalesInvoiceStatus.CONFIRMED, SalesInvoiceStatus.PAID],
    });
    invoiceQb.andWhere('invoice.deleted_at IS NULL');

    if (start && end) {
      invoiceQb.andWhere('invoice.sale_date BETWEEN :start AND :end', { start, end });
    }
    if (dto.season_id) {
      invoiceQb.andWhere('invoice.season_id = :seasonId', { seasonId: dto.season_id });
    }

    const invoiceStats = await invoiceQb
      .select('COUNT(invoice.id)', 'total_count')
      .addSelect('COALESCE(SUM(invoice.final_amount), 0)', 'total_revenue')
      .addSelect('COALESCE(SUM(invoice.cost_of_goods_sold), 0)', 'total_cost')
      .addSelect('COALESCE(SUM(invoice.gross_profit), 0)', 'total_profit')
      .addSelect('COALESCE(SUM(invoice.discount_amount), 0)', 'total_discount')
      .addSelect('COALESCE(SUM(invoice.remaining_amount), 0)', 'total_debt')
      .addSelect('COALESCE(SUM(invoice.gift_value), 0)', 'total_gift_value')
      .getRawOne();

    // Chiết khấu NCC lúa giống được chốt sau khi nhập nên không ghi đè snapshot hóa đơn.
    // Dashboard cộng phần đã bán ròng để giá vốn và lợi nhuận khớp báo cáo mùa vụ.
    const invoiceRows = await invoiceQb
      .clone()
      .select('invoice')
      .leftJoinAndSelect('invoice.items', 'item')
      .getMany();
    const supplierRebates = await loadSupplierRebates(
      this.salesInvoiceRepo.manager,
      invoiceRows,
    );
    const supplierRebateTotal = [...supplierRebates.values()].reduce(
      (total, value) => total + value,
      0,
    );

    const customerCount = await this.customerRepo
      .createQueryBuilder('customer')
      .where('customer.created_at IS NOT NULL')
      .getCount();

    const debtStats = this.debtNoteRepo
      .createQueryBuilder('debt_note')
      .select('COALESCE(SUM(debt_note.remaining_amount), 0)', 'total_remaining')
      .addSelect('COALESCE(SUM(debt_note.amount), 0)', 'total_amount')
      .addSelect('COALESCE(SUM(debt_note.paid_amount), 0)', 'total_paid')
      .addSelect(
        'COUNT(CASE WHEN debt_note.remaining_amount > 0 AND debt_note.created_at < :overdueCutoffDate THEN 1 END)',
        'overdue_count',
      )
      .addSelect(
        'COUNT(CASE WHEN debt_note.remaining_amount > 0 AND debt_note.created_at >= :overdueCutoffDate THEN 1 END)',
        'active_count',
      )
      .addSelect(`COUNT(CASE WHEN debt_note.status IN ('${DebtNoteStatus.PAID}', '${DebtNoteStatus.SETTLED}') THEN 1 END)`, 'paid_count')
      .setParameter('overdueCutoffDate', overdueCutoffDate)
      .where('debt_note.status IN (:...statuses)', {
        statuses: [
          DebtNoteStatus.ACTIVE,
          DebtNoteStatus.OVERDUE,
          DebtNoteStatus.PAID,
          DebtNoteStatus.SETTLED,
        ],
      });

    if (dto.season_id) {
      debtStats.andWhere('debt_note.season_id = :seasonId', { seasonId: dto.season_id });
    }

    const debtStatsResult = await debtStats
      .getRawOne();

    const inventoryStats = await this.inventoryBatchRepo
      .createQueryBuilder('batch')
      .leftJoinAndSelect('batch.product', 'product')
      .select('COUNT(batch.id)', 'total_batches')
      .addSelect('COALESCE(SUM(CAST(batch.remaining_quantity AS DECIMAL) * CAST(batch.unit_cost_price AS DECIMAL)), 0)', 'total_value')
      .where('batch.deleted_at IS NULL')
      .getRawOne();

    const lowStockProducts = await this.productRepo
      .createQueryBuilder('product')
      .where('product.deleted_at IS NULL')
      .andWhere('product.status = :active', { active: 'active' })
      .getMany();

    const lowStockCount = lowStockProducts.filter(
      (p) => p.quantity !== undefined && p.quantity !== null && this.toNumber(p.quantity) <= 0,
    ).length;

    const now = new Date();
    const thirtyDaysLater = new Date(now);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    const expiringBatches = await this.inventoryBatchRepo
      .createQueryBuilder('batch')
      .innerJoin('batch.product', 'product')
      .select('COUNT(batch.id)', 'expiring_count')
      .addSelect('COALESCE(SUM(CAST(batch.remaining_quantity AS DECIMAL) * CAST(batch.unit_cost_price AS DECIMAL)), 0)', 'expiring_value')
      .where('batch.expiry_date IS NOT NULL')
      .andWhere('batch.expiry_date BETWEEN :now AND :thirtyDaysLater', { now, thirtyDaysLater })
      .andWhere('batch.remaining_quantity > 0')
      .getRawOne();

    const operatingCostQb = this.operatingCostRepo
      .createQueryBuilder('cost')
      .select('COALESCE(SUM(cost.value), 0)', 'total');

    if (dto.season_id) {
      operatingCostQb.where('cost.season_id = :seasonId', { seasonId: dto.season_id });
    } else if (costStart && costEnd) {
      operatingCostQb.where('cost.expense_date BETWEEN :costStart AND :costEnd', { costStart, costEnd });
    }

    const manualGiftCostQb = this.farmGiftCostRepo
      .createQueryBuilder('gift')
      .select('COALESCE(SUM(gift.amount), 0)', 'total')
      .where('gift.reward_history_id IS NULL')
      .andWhere('(gift.source IS NULL OR gift.source != :invoiceGiftSource)', {
        invoiceGiftSource: 'gift_from_invoice',
      });

    if (dto.season_id) {
      manualGiftCostQb.andWhere('gift.season_id = :seasonId', { seasonId: dto.season_id });
    } else if (costStart && costEnd) {
      manualGiftCostQb.andWhere('gift.gift_date BETWEEN :costStart AND :costEnd', { costStart, costEnd });
    }

    const accumulatedGiftCostQb = this.customerRewardHistoryRepo
      .createQueryBuilder('reward')
      .select('COALESCE(SUM(reward.gift_value), 0)', 'total')
      .where('reward.gift_status != :cancelledGiftStatus', { cancelledGiftStatus: 'cancelled' });

    if (dto.season_id) {
      accumulatedGiftCostQb.andWhere('reward.season_ids @> CAST(:seasonIds AS jsonb)', {
        seasonIds: JSON.stringify([dto.season_id]),
      });
    } else if (costStart && costEnd) {
      accumulatedGiftCostQb.andWhere('reward.reward_date BETWEEN :costStart AND :costEnd', { costStart, costEnd });
    }

    const campaignGiftCostQb = this.promotionRewardReservationRepo
      .createQueryBuilder('reservation')
      .select('COALESCE(SUM(reservation.reward_value), 0)', 'total')
      .where('reservation.status = :issuedStatus', { issuedStatus: 'issued' });

    if (dto.season_id) {
      if (seasonStart && seasonEnd) {
        campaignGiftCostQb.andWhere('reservation.issued_at BETWEEN :seasonStart AND :seasonEnd', {
          seasonStart,
          seasonEnd,
        });
      } else {
        campaignGiftCostQb.andWhere('1 = 0');
      }
    } else if (costStart && costEnd) {
      campaignGiftCostQb.andWhere('reservation.issued_at BETWEEN :costStart AND :costEnd', { costStart, costEnd });
    }

    const [operatingCost, manualGiftCost, accumulatedGiftCost, campaignGiftCost] = await Promise.all([
      operatingCostQb.getRawOne(),
      manualGiftCostQb.getRawOne(),
      accumulatedGiftCostQb.getRawOne(),
      campaignGiftCostQb.getRawOne(),
    ]);
    const serviceCostQb = this.salesInvoiceRepo.manager.getRepository(FarmServiceCost)
      .createQueryBuilder('service')
      .select('COALESCE(SUM(service.amount), 0)', 'total');
    const deliveryCostQb = this.salesInvoiceRepo.manager.getRepository(DeliveryLog)
      .createQueryBuilder('delivery')
      .leftJoin('delivery.invoice', 'deliveryInvoice')
      .select('COALESCE(SUM(delivery.total_cost), 0)', 'total');
    if (dto.season_id) {
      serviceCostQb.where('service.season_id = :seasonId', { seasonId: dto.season_id });
      deliveryCostQb.where('(delivery.season_id = :seasonId OR deliveryInvoice.season_id = :seasonId)', {
        seasonId: dto.season_id,
      });
    } else if (costStart && costEnd) {
      serviceCostQb.where('service.expense_date BETWEEN :costStart AND :costEnd', { costStart, costEnd });
      deliveryCostQb.where('delivery.delivery_date BETWEEN :costStart AND :costEnd', { costStart, costEnd });
    }
    const [serviceCost, deliveryCost] = await Promise.all([
      serviceCostQb.getRawOne(), deliveryCostQb.getRawOne(),
    ]);

    const loanStats = await this.loanRepo
      .createQueryBuilder('loan')
      .select('COUNT(CASE WHEN loan.status = :activeStatus THEN 1 END)', 'active_count')
      .addSelect('COUNT(CASE WHEN loan.status = :paidStatus THEN 1 END)', 'paid_count')
      .addSelect('COALESCE(SUM(CASE WHEN loan.status = :activeStatus THEN loan.principal_amount ELSE 0 END), 0)', 'active_principal')
      .addSelect('COALESCE(SUM(CASE WHEN loan.status = :activeStatus THEN loan.remaining_amount ELSE 0 END), 0)', 'active_remaining')
      .addSelect('COALESCE(SUM(CASE WHEN loan.status = :paidStatus THEN loan.paid_amount ELSE 0 END), 0)', 'paid_amount')
      .addSelect('COALESCE(SUM(CASE WHEN loan.status = :paidStatus THEN loan.interest_amount ELSE 0 END), 0)', 'realized_interest')
      .addSelect(
        `COALESCE(SUM(
          CASE WHEN loan.status = :activeStatus
          THEN ROUND((loan.principal_amount * loan.monthly_interest_rate * GREATEST((CURRENT_DATE - loan.loan_date), 0)) / 3000, 2)
          ELSE 0 END
        ), 0)`,
        'estimated_interest',
      )
      .where('loan.status != :cancelledStatus', { cancelledStatus: LoanStatus.CANCELLED })
      .setParameters({
        activeStatus: LoanStatus.ACTIVE,
        paidStatus: LoanStatus.PAID,
      })
      .getRawOne();

    const totalRevenue = this.toNumber(invoiceStats?.total_revenue || 0);
    const grossProfit =
      this.toNumber(invoiceStats?.total_profit || 0) + supplierRebateTotal;
    const invoiceGiftValue = this.toNumber(invoiceStats?.total_gift_value || 0);
    const operatingCostValue = this.toNumber(operatingCost?.total || 0);
    const manualGiftCostValue = this.toNumber(manualGiftCost?.total || 0);
    const accumulatedGiftCostValue = this.toNumber(accumulatedGiftCost?.total || 0);
    const campaignGiftCostValue = this.toNumber(campaignGiftCost?.total || 0);
    const totalGiftCost = invoiceGiftValue + manualGiftCostValue + accumulatedGiftCostValue + campaignGiftCostValue;
    const serviceCostValue = this.toNumber(serviceCost?.total || 0);
    const deliveryCostValue = this.toNumber(deliveryCost?.total || 0);
    const totalExtraCost = operatingCostValue + totalGiftCost + serviceCostValue + deliveryCostValue;
    const netProfit = grossProfit - totalExtraCost;
    const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const loanActivePrincipal = this.toNumber(loanStats?.active_principal || 0);
    const loanEstimatedInterest = this.toNumber(loanStats?.estimated_interest || 0);

    return {
      period: dto.period || DashboardPeriod.MONTH,
      start_date: start,
      end_date: end,
      stats: {
        totalRevenue,
        totalOrders: this.toNumber(invoiceStats?.total_count || 0),
        totalCost:
          this.toNumber(invoiceStats?.total_cost || 0) - supplierRebateTotal,
        totalProfit: netProfit,
        grossProfit,
        netProfit,
        grossProfitMargin: parseFloat(grossProfitMargin.toFixed(2)),
        netProfitMargin: parseFloat(netProfitMargin.toFixed(2)),
        operatingCost: operatingCostValue,
        serviceCost: serviceCostValue,
        deliveryCost: deliveryCostValue,
        totalGiftCost,
        totalExtraCost,
        totalDiscount: this.toNumber(invoiceStats?.total_discount || 0),
        totalDebt: this.toNumber(invoiceStats?.total_debt || 0),
        totalGiftValue: totalGiftCost,
        totalCustomers: customerCount,
        giftCosts: {
          invoiceGiftValue,
          manualGiftCost: manualGiftCostValue,
          accumulatedGiftCost: accumulatedGiftCostValue,
          campaignGiftCost: campaignGiftCostValue,
          totalGiftCost,
        },
        loans: {
          activeCount: this.toNumber(loanStats?.active_count || 0),
          paidCount: this.toNumber(loanStats?.paid_count || 0),
          activePrincipal: loanActivePrincipal,
          estimatedInterest: loanEstimatedInterest,
          activeReceivable: loanActivePrincipal + loanEstimatedInterest,
          storedRemaining: this.toNumber(loanStats?.active_remaining || 0),
          realizedInterest: this.toNumber(loanStats?.realized_interest || 0),
          paidAmount: this.toNumber(loanStats?.paid_amount || 0),
        },
        debt: {
          totalAmount: this.toNumber(debtStatsResult?.total_amount || 0),
          totalPaid: this.toNumber(debtStatsResult?.total_paid || 0),
          totalRemaining: this.toNumber(debtStatsResult?.total_remaining || 0),
          overdueCount: this.toNumber(debtStatsResult?.overdue_count || 0),
          activeCount: this.toNumber(debtStatsResult?.active_count || 0),
          paidCount: this.toNumber(debtStatsResult?.paid_count || 0),
          overdueAfterMonths,
        },
        inventory: {
          totalBatches: this.toNumber(inventoryStats?.total_batches || 0),
          totalValue: this.toNumber(inventoryStats?.total_value || 0),
          lowStockCount,
          expiringCount: this.toNumber(expiringBatches?.expiring_count || 0),
          expiringValue: this.toNumber(expiringBatches?.expiring_value || 0),
        },
      },
    };
  }

  async getRevenue(dto: DashboardQueryDto) {
    const { start, end } = this.getPeriodRange(dto);

    const invoiceQb = this.salesInvoiceRepo.createQueryBuilder('invoice');
    invoiceQb.where('invoice.status IN (:...postedStatuses)', {
      postedStatuses: [SalesInvoiceStatus.CONFIRMED, SalesInvoiceStatus.PAID],
    });
    invoiceQb.andWhere('invoice.deleted_at IS NULL');

    if (start && end) {
      invoiceQb.andWhere('invoice.sale_date BETWEEN :start AND :end', { start, end });
    }
    if (dto.season_id) {
      invoiceQb.andWhere('invoice.season_id = :seasonId', { seasonId: dto.season_id });
    }

    const invoiceRows = await invoiceQb
      .clone()
      .leftJoinAndSelect('invoice.items', 'item')
      .getMany();
    const supplierRebates = await loadSupplierRebates(
      this.salesInvoiceRepo.manager,
      invoiceRows,
    );
    const supplierRebateByMonth = new Map<string, number>();
    for (const invoice of invoiceRows) {
      if (!invoice.sale_date) continue;
      const month = new Date(invoice.sale_date).toISOString().slice(0, 7);
      const rebate = (invoice.items || []).reduce(
        (total, item) => total + (supplierRebates.get(Number(item.id)) || 0),
        0,
      );
      supplierRebateByMonth.set(
        month,
        (supplierRebateByMonth.get(month) || 0) + rebate,
      );
    }

    const monthlyData = await invoiceQb
      .select('DATE_TRUNC(\'month\', invoice.sale_date)', 'month')
      .addSelect('COALESCE(SUM(invoice.final_amount), 0)', 'revenue')
      .addSelect('COUNT(invoice.id)', 'count')
      .addSelect('COALESCE(SUM(invoice.gross_profit), 0)', 'profit')
      .addSelect('COALESCE(SUM(invoice.cost_of_goods_sold), 0)', 'cost')
      .groupBy('DATE_TRUNC(\'month\', invoice.sale_date)')
      .orderBy('month', 'ASC')
      .limit(12)
      .getRawMany();

    const monthlyRevenue = monthlyData.map((row) => {
      const monthDate = row.month ? new Date(row.month) : null;
      const rebate = monthDate
        ? supplierRebateByMonth.get(monthDate.toISOString().slice(0, 7)) || 0
        : 0;
      return {
        month: monthDate
          ? monthDate.toLocaleDateString('vi-VN', { month: 'short', year: 'numeric' })
          : '-',
        revenue: this.toNumber(row.revenue) / 1000000,
        count: this.toNumber(row.count),
        profit: (this.toNumber(row.profit) + rebate) / 1000000,
        cost: (this.toNumber(row.cost) - rebate) / 1000000,
      };
    });

    let comparisonRevenue: any[] = [];
    let yoyGrowth = 0;
    let momGrowth = 0;

    if (start && end) {
      const thisYearStart = new Date(start);
      const thisYearEnd = new Date(end);
      const compareStart = new Date(thisYearStart.getFullYear() - 1, thisYearStart.getMonth(), thisYearStart.getDate());
      const compareEnd = new Date(thisYearEnd.getFullYear() - 1, thisYearEnd.getMonth(), thisYearEnd.getDate(), 23, 59, 59);

      const comparisonQb = invoiceQb
        .clone()
        .where('invoice.status IN (:...postedStatuses)', {
          postedStatuses: [SalesInvoiceStatus.CONFIRMED, SalesInvoiceStatus.PAID],
        })
        .andWhere('invoice.deleted_at IS NULL')
        .andWhere('invoice.sale_date BETWEEN :start AND :end', {
          start: compareStart.toISOString(),
          end: compareEnd.toISOString(),
        });

      if (dto.season_id) {
        comparisonQb.andWhere('invoice.season_id = :seasonId', { seasonId: dto.season_id });
      }

      comparisonRevenue = await comparisonQb
        .select('DATE_TRUNC(\'month\', invoice.sale_date)', 'month')
        .addSelect('COALESCE(SUM(invoice.final_amount), 0)', 'revenue')
        .groupBy('DATE_TRUNC(\'month\', invoice.sale_date)')
        .orderBy('month', 'ASC')
        .getRawMany();

      const currentPeriodRevenue = monthlyData.reduce((sum, row) => sum + this.toNumber(row.revenue), 0);
      const comparePeriodRevenue = comparisonRevenue.reduce(
        (sum, row) => sum + this.toNumber(row.revenue),
        0,
      );

      if (comparePeriodRevenue > 0) {
        yoyGrowth = ((currentPeriodRevenue - comparePeriodRevenue) / comparePeriodRevenue) * 100;
      }

      if (monthlyData.length >= 2) {
        const lastMonth = monthlyData[monthlyData.length - 1];
        const prevMonth = monthlyData[monthlyData.length - 2];
        const lastMonthRevenue = this.toNumber(lastMonth.revenue);
        const prevMonthRevenue = this.toNumber(prevMonth.revenue);
        if (prevMonthRevenue > 0) {
          momGrowth = ((lastMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100;
        }
      }
    }

    return {
      period: dto.period || DashboardPeriod.MONTH,
      start_date: start,
      end_date: end,
      monthly: monthlyRevenue,
      comparison: comparisonRevenue.map((row) => ({
        month: row.month ? new Date(row.month).toLocaleDateString('vi-VN', { month: 'short', year: 'numeric' }) : '-',
        revenue: this.toNumber(row.revenue) / 1000000,
      })),
      growth: {
        yoy: parseFloat(yoyGrowth.toFixed(2)),
        mom: parseFloat(momGrowth.toFixed(2)),
      },
      totals: {
        currentPeriod: monthlyRevenue.reduce((sum, m) => sum + m.revenue, 0),
        comparePeriod: comparisonRevenue.reduce((sum, m) => sum + this.toNumber(m.revenue) / 1000000, 0),
      },
    };
  }

  async getReceivables(dto: DashboardQueryDto) {
    const overdueAfterMonths = await this.getDebtOverdueAfterMonths();
    const debtNotesQb = this.debtNoteRepo
      .createQueryBuilder('debt_note')
      .leftJoinAndSelect('debt_note.customer', 'customer')
      .where('debt_note.status IN (:...statuses)', {
        statuses: [DebtNoteStatus.ACTIVE, DebtNoteStatus.OVERDUE],
      })
      .andWhere('debt_note.remaining_amount > 0');

    if (dto.season_id) {
      debtNotesQb.andWhere('debt_note.season_id = :seasonId', { seasonId: dto.season_id });
    }

    const debtNotes = await debtNotesQb
      .orderBy('debt_note.due_date', 'ASC', 'NULLS LAST')
      .getMany();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const byCustomer: Record<string, {
      customerId: number;
      customerName: string;
      totalDebt: number;
      overdueAmount: number;
      activeCount: number;
      overdueCount: number;
      lastDueDate: string | null;
      invoices: Array<{ code: string; remaining: number; dueDate: string | null; status: string }>;
    }> = {};

    debtNotes.forEach((dn) => {
      const isOverdue = this.isDebtNoteOverdue(dn, overdueAfterMonths, today);
      const debtDueDate = this.getDebtDueDate(dn, overdueAfterMonths);
      const key = String(dn.customer_id);
      if (!byCustomer[key]) {
        byCustomer[key] = {
          customerId: dn.customer_id,
          customerName: dn.customer?.name || 'Khách hàng',
          totalDebt: 0,
          overdueAmount: 0,
          activeCount: 0,
          overdueCount: 0,
          lastDueDate: null,
          invoices: [],
        };
      }

      byCustomer[key].totalDebt += this.toNumber(dn.remaining_amount);
      byCustomer[key].invoices.push({
        code: dn.code,
        remaining: this.toNumber(dn.remaining_amount),
        dueDate: this.formatDate(debtDueDate),
        status: isOverdue ? DebtNoteStatus.OVERDUE : DebtNoteStatus.ACTIVE,
      });

      if (isOverdue) {
        byCustomer[key].overdueAmount += this.toNumber(dn.remaining_amount);
        byCustomer[key].overdueCount += 1;
      } else {
        byCustomer[key].activeCount += 1;
      }

      if (!byCustomer[key].lastDueDate || debtDueDate.getTime() < new Date(byCustomer[key].lastDueDate).getTime()) {
        byCustomer[key].lastDueDate = this.formatDate(debtDueDate);
      }
    });

    const customerSummary = Object.values(byCustomer)
      .sort((a, b) => b.totalDebt - a.totalDebt)
      .slice(0, dto.limit || 10);

    const totalDebtQb = this.debtNoteRepo
      .createQueryBuilder('debt_note')
      .select('COALESCE(SUM(debt_note.remaining_amount), 0)', 'total_remaining')
      .addSelect('COALESCE(SUM(CASE WHEN debt_note.created_at < :overdueCutoffDate THEN debt_note.remaining_amount ELSE 0 END), 0)', 'overdue_amount')
      .addSelect('COALESCE(SUM(CASE WHEN debt_note.created_at >= :overdueCutoffDate THEN debt_note.remaining_amount ELSE 0 END), 0)', 'active_amount')
      .addSelect('COUNT(CASE WHEN debt_note.created_at < :overdueCutoffDate THEN 1 END)', 'overdue_count')
      .addSelect('COUNT(CASE WHEN debt_note.created_at >= :overdueCutoffDate THEN 1 END)', 'active_count')
      .setParameter('overdueCutoffDate', this.getDebtOverdueCutoffDate(overdueAfterMonths))
      .where('debt_note.status IN (:...statuses)', {
        statuses: [DebtNoteStatus.ACTIVE, DebtNoteStatus.OVERDUE],
      });

    if (dto.season_id) {
      totalDebtQb.andWhere('debt_note.season_id = :seasonId', { seasonId: dto.season_id });
    }

    const totalDebt = await totalDebtQb
      .getRawOne();

    type AgingBucketKey = '0_7_days' | '8_30_days' | '31_90_days' | '90_plus';
    const agingBuckets: Record<AgingBucketKey, { count: number; amount: number }> = {
      '0_7_days': { count: 0, amount: 0 },
      '8_30_days': { count: 0, amount: 0 },
      '31_90_days': { count: 0, amount: 0 },
      '90_plus': { count: 0, amount: 0 },
    };

    debtNotes.forEach((dn) => {
      if (this.isDebtNoteOverdue(dn, overdueAfterMonths, today)) {
        const due = this.getDebtDueDate(dn, overdueAfterMonths);
        const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        const amount = this.toNumber(dn.remaining_amount);

        if (diffDays <= 7) {
          agingBuckets['0_7_days'].count += 1;
          agingBuckets['0_7_days'].amount += amount;
        } else if (diffDays <= 30) {
          agingBuckets['8_30_days'].count += 1;
          agingBuckets['8_30_days'].amount += amount;
        } else if (diffDays <= 90) {
          agingBuckets['31_90_days'].count += 1;
          agingBuckets['31_90_days'].amount += amount;
        } else {
          agingBuckets['90_plus'].count += 1;
          agingBuckets['90_plus'].amount += amount;
        }
      }
    });

    return {
      totalAmount: this.toNumber(totalDebt?.total_remaining || 0),
      overdueAmount: this.toNumber(totalDebt?.overdue_amount || 0),
      activeAmount: this.toNumber(totalDebt?.active_amount || 0),
      overdueCount: this.toNumber(totalDebt?.overdue_count || 0),
      activeCount: this.toNumber(totalDebt?.active_count || 0),
      overdueAfterMonths,
      aging: agingBuckets,
      byCustomer: customerSummary,
    };
  }

  async getInventory(dto: DashboardQueryDto) {
    const now = new Date();
    const thirtyDaysLater = new Date(now);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    const inventoryStats = await this.inventoryBatchRepo
      .createQueryBuilder('batch')
      .select('COUNT(batch.id)', 'total_batches')
      .addSelect('COALESCE(SUM(CAST(batch.remaining_quantity AS DECIMAL)), 0)', 'total_quantity')
      .addSelect('COALESCE(SUM(CAST(batch.remaining_quantity AS DECIMAL) * CAST(batch.unit_cost_price AS DECIMAL)), 0)', 'total_value')
      .where('batch.deleted_at IS NULL')
      .getRawOne();

    const expiringSoon = await this.inventoryBatchRepo
      .createQueryBuilder('batch')
      .innerJoin('batch.product', 'product')
      .select('COUNT(batch.id)', 'expiring_count')
      .addSelect('COALESCE(SUM(CAST(batch.remaining_quantity AS DECIMAL) * CAST(batch.unit_cost_price AS DECIMAL)), 0)', 'expiring_value')
      .where('batch.expiry_date IS NOT NULL')
      .andWhere('batch.expiry_date BETWEEN :now AND :thirtyDaysLater', { now, thirtyDaysLater })
      .andWhere('batch.remaining_quantity > 0')
      .getRawOne();

    const expired = await this.inventoryBatchRepo
      .createQueryBuilder('batch')
      .select('COUNT(batch.id)', 'expired_count')
      .addSelect('COALESCE(SUM(CAST(batch.remaining_quantity AS DECIMAL) * CAST(batch.unit_cost_price AS DECIMAL)), 0)', 'expired_value')
      .where('batch.expiry_date IS NOT NULL')
      .andWhere('batch.expiry_date < :now', { now })
      .andWhere('batch.remaining_quantity > 0')
      .getRawOne();

    const lowStockProducts = await this.productRepo
      .createQueryBuilder('product')
      .where('product.deleted_at IS NULL')
      .andWhere('product.status = :active', { active: 'active' })
      .andWhere('CAST(product.quantity AS DECIMAL) <= :threshold', { threshold: 0 })
      .orderBy('CAST(product.quantity AS DECIMAL)', 'ASC')
      .limit(dto.limit || 10)
      .getMany();

    const lowStockList = lowStockProducts.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.trade_name,
      quantity: this.toNumber(p.quantity),
      price: this.toNumber(p.price),
    }));

    return {
      totalBatches: this.toNumber(inventoryStats?.total_batches || 0),
      totalQuantity: this.toNumber(inventoryStats?.total_quantity || 0),
      totalValue: this.toNumber(inventoryStats?.total_value || 0),
      expiringSoon: {
        count: this.toNumber(expiringSoon?.expiring_count || 0),
        value: this.toNumber(expiringSoon?.expiring_value || 0),
      },
      expired: {
        count: this.toNumber(expired?.expired_count || 0),
        value: this.toNumber(expired?.expired_value || 0),
      },
      lowStock: {
        count: lowStockList.length,
        products: lowStockList,
      },
    };
  }

  async getSalesPerformance(dto: DashboardQueryDto, type: 'top-products' | 'top-customers' | 'top-employees') {
    const { start, end } = this.getPeriodRange(dto);
    const limit = dto.limit || 10;

    let qb = this.salesInvoiceRepo.createQueryBuilder('invoice');
    qb.where('invoice.status IN (:...postedStatuses)', {
      postedStatuses: [SalesInvoiceStatus.CONFIRMED, SalesInvoiceStatus.PAID],
    });
    qb.andWhere('invoice.deleted_at IS NULL');

    if (start && end) {
      qb.andWhere('invoice.sale_date BETWEEN :start AND :end', { start, end });
    }
    if (dto.season_id) {
      qb.andWhere('invoice.season_id = :seasonId', { seasonId: dto.season_id });
    }

    switch (type) {
      case 'top-products': {
        // Tổng hợp trả hàng trước khi join để không nhân dòng bán khi trả nhiều lần.
        const approvedReturns = `(SELECT returned.sales_invoice_item_id,
          SUM(returned.quantity) AS returned_quantity,
          SUM(returned.total_price) AS returned_amount
          FROM sales_return_items returned
          INNER JOIN sales_returns header ON header.id = returned.sales_return_id
          WHERE header.status = 'approved' AND returned.sales_invoice_item_id IS NOT NULL
          GROUP BY returned.sales_invoice_item_id)`;
        const results = await qb
          .leftJoin('invoice.items', 'items')
          .leftJoin('items.product', 'product')
          .leftJoin(approvedReturns, 'item_returns', 'item_returns.sales_invoice_item_id = items.id')
          .select('product.id', 'productId')
          .addSelect('product.name', 'productName')
          .addSelect('product.trade_name', 'tradeName')
          .addSelect('product.code', 'productCode')
          .addSelect('COALESCE(SUM(GREATEST(0, items.quantity - COALESCE(item_returns.returned_quantity, 0))), 0)', 'total_quantity')
          .addSelect(`COALESCE(SUM(GREATEST(0, items.total_price
            - CASE WHEN invoice.total_amount > 0 THEN COALESCE(invoice.discount_amount, 0)
                * items.total_price / invoice.total_amount ELSE 0 END
            - COALESCE(item_returns.returned_amount, 0))), 0)`, 'total_amount')
          .addSelect('COUNT(DISTINCT invoice.id)', 'invoice_count')
          .groupBy('product.id, product.name, product.trade_name, product.code')
          .orderBy('total_amount', 'DESC')
          .limit(limit)
          .getRawMany();

        return {
          type: 'top-products',
          period: { start, end },
          items: results.map((r) => ({
            id: this.toNumber(r.productId),
            code: r.productCode,
            name: r.tradeName || r.productName,
            totalQuantity: this.toNumber(r.total_quantity),
            totalAmount: this.toNumber(r.total_amount),
            invoiceCount: this.toNumber(r.invoice_count),
          })),
        };
      }

      case 'top-customers': {
        const results = await qb
          .select('invoice.customer_id', 'customerId')
          .addSelect('invoice.customer_name', 'customerName')
          .addSelect('COALESCE(SUM(invoice.final_amount), 0)', 'total_amount')
          .addSelect('COUNT(DISTINCT invoice.id)', 'invoice_count')
          .addSelect('COALESCE(SUM(invoice.remaining_amount), 0)', 'remaining_debt')
          .andWhere('invoice.customer_id IS NOT NULL')
          .groupBy('invoice.customer_id, invoice.customer_name')
          .orderBy('total_amount', 'DESC')
          .limit(limit)
          .getRawMany();

        return {
          type: 'top-customers',
          period: { start, end },
          items: results.map((r) => ({
            customerId: this.toNumber(r.customerId),
            customerName: r.customerName,
            totalAmount: this.toNumber(r.total_amount),
            invoiceCount: this.toNumber(r.invoice_count),
            remainingDebt: this.toNumber(r.remaining_debt),
          })),
        };
      }

      case 'top-employees': {
        const results = await qb
          .leftJoin('invoice.creator', 'creator')
          .select('creator.id', 'userId')
          .addSelect('creator.account', 'fullName')
          .addSelect('creator.account', 'account')
          .addSelect('COALESCE(SUM(invoice.final_amount), 0)', 'total_amount')
          .addSelect('COUNT(DISTINCT invoice.id)', 'invoice_count')
          .addSelect('COALESCE(SUM(invoice.gross_profit), 0)', 'total_profit')
          .groupBy('creator.id, creator.account')
          .orderBy('total_amount', 'DESC')
          .limit(limit)
          .getRawMany();

        return {
          type: 'top-employees',
          period: { start, end },
          items: results.map((r) => ({
            userId: this.toNumber(r.userId),
            fullName: r.fullName,
            account: r.account,
            totalAmount: this.toNumber(r.total_amount),
            invoiceCount: this.toNumber(r.invoice_count),
            totalProfit: this.toNumber(r.total_profit),
          })),
        };
      }

      default:
        return { type, period: { start, end }, items: [] };
    }
  }
}
