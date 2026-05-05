import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from '../../entities/suppliers.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { InventoryReceipt } from '../../entities/inventory-receipts.entity';
import { SalesInvoiceStatus } from '../../entities/sales-invoices.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';
import { SalesReturnStatus } from '../../entities/sales-return.entity';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';
import { InventoryReturnItem } from '../../entities/inventory-return-items.entity';
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

  private toBaseQuantity(
    baseQuantity?: number | string | null,
    quantity?: number | string | null,
    conversionFactor?: number | string | null,
  ): number {
    const normalizedBase = Number(baseQuantity || 0);
    if (Number.isFinite(normalizedBase) && normalizedBase > 0) {
      return normalizedBase;
    }

    const normalizedQuantity = Number(quantity || 0);
    const normalizedFactor = Number(conversionFactor || 1);
    return normalizedQuantity * (normalizedFactor > 0 ? normalizedFactor : 1);
  }

  private getEventTimestamp(...values: Array<Date | string | undefined>): number {
    for (const value of values) {
      if (!value) continue;
      const timestamp = new Date(value).getTime();
      if (Number.isFinite(timestamp)) {
        return timestamp;
      }
    }
    return 0;
  }

  private async buildLegacyAllocationByItem(
    supplierId: number,
    productIds: number[],
    targetSalesItemIds: number[],
    endDate?: string,
  ): Promise<Map<number, { quantity: number; totalCost: number }>> {
    const allocationByItem = new Map<number, { quantity: number; totalCost: number }>();
    if (productIds.length === 0 || targetSalesItemIds.length === 0) {
      return allocationByItem;
    }

    const receiptQuery = this.receiptItemRepository
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.receipt', 'receipt')
      .where('item.product_id IN (:...productIds)', { productIds })
      .andWhere("receipt.status IN ('approved', 'completed')")
      .andWhere('receipt.deleted_at IS NULL')
      .orderBy('COALESCE(receipt.bill_date, receipt.approved_at, receipt.created_at)', 'ASC')
      .addOrderBy('receipt.created_at', 'ASC')
      .addOrderBy('item.id', 'ASC');

    const salesQuery = this.salesInvoiceItemRepository
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.invoice', 'invoice')
      .where('item.product_id IN (:...productIds)', { productIds })
      .andWhere('invoice.status NOT IN (:...excludeStatuses)', {
        excludeStatuses: [
          SalesInvoiceStatus.CANCELLED,
          SalesInvoiceStatus.REFUNDED,
          SalesInvoiceStatus.DRAFT,
        ],
      })
      .andWhere('invoice.deleted_at IS NULL')
      .andWhere('item.deleted_at IS NULL')
      .orderBy('COALESCE(invoice.sale_date, invoice.created_at)', 'ASC')
      .addOrderBy('invoice.created_at', 'ASC')
      .addOrderBy('item.id', 'ASC');

    const inventoryReturnQuery = this.salesInvoiceItemRepository.manager
      .getRepository(InventoryReturnItem)
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.return', 'inventory_return')
      .where('item.product_id IN (:...productIds)', { productIds })
      .andWhere('inventory_return.status = :status', { status: 'approved' })
      .andWhere('inventory_return.deleted_at IS NULL')
      .orderBy(
        'COALESCE(inventory_return.approved_at, inventory_return.created_at)',
        'ASC',
      )
      .addOrderBy('item.id', 'ASC');

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      receiptQuery.andWhere(
        'COALESCE(receipt.bill_date, receipt.approved_at, receipt.created_at) <= :end',
        { end },
      );
      salesQuery.andWhere('COALESCE(invoice.sale_date, invoice.created_at) <= :end', {
        end,
      });
      inventoryReturnQuery.andWhere(
        'COALESCE(inventory_return.approved_at, inventory_return.created_at) <= :end',
        { end },
      );
    }

    const [receiptItems, salesItems, inventoryReturnItems] = await Promise.all([
      receiptQuery.getMany(),
      salesQuery.getMany(),
      inventoryReturnQuery.getMany(),
    ]);

    type ReceiptEvent = {
      type: 'receipt';
      productId: number;
      sortKey: number;
      priority: number;
      receiptItemId: number;
      receiptId: number;
      supplierId?: number;
      quantity: number;
      unitCost: number;
    };
    type InventoryReturnEvent = {
      type: 'inventory_return';
      productId: number;
      sortKey: number;
      priority: number;
      receiptItemId?: number | undefined;
      receiptId?: number | undefined;
      quantity: number;
      id: number;
    };
    type SaleEvent = {
      type: 'sale';
      productId: number;
      sortKey: number;
      priority: number;
      salesItemId: number;
      quantity: number;
    };

    const events: Array<ReceiptEvent | InventoryReturnEvent | SaleEvent> = [];
    for (const item of receiptItems) {
      const quantity = this.toBaseQuantity(
        item.base_quantity,
        item.quantity,
        item.conversion_factor,
      );
      if (quantity <= 0) continue;
      events.push({
        type: 'receipt',
        productId: Number(item.product_id),
        sortKey: this.getEventTimestamp(
          item.receipt?.bill_date,
          item.receipt?.approved_at,
          item.receipt?.created_at,
        ),
        priority: 0,
        receiptItemId: Number(item.id),
        receiptId: Number(item.receipt_id),
        supplierId: item.receipt?.supplier_id,
        quantity,
        unitCost: Number(item.final_unit_cost ?? item.unit_cost ?? 0),
      });
    }

    for (const item of inventoryReturnItems) {
      const quantity = this.toBaseQuantity(
        item.base_quantity,
        item.quantity,
        item.conversion_factor,
      );
      if (quantity <= 0) continue;
      events.push({
        type: 'inventory_return',
        productId: Number(item.product_id),
        sortKey: this.getEventTimestamp(
          item.return?.approved_at,
          item.return?.created_at,
        ),
        priority: 1,
        receiptItemId: item.receipt_item_id,
        receiptId: item.return?.receipt_id,
        quantity,
        id: Number(item.id),
      });
    }

    for (const item of salesItems) {
      const quantity = this.toBaseQuantity(
        item.base_quantity,
        item.quantity,
        item.conversion_factor,
      );
      if (quantity <= 0) continue;
      events.push({
        type: 'sale',
        productId: Number(item.product_id),
        sortKey: this.getEventTimestamp(
          item.invoice?.sale_date,
          item.invoice?.created_at,
        ),
        priority: 2,
        salesItemId: Number(item.id),
        quantity,
      });
    }

    events.sort((a, b) => {
      if (a.sortKey !== b.sortKey) {
        return a.sortKey - b.sortKey;
      }
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      if (a.type === 'receipt' && b.type === 'receipt') {
        return a.receiptItemId - b.receiptItemId;
      }
      if (a.type === 'inventory_return' && b.type === 'inventory_return') {
        return a.id - b.id;
      }
      if (a.type === 'sale' && b.type === 'sale') {
        return a.salesItemId - b.salesItemId;
      }
      return 0;
    });

    type LegacyLot = {
      receiptItemId: number;
      receiptId: number;
      supplierId?: number | undefined;
      remainingQuantity: number;
      unitCost: number;
    };

    const targetSet = new Set(targetSalesItemIds.map(Number));
    const lotsByProduct = new Map<number, LegacyLot[]>();

    for (const event of events) {
      const lots = lotsByProduct.get(event.productId) || [];
      if (!lotsByProduct.has(event.productId)) {
        lotsByProduct.set(event.productId, lots);
      }

      if (event.type === 'receipt') {
        lots.push({
          receiptItemId: event.receiptItemId,
          receiptId: event.receiptId,
          supplierId: event.supplierId,
          remainingQuantity: event.quantity,
          unitCost: event.unitCost,
        });
        continue;
      }

      if (event.type === 'inventory_return') {
        let remainingReturnQty = event.quantity;
        const matchedLots = event.receiptItemId
          ? lots.filter((lot) => lot.receiptItemId === Number(event.receiptItemId))
          : event.receiptId
            ? lots.filter((lot) => lot.receiptId === Number(event.receiptId))
            : lots;

        for (const lot of matchedLots) {
          if (remainingReturnQty <= 0) break;
          if (lot.remainingQuantity <= 0) continue;
          const deductedQty = Math.min(lot.remainingQuantity, remainingReturnQty);
          lot.remainingQuantity -= deductedQty;
          remainingReturnQty -= deductedQty;
        }
        continue;
      }

      let remainingSaleQty = event.quantity;
      for (const lot of lots) {
        if (remainingSaleQty <= 0) break;
        if (lot.remainingQuantity <= 0) continue;

        const allocatedQty = Math.min(lot.remainingQuantity, remainingSaleQty);
        lot.remainingQuantity -= allocatedQty;
        remainingSaleQty -= allocatedQty;

        if (
          targetSet.has(event.salesItemId) &&
          Number(lot.supplierId || 0) === Number(supplierId)
        ) {
          const current = allocationByItem.get(event.salesItemId) || {
            quantity: 0,
            totalCost: 0,
          };
          current.quantity += allocatedQty;
          current.totalCost += allocatedQty * Number(lot.unitCost || 0);
          allocationByItem.set(event.salesItemId, current);
        }
      }
    }

    return allocationByItem;
  }

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
      const supplierProductRows = await this.receiptItemRepository
        .createQueryBuilder('item')
        .innerJoin('item.receipt', 'receipt')
        .select('DISTINCT item.product_id', 'product_id')
        .addSelect('receipt.supplier_id', 'supplier_id')
        .getRawMany();

      const suppliersByProduct = new Map<number, Set<number>>();
      for (const row of supplierProductRows) {
        const productId = Number(row.product_id);
        const rowSupplierId = Number(row.supplier_id);
        if (!suppliersByProduct.has(productId)) {
          suppliersByProduct.set(productId, new Set<number>());
        }
        suppliersByProduct.get(productId)!.add(rowSupplierId);
      }

      const productIds = supplierProductRows
        .filter((row) => Number(row.supplier_id) === Number(supplierId))
        .map((p) => Number(p.product_id));

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
      const invoiceIdsForReturns = Array.from(
        new Set(salesItems.map((item) => item.invoice_id)),
      );
      const salesItemIds = salesItems.map((item) => item.id);
      const allocationByItem = new Map<
        number,
        { quantity: number; totalCost: number }
      >();

      if (salesItemIds.length > 0) {
        const allocationRows = await this.salesInvoiceItemRepository.manager
          .getRepository(SalesInvoiceItemStockAllocation)
          .createQueryBuilder('allocation')
          .select('allocation.sales_invoice_item_id', 'sales_invoice_item_id')
          .addSelect('COALESCE(SUM(allocation.quantity), 0)', 'quantity')
          .addSelect('COALESCE(SUM(allocation.total_cost), 0)', 'total_cost')
          .where('allocation.supplier_id = :supplierId', { supplierId })
          .andWhere('allocation.sales_invoice_item_id IN (:...salesItemIds)', {
            salesItemIds,
          })
          .groupBy('allocation.sales_invoice_item_id')
          .getRawMany();

        for (const row of allocationRows) {
          allocationByItem.set(Number(row.sales_invoice_item_id), {
            quantity: Number(row.quantity || 0),
            totalCost: Number(row.total_cost || 0),
          });
        }

        const missingSalesItemIds = salesItemIds.filter(
          (salesItemId) => !allocationByItem.has(Number(salesItemId)),
        );
        if (missingSalesItemIds.length > 0) {
          const legacyAllocationByItem = await this.buildLegacyAllocationByItem(
            supplierId,
            productIds,
            missingSalesItemIds,
            endDate,
          );
          for (const [salesItemId, allocation] of legacyAllocationByItem.entries()) {
            allocationByItem.set(salesItemId, allocation);
          }
        }
      }
      const returnStats = new Map<
        string,
        { returnedBaseQuantity: number; returnedAmount: number }
      >();

      if (invoiceIdsForReturns.length > 0) {
        const returnRows = await this.salesInvoiceItemRepository.manager
          .getRepository(SalesReturnItem)
          .createQueryBuilder('item')
          .innerJoin('item.sales_return', 'sales_return')
          .select('sales_return.invoice_id', 'invoice_id')
          .addSelect('item.sales_invoice_item_id', 'sales_invoice_item_id')
          .addSelect('item.product_id', 'product_id')
          .addSelect(
            'COALESCE(SUM(COALESCE(item.base_quantity, item.quantity * COALESCE(item.conversion_factor, 1))), 0)',
            'returned_base_quantity',
          )
          .addSelect('COALESCE(SUM(item.total_price), 0)', 'returned_amount')
          .where('sales_return.status = :status', {
            status: SalesReturnStatus.APPROVED,
          })
          .andWhere('sales_return.invoice_id IN (:...invoiceIds)', {
            invoiceIds: invoiceIdsForReturns,
          })
          .groupBy('sales_return.invoice_id')
          .addGroupBy('item.sales_invoice_item_id')
          .addGroupBy('item.product_id')
          .getRawMany();

        for (const row of returnRows) {
          const invoiceId = Number(row.invoice_id);
          const invoiceItemId = row.sales_invoice_item_id
            ? Number(row.sales_invoice_item_id)
            : undefined;
          const productId = Number(row.product_id);
          const key = invoiceItemId
            ? `${invoiceId}:item:${invoiceItemId}`
            : `${invoiceId}:product:${productId}`;
          returnStats.set(key, {
            returnedBaseQuantity: Number(row.returned_base_quantity || 0),
            returnedAmount: Number(row.returned_amount || 0),
          });
        }
      }

      // 4. Tổng hợp dữ liệu theo sản phẩm
      const productMap = new Map<number, SupplierProductStatDto>();
      const invoiceIds = new Set<number>();

      for (const item of salesItems) {
        const productId = item.product_id;
        const stats =
          returnStats.get(`${item.invoice_id}:item:${item.id}`) ||
          returnStats.get(`${item.invoice_id}:product:${item.product_id}`) || {
            returnedBaseQuantity: 0,
            returnedAmount: 0,
          };
        const originalBaseQuantity = Number(item.base_quantity || item.quantity);
        const remainingBaseQuantity = Math.max(
          0,
          originalBaseQuantity - stats.returnedBaseQuantity,
        );
        const netRevenue = Math.max(
          0,
          Number(item.total_price) - stats.returnedAmount,
        );
        const allocation = allocationByItem.get(item.id);
        const productSuppliers = suppliersByProduct.get(item.product_id);
        const canUseLegacyFallback =
          !allocation &&
          productSuppliers?.size === 1 &&
          productSuppliers.has(Number(supplierId));

        if (!allocation && !canUseLegacyFallback) {
          continue;
        }

        invoiceIds.add(item.invoice_id);
        if (!productMap.has(productId)) {
          productMap.set(productId, {
            product_id: productId,
            product_code: item.product?.code || 'N/A',
            product_name: item.product?.trade_name || item.product?.name || 'Unknown',
            quantity_sold: 0,
            unit_name: item.product?.unit?.name || item.unit_name || null,
            total_revenue: 0,
            total_cost: 0,
            profit: 0,
            margin: 0,
          });
        }

        const stat = productMap.get(productId)!;

        const remainingRatio =
          originalBaseQuantity > 0
            ? remainingBaseQuantity / originalBaseQuantity
            : 0;
        const quantity = allocation
          ? Number(allocation.quantity || 0) * remainingRatio
          : remainingBaseQuantity;
        const revenue =
          allocation && remainingBaseQuantity > 0
            ? netRevenue * (quantity / remainingBaseQuantity)
            : netRevenue;
        const cost = allocation
          ? Number(allocation.totalCost || 0) * remainingRatio
          : quantity *
            Number(item.cost_price ?? item.product?.average_cost_price ?? 0);

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
