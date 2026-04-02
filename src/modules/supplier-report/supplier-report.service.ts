import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from '../../entities/suppliers.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { InventoryReceipt } from '../../entities/inventory-receipts.entity';
import { SalesInvoiceStatus } from '../../entities/sales-invoices.entity';
import { 
  SupplierReportDto, 
  SupplierProductStatDto, 
  SupplierStatsSummaryDto 
} from './dto/supplier-report.dto';

@Injectable()
export class SupplierReportService {
  private readonly logger = new Logger(SupplierReportService.name);

  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(InventoryReceiptItem)
    private readonly receiptItemRepository: Repository<InventoryReceiptItem>,
    @InjectRepository(SalesInvoiceItem)
    private readonly salesInvoiceItemRepository: Repository<SalesInvoiceItem>,
    @InjectRepository(InventoryReceipt)
    private readonly inventoryReceiptRepository: Repository<InventoryReceipt>,
  ) {}

  /**
   * Lấy thống kê doanh số và lợi nhuận của một nhà cung cấp
   * @param supplierId - ID nhà cung cấp
   * @param startDate - Ngày bắt đầu (YYYY-MM-DD)
   * @param endDate - Ngày kết thúc (YYYY-MM-DD)
   */
  async getSupplierSalesStats(
    supplierId: number,
    startDate?: string,
    endDate?: string
  ): Promise<SupplierReportDto> {
    try {
      // 1. Kiểm tra nhà cung cấp
      const supplier = await this.supplierRepository.findOne({
        where: { id: supplierId }
      });

      if (!supplier) {
        throw new NotFoundException(`Không tìm thấy nhà cung cấp với ID: ${supplierId}`);
      }

      // 2. Tìm danh sách ID các sản phẩm từng được nhập từ nhà cung cấp này
      const stockedProducts = await this.receiptItemRepository
        .createQueryBuilder('item')
        .innerJoin('item.receipt', 'receipt')
        .where('receipt.supplier_id = :supplierId', { supplierId })
        .select('DISTINCT item.product_id', 'product_id')
        .getRawMany();

      const productIds = stockedProducts.map(p => p.product_id);

      if (productIds.length === 0) {
        return {
          supplier_id: supplier.id,
          supplier_name: supplier.name,
          summary: {
            total_revenue: 0,
            total_cost: 0,
            gross_profit: 0,
            gross_margin: 0,
            product_count: 0,
            invoice_count: 0,
            total_purchase_value: 0,
            period: { start_date: startDate || null, endDate: endDate || null },
          },
          products: [],
        };
      }

      // 3. Truy vấn các item trong hóa đơn bán hàng cho các sản phẩm này
      const queryBuilder = this.salesInvoiceItemRepository
        .createQueryBuilder('item')
        .innerJoinAndSelect('item.invoice', 'invoice')
        .innerJoinAndSelect('item.product', 'product')
        .leftJoinAndSelect('product.unit', 'unit')
        .where('item.product_id IN (:...productIds)', { productIds })
        .andWhere('invoice.status NOT IN (:...excludeStatuses)', { 
          excludeStatuses: [
            SalesInvoiceStatus.CANCELLED, 
            SalesInvoiceStatus.REFUNDED, 
            SalesInvoiceStatus.DRAFT
          ] 
        });

      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        queryBuilder.andWhere('invoice.sale_date BETWEEN :start AND :end', { start, end });
      }

      const salesItems = await queryBuilder.getMany();

      // 4. Tổng hợp dữ liệu theo sản phẩm
      const productMap = new Map<number, SupplierProductStatDto>();
      const invoiceIds = new Set<number>();

      for (const item of salesItems) {
        invoiceIds.add(item.invoice_id);
        const productId = item.product_id;

        if (!productMap.has(productId)) {
          productMap.set(productId, {
            product_id: productId,
            product_code: item.product?.code || 'N/A',
            product_name: item.product?.trade_name || item.product?.name || 'Unknown',
            quantity_sold: 0,
            unit_name: item.unit_name || item.product?.unit?.name || null,
            total_revenue: 0,
            total_cost: 0,
            profit: 0,
            margin: 0,
          });
        }

        const stat = productMap.get(productId)!;
        const avgCost = Number(item.product?.average_cost_price || 0);
        const quantity = Number(item.base_quantity || item.quantity);
        const revenue = Number(item.total_price);
        const cost = quantity * avgCost;

        stat.quantity_sold += quantity;
        stat.total_revenue += revenue;
        stat.total_cost += cost;
        stat.profit = stat.total_revenue - stat.total_cost;
        stat.margin = stat.total_revenue > 0 
          ? Math.round((stat.profit / stat.total_revenue) * 10000) / 100 
          : 0;
      }

      // 5. Tính toán summary cuối cùng
      const products = Array.from(productMap.values()).sort((a, b) => b.total_revenue - a.total_revenue);
      
      let totalRevenue = 0;
      let totalCost = 0;
      
      products.forEach(p => {
        totalRevenue += p.total_revenue;
        totalCost += p.total_cost;
      });

      const grossProfit = totalRevenue - totalCost;
      const summary: SupplierStatsSummaryDto = {
        total_revenue: Math.round(totalRevenue * 100) / 100,
        total_cost: Math.round(totalCost * 100) / 100,
        gross_profit: Math.round(grossProfit * 100) / 100,
        gross_margin: totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 10000) / 100 : 0,
        product_count: products.length,
        invoice_count: invoiceIds.size,
        total_purchase_value: 0,
        period: {
          start_date: startDate || null,
          endDate: endDate || null,
        },
      };

      // 6. Tính tổng tiền nhập kho từ nhà cung cấp này trong khoảng thời gian đã chọn
      const purchaseQuery = this.inventoryReceiptRepository
        .createQueryBuilder('receipt')
        .where('receipt.supplier_id = :supplierId', { supplierId })
        .andWhere('receipt.status != :status', { status: 'cancelled' }); // Bỏ qua phiếu đã hủy

      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        // Sử dụng bill_date nếu có, nếu không thì dùng created_at
        purchaseQuery.andWhere('(receipt.bill_date BETWEEN :start AND :end OR (receipt.bill_date IS NULL AND receipt.created_at BETWEEN :start AND :end))', { start, end });
      }

      const purchaseStats = await purchaseQuery
        .select('SUM(COALESCE(receipt.final_amount, receipt.total_amount))', 'total_purchase_value')
        .getRawOne();
      
      summary.total_purchase_value = Math.round(Number(purchaseStats?.total_purchase_value || 0) * 100) / 100;

      this.logger.log(`📊 Đã tạo báo cáo cho nhà cung cấp ${supplier.name}: ${products.length} sản phẩm, Doanh số ${totalRevenue.toLocaleString()} đ, Nhập hàng ${summary.total_purchase_value.toLocaleString()} đ`);

      return {
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        summary,
        products,
      };
    } catch (error) {
      this.logger.error(`❌ Lỗi khi lấy thống kê nhà cung cấp ${supplierId}:`, error);
      throw error;
    }
  }
}
