import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SearchSupplierDto } from './dto/search-supplier.dto';
import { SupplierService } from './supplier.service';

/**
 * Controller xử lý các request liên quan đến nhà cung cấp
 */
@Controller('suppliers')
@UseGuards(JwtAuthGuard)
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  /**
   * Tạo nhà cung cấp mới
   * @param createSupplierDto - Dữ liệu tạo nhà cung cấp mới
   * @returns Thông tin nhà cung cấp đã tạo
   */
  @Post()
  create(@Body() createSupplierDto: CreateSupplierDto) {
    return this.supplierService.create(createSupplierDto);
  }

  /**
   * Lấy danh sách tất cả nhà cung cấp với phân trang và điều kiện lọc
   * @param page - Trang hiện tại (mặc định: 1)
   * @param limit - Số bản ghi mỗi trang (mặc định: 20)
   * @param status - Trạng thái cần lọc (active, inactive, archived)
   * @param deleted - Lọc theo trạng thái xóa (true: đã xóa, false: chưa xóa, undefined: tất cả)
   * @returns Danh sách nhà cung cấp với thông tin phân trang
   */
  @Get()
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: string,
    @Query('deleted') deleted?: boolean,
  ) {
    // Chuyển đổi thành cấu trúc search với điều kiện lọc
    const searchDto = new SearchSupplierDto();
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

    // Đảm bảo nested_filters luôn là mảng
    if (!searchDto.nested_filters) {
      searchDto.nested_filters = [];
    }

    return this.supplierService.searchSuppliers(searchDto);
  }

  /**
   * Tìm nhà cung cấp theo ID
   * @param id - ID của nhà cung cấp cần tìm
   * @returns Thông tin nhà cung cấp
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.supplierService.findOne(+id);
  }

  /**
   * Tìm kiếm nâng cao nhà cung cấp
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách nhà cung cấp phù hợp với thông tin phân trang
   */
  @Post('search')
  search(@Body() searchDto: SearchSupplierDto) {
    try {
      return this.supplierService.searchSuppliers(searchDto);
    } catch (error) {
      throw new HttpException(
        'Error occurred while searching suppliers',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Cập nhật thông tin nhà cung cấp
   * @param id - ID của nhà cung cấp cần cập nhật
   * @param updateSupplierDto - Dữ liệu cập nhật nhà cung cấp
   * @returns Thông tin nhà cung cấp đã cập nhật
   */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ) {
    return this.supplierService.update(+id, updateSupplierDto);
  }

  /**
   * Xóa nhà cung cấp theo ID
   * @param id - ID của nhà cung cấp cần xóa
   * @returns Kết quả xóa nhà cung cấp
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.supplierService.remove(+id);
  }
}
