import { SalesInvoice, SalesInvoiceStatus } from '../../entities/sales-invoices.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';

/** Làm tròn tiền về hai chữ số, dùng trên tổng lũy kế để tránh lệch khi trả nhiều đợt. */
export function roundRewardMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Tính phần tích lũy lũy kế từ tiền thực trả và giá bán cuối của từng dòng hàng.
 * total_price đã là thành tiền cuối dòng; không trừ giảm giá dòng thêm lần nữa.
 */
export function calculateInvoiceRewardAccumulation(
  invoice: SalesInvoice,
  items: SalesInvoiceItem[],
  returns: SalesReturnItem[],
  paidAmount: number = Number(invoice.partial_payment_amount || 0),
): number {
  if (![SalesInvoiceStatus.CONFIRMED, SalesInvoiceStatus.PAID].includes(invoice.status)) {
    return 0;
  }

  const paid = Math.max(0, Math.min(paidAmount, Number(invoice.final_amount || 0)));
  // Chứng từ trước khi bật tính năng giữ nguyên quy tắc tích lũy tiền đã trả.
  if (Number(invoice.reward_policy_version || 0) === 0) {
    return roundRewardMoney(paid);
  }

  let totalValue = 0;
  let eligibleValue = 0;
  for (const item of items) {
    const baseQuantity = Number(item.base_quantity ?? item.quantity * Number(item.conversion_factor || 1));
    const returnedQuantity = returns
      .filter((returned) => returned.sales_invoice_item_id === item.id)
      .reduce((sum, returned) => sum + Number(
        returned.base_quantity ?? returned.quantity * Number(returned.conversion_factor || 1),
      ), 0);
    const remainingRatio = baseQuantity > 0
      ? Math.max(0, baseQuantity - returnedQuantity) / baseQuantity
      : 0;
    const finalLineValue = Math.max(0, Number(item.total_price || 0)) * remainingRatio;
    totalValue += finalLineValue;
    if (!item.exclude_from_reward) eligibleValue += finalLineValue;
  }

  if (totalValue <= 0) return 0;
  return roundRewardMoney(paid * Math.min(1, eligibleValue / totalValue));
}
