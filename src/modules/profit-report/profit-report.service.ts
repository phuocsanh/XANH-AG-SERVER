import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RiceCrop } from '../../entities/rice-crop.entity';
import { CostItem, CostCategory } from '../../entities/cost-item.entity';
import { HarvestRecord } from '../../entities/harvest-record.entity';

export interface ProfitReport {
  rice_crop_id: number;
  field_name: string;
  area: number;
  rice_variety: string;
  
  // Chi phí
  total_cost: number;
  cost_breakdown: Record<CostCategory, number>;
  cost_items: CostItem[];
  
  // Thu hoạch
  yield_amount: number;
  quality_grade: string;
  revenue: number;
  
  // Lợi nhuận
  profit: number;
  roi: number; // Return on Investment (%)
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

      // Lấy tất cả chi phí
      const costItems = await this.costItemRepository.find({
        where: { rice_crop_id: cropId },
      });

      // Tính tổng chi phí và phân loại
      const total_cost = costItems.reduce((sum, item) => sum + Number(item.total_cost), 0);
      
      const cost_breakdown: Record<CostCategory, number> = {
        [CostCategory.SEED]: 0,
        [CostCategory.FERTILIZER]: 0,
        [CostCategory.PESTICIDE]: 0,
        [CostCategory.LABOR]: 0,
        [CostCategory.MACHINERY]: 0,
        [CostCategory.IRRIGATION]: 0,
        [CostCategory.OTHER]: 0,
      };

      costItems.forEach(item => {
        const category = item.category || CostCategory.OTHER; // Fallback nếu category undefined
        cost_breakdown[category] += Number(item.total_cost);
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
      const profit = revenue - total_cost;
      const roi = total_cost > 0 ? (profit / total_cost) * 100 : 0;
      const profit_per_m2 = Number(crop.field_area) > 0 ? profit / Number(crop.field_area) : 0;

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
        revenue,
        profit,
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
      const total_revenue = cropReports.reduce((sum, r) => sum + r.revenue, 0);
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
