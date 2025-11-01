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
import { ProductSubtypeService } from './product-subtype.service';
import { CreateProductSubtypeDto } from './dto/create-product-subtype.dto';
import { UpdateProductSubtypeDto } from './dto/update-product-subtype.dto';
import { BaseStatus } from '../../entities/base-status.enum';
import { SearchProductSubtypeDto } from './dto/search-product-subtype.dto';

/**
 * Controller xử lý các request liên quan đến loại phụ sản phẩm
 * Cung cấp các endpoint CRUD cho quản lý loại phụ sản phẩm
 * Hỗ trợ soft delete và quản lý trạng thái (active/inactive/archived)
 */
@Controller('product-subtype')
// @UseGuards(JwtAuthGuard) // Tạm thời comment để test
export class ProductSubtypeController {
  /**
   * Constructor injection ProductSubtypeService
   * @param productSubtypeService - Service xử lý logic nghiệp vụ loại phụ sản phẩm
   */
  constructor(private readonly productSubtypeService: ProductSubtypeService) {}

  /**
   * Tạo loại phụ sản phẩm mới
   * @param createProductSubtypeDto - Dữ liệu tạo loại phụ sản phẩm mới
   * @returns Thông tin loại phụ sản phẩm đã tạo
   */
  @Post()
  create(@Body() createProductSubtypeDto: CreateProductSubtypeDto) {
    return this.productSubtypeService.create(createProductSubtypeDto);
  }

  /**
   * Lấy danh sách tất cả loại phụ sản phẩm với phân trang và điều kiện lọc
   * @param page - Trang hiện tại (mặc định: 1)
   * @param limit - Số bản ghi mỗi trang (mặc định: 20)
   * @param deleted - Lọc theo trạng thái xóa (true: đã xóa, false: chưa xóa, undefined: tất cả)
   * @returns Danh sách loại phụ sản phẩm với thông tin phân trang
   */
  @Get()
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('deleted') deleted?: boolean,
  ) {
    // Chuyển đổi thành cấu trúc search với điều kiện lọc
    const searchDto = new SearchProductSubtypeDto();
    searchDto.page = Number(page);
    searchDto.limit = Number(limit);
    searchDto.filters = [];
    searchDto.nested_filters = [];

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

    return this.productSubtypeService.searchProductSubtypes(searchDto);
  }

  /**
   * Lấy danh sách loại phụ sản phẩm theo trạng thái
   * @param status - Trạng thái cần lọc (active/inactive/archived)
   * @returns Danh sách loại phụ sản phẩm theo trạng thái
   */
  @Get('by-status/:status')
  findByStatus(@Param('status') status: BaseStatus) {
    return this.productSubtypeService.findByStatus(status);
  }

  /**
   * Lấy danh sách loại phụ sản phẩm đã bị xóa mềm
   * @returns Danh sách loại phụ sản phẩm đã bị xóa
   */
  @Get('deleted')
  findDeleted() {
    return this.productSubtypeService.findDeleted();
  }

  /**
   * Lấy thông tin chi tiết một loại phụ sản phẩm theo ID
   * @param id - ID của loại phụ sản phẩm cần tìm
   * @returns Thông tin loại phụ sản phẩm
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productSubtypeService.findOne(+id);
  }

  /**
   * Lấy danh sách loại phụ sản phẩm theo loại sản phẩm
   * @param productTypeId - ID của loại sản phẩm
   * @returns Danh sách loại phụ sản phẩm thuộc loại sản phẩm đó
   */
  @Get('by-product-type/:productTypeId')
  findByProductType(@Param('productTypeId') productTypeId: string) {
    return this.productSubtypeService.findByProductType(+productTypeId);
  }

  /**
   * Tìm kiếm nâng cao loại phụ sản phẩm
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách loại phụ sản phẩm phù hợp
   */
  @Post('search')
  search(@Body() searchDto: SearchProductSubtypeDto) {
    try {
      return this.productSubtypeService.searchProductSubtypes(searchDto);
    } catch (error) {
      throw new HttpException(
        'Error occurred while searching product subtypes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Cập nhật thông tin loại phụ sản phẩm
   * @param id - ID của loại phụ sản phẩm cần cập nhật
   * @param updateProductSubtypeDto - Dữ liệu cập nhật loại phụ sản phẩm
   * @returns Thông tin loại phụ sản phẩm đã cập nhật
   */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateProductSubtypeDto: UpdateProductSubtypeDto,
  ) {
    return this.productSubtypeService.update(+id, updateProductSubtypeDto);
  }

  /**
   * Kích hoạt loại phụ sản phẩm (chuyển status thành 'active')
   * @param id - ID của loại phụ sản phẩm cần kích hoạt
   * @returns Thông tin loại phụ sản phẩm đã được kích hoạt
   */
  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.productSubtypeService.activate(+id);
  }

  /**
   * Vô hiệu hóa loại phụ sản phẩm (chuyển status thành 'inactive')
   * @param id - ID của loại phụ sản phẩm cần vô hiệu hóa
   * @returns Thông tin loại phụ sản phẩm đã được vô hiệu hóa
   */
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.productSubtypeService.deactivate(+id);
  }

  /**
   * Lưu trữ loại phụ sản phẩm (chuyển status thành 'archived')
   * @param id - ID của loại phụ sản phẩm cần lưu trữ
   * @returns Thông tin loại phụ sản phẩm đã được lưu trữ
   */
  @Patch(':id/archive')
  archive(@Param('id') id: string) {
    return this.productSubtypeService.archive(+id);
  }

  /**
   * Khôi phục loại phụ sản phẩm đã bị xóa mềm
   * @param id - ID của loại phụ sản phẩm cần khôi phục
   * @returns Thông tin loại phụ sản phẩm đã được khôi phục
   */
  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.productSubtypeService.restore(+id);
  }

  /**
   * Xóa mềm loại phụ sản phẩm (soft delete)
   * @param id - ID của loại phụ sản phẩm cần xóa mềm
   * @returns Kết quả xóa mềm loại phụ sản phẩm
   */
  @Delete(':id/soft')
  softRemove(@Param('id') id: string) {
    return this.productSubtypeService.softRemove(+id);
  }

  /**
   * Xóa cứng loại phụ sản phẩm (hard delete - xóa vĩnh viễn)
   * @param id - ID của loại phụ sản phẩm cần xóa cứng
   * @returns Kết quả xóa cứng loại phụ sản phẩm
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productSubtypeService.remove(+id);
  }
}
