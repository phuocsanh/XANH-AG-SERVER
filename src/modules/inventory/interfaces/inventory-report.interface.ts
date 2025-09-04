/**
 * Interface cho báo cáo giá trị tồn kho theo sản phẩm
 */
export interface ProductGroup {
  productId: number;
  batches: Array<{
    batchId: number;
    batchCode: string;
    quantity: number;
    unitCost: number;
    totalValue: number;
    expiryDate?: Date;
  }>;
  totalQuantity: number;
  totalValue: number;
  weightedAverageCost: number;
}

/**
 * Interface cho dữ liệu tồn kho của sản phẩm
 */
export interface StockData {
  productId: number;
  totalQuantity: number;
  weightedAverageCost: number;
  batches: Array<{
    batchId: number;
    batchCode: string;
    quantity: number;
    unitCost: number;
    expiryDate?: Date;
  }>;
}

/**
 * Interface cho sản phẩm có tồn kho thấp với thông tin cảnh báo
 */
export interface LowStockProduct extends StockData {
  alertLevel: string;
  recommendedReorder: number;
}