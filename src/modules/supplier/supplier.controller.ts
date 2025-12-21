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

} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SearchSupplierDto } from './dto/search-supplier.dto';
import { SupplierService } from './supplier.service';

import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * Controller xử lý các request liên quan đến nhà cung cấp
 */
@Controller('suppliers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  /**
   * Tạo nhà cung cấp mới
   * @param createSupplierDto - Dữ liệu tạo nhà cung cấp mới
   * @returns Thông tin nhà cung cấp đã tạo
   */
  @Post()
  @RequirePermissions('inventory:manage')
  create(
    @Body() createSupplierDto: CreateSupplierDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.supplierService.create(createSupplierDto, userId);
  }

  /**
   * Lấy danh sách tất cả nhà cung cấp với phân trang và điều kiện lọc
   * @param page - Trang hiện tại (mặc định: 1)
   * @param limit - Số bản ghi mỗi trang (mặc định: 20)
   * @param status - Trạng thái cần lọc (active, inactive, archived)
   * @param deleted - Lọc theo trạng thái xóa (true: đã xóa, false: chưa xóa, undefined: tất cả)
   * @returns Danh sách nhà cung cấp với thông tin phân trang
   */


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
  @RequirePermissions('inventory:read')
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
  @RequirePermissions('inventory:manage')
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
  @RequirePermissions('inventory:manage')
  remove(@Param('id') id: string) {
    return this.supplierService.remove(+id);
  }
}
