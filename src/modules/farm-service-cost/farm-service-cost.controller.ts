import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FarmServiceCostService } from './farm-service-cost.service';
import { CreateFarmServiceCostDto } from './dto/create-farm-service-cost.dto';
import { UpdateFarmServiceCostDto } from './dto/update-farm-service-cost.dto';
import { SearchFarmServiceCostDto } from './dto/search-farm-service-cost.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

/**
 * Controller xử lý API cho chi phí dịch vụ/quà tặng dành cho nông dân
 */
@ApiTags('Farm Service Costs')
@ApiBearerAuth()
@Controller('farm-service-costs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FarmServiceCostController {
  constructor(private readonly farmServiceCostService: FarmServiceCostService) {}

  @Post()
  @RequirePermissions('rice_crop:update')
  @ApiOperation({ summary: 'Tạo chi phí dịch vụ/quà tặng mới' })
  @ApiResponse({ status: 201, description: 'Chi phí đã được tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async create(@Body() createDto: CreateFarmServiceCostDto) {
    return this.farmServiceCostService.create(createDto);
  }

  @Post('search')
  @RequirePermissions('rice_crop:read')
  @ApiOperation({ summary: 'Tìm kiếm chi phí dịch vụ' })
  @ApiResponse({ status: 200, description: 'Danh sách chi phí dịch vụ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async search(@Body() searchDto: SearchFarmServiceCostDto) {
    return this.farmServiceCostService.search(searchDto);
  }

  @Get(':id')
  @RequirePermissions('rice_crop:read')
  @ApiOperation({ summary: 'Lấy chi tiết chi phí dịch vụ theo ID' })
  @ApiResponse({ status: 200, description: 'Chi tiết chi phí dịch vụ' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.farmServiceCostService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('rice_crop:update')
  @ApiOperation({ summary: 'Cập nhật chi phí dịch vụ' })
  @ApiResponse({ status: 200, description: 'Chi phí đã được cập nhật' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateFarmServiceCostDto,
  ) {
    return this.farmServiceCostService.update(id, updateDto);
  }

  @Delete(':id')
  @RequirePermissions('rice_crop:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa chi phí dịch vụ' })
  @ApiResponse({ status: 204, description: 'Chi phí đã được xóa' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.farmServiceCostService.remove(id);
  }
}
