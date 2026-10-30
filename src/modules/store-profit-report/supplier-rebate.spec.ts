import { loadSupplierRebates } from './supplier-rebate';
import { ProductCostingMethod } from '../../entities/products.entity';

describe('loadSupplierRebates', () => {
  const invoice = {
    id: 10,
    items: [{ id: 101, costing_method_snapshot: ProductCostingMethod.BY_PRICE_TYPE }],
  };

  function managerFor(rate: number) {
    return {
      getRepository: jest.fn().mockReturnValue({
        find: jest.fn().mockResolvedValue([
          { id: 501, supplier_rebate_per_base_unit: rate },
        ]),
        createQueryBuilder: jest.fn(),
      }),
    };
  }

  it('trừ đúng chiết khấu của kg khách trả về lô nguồn', async () => {
    const result = await loadSupplierRebates(
      managerFor(250) as never,
      [invoice as never],
      [{
        sales_invoice_item_id: 101,
        receipt_item_id: 501,
        inventory_batch_id: 700,
        quantity: 400,
      }] as never,
      [{
        id: 1,
        sales_invoice_item_id: 101,
        base_quantity: 40,
        quantity: 1,
        conversion_factor: 40,
        stock_allocations: [{ sourceBatchId: 700, quantity: 40 }],
      }] as never,
    );

    expect(result.get(101)).toBe(90000);
  });

  it('ghi nhận toàn bộ chiết khấu khi khách không trả hàng', async () => {
    const result = await loadSupplierRebates(
      managerFor(250) as never,
      [invoice as never],
      [{
        sales_invoice_item_id: 101,
        receipt_item_id: 501,
        inventory_batch_id: 700,
        quantity: 400,
      }] as never,
      [],
    );

    expect(result.get(101)).toBe(100000);
  });
});
