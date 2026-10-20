import {
  SalesInvoice,
  SalesInvoiceStatus,
} from '../../entities/sales-invoices.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';
import { calculateInvoiceRewardAccumulation } from './invoice-reward-accumulation';

/** Dữ liệu cục bộ, không kết nối DB hoặc API. */
function invoice(overrides: Partial<SalesInvoice> = {}) {
  return Object.assign(
    new SalesInvoice(),
    {
      id: 1,
      status: SalesInvoiceStatus.CONFIRMED,
      reward_policy_version: 1,
      final_amount: 1000,
      partial_payment_amount: 1000,
    },
    overrides,
  );
}

function item(
  id: number,
  total: number,
  excluded = false,
  overrides: Partial<SalesInvoiceItem> = {},
) {
  return Object.assign(
    new SalesInvoiceItem(),
    {
      id,
      product_id: id,
      invoice_id: 1,
      quantity: 10,
      base_quantity: 10,
      conversion_factor: 1,
      unit_price: total / 10,
      total_price: total,
      discount_amount: 0,
      exclude_from_reward: excluded,
    },
    overrides,
  );
}

describe('Tích lũy từ giá bán cuối cùng của sản phẩm', () => {
  it.each([
    [false, false, 1000, 1000],
    [true, true, 1000, 0],
    [false, true, 1000, 600],
    [false, true, 500, 300],
    [false, true, 0, 0],
    [false, true, 2000, 600],
  ])(
    'loại đúng sản phẩm và chỉ tính tiền thực trả (%s, %s, %s)',
    (excludeA, excludeB, paid, expected) => {
      expect(
        calculateInvoiceRewardAccumulation(
          invoice({ partial_payment_amount: paid }),
          [item(1, 600, excludeA), item(2, 400, excludeB)],
          [],
        ),
      ).toBe(expected);
    },
  );

  it('dùng giá trị cuối dòng 900, không trừ giảm giá 100 thêm lần nữa', () => {
    expect(
      calculateInvoiceRewardAccumulation(
        invoice(),
        [
          item(1, 900, false, { unit_price: 100, discount_amount: 100 }),
          item(2, 100, true),
        ],
        [],
      ),
    ).toBe(900);
  });

  it('giới hạn phần tích lũy bằng tiền cuối hóa đơn khi có giảm giá tổng đơn', () => {
    expect(
      calculateInvoiceRewardAccumulation(
        invoice({ final_amount: 900, partial_payment_amount: 900 }),
        [item(1, 600), item(2, 400, true)],
        [],
      ),
    ).toBe(540);
  });

  it('phân bổ giảm giá tổng đơn theo tỷ trọng dòng khi mới thu một phần', () => {
    expect(
      calculateInvoiceRewardAccumulation(
        invoice({
          final_amount: 900,
          partial_payment_amount: 450,
        }),
        [item(1, 600), item(2, 400, true)],
        [],
      ),
    ).toBe(270);
  });

  it.each([
    SalesInvoiceStatus.DRAFT,
    SalesInvoiceStatus.CANCELLED,
    SalesInvoiceStatus.REFUNDED,
  ])('không ghi tích lũy cho trạng thái %s', (status) => {
    expect(
      calculateInvoiceRewardAccumulation(
        invoice({ status }),
        [item(1, 1000)],
        [],
      ),
    ).toBe(0);
  });

  it('giữ quy tắc tiền đã trả cho chứng từ cũ', () => {
    expect(
      calculateInvoiceRewardAccumulation(
        invoice({ reward_policy_version: 0, partial_payment_amount: 500 }),
        [item(1, 600, true), item(2, 400, true)],
        [],
      ),
    ).toBe(500);
  });

  it('trả hết sản phẩm được tích lũy thu hồi toàn bộ phần đã ghi nhận', () => {
    const returned = Object.assign(new SalesReturnItem(), {
      sales_invoice_item_id: 1,
      quantity: 10,
      base_quantity: 10,
    });
    expect(
      calculateInvoiceRewardAccumulation(
        invoice({ final_amount: 400, partial_payment_amount: 400 }),
        [item(1, 600), item(2, 400, true)],
        [returned],
      ),
    ).toBe(0);
  });

  it('hoàn tiền hàng bị loại không thu hồi tích lũy của hàng đủ điều kiện', () => {
    const returned = Object.assign(new SalesReturnItem(), {
      sales_invoice_item_id: 2,
      quantity: 10,
      base_quantity: 10,
    });
    expect(
      calculateInvoiceRewardAccumulation(
        invoice({ final_amount: 600, partial_payment_amount: 600 }),
        [item(1, 600), item(2, 400, true)],
        [returned],
      ),
    ).toBe(600);
  });

  it('tính hàng trả theo đơn vị cơ sở khi bán bao và trả kg', () => {
    const returned = Object.assign(new SalesReturnItem(), {
      sales_invoice_item_id: 1,
      quantity: 25,
      conversion_factor: 1,
      base_quantity: 25,
    });
    expect(
      calculateInvoiceRewardAccumulation(
        invoice({ final_amount: 700, partial_payment_amount: 700 }),
        [
          item(1, 600, false, {
            quantity: 1,
            conversion_factor: 50,
            base_quantity: 50,
          }),
          item(2, 400, true),
        ],
        [returned],
      ),
    ).toBe(300);
  });

  it('tổng chênh lệch qua nhiều lần trả đạt đúng mốc lũy kế cuối', () => {
    const items = [item(1, 1), item(2, 2, true)];
    const bill = invoice({ final_amount: 3 });
    let previous = 0;
    let credited = 0;
    for (const paid of [0.1, 0.2, 0.3, 0.6, 0.9, 1.5, 2.1, 2.7, 3]) {
      const target = calculateInvoiceRewardAccumulation(bill, items, [], paid);
      credited += target - previous;
      previous = target;
    }
    expect(Number(credited.toFixed(2))).toBe(1);
  });
});
