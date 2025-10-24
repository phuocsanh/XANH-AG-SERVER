import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { UnitService } from './unit.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { BaseStatus } from '../../entities/base-status.enum';

/**
 * Controller xử lý các request liên quan đến đơn vị tính
 * Bao gồm quản lý đơn vị tính, Status Management và Soft Delete
 */
@Controller('units')
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
  create(@Body() createUnitDto: CreateUnitDto) {
    return this.unitService.create(createUnitDto);
  }

  /**
   * Lấy danh sách tất cả đơn vị tính
   * @returns Danh sách đơn vị tính
   */
  @Get()
  findAll() {
    return this.unitService.findAll();
  }

  /**
   * Lấy danh sách đơn vị tính theo trạng thái
   * @param status - Trạng thái cần lọc (active, inactive, archived)
   * @returns Danh sách đơn vị tính theo trạng thái
   */
  @Get('by-status/:status')
  findByStatus(@Param('status') status: BaseStatus) {
    return this.unitService.findByStatus(status);
  }

  /**
   * Lấy thông tin chi tiết một đơn vị tính theo ID
   * @param id - ID của đơn vị tính cần tìm
   * @returns Thông tin đơn vị tính
   */
  @Get(':id')
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
  update(@Param('id') id: string, @Body() updateUnitDto: UpdateUnitDto) {
    return this.unitService.update(+id, updateUnitDto);
  }

  /**
   * Kích hoạt đơn vị tính (chuyển trạng thái thành active)
   * @param id - ID của đơn vị tính cần kích hoạt
   * @returns Thông tin đơn vị tính đã kích hoạt
   */
  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.unitService.activate(+id);
  }

  /**
   * Vô hiệu hóa đơn vị tính (chuyển trạng thái thành inactive)
   * @param id - ID của đơn vị tính cần vô hiệu hóa
   * @returns Thông tin đơn vị tính đã vô hiệu hóa
   */
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.unitService.deactivate(+id);
  }

  /**
   * Lưu trữ đơn vị tính (chuyển trạng thái thành archived)
   * @param id - ID của đơn vị tính cần lưu trữ
   * @returns Thông tin đơn vị tính đã lưu trữ
   */
  @Patch(':id/archive')
  archive(@Param('id') id: string) {
    return this.unitService.archive(+id);
  }

  /**
   * Soft delete đơn vị tính
   * @param id - ID của đơn vị tính cần soft delete
   */
  @Delete(':id/soft')
  softDelete(@Param('id') id: string) {
    return this.unitService.softDelete(+id);
  }

  /**
   * Khôi phục đơn vị tính đã bị soft delete
   * @param id - ID của đơn vị tính cần khôi phục
   * @returns Thông tin đơn vị tính đã khôi phục
   */
  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.unitService.restore(+id);
  }

  /**
   * Xóa cứng đơn vị tính theo ID (hard delete)
   * @param id - ID của đơn vị tính cần xóa
   * @returns Kết quả xóa đơn vị tính
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.unitService.remove(+id);
  }
}
