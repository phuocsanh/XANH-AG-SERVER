import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesInvoice } from '../../entities/sales-invoices.entity';
import { ExternalPurchase } from '../../entities/external-purchase.entity';

export interface MergedPurchase {
  id: number | string;
  code: string;
  date: Date;
  supplier: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  payment_method: string;
  source: 'system' | 'external';
  items: any[];
  notes?: string | undefined;
  created_by?: number;
}

/**
 * Service để merge hóa đơn từ 2 nguồn: hệ thống và external
 */
@Injectable()
export class PurchaseMergeService {
  constructor(
    @InjectRepository(SalesInvoice)
    private salesInvoiceRepository: Repository<SalesInvoice>,
    @InjectRepository(ExternalPurchase)
    private externalPurchaseRepository: Repository<ExternalPurchase>,
  ) {}

  /**
   * Lấy tất cả hóa đơn mua hàng của 1 rice_crop (cả system và external)
   * Kèm theo tóm tắt thống kê (loại bỏ hóa đơn hủy)
   */
  async getAllPurchasesByRiceCrop(riceCropId: number): Promise<{
    data: MergedPurchase[];
    summary: {
      total_amount: number;
      paid_amount: number;
      remaining_amount: number;
      system_count: number;
      external_count: number;
    };
  }> {
    // 1. Lấy hóa đơn từ hệ thống
    const systemInvoices = await this.salesInvoiceRepository.find({
      where: { rice_crop_id: riceCropId },
      relations: ['items', 'items.product'],
      order: { created_at: 'DESC' },
    });

    // 2. Lấy hóa đơn nông dân tự nhập
    const externalPurchases = await this.externalPurchaseRepository.find({
      where: { rice_crop_id: riceCropId },
      relations: ['items'],
      order: { purchase_date: 'DESC' },
    });

    // 3. Chuẩn hóa format chung cho system invoices
    const systemData: MergedPurchase[] = systemInvoices.map((inv) => ({
      id: inv.id,
      code: inv.code,
      date: inv.sale_date || inv.created_at,
      supplier: 'Cửa hàng XANH',
      total_amount: Number(inv.final_amount || 0),
      paid_amount: Number(inv.partial_payment_amount || 0),
      remaining_amount: Number(inv.remaining_amount || 0),
      status: inv.status,
      payment_method: inv.payment_method,
      source: 'system',
      items: inv.items || [],
      notes: inv.notes,
      created_by: inv.created_by,
    }));

    // 4. Chuẩn hóa format chung cho external purchases
    const externalData: MergedPurchase[] = externalPurchases.map((ext) => ({
      id: `ext-${ext.id}`, // Prefix để tránh trùng ID
      code: `EXT-${ext.id.toString().padStart(4, '0')}`,
      date: ext.purchase_date,
      supplier: ext.supplier_name,
      total_amount: Number(ext.total_amount || 0),
      paid_amount: Number(ext.paid_amount || 0),
      remaining_amount: Number(ext.total_amount || 0) - Number(ext.paid_amount || 0),
      status: ext.payment_status || 'paid',
      payment_method: 'cash',
      source: 'external',
      items: ext.items || [],
      notes: ext.notes,
      created_by: ext.created_by,
    }));

    // 5. Merge và sort theo ngày (mới nhất trước)
    const merged = [...systemData, ...externalData].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    // 6. Tính toán summary (loại bỏ hóa đơn hủy)
    const activePurchases = merged.filter((p) => p.status !== 'cancelled');
    
    const summary = {
      total_amount: activePurchases.reduce((sum, p) => sum + p.total_amount, 0),
      paid_amount: activePurchases.reduce((sum, p) => sum + p.paid_amount, 0),
      remaining_amount: activePurchases.reduce((sum, p) => sum + p.remaining_amount, 0),
      system_count: activePurchases.filter(p => p.source === 'system').length,
      external_count: activePurchases.filter(p => p.source === 'external').length,
    };

    return {
      data: merged,
      summary,
    };
  }

  /**
   * Tính tổng chi phí từ cả 2 nguồn
   */
  async getTotalPurchaseAmount(riceCropId: number): Promise<{
    system_total: number;
    external_total: number;
    grand_total: number;
  }> {
    const result = await this.getAllPurchasesByRiceCrop(riceCropId);

    return {
      system_total: result.summary.total_amount - result.data
        .filter(p => p.source === 'external' && p.status !== 'cancelled')
        .reduce((sum, p) => sum + p.total_amount, 0),
      external_total: result.summary.external_count > 0 ? result.data
        .filter(p => p.source === 'external' && p.status !== 'cancelled')
        .reduce((sum, p) => sum + p.total_amount, 0) : 0,
      grand_total: result.summary.total_amount,
    };
  }
}
