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
   */
  async getAllPurchasesByRiceCrop(riceCropId: number): Promise<MergedPurchase[]> {
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
      date: inv.created_at,
      supplier: 'Hệ thống',
      total_amount: Number(inv.final_amount || 0),
      paid_amount: Number(inv.partial_payment_amount || 0),
      remaining_amount: Number(inv.remaining_amount || 0),
      status: inv.status,
      payment_method: inv.payment_method,
      source: 'system',
      items: inv.items || [],
      notes: inv.notes,
    }));

    // 4. Chuẩn hóa format chung cho external purchases
    const externalData: MergedPurchase[] = externalPurchases.map((ext) => ({
      id: `ext-${ext.id}`, // Prefix để tránh trùng ID
      code: `EXT-${ext.id.toString().padStart(4, '0')}`,
      date: ext.purchase_date,
      supplier: ext.supplier_name,
      total_amount: Number(ext.total_amount || 0),
      paid_amount: Number(ext.total_amount || 0), // External mặc định đã trả hết
      remaining_amount: 0,
      status: 'paid',
      payment_method: 'cash',
      source: 'external',
      items: ext.items || [],
      notes: ext.notes,
    }));

    // 5. Merge và sort theo ngày (mới nhất trước)
    const merged = [...systemData, ...externalData].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return merged;
  }

  /**
   * Tính tổng chi phí từ cả 2 nguồn
   */
  async getTotalPurchaseAmount(riceCropId: number): Promise<{
    system_total: number;
    external_total: number;
    grand_total: number;
  }> {
    const allPurchases = await this.getAllPurchasesByRiceCrop(riceCropId);

    const system_total = allPurchases
      .filter((p) => p.source === 'system')
      .reduce((sum, p) => sum + p.total_amount, 0);

    const external_total = allPurchases
      .filter((p) => p.source === 'external')
      .reduce((sum, p) => sum + p.total_amount, 0);

    return {
      system_total,
      external_total,
      grand_total: system_total + external_total,
    };
  }
}
