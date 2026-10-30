import { BadRequestException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { SalesInvoice } from '../../entities/sales-invoices.entity';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';
import { SalesReturnStatus } from '../../entities/sales-return.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { ProductCostingMethod } from '../../entities/products.entity';

/** Phần chiết khấu NCC theo loại giá bán đã bán ròng, theo dòng nhập và lô khách trả. */
export async function loadSupplierRebates(
  manager: EntityManager,
    invoices: SalesInvoice[],
    givenAllocations?: SalesInvoiceItemStockAllocation[],
    givenReturns?: SalesReturnItem[],
  ): Promise<Map<number, number>> {
    const eligibleItems = invoices.flatMap((invoice) => invoice.items || [])
      .filter((item) => item.costing_method_snapshot === ProductCostingMethod.BY_PRICE_TYPE);
    if (!eligibleItems.length) return new Map();
    const itemIds = eligibleItems.map((item) => Number(item.id));
    const allocations = givenAllocations || await manager.getRepository(SalesInvoiceItemStockAllocation)
      .find({ where: { sales_invoice_item_id: In(itemIds) } });
    const seedAllocations = allocations.filter((row) => itemIds.includes(Number(row.sales_invoice_item_id)));
    if (!seedAllocations.length) return new Map();
    const receiptItemIds = [...new Set(seedAllocations.map((row) => Number(row.receipt_item_id || 0)).filter(Boolean))];
    if (!receiptItemIds.length) return new Map();
    const receiptItems = await manager.getRepository(InventoryReceiptItem)
      .find({ where: { id: In(receiptItemIds) } });
    const rates = new Map(receiptItems.map((item) => [Number(item.id), Number(item.supplier_rebate_per_base_unit || 0)]));
    if (![...rates.values()].some((rate) => rate > 0)) return new Map();

    const invoiceIds = [...new Set(invoices.map((invoice) => Number(invoice.id)))];
    const returns = givenReturns || await manager.getRepository(SalesReturnItem)
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.sales_return', 'salesReturn')
      .where('salesReturn.invoice_id IN (:...invoiceIds)', { invoiceIds })
      .andWhere('salesReturn.status = :status', { status: SalesReturnStatus.APPROVED })
      .getMany();
    const result = new Map<number, number>();
    for (const item of eligibleItems) {
      const sources = seedAllocations.filter((row) => Number(row.sales_invoice_item_id) === Number(item.id));
      if (!sources.some((source) => Number(rates.get(Number(source.receipt_item_id)) || 0) > 0)) continue;
      let rebate = sources.reduce((sum, source) =>
        sum + Number(source.quantity) * Number(rates.get(Number(source.receipt_item_id)) || 0), 0);
      for (const returned of returns.filter((row) => Number(row.sales_invoice_item_id) === Number(item.id))) {
        const snapshots = returned.stock_allocations || [];
        const returnedQty = Number(returned.base_quantity ??
          Number(returned.quantity) * Number(returned.conversion_factor ?? 1));
        if (!snapshots.length || Math.abs(snapshots.reduce((sum, row) => sum + Number(row.quantity), 0) - returnedQty) > 0.0001) {
          throw new BadRequestException(`Phiếu khách trả dòng #${returned.id} thiếu dữ liệu lô để tính chiết khấu NCC.`);
        }
        for (const snapshot of snapshots) {
          const source = sources.find((row) =>
            Number(row.inventory_batch_id) === Number(snapshot.sourceBatchId));
          if (!source && sources.some((row) => Number(rates.get(Number(row.receipt_item_id)) || 0) > 0)) {
            throw new BadRequestException(`Phiếu khách trả dòng #${returned.id} thiếu lô nguồn chiết khấu NCC.`);
          }
          rebate -= Number(snapshot.quantity) * Number(rates.get(Number(source?.receipt_item_id)) || 0);
        }
      }
      result.set(Number(item.id), Math.round(Math.max(0, rebate) * 100) / 100);
    }
    return result;
  }
