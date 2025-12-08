import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AreaOfEachPlotOfLandService } from './area-of-each-plot-of-land.service';
import { CreateAreaOfEachPlotOfLandDto, UpdateAreaOfEachPlotOfLandDto, SearchAreaOfEachPlotOfLandDto } from './area-of-each-plot-of-land.dto';
import { AreaOfEachPlotOfLand } from '../../entities/area-of-each-plot-of-land.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

/**
 * Controller quản lý các vùng/lô đất
 */
@ApiTags('Area of Each Plot of Land Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('area-of-each-plot-of-land')
export class AreaOfEachPlotOfLandController {
  constructor(private readonly areaService: AreaOfEachPlotOfLandService) {}

  /**
   * Tạo vùng/lô đất mới
   */
  @Post()
  @RequirePermissions('area_of_each_plot_of_land:create')
  @ApiOperation({ summary: 'Tạo vùng/lô đất mới' })
  @ApiResponse({ status: 201, description: 'Vùng/lô đất đã được tạo thành công', type: AreaOfEachPlotOfLand })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async create(@Body() createDto: CreateAreaOfEachPlotOfLandDto): Promise<AreaOfEachPlotOfLand> {
    return this.areaService.create(createDto);
  }

  /**
   * Tìm kiếm vùng/lô đất với filter và pagination
   */
  @Post('search')
  @RequirePermissions('area_of_each_plot_of_land:read')
  @ApiOperation({ summary: 'Tìm kiếm vùng/lô đất với filter' })
  @ApiResponse({ status: 200, description: 'Danh sách vùng/lô đất' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async search(@Body() searchDto: SearchAreaOfEachPlotOfLandDto): Promise<{ data: AreaOfEachPlotOfLand[]; total: number }> {
    return this.areaService.search(searchDto);
  }

  /**
   * Lấy chi tiết vùng/lô đất theo ID
   */
  @Get(':id')
  @RequirePermissions('area_of_each_plot_of_land:read')
  @ApiOperation({ summary: 'Lấy chi tiết vùng/lô đất theo ID' })
  @ApiResponse({ status: 200, description: 'Chi tiết vùng/lô đất', type: AreaOfEachPlotOfLand })
  @ApiResponse({ status: 404, description: 'Không tìm thấy vùng/lô đất' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<AreaOfEachPlotOfLand> {
    return this.areaService.findOne(id);
  }

  /**
   * Cập nhật vùng/lô đất
   */
  @Patch(':id')
  @RequirePermissions('area_of_each_plot_of_land:update')
  @ApiOperation({ summary: 'Cập nhật vùng/lô đất' })
  @ApiResponse({ status: 200, description: 'Vùng/lô đất đã được cập nhật', type: AreaOfEachPlotOfLand })
  @ApiResponse({ status: 404, description: 'Không tìm thấy vùng/lô đất' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateAreaOfEachPlotOfLandDto,
  ): Promise<AreaOfEachPlotOfLand> {
    return this.areaService.update(id, updateDto);
  }

  /**
   * Xóa vùng/lô đất
   */
  @Delete(':id')
  @RequirePermissions('area_of_each_plot_of_land:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa vùng/lô đất' })
  @ApiResponse({ status: 204, description: 'Vùng/lô đất đã được xóa' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy vùng/lô đất' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.areaService.remove(id);
  }
}
