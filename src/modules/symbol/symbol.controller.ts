import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  NotFoundException,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { SymbolService } from './symbol.service';
import { Symbol } from '../../entities/symbols.entity';
import { SearchSymbolDto } from './dto/search-symbol.dto';
import { BaseStatus } from '../../entities/base-status.enum';
import { CreateSymbolDto } from './dto/create-symbol.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

/**
 * Controller xử lý các yêu cầu HTTP liên quan đến ký hiệu sản phẩm
 * Cung cấp các endpoint để quản lý ký hiệu
 */
@Controller('symbols')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SymbolController {
  /**
   * Constructor injection service cần thiết
   * @param symbolService - Service xử lý logic nghiệp vụ ký hiệu
   */
  constructor(private readonly symbolService: SymbolService) {}

  /**
   * Tạo ký hiệu mới
   * @param symbolData - Dữ liệu tạo ký hiệu mới
   * @returns Thông tin ký hiệu đã tạo
   */
  @Post()
  async create(@Body() symbolData: CreateSymbolDto): Promise<Symbol> {
    return this.symbolService.create(symbolData);
  }

  /**
   * Lấy danh sách tất cả ký hiệu với phân trang và điều kiện lọc
   * @param page - Trang hiện tại (mặc định: 1)
   * @param limit - Số bản ghi mỗi trang (mặc định: 20)
   * @param status - Trạng thái cần lọc (active, inactive, archived)
   * @param deleted - Lọc theo trạng thái xóa (true: đã xóa, false: chưa xóa, undefined: tất cả)
   * @returns Danh sách ký hiệu với thông tin phân trang
   */


  /**
   * Lấy danh sách ký hiệu theo trạng thái
   * @param status - Trạng thái cần lọc (active, inactive, archived)
   * @returns Danh sách ký hiệu theo trạng thái
   */
  @Get('by-status/:status')
  findByStatus(@Param('status') status: BaseStatus) {
    return this.symbolService.findByStatus(status);
  }

  /**
   * Tìm ký hiệu theo ID
   * @param id - ID của ký hiệu cần tìm
   * @returns Thông tin ký hiệu
   */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Symbol> {
    const symbol = await this.symbolService.findOne(id);
    if (!symbol) {
      throw new NotFoundException(`Không tìm thấy ký hiệu với ID: ${id}`);
    }
    return symbol;
  }

  /**
   * Cập nhật thông tin ký hiệu
   * @param id - ID của ký hiệu cần cập nhật
   * @param updateData - Dữ liệu cập nhật ký hiệu
   * @returns Thông tin ký hiệu đã cập nhật
   */
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateData: Partial<Symbol>,
  ): Promise<Symbol> {
    const symbol = await this.symbolService.update(id, updateData);
    if (!symbol) {
      throw new NotFoundException(`Không tìm thấy ký hiệu với ID: ${id}`);
    }
    return symbol;
  }

  /**
   * Kích hoạt ký hiệu (chuyển trạng thái thành active)
   * @param id - ID của ký hiệu cần kích hoạt
   * @returns Thông tin ký hiệu đã kích hoạt
   */
  @Patch(':id/activate')
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.symbolService.activate(id);
  }

  /**
   * Vô hiệu hóa ký hiệu (chuyển trạng thái thành inactive)
   * @param id - ID của ký hiệu cần vô hiệu hóa
   * @returns Thông tin ký hiệu đã vô hiệu hóa
   */
  @Patch(':id/deactivate')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.symbolService.deactivate(id);
  }

  /**
   * Lưu trữ ký hiệu (chuyển trạng thái thành archived)
   * @param id - ID của ký hiệu cần lưu trữ
   * @returns Thông tin ký hiệu đã lưu trữ
   */
  @Patch(':id/archive')
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.symbolService.archive(id);
  }

  /**
   * Soft delete ký hiệu
   * @param id - ID của ký hiệu cần soft delete
   */
  @Delete(':id/soft')
  softDelete(@Param('id', ParseIntPipe) id: number) {
    return this.symbolService.softDelete(id);
  }

  /**
   * Khôi phục ký hiệu đã bị soft delete
   * @param id - ID của ký hiệu cần khôi phục
   * @returns Thông tin ký hiệu đã khôi phục
   */
  @Patch(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.symbolService.restore(id);
  }

  /**
   * Xóa ký hiệu theo ID
   * @param id - ID của ký hiệu cần xóa
   */
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.symbolService.remove(id);
  }

  /**
   * Tìm kiếm nâng cao ký hiệu
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách ký hiệu phù hợp
   */
  @Post('search')
  @RequirePermissions('product:read')
  search(@Body() searchDto: SearchSymbolDto) {
    try {
      return this.symbolService.searchSymbols(searchDto);
    } catch (error) {
      throw new HttpException(
        'Error occurred while searching symbols',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
