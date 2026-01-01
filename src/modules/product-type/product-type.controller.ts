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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ProductTypeService } from './product-type.service';
import { CreateProductTypeDto } from './dto/create-product-type.dto';
import { UpdateProductTypeDto } from './dto/update-product-type.dto';
import { BaseStatus } from '../../entities/base-status.enum';
import { SearchProductTypeDto } from './dto/search-product-type.dto';

/**
 * Controller xử lý các request liên quan đến loại sản phẩm
 * Bao gồm các thao tác CRUD, Status Management và Soft Delete cho ProductType
 * 
 * PUBLIC endpoints: by-status (GET)
 * PROTECTED endpoints: create, update, delete, search
 */
@Controller('product-types')
export class ProductTypeController {
  /**
   * Constructor injection ProductTypeService
   * @param productTypeService - Service xử lý logic nghiệp vụ loại sản phẩm
   */
  constructor(private readonly productTypeService: ProductTypeService) {}

  /**
   * Tạo loại sản phẩm mới
   * @param createProductTypeDto - Dữ liệu tạo loại sản phẩm mới
   * @returns Thông tin loại sản phẩm đã tạo
   */
  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('product:manage')
  create(@Body() createProductTypeDto: CreateProductTypeDto) {
    return this.productTypeService.create(createProductTypeDto);
  }

  /**
   * Lấy danh sách tất cả loại sản phẩm với phân trang và điều kiện lọc
   * @param page - Trang hiện tại (mặc định: 1)
   * @param limit - Số bản ghi mỗi trang (mặc định: 20)
   * @param deleted - Lọc theo trạng thái xóa (true: đã xóa, false: chưa xóa, undefined: tất cả)
   * @returns Danh sách loại sản phẩm với thông tin phân trang
   */


  /**
   * Lấy danh sách loại sản phẩm theo trạng thái
   * @param status - Trạng thái cần lọc (active, inactive, archived)
   * @returns Danh sách loại sản phẩm theo trạng thái
   * PUBLIC - Không cần auth để xem danh sách
   */
  @Get('by-status/:status')
  findByStatus(@Param('status') status: BaseStatus) {
    return this.productTypeService.findByStatus(status);
  }

  /**
   * Lấy danh sách loại sản phẩm đã bị xóa mềm
   * @returns Danh sách loại sản phẩm đã bị xóa
   */
  @Get('deleted')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('product:manage')
  findDeleted() {
    return this.productTypeService.findDeleted();
  }

  /**
   * Tìm kiếm nâng cao loại sản phẩm
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách loại sản phẩm phù hợp
   */
  @Post('search')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('product:read')
  search(@Body() searchDto: SearchProductTypeDto) {
    try {
      return this.productTypeService.searchProductTypes(searchDto);
    } catch (error) {
      throw new HttpException(
        'Error occurred while searching product types',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Lấy thông tin chi tiết một loại sản phẩm theo ID
   * @param id - ID của loại sản phẩm cần tìm
   * @returns Thông tin loại sản phẩm
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('product:read')
  findOne(@Param('id') id: string) {
    return this.productTypeService.findOne(+id);
  }

  /**
   * Cập nhật thông tin loại sản phẩm
   * @param id - ID của loại sản phẩm cần cập nhật
   * @param updateProductTypeDto - Dữ liệu cập nhật loại sản phẩm
   * @returns Thông tin loại sản phẩm đã cập nhật
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('product:manage')
  update(
    @Param('id') id: string,
    @Body() updateProductTypeDto: UpdateProductTypeDto,
  ) {
    return this.productTypeService.update(+id, updateProductTypeDto);
  }

  /**
   * Kích hoạt loại sản phẩm (chuyển trạng thái thành active)
   * @param id - ID của loại sản phẩm cần kích hoạt
   * @returns Thông tin loại sản phẩm đã kích hoạt
   */
  @Patch(':id/activate')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('product:manage')
  activate(@Param('id') id: string) {
    return this.productTypeService.activate(+id);
  }

  /**
   * Vô hiệu hóa loại sản phẩm (chuyển trạng thái thành inactive)
   * @param id - ID của loại sản phẩm cần vô hiệu hóa
   * @returns Thông tin loại sản phẩm đã vô hiệu hóa
   */
  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('product:manage')
  deactivate(@Param('id') id: string) {
    return this.productTypeService.deactivate(+id);
  }

  /**
   * Lưu trữ loại sản phẩm (chuyển trạng thái thành archived)
   * @param id - ID của loại sản phẩm cần lưu trữ
   * @returns Thông tin loại sản phẩm đã lưu trữ
   */
  @Patch(':id/archive')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('product:manage')
  archive(@Param('id') id: string) {
    return this.productTypeService.archive(+id);
  }

  /**
   * Soft delete loại sản phẩm (đánh dấu deleted_at)
   * @param id - ID của loại sản phẩm cần soft delete
   * @returns Kết quả soft delete
   */
  @Delete(':id/soft')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('product:manage')
  softDelete(@Param('id') id: string) {
    return this.productTypeService.softDelete(+id);
  }

  /**
   * Khôi phục loại sản phẩm đã bị soft delete
   * @param id - ID của loại sản phẩm cần khôi phục
   * @returns Thông tin loại sản phẩm đã khôi phục
   */
  @Patch(':id/restore')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('product:manage')
  restore(@Param('id') id: string) {
    return this.productTypeService.restore(+id);
  }

  /**
   * Xóa vĩnh viễn loại sản phẩm theo ID (hard delete)
   * @param id - ID của loại sản phẩm cần xóa vĩnh viễn
   * @returns Kết quả xóa vĩnh viễn loại sản phẩm
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('product:manage')
  remove(@Param('id') id: string) {
    return this.productTypeService.remove(+id);
  }
}
