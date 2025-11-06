/**
 * Utility class để tính toán giá bán dựa trên chi phí và lợi nhuận mong muốn
 */

export class PricingCalculatorUtil {
  /**
   * Tính giá bán để đạt được lợi nhuận mong muốn
   * @param totalCost - Tổng chi phí
   * @param desiredProfitMargin - Tỷ lệ lợi nhuận mong muốn (%)
   * @returns Giá bán để đạt được lợi nhuận mong muốn
   */
  static calculateSellingPrice(
    totalCost: number,
    desiredProfitMargin: number,
  ): number {
    if (desiredProfitMargin >= 100 || desiredProfitMargin < 0) {
      throw new Error('Tỷ lệ lợi nhuận phải từ 0% đến dưới 100%');
    }

    if (totalCost <= 0) {
      throw new Error('Tổng chi phí phải lớn hơn 0');
    }

    // Giá bán = Tổng chi phí / (1 - Tỷ lệ lợi nhuận)
    return totalCost / (1 - desiredProfitMargin / 100);
  }

  /**
   * Tính chi phí gián tiếp phân bổ cho một sản phẩm dựa trên tỷ trọng giá trị
   * @param productValue - Giá trị của sản phẩm (giá vốn * số lượng)
   * @param totalInventoryValue - Tổng giá trị hàng tồn kho
   * @param totalIndirectCosts - Tổng chi phí gián tiếp
   * @returns Chi phí gián tiếp phân bổ cho sản phẩm
   */
  static calculateIndirectCostAllocation(
    productValue: number,
    totalInventoryValue: number,
    totalIndirectCosts: number,
  ): number {
    if (totalInventoryValue <= 0) {
      throw new Error('Tổng giá trị hàng tồn kho phải lớn hơn 0');
    }

    // Tính tỷ lệ phân bổ
    const allocationRate = totalIndirectCosts / totalInventoryValue;

    // Tính chi phí gián tiếp phân bổ cho sản phẩm
    return productValue * allocationRate;
  }

  /**
   * Tính giá vốn trung bình khi nhập thêm hàng với giá khác
   * @param currentQuantity - Số lượng hiện tại
   * @param currentAverageCost - Giá vốn trung bình hiện tại
   * @param newQuantity - Số lượng nhập thêm
   * @param newUnitCost - Giá vốn đơn vị của hàng nhập thêm
   * @returns Giá vốn trung bình mới
   */
  static calculateWeightedAverageCost(
    currentQuantity: number,
    currentAverageCost: number,
    newQuantity: number,
    newUnitCost: number,
  ): number {
    const totalQuantity = currentQuantity + newQuantity;
    if (totalQuantity <= 0) {
      throw new Error('Tổng số lượng phải lớn hơn 0');
    }

    return (
      (currentQuantity * currentAverageCost + newQuantity * newUnitCost) /
      totalQuantity
    );
  }

  /**
   * Tính giá bán bao gồm thuế
   * @param basePrice - Giá bán cơ bản (chưa bao gồm thuế)
   * @param taxRate - Tỷ lệ thuế (%)
   * @returns Giá bán bao gồm thuế
   */
  static calculatePriceWithTax(basePrice: number, taxRate: number): number {
    if (taxRate < 0) {
      throw new Error('Tỷ lệ thuế không được âm');
    }

    return basePrice / (1 - taxRate / 100);
  }
}
