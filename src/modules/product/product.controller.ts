import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Put,
  Delete,
  Query,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SearchProductDto } from './dto/search-product.dto';
import { Product } from '../../entities/products.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

/**
 * Controller xử lý các yêu cầu liên quan đến sản phẩm
 * Cung cấp các endpoint RESTful cho quản lý sản phẩm nông nghiệp
 */
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  /**
   * Tạo sản phẩm mới
   * @param createProductDto - Dữ liệu tạo sản phẩm mới
   * @returns Thông tin sản phẩm đã tạo
   */
  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('PRODUCT_MANAGE')
  async create(@Body() createProductDto: CreateProductDto): Promise<Product> {
    return this.productService.create(createProductDto);
  }

  /**
   * Tạo sản phẩm mới với giá bán đề xuất
   * @param createProductDto - Dữ liệu tạo sản phẩm mới
   * @returns Thông tin sản phẩm đã tạo
   */
  @Post('with-suggested-price')
  async createWithSuggestedPrice(
    @Body() createProductDto: CreateProductDto,
  ): Promise<Product> {
    return this.productService.createWithSuggestedPrice(createProductDto);
  }

  /**
   * Lấy danh sách tất cả sản phẩm
   * @returns Danh sách sản phẩm
   */
  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('PRODUCT_VIEW')
  async findAll(): Promise<Product[]> {
    return this.productService.findAll();
  }

  /**
   * Tìm sản phẩm theo ID
   * @param id - ID của sản phẩm cần tìm
   * @returns Thông tin sản phẩm
   */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Product> {
    const product = await this.productService.findOne(id);
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với ID ${id}`);
    }
    return product;
  }

  /**
   * Cập nhật thông tin sản phẩm
   * @param id - ID của sản phẩm cần cập nhật
   * @param updateProductDto - Dữ liệu cập nhật sản phẩm
   * @returns Thông tin sản phẩm đã cập nhật
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('PRODUCT_MANAGE')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.productService.update(id, updateProductDto);
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với ID ${id}`);
    }
    return product;
  }

  /**
   * Xóa sản phẩm theo ID (soft delete)
   * @param id - ID của sản phẩm cần xóa
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('PRODUCT_MANAGE')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.productService.softDelete(id);
  }

  /**
   * Kích hoạt sản phẩm
   * @param id - ID của sản phẩm cần kích hoạt
   * @returns Thông tin sản phẩm đã kích hoạt
   */
  @Put(':id/activate')
  async activate(@Param('id', ParseIntPipe) id: number): Promise<Product> {
    const product = await this.productService.activate(id);
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với ID ${id}`);
    }
    return product;
  }

  /**
   * Vô hiệu hóa sản phẩm
   * @param id - ID của sản phẩm cần vô hiệu hóa
   * @returns Thông tin sản phẩm đã vô hiệu hóa
   */
  @Put(':id/deactivate')
  async deactivate(@Param('id', ParseIntPipe) id: number): Promise<Product> {
    const product = await this.productService.deactivate(id);
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với ID ${id}`);
    }
    return product;
  }

  /**
   * Lưu trữ sản phẩm
   * @param id - ID của sản phẩm cần lưu trữ
   * @returns Thông tin sản phẩm đã lưu trữ
   */
  @Put(':id/archive')
  async archive(@Param('id', ParseIntPipe) id: number): Promise<Product> {
    const product = await this.productService.archive(id);
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với ID ${id}`);
    }
    return product;
  }

  /**
   * Khôi phục sản phẩm đã bị xóa
   * @param id - ID của sản phẩm cần khôi phục
   * @returns Thông tin sản phẩm đã khôi phục
   */
  @Put(':id/restore')
  async restore(@Param('id', ParseIntPipe) id: number): Promise<Product> {
    const product = await this.productService.restore(id);
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với ID ${id}`);
    }
    return product;
  }

  /**
   * Tìm kiếm sản phẩm theo từ khóa
   * @param query - Từ khóa tìm kiếm
   * @returns Danh sách sản phẩm phù hợp
   */
  @Get('search/:query')
  async search(@Param('query') query: string): Promise<Product[]> {
    return this.productService.searchProducts(query);
  }

  /**
   * Tìm kiếm sản phẩm nâng cao
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách sản phẩm phù hợp
   */
  @Post('search')
  async searchAdvanced(@Body() searchDto: SearchProductDto): Promise<any> {
    return this.productService.searchProductsAdvanced(searchDto);
  }

  /**
   * Tìm sản phẩm theo loại sản phẩm
   * @param productType - ID loại sản phẩm
   * @returns Danh sách sản phẩm thuộc loại đó
   */
  @Get('type/:productType')
  async findByType(
    @Param('productType', ParseIntPipe) productType: number,
  ): Promise<Product[]> {
    return this.productService.findByType(productType);
  }

  /**
   * Cập nhật giá vốn trung bình và giá bán sản phẩm
   * @param productId - ID của sản phẩm cần cập nhật
   * @param averageCostPrice - Giá vốn trung bình mới
   * @returns Thông tin sản phẩm đã cập nhật
   */
  @Put(':id/average-cost-price')
  async updateProductAverageCostAndPrice(
    @Param('id', ParseIntPipe) productId: number,
    @Body('averageCostPrice') averageCostPrice: number,
  ): Promise<Product> {
    const product = await this.productService.updateProductAverageCostAndPrice(
      productId,
      averageCostPrice,
    );
    if (!product) {
      throw new NotFoundException(
        `Không tìm thấy sản phẩm với ID ${productId}`,
      );
    }
    return product;
  }

  /**
   * Cập nhật giá bán đề xuất cho sản phẩm
   * @param productId - ID của sản phẩm
   * @param desiredProfitMargin - Tỷ lệ lợi nhuận mong muốn (tùy chọn)
   * @returns Thông tin sản phẩm đã cập nhật
   */
  @Put(':id/suggested-price')
  async updateSuggestedPrice(
    @Param('id', ParseIntPipe) productId: number,
    @Query('desiredProfitMargin') desiredProfitMargin?: number,
  ): Promise<Product> {
    const product = await this.productService.updateSuggestedPrice(
      productId,
      desiredProfitMargin,
    );
    if (!product) {
      throw new NotFoundException(
        `Không tìm thấy sản phẩm với ID ${productId}`,
      );
    }
    return product;
  }

  /**
   * Cập nhật giá bán đề xuất cho tất cả sản phẩm
   * @param desiredProfitMargin - Tỷ lệ lợi nhuận mong muốn (tùy chọn)
   * @returns Thông báo thành công
   */
  @Put('update-all-suggested-prices')
  async updateAllSuggestedPrices(
    @Query('desiredProfitMargin') desiredProfitMargin?: number,
  ): Promise<{ message: string }> {
    await this.productService.updateAllSuggestedPrices(desiredProfitMargin);
    return { message: 'Đã cập nhật giá bán đề xuất cho tất cả sản phẩm' };
  }

  /**
   * Tính giá bán đề xuất cho sản phẩm
   * @param productId - ID của sản phẩm
   * @param desiredProfitMargin - Tỷ lệ lợi nhuận mong muốn (mặc định 10)
   * @param taxRate - Tỷ lệ thuế (mặc định 1.5)
   * @returns Giá bán đề xuất
   */
  @Get(':id/suggested-price')
  async calculateSuggestedPrice(
    @Param('id', ParseIntPipe) productId: number,
    @Query('desiredProfitMargin') desiredProfitMargin: number = 10,
    @Query('taxRate') taxRate: number = 1.5,
  ): Promise<{ suggestedPrice: number }> {
    const suggestedPrice = await this.productService.calculateSuggestedPrice(
      productId,
      desiredProfitMargin,
      taxRate,
    );
    return { suggestedPrice };
  }

  /**
   * Tính tổng giá trị hàng tồn kho
   * @returns Tổng giá trị hàng tồn kho
   */
  @Get('inventory-value')
  async calculateTotalInventoryValue() {
    const totalValue = await this.productService.calculateTotalInventoryValue();
    return { totalValue };
  }

  /**
   * Tính tỷ lệ phân bổ chi phí gián tiếp
   * @returns Tỷ lệ phân bổ chi phí gián tiếp
   */
  @Get('allocation-rate')
  async calculateIndirectCostAllocationRate() {
    const allocationRate =
      await this.productService.calculateIndirectCostAllocationRate();
    return { allocationRate };
  }

  /**
   * Tính chi phí gián tiếp phân bổ cho một sản phẩm
   * @param productId - ID của sản phẩm
   * @returns Chi phí gián tiếp phân bổ cho sản phẩm
   */
  @Get('indirect-cost/:productId')
  async calculateProductIndirectCost(
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    const indirectCost =
      await this.productService.calculateProductIndirectCost(productId);
    return { indirectCost };
  }
}
