import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { BaseStatus } from '../../entities/base-status.enum';
import { InventoryService } from '../inventory/inventory.service';
import { SearchProductDto } from './dto/search-product.dto';

/**
 * Controller xử lý các request liên quan đến sản phẩm
 * Bao gồm quản lý sản phẩm, Status Management và Soft Delete
 */
@Controller('products')
// @UseGuards(JwtAuthGuard) // Tạm thời comment để test
export class ProductController {
  /**
   * Constructor injection ProductService
   * @param productService - Service xử lý logic nghiệp vụ sản phẩm
   */
  constructor(
    private readonly productService: ProductService,
    private readonly inventoryService: InventoryService,
  ) {}

  /**
   * Tạo sản phẩm mới
   * @param createProductDto - Dữ liệu tạo sản phẩm mới
   * @returns Thông tin sản phẩm đã tạo
   */
  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productService.create(createProductDto);
  }

  /**
   * Lấy danh sách tất cả sản phẩm với phân trang và điều kiện lọc
   * @param page - Trang hiện tại (mặc định: 1)
   * @param limit - Số bản ghi mỗi trang (mặc định: 20)
   * @param status - Trạng thái cần lọc (active, inactive, archived)
   * @param deleted - Lọc theo trạng thái xóa (true: đã xóa, false: chưa xóa, undefined: tất cả)
   * @returns Danh sách sản phẩm với thông tin phân trang
   */
  @Get()
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: string,
    @Query('deleted') deleted?: boolean,
  ) {
    // Chuyển đổi thành cấu trúc search với điều kiện lọc
    const searchDto = new SearchProductDto();
    searchDto.page = Number(page);
    searchDto.limit = Number(limit);
    searchDto.filters = [];
    searchDto.nested_filters = [];

    // Thêm điều kiện lọc status nếu có
    if (status) {
      searchDto.filters.push({
        field: 'status',
        operator: 'eq',
        value: status,
      });
    }

    // Thêm điều kiện lọc deleted_at nếu có
    if (deleted !== undefined) {
      if (deleted) {
        searchDto.filters.push({
          field: 'deleted_at',
          operator: 'isnotnull',
          value: null,
        });
      } else {
        searchDto.filters.push({
          field: 'deleted_at',
          operator: 'isnull',
          value: null,
        });
      }
    }

    return this.productService.searchProductsAdvanced(searchDto);
  }

  /**
   * Lấy danh sách sản phẩm theo trạng thái
   * @param status - Trạng thái cần lọc (active, inactive, archived)
   * @returns Danh sách sản phẩm theo trạng thái
   */
  @Get('by-status/:status')
  findByStatus(@Param('status') status: BaseStatus) {
    return this.productService.findByStatus(status);
  }

  /**
   * Tìm kiếm sản phẩm nâng cao với cấu trúc filter lồng nhau
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách sản phẩm phù hợp
   */
  @Post('search')
  async search(@Body() searchDto: SearchProductDto) {
    try {
      const result =
        await this.productService.searchProductsAdvanced(searchDto);
      return result;
    } catch (error) {
      throw new HttpException(
        'Error occurred while searching products',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Lấy thông tin chi tiết một sản phẩm theo ID
   * @param id - ID của sản phẩm cần tìm
   * @returns Thông tin sản phẩm
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    const productId = +id;
    if (isNaN(productId)) {
      throw new Error('Invalid product ID');
    }
    return this.productService.findOne(productId);
  }

  /**
   * Lấy thông tin chi tiết một sản phẩm theo ID cùng với thông tin giá nhập
   * @param id - ID của sản phẩm cần tìm
   * @returns Thông tin sản phẩm cùng với giá nhập mới nhất và giá nhập trung bình
   */
  @Get(':id/with-purchase-info')
  async findOneWithPurchaseInfo(@Param('id') id: string) {
    const productId = +id;
    if (isNaN(productId)) {
      throw new Error('Invalid product ID');
    }
    const product = await this.productService.findOne(productId);

    if (!product) {
      return null;
    }

    const purchaseInfo =
      await this.inventoryService.getProductPurchasePrices(productId);

    return {
      ...product,
      latestPurchasePrice: purchaseInfo.latestPurchasePrice,
      averageCostPrice: purchaseInfo.averageCostPrice,
    };
  }

  /**
   * Cập nhật thông tin sản phẩm
   * @param id - ID của sản phẩm cần cập nhật
   * @param updateProductDto - Dữ liệu cập nhật sản phẩm
   * @returns Thông tin sản phẩm đã cập nhật
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    const productId = +id;
    if (isNaN(productId)) {
      throw new Error('Invalid product ID');
    }
    return this.productService.update(productId, updateProductDto);
  }

  /**
   * Kích hoạt sản phẩm (chuyển trạng thái thành active)
   * @param id - ID của sản phẩm cần kích hoạt
   * @returns Thông tin sản phẩm đã kích hoạt
   */
  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    const productId = +id;
    if (isNaN(productId)) {
      throw new Error('Invalid product ID');
    }
    return this.productService.activate(productId);
  }

  /**
   * Vô hiệu hóa sản phẩm (chuyển trạng thái thành inactive)
   * @param id - ID của sản phẩm cần vô hiệu hóa
   * @returns Thông tin sản phẩm đã vô hiệu hóa
   */
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    const productId = +id;
    if (isNaN(productId)) {
      throw new Error('Invalid product ID');
    }
    return this.productService.deactivate(productId);
  }

  /**
   * Lưu trữ sản phẩm (chuyển trạng thái thành archived)
   * @param id - ID của sản phẩm cần lưu trữ
   * @returns Thông tin sản phẩm đã lưu trữ
   */
  @Patch(':id/archive')
  archive(@Param('id') id: string) {
    const productId = +id;
    if (isNaN(productId)) {
      throw new Error('Invalid product ID');
    }
    return this.productService.archive(productId);
  }

  /**
   * Soft delete sản phẩm
   * @param id - ID của sản phẩm cần soft delete
   */
  @Delete(':id/soft')
  softDelete(@Param('id') id: string) {
    const productId = +id;
    if (isNaN(productId)) {
      throw new Error('Invalid product ID');
    }
    return this.productService.softDelete(productId);
  }

  /**
   * Khôi phục sản phẩm đã bị soft delete
   * @param id - ID của sản phẩm cần khôi phục
   * @returns Thông tin sản phẩm đã khôi phục
   */
  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    const productId = +id;
    if (isNaN(productId)) {
      throw new Error('Invalid product ID');
    }
    return this.productService.restore(productId);
  }

  /**
   * Xóa cứng sản phẩm theo ID (hard delete)
   * @param id - ID của sản phẩm cần xóa
   * @returns Kết quả xóa sản phẩm
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    const productId = +id;
    if (isNaN(productId)) {
      throw new Error('Invalid product ID');
    }
    return this.productService.remove(productId);
  }
}
