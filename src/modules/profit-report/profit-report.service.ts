import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RiceCrop } from '../../entities/rice-crop.entity';
import { CostItem, CostCategory } from '../../entities/cost-item.entity';
import { HarvestRecord } from '../../entities/harvest-record.entity';
import { SalesInvoice, SalesInvoiceStatus } from '../../entities/sales-invoices.entity';
import { ExternalPurchase } from '../../entities/external-purchase.entity';
import { Not } from 'typeorm';

export interface ProfitReport {
  rice_crop_id: number;
  field_name: string;
  area: number;
  rice_variety: string;
  
  // Chi phí
  total_cost: number;
  cost_breakdown: any[]; // Mảng chứa các hạng mục chi phí cho biểu đồ
  cost_items: CostItem[];
  
  // Thu hoạch
  yield_amount: number;
  quality_grade: string;
  total_revenue: number; // Đổi tên để khớp với Frontend
  
  // Lợi nhuận
  net_profit: number; // Đổi tên để khớp với Frontend
  roi: number; 
  profit_per_m2: number;
  
  // Thời gian
  sowing_date?: Date | undefined;
  harvest_date?: Date | undefined;
  duration_days?: number | undefined;
}

@Injectable()
export class ProfitReportService {
  private readonly logger = new Logger(ProfitReportService.name);

  constructor(
    @InjectRepository(RiceCrop)
    private riceCropRepository: Repository<RiceCrop>,
    @InjectRepository(CostItem)
    private costItemRepository: Repository<CostItem>,
    @InjectRepository(HarvestRecord)
    private harvestRecordRepository: Repository<HarvestRecord>,
    @InjectRepository(SalesInvoice)
    private salesInvoiceRepository: Repository<SalesInvoice>,
    @InjectRepository(ExternalPurchase)
    private externalPurchaseRepository: Repository<ExternalPurchase>,
  ) {}

  /**
   * Tính toán báo cáo lợi nhuận cho 1 vụ lúa
   */
  async calculateCropProfitability(cropId: number): Promise<ProfitReport> {
    try {
      // Lấy thông tin mảnh ruộng
      const crop = await this.riceCropRepository.findOne({ where: { id: cropId } });
      if (!crop) {
        throw new Error(`Không tìm thấy vụ lúa với ID: ${cropId}`);
      }

      // 1. Lấy chi phí canh tác (nhập tay: công cán, máy móc...)
      const costItems = await this.costItemRepository.find({
        where: { rice_crop_id: cropId },
      });

      // 2. Lấy hóa đơn hệ thống (vật tư mua tại cửa hàng)
      const systemInvoices = await this.salesInvoiceRepository.find({
        where: { 
          rice_crop_id: cropId,
          status: Not(SalesInvoiceStatus.CANCELLED)
        },
      });

      // 3. Lấy hóa đơn tự nhập (nông dân tự mua ngoài)
      const externalPurchases = await this.externalPurchaseRepository.find({
        where: { rice_crop_id: cropId },
      });

      // Tính toán tổng hợp
      const cultivationCost = costItems.reduce((sum, item) => sum + Number(item.total_cost), 0);
      const systemCost = systemInvoices.reduce((sum, inv) => sum + Number(inv.final_amount), 0);
      const externalCost = externalPurchases.reduce((sum, ext) => sum + Number(ext.total_amount), 0);
      
      const total_cost = cultivationCost + systemCost + externalCost;
      
      // Phân bổ chi phí cho biểu đồ
      const temp_breakdown: Record<string, number> = {
        [CostCategory.SEED]: 0,
        [CostCategory.FERTILIZER]: 0,
        [CostCategory.PESTICIDE]: 0,
        [CostCategory.LABOR]: 0,
        [CostCategory.MACHINERY]: 0,
        [CostCategory.IRRIGATION]: 0,
        'system_invoices': systemCost,
        'external_invoices': externalCost,
        [CostCategory.OTHER]: 0,
      };

      costItems.forEach(item => {
        const category = item.category || CostCategory.OTHER;
        if (temp_breakdown[category] !== undefined) {
          temp_breakdown[category] += Number(item.total_cost);
        } else {
          temp_breakdown[CostCategory.OTHER] += Number(item.total_cost);
        }
      });

      // Lấy thông tin thu hoạch
      const harvestRecords = await this.harvestRecordRepository.find({
        where: { rice_crop_id: cropId },
      });

      const harvest = harvestRecords[0]; // Lấy record đầu tiên
      const yield_amount = harvest ? Number(harvest.yield_amount) : (Number(crop.yield_amount) || 0);
      const quality_grade = harvest ? harvest.quality_grade : (crop.quality_grade || 'N/A');
      const revenue = harvest ? Number(harvest.total_revenue) : 0;

      // Tính lợi nhuận
      const net_profit = revenue - total_cost;
      const roi = total_cost > 0 ? (net_profit / total_cost) * 100 : 0;
      const profit_per_m2 = Number(crop.field_area) > 0 ? net_profit / Number(crop.field_area) : 0;

      // Chuyển đổi breakdown sang dạng mảng mà Frontend mong đợi
      const categoryLabels: Record<string, string> = {
        [CostCategory.SEED]: 'Hạt giống',
        [CostCategory.FERTILIZER]: 'Phân bón',
        [CostCategory.PESTICIDE]: 'Thuốc BVTV',
        [CostCategory.LABOR]: 'Nhân công',
        [CostCategory.MACHINERY]: 'Máy móc',
        [CostCategory.IRRIGATION]: 'Tưới tiêu',
        'system_invoices': 'Vật tư (Cửa hàng)',
        'external_invoices': 'Vật tư (Mua ngoài)',
        [CostCategory.OTHER]: 'Khác',
      };

      const cost_breakdown = Object.entries(temp_breakdown)
        .filter(([_, amount]) => amount > 0)
        .map(([category, amount]) => ({
          category: categoryLabels[category] || category,
          amount: amount,
          percentage: total_cost > 0 ? (amount / total_cost) * 100 : 0,
        }));

      // Tính thời gian
      const sowing_date = crop.sowing_date;
      const harvest_date = crop.actual_harvest_date || (harvest ? harvest.harvest_date : undefined);
      let duration_days: number | undefined;
      
      if (sowing_date && harvest_date) {
        const diff = new Date(harvest_date).getTime() - new Date(sowing_date).getTime();
        duration_days = Math.floor(diff / (1000 * 60 * 60 * 24));
      }

      const report: ProfitReport = {
        rice_crop_id: crop.id,
        field_name: crop.field_name,
        area: Number(crop.field_area),
        rice_variety: crop.rice_variety,
        total_cost,
        cost_breakdown,
        cost_items: costItems,
        yield_amount,
        quality_grade,
        total_revenue: revenue,
        net_profit,
        roi: Math.round(roi * 100) / 100,
        profit_per_m2: Math.round(profit_per_m2 * 100) / 100,
        sowing_date,
        harvest_date,
        duration_days,
      };

      this.logger.log(`✅ Đã tính toán báo cáo lợi nhuận cho mảnh ruộng ID: ${cropId}`);
      return report;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi tính toán báo cáo: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Báo cáo tổng hợp theo mùa vụ
   */
  async getSeasonProfitReport(seasonId: number, customerId?: number): Promise<{
    season_id: number;
    total_crops: number;
    total_area: number;
    total_cost: number;
    total_revenue: number;
    total_profit: number;
    average_roi: number;
    crops: ProfitReport[];
  }> {
    try {
      const where: any = { season_id: seasonId };
      if (customerId) {
        where.customer_id = customerId;
      }

      const crops = await this.riceCropRepository.find({ where });
      
      const cropReports = await Promise.all(
        crops.map(crop => this.calculateCropProfitability(crop.id))
      );

      const total_crops = cropReports.length;
      const total_area = cropReports.reduce((sum, r) => sum + r.area, 0);
      const total_cost = cropReports.reduce((sum, r) => sum + r.total_cost, 0);
      const total_revenue = cropReports.reduce((sum, r) => sum + r.total_revenue, 0);
      const total_profit = total_revenue - total_cost;
      const average_roi = total_cost > 0 ? (total_profit / total_cost) * 100 : 0;

      return {
        season_id: seasonId,
        total_crops,
        total_area,
        total_cost,
        total_revenue,
        total_profit,
        average_roi: Math.round(average_roi * 100) / 100,
        crops: cropReports,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi báo cáo mùa vụ: ${err.message}`, err.stack);
      throw error;
    }
  }
}
