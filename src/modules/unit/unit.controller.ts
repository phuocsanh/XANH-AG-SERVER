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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { UnitService } from './unit.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { BaseStatus } from '../../entities/base-status.enum';
import { SearchUnitDto } from './dto/search-unit.dto';

/**
 * Controller xử lý các request liên quan đến đơn vị tính
 * Bao gồm quản lý đơn vị tính, Status Management và Soft Delete
 */
@Controller('units')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UnitController {
  /**
   * Constructor injection UnitService
   * @param unitService - Service xử lý logic nghiệp vụ đơn vị tính
   */
  constructor(private readonly unitService: UnitService) {}

  /**
   * Tạo đơn vị tính mới
   * @param createUnitDto - Dữ liệu tạo đơn vị tính mới
   * @returns Thông tin đơn vị tính đã tạo
   */
  @Post()
  @RequirePermissions('PRODUCT_MANAGE')
  create(@Body() createUnitDto: CreateUnitDto) {
    return this.unitService.create(createUnitDto);
  }

  /**
   * Lấy danh sách tất cả đơn vị tính với phân trang và điều kiện lọc
   * @param page - Trang hiện tại (mặc định: 1)
   * @param limit - Số bản ghi mỗi trang (mặc định: 20)
   * @param status - Trạng thái cần lọc (active, inactive, archived)
   * @param deleted - Lọc theo trạng thái xóa (true: đã xóa, false: chưa xóa, undefined: tất cả)
   * @returns Danh sách đơn vị tính với thông tin phân trang
   */
  @Get()
  @RequirePermissions('PRODUCT_VIEW')
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: string,
    @Query('deleted') deleted?: boolean,
  ) {
    // Chuyển đổi thành cấu trúc search với điều kiện lọc
    const searchDto = new SearchUnitDto();
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

    return this.unitService.searchUnits(searchDto);
  }

  /**
   * Lấy danh sách đơn vị tính theo trạng thái
   * @param status - Trạng thái cần lọc (active, inactive, archived)
   * @returns Danh sách đơn vị tính theo trạng thái
   */
  @Get('by-status/:status')
  @RequirePermissions('PRODUCT_VIEW')
  findByStatus(@Param('status') status: BaseStatus) {
    return this.unitService.findByStatus(status);
  }

  /**
   * Lấy thông tin chi tiết một đơn vị tính theo ID
   * @param id - ID của đơn vị tính cần tìm
   * @returns Thông tin đơn vị tính
   */
  @Get(':id')
  @RequirePermissions('PRODUCT_VIEW')
  findOne(@Param('id') id: string) {
    return this.unitService.findOne(+id);
  }

  /**
   * Cập nhật thông tin đơn vị tính
   * @param id - ID của đơn vị tính cần cập nhật
   * @param updateUnitDto - Dữ liệu cập nhật đơn vị tính
   * @returns Thông tin đơn vị tính đã cập nhật
   */
  @Patch(':id')
  @RequirePermissions('PRODUCT_MANAGE')
  update(@Param('id') id: string, @Body() updateUnitDto: UpdateUnitDto) {
    return this.unitService.update(+id, updateUnitDto);
  }

  /**
   * Kích hoạt đơn vị tính (chuyển trạng thái thành active)
   * @param id - ID của đơn vị tính cần kích hoạt
   * @returns Thông tin đơn vị tính đã kích hoạt
   */
  @Patch(':id/activate')
  @RequirePermissions('PRODUCT_MANAGE')
  activate(@Param('id') id: string) {
    return this.unitService.activate(+id);
  }

  /**
   * Vô hiệu hóa đơn vị tính (chuyển trạng thái thành inactive)
   * @param id - ID của đơn vị tính cần vô hiệu hóa
   * @returns Thông tin đơn vị tính đã vô hiệu hóa
   */
  @Patch(':id/deactivate')
  @RequirePermissions('PRODUCT_MANAGE')
  deactivate(@Param('id') id: string) {
    return this.unitService.deactivate(+id);
  }

  /**
   * Lưu trữ đơn vị tính (chuyển trạng thái thành archived)
   * @param id - ID của đơn vị tính cần lưu trữ
   * @returns Thông tin đơn vị tính đã lưu trữ
   */
  @Patch(':id/archive')
  @RequirePermissions('PRODUCT_MANAGE')
  archive(@Param('id') id: string) {
    return this.unitService.archive(+id);
  }

  /**
   * Soft delete đơn vị tính
   * @param id - ID của đơn vị tính cần soft delete
   */
  @Delete(':id/soft')
  @RequirePermissions('PRODUCT_MANAGE')
  softDelete(@Param('id') id: string) {
    return this.unitService.softDelete(+id);
  }

  /**
   * Khôi phục đơn vị tính đã bị soft delete
   * @param id - ID của đơn vị tính cần khôi phục
   * @returns Thông tin đơn vị tính đã khôi phục
   */
  @Patch(':id/restore')
  @RequirePermissions('PRODUCT_MANAGE')
  restore(@Param('id') id: string) {
    return this.unitService.restore(+id);
  }

  /**
   * Xóa cứng đơn vị tính theo ID (hard delete)
   * @param id - ID của đơn vị tính cần xóa
   * @returns Kết quả xóa đơn vị tính
   */
  @Delete(':id')
  @RequirePermissions('PRODUCT_MANAGE')
  remove(@Param('id') id: string) {
    return this.unitService.remove(+id);
  }

  /**
   * Tìm kiếm nâng cao đơn vị tính
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách đơn vị tính phù hợp
   */
  @Post('search')
  search(@Body() searchDto: SearchUnitDto) {
    try {
      return this.unitService.searchUnits(searchDto);
    } catch (error) {
      throw new HttpException(
        'Error occurred while searching units',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
