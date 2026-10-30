import { ProductCostingMethod } from '../../entities/products.entity';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';
import { SupplierReportService } from './supplier-report.service';

describe('Báo cáo nhà cung cấp theo lô', () => {
  it.each([
    { supplierId: 1, quantity: 2, cost: 200, revenue: 400, discount: 0, returnedAmount: 200, method: ProductCostingMethod.BY_BATCH },
    { supplierId: 2, quantity: 0, cost: 0, revenue: 0, discount: 0, returnedAmount: 200, method: ProductCostingMethod.BY_BATCH },
    { supplierId: 1, quantity: 2, cost: 200, revenue: 360, discount: 60, returnedAmount: 180, method: ProductCostingMethod.BY_BATCH },
    { supplierId: 1, quantity: 2, cost: 213.34, revenue: 400, discount: 0, returnedAmount: 200, method: ProductCostingMethod.BY_PRICE_TYPE },
  ])('trừ đúng lô trả và chiết khấu NCC $supplierId, giảm $discount, $method', async ({ supplierId, quantity, cost, revenue, discount, returnedAmount, method }) => {
    const query = (rows: unknown[], itemRows: unknown[] = []) => {
      const qb = {
        innerJoin: jest.fn().mockReturnThis(), innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(), groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(), getRawMany: jest.fn().mockResolvedValue(rows),
        getMany: jest.fn().mockResolvedValue(itemRows), getRawOne: jest.fn().mockResolvedValue({ total_purchase_value: 0 }),
      };
      return qb;
    };
    const source = supplierId === 1
      ? { sales_invoice_item_id: 18, inventory_batch_id: 101, quantity: 2, unit_cost: 100, total_cost: 200 }
      : { sales_invoice_item_id: 18, inventory_batch_id: 102, quantity: 1, unit_cost: 120, total_cost: 120 };
    const returns = [{
      id: 4, sales_invoice_item_id: 18, quantity: 1, base_quantity: 1,
      stock_allocations: [{ sourceBatchId: 102, quantity: 1 }],
    }];
    const allocationRepo = {
      createQueryBuilder: jest.fn(() => query([{
        sales_invoice_item_id: 18, quantity: source.quantity, total_cost: source.total_cost,
      }])),
      find: jest.fn().mockResolvedValue([source]),
    };
    const returnRepo = {
      createQueryBuilder: jest.fn(() => query([{
        invoice_id: 7, sales_invoice_item_id: 18, product_id: 10,
        returned_base_quantity: 1, returned_amount: returnedAmount,
      }])),
      find: jest.fn().mockResolvedValue(returns),
    };
    const service = Object.create(SupplierReportService.prototype) as SupplierReportService;
    Object.assign(service, {
      logger: { log: jest.fn(), error: jest.fn() },
      supplierRepository: { findOne: jest.fn().mockResolvedValue({ id: supplierId, name: 'NCC' }) },
      receiptItemRepository: { createQueryBuilder: jest.fn(() => query([
        { product_id: 10, supplier_id: 1 }, { product_id: 10, supplier_id: 2 },
      ])) },
      salesInvoiceItemRepository: {
        manager: { getRepository: jest.fn((entity) => entity === SalesInvoiceItemStockAllocation ? allocationRepo : returnRepo) },
        createQueryBuilder: jest.fn(() => query([], [{
          id: 18, invoice_id: 7, product_id: 10, quantity: 3, base_quantity: 3,
          total_price: 600, cost_price: 106.67, costing_method_snapshot: method,
          invoice: { id: 7, total_amount: 600, discount_amount: discount },
          product: { code: 'P', name: 'Thuốc' },
        }])),
      },
      inventoryReceiptRepository: { createQueryBuilder: jest.fn(() => query([])) },
    });

    const report = await service.getSupplierSalesStats(supplierId);
    expect(report.summary.total_cost).toBe(cost);
    expect(report.summary.total_revenue).toBe(revenue);
    expect(report.products[0]?.quantity_sold).toBe(quantity);
  });
});
