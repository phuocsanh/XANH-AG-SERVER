import { BadRequestException } from '@nestjs/common';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';

type Balance = { quantity: number; taxableQuantity: number };
const EPSILON = 0.00000001;
const round = (value: number) => Math.round(value * 10000) / 10000;

function quantity(value: unknown, context: string): number {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim()) ||
      !['number', 'string'].includes(typeof value) ||
      !Number.isFinite(Number(value)) || Number(value) < 0) {
    throw new BadRequestException(`${context}: số lượng không hợp lệ; cần đối soát trước khi hoàn kho.`);
  }
  return Number(value);
}

function baseQuantity(item: { base_quantity?: number; quantity: number; conversion_factor?: number }, context: string) {
  if (item.base_quantity !== null && item.base_quantity !== undefined) {
    return quantity(item.base_quantity, context);
  }
  const factor = quantity(item.conversion_factor ?? 1, context);
  if (factor <= 0) throw new BadRequestException(`${context}: hệ số quy đổi phải lớn hơn 0.`);
  return quantity(item.quantity, context) * factor;
}

/** numeric(15,2) must round-trip to the exact base-unit tax snapshot. */
export function saleTaxQuantityForStorage(baseTax: number, factor: number): number {
  quantity(baseTax, 'Thuế xuất kho');
  quantity(factor, 'Đơn vị bán');
  if (factor <= 0) throw new BadRequestException('Hệ số quy đổi đơn vị bán phải lớn hơn 0.');
  const stored = Math.round(baseTax / factor * 100) / 100;
  if (!Number.isFinite(stored) || stored > 9999999999999.99 ||
      baseTax > 9999999999999.99 || Math.abs(Math.round(baseTax * 100) / 100 - baseTax) > EPSILON ||
      Math.abs(stored * factor - baseTax) > EPSILON) {
    throw new BadRequestException('Đơn vị bán không lưu chính xác được số lượng thuế với 2 chữ số thập phân. Vui lòng bán theo đơn vị gốc.');
  }
  return stored;
}

/**
 * products.taxable_quantity_stock là numeric(15,4): phải round-trip chính xác tới 4 chữ số
 * thập phân, lẻ hơn thì báo lỗi để đối soát thay vì tự làm tròn số thuế.
 */
export function restoredTaxStockForStorage(value: number, productId: number): number {
  quantity(value, `Tồn thuế sản phẩm #${productId}`);
  const stored = Math.round(value * 10000) / 10000;
  if (stored > 99999999999.9999 || Math.abs(stored - value) > EPSILON) {
    throw new BadRequestException(`Tồn thuế sản phẩm #${productId} không lưu chính xác được với 4 chữ số thập phân; cần đối soát trước khi hoàn kho.`);
  }
  return stored;
}

/** All source and return allocations use base units, independently of prices. */
export function planInvoiceStockRestoration(
  invoiceId: number,
  items: SalesInvoiceItem[],
  allocations: SalesInvoiceItemStockAllocation[],
  returns: SalesReturnItem[],
  invoiceCode: string = String(invoiceId),
): { byItem: Map<number, Balance>; byAllocation: Map<number, Balance> } {
  const byItem = new Map<number, Balance>();
  const byAllocation = new Map<number, Balance>();
  const returnsByItem = new Map<number, SalesReturnItem[]>();

  for (const returned of returns) {
    if (returned.sales_return?.invoice_id != null && Number(returned.sales_return.invoice_id) !== invoiceId) {
      throw new BadRequestException(`Phiếu khách trả, dòng #${returned.id}, không thuộc hóa đơn ${invoiceCode}.`);
    }
    const matches = items.filter((item) => returned.sales_invoice_item_id
      ? item.id === Number(returned.sales_invoice_item_id) && item.product_id === returned.product_id
      : item.product_id === returned.product_id);
    if (matches.length !== 1) {
      throw new BadRequestException(`Phiếu khách trả, dòng #${returned.id}, thiếu dòng bán gốc duy nhất của hóa đơn ${invoiceCode}; cần đối soát.`);
    }
    const itemId = matches[0]!.id;
    returnsByItem.set(itemId, [...(returnsByItem.get(itemId) || []), returned]);
  }

  for (const allocation of allocations) {
    const item = items.find((entry) => entry.id === Number(allocation.sales_invoice_item_id));
    if (!item || Number(allocation.invoice_id) !== invoiceId ||
        Number(allocation.product_id) !== Number(item.product_id) || byAllocation.has(allocation.id)) {
      throw new BadRequestException(`Phân bổ lô #${allocation.id} không khớp hóa đơn ${invoiceCode}; cần đối soát.`);
    }
    const context = `Allocation #${allocation.id}, dòng hóa đơn #${item.id} (${invoiceCode})`;
    if (allocation.taxable_quantity === null || allocation.taxable_quantity === undefined) {
      throw new BadRequestException(`${context} thiếu snapshot thuế theo lô; cần đối soát trước khi hoàn kho.`);
    }
    const balance = {
      quantity: quantity(allocation.quantity, context),
      taxableQuantity: quantity(allocation.taxable_quantity, context),
    };
    if (balance.taxableQuantity > balance.quantity + EPSILON) {
      throw new BadRequestException(`${context}: thuế vượt số lượng nguồn.`);
    }
    byAllocation.set(allocation.id, balance);
  }

  for (const item of items) {
    const context = `Dòng hóa đơn #${item.id} (${invoiceCode})`;
    const original = baseQuantity(item, context);
    const sources = allocations.filter((entry) => Number(entry.sales_invoice_item_id) === item.id);
    if (sources.length && Math.abs(sources.reduce((sum, entry) => sum + Number(entry.quantity), 0) - original) > EPSILON) {
      throw new BadRequestException(`Phân bổ lô của dòng hóa đơn #${item.id} (${invoiceCode}) không khớp số lượng đã bán. Cần đối soát trước khi hoàn kho.`);
    }
    const legacyTax = sources.length ? 0 : quantity(item.taxable_quantity, context);
    let legacyRemaining = original;
    for (const returned of returnsByItem.get(item.id) || []) {
      const returnContext = `Phiếu khách trả, dòng #${returned.id}, ${context}`;
      const returnedQuantity = baseQuantity(returned, returnContext);
      const snapshots = Array.isArray(returned.stock_allocations) ? returned.stock_allocations : [];
      if (!sources.length) {
        legacyRemaining = round(legacyRemaining - returnedQuantity);
        if (legacyRemaining < -EPSILON) throw new BadRequestException(`${returnContext}: trả vượt số lượng bán.`);
        if (!snapshots.length && legacyTax > 0) {
          throw new BadRequestException(`${returnContext} thiếu snapshot thuế theo lô; cần đối soát.`);
        }
      }
      if (!snapshots.length) {
        if (sources.length !== 0) throw new BadRequestException(`${returnContext} thiếu snapshot thuế theo lô; cần đối soát.`);
        continue;
      }
      let snapshotQuantity = 0;
      for (const snapshot of snapshots) {
        const returnedBalance = {
          quantity: quantity(snapshot.quantity, returnContext),
          taxableQuantity: quantity(snapshot.taxableQuantity, `${returnContext} thiếu snapshot thuế theo lô`),
        };
        snapshotQuantity += returnedBalance.quantity;
        if (returnedBalance.taxableQuantity > returnedBalance.quantity + EPSILON) {
          throw new BadRequestException(`${returnContext}: thuế trả vượt số lượng trả.`);
        }
        if (!sources.length) {
          if (legacyTax === 0 && returnedBalance.taxableQuantity > 0) {
            throw new BadRequestException(`${returnContext}: snapshot trả có thuế nhưng dòng bán không có nguồn thuế.`);
          }
          continue;
        }
        // batchId identifies the newly returned stock, not the original sale lot.
        for (const sourceId of [snapshot.sourceBatchId, snapshot.sourceReceiptItemId]) {
          if (sourceId != null && (!Number.isSafeInteger(Number(sourceId)) || Number(sourceId) <= 0)) {
            throw new BadRequestException(`${returnContext}: mã lô xuất gốc không hợp lệ; cần đối soát.`);
          }
        }
        const hasSource = snapshot.sourceBatchId != null || snapshot.sourceReceiptItemId != null;
        const matches = sources.filter((source) =>
          (snapshot.sourceBatchId == null || Number(source.inventory_batch_id) === Number(snapshot.sourceBatchId)) &&
          (snapshot.sourceReceiptItemId == null || Number(source.receipt_item_id) === Number(snapshot.sourceReceiptItemId)),
        );
        if ((!hasSource && sources.length !== 1) || matches.length !== 1) {
          throw new BadRequestException(`${returnContext} thiếu lô xuất gốc duy nhất hoặc nguồn lô không khớp; cần đối soát.`);
        }
        const balance = byAllocation.get(matches[0]!.id)!;
        const remainingQuantity = round(balance.quantity - returnedBalance.quantity);
        const remainingTax = round(balance.taxableQuantity - returnedBalance.taxableQuantity);
        if (remainingQuantity < -EPSILON || remainingTax < -EPSILON || remainingTax > remainingQuantity + EPSILON) {
          throw new BadRequestException(`${returnContext}: số lượng thuế hoặc hàng không thuế trả vượt lô xuất gốc #${matches[0]!.id}.`);
        }
        balance.quantity = remainingQuantity;
        balance.taxableQuantity = remainingTax;
      }
      if (Math.abs(snapshotQuantity - returnedQuantity) > EPSILON) {
        throw new BadRequestException(`${returnContext}: snapshot lô không khớp số lượng trả.`);
      }
    }
    if (!sources.length) {
      if (legacyRemaining > EPSILON && legacyTax > 0) {
        throw new BadRequestException(`${context} thiếu snapshot thuế theo lô; không thể hoàn kho tự động, cần đối soát trước.`);
      }
      byItem.set(item.id, { quantity: legacyRemaining, taxableQuantity: 0 });
    } else {
      byItem.set(item.id, sources.reduce((sum, source) => {
        const balance = byAllocation.get(source.id)!;
        return { quantity: round(sum.quantity + balance.quantity), taxableQuantity: round(sum.taxableQuantity + balance.taxableQuantity) };
      }, { quantity: 0, taxableQuantity: 0 }));
    }
  }
  return { byItem, byAllocation };
}
