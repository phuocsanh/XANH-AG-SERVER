import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RiceCropService } from './rice-crop.service';
import {
  CreateRiceCropDto,
  UpdateRiceCropDto,
  UpdateGrowthStageDto,
  UpdateCropStatusDto,
  SearchRiceCropDto,
} from './rice-crop.dto';
import { RiceCrop } from '../../entities/rice-crop.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Rice Crop Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('rice-crops')
export class RiceCropController {
  constructor(private readonly riceCropService: RiceCropService) {}

  /**
   * Tạo mảnh ruộng mới
   */
  @Post()
  @RequirePermissions('rice_crop:create')
  @ApiOperation({ summary: 'Tạo mảnh ruộng mới' })
  @ApiResponse({ status: 201, description: 'Mảnh ruộng đã được tạo thành công', type: RiceCrop })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async create(@Body() createDto: CreateRiceCropDto): Promise<RiceCrop> {
    return this.riceCropService.create(createDto);
  }

  /**
   * Lấy danh sách mảnh ruộng
   */
  /**
   * Tìm kiếm vụ lúa
   */
  @Post('search')
  @RequirePermissions('rice_crop:read')
  @ApiOperation({ summary: 'Tìm kiếm vụ lúa với filter' })
  @ApiResponse({ status: 200, description: 'Danh sách vụ lúa' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async search(@Body() searchDto: SearchRiceCropDto, @Req() req: any): Promise<{ data: RiceCrop[]; total: number; page: number; limit: number }> {
    return this.riceCropService.search(searchDto, req.user);
  }

  /**
   * Lấy chi tiết mảnh ruộng
   */
  @Get(':id')
  @RequirePermissions('rice_crop:read')
  @ApiOperation({ summary: 'Lấy chi tiết mảnh ruộng theo ID' })
  @ApiResponse({ status: 200, description: 'Chi tiết vụ lúa', type: RiceCrop })
  @ApiResponse({ status: 404, description: 'Không tìm thấy vụ lúa' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<RiceCrop> {
    return this.riceCropService.findOne(id);
  }

  /**
   * Cập nhật thông tin mảnh ruộng
   */
  @Patch(':id')
  @RequirePermissions('rice_crop:update')
  @ApiOperation({ summary: 'Cập nhật thông tin mảnh ruộng' })
  @ApiResponse({ status: 200, description: 'Mảnh ruộng đã được cập nhật', type: RiceCrop })
  @ApiResponse({ status: 404, description: 'Không tìm thấy vụ lúa' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateRiceCropDto,
  ): Promise<RiceCrop> {
    return this.riceCropService.update(id, updateDto);
  }

  /**
   * Cập nhật giai đoạn sinh trưởng
   */
  @Patch(':id/growth-stage')
  @RequirePermissions('rice_crop:update')
  @ApiOperation({ summary: 'Cập nhật giai đoạn sinh trưởng' })
  @ApiResponse({ status: 200, description: 'Giai đoạn sinh trưởng đã được cập nhật', type: RiceCrop })
  @ApiResponse({ status: 404, description: 'Không tìm thấy vụ lúa' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async updateGrowthStage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGrowthStageDto,
  ): Promise<RiceCrop> {
    return this.riceCropService.updateGrowthStage(id, dto);
  }

  /**
   * Cập nhật trạng thái mảnh ruộng
   */
  @Patch(':id/status')
  @RequirePermissions('rice_crop:update')
  @ApiOperation({ summary: 'Cập nhật trạng thái mảnh ruộng' })
  @ApiResponse({ status: 200, description: 'Trạng thái đã được cập nhật', type: RiceCrop })
  @ApiResponse({ status: 404, description: 'Không tìm thấy vụ lúa' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCropStatusDto,
  ): Promise<RiceCrop> {
    return this.riceCropService.updateStatus(id, dto);
  }

  /**
   * Xóa mảnh ruộng
   */
  @Delete(':id')
  @RequirePermissions('rice_crop:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa mảnh ruộng' })
  @ApiResponse({ status: 204, description: 'Mảnh ruộng đã được xóa' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy vụ lúa' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.riceCropService.remove(id);
  }

  /**
   * Lấy thống kê mảnh ruộng theo khách hàng
   */
  @Get('customer/:customerId/stats')
  @RequirePermissions('rice_crop:read')
  @ApiOperation({ summary: 'Lấy thống kê mảnh ruộng theo khách hàng' })
  @ApiResponse({ 
    status: 200, 
    description: 'Thống kê vụ lúa',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', example: 10 },
        active: { type: 'number', example: 5 },
        harvested: { type: 'number', example: 4 },
        failed: { type: 'number', example: 1 },
        totalArea: { type: 'number', example: 50000 },
        totalYield: { type: 'number', example: 30000 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async getCustomerStats(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.riceCropService.getCustomerStats(customerId);
  }

  /**
   * Lấy tất cả hóa đơn mua hàng (system + external)
   */
  @Get(':id/all-purchases')
  @RequirePermissions('rice_crop:read')
  @ApiOperation({ summary: 'Lấy tất cả hóa đơn mua hàng của Ruộng lúa (cả hệ thống và external)' })
  @ApiResponse({ status: 200, description: 'Danh sách hóa đơn đã merge' })
  async getAllPurchases(@Param('id', ParseIntPipe) id: number) {
    return this.riceCropService.getAllPurchases(id);
  }
}
