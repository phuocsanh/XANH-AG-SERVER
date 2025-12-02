import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CostItemService } from './cost-item.service';
import { CreateCostItemDto, UpdateCostItemDto, QueryCostItemDto } from './cost-item.dto';
import { CostItem } from '../../entities/cost-item.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Cost Item Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('cost-items')
export class CostItemController {
  constructor(private readonly costItemService: CostItemService) {}

  @Post()
  @RequirePermissions('cost_item:create')
  @ApiOperation({ summary: 'Tạo chi phí mới' })
  @ApiResponse({ status: 201, description: 'Chi phí đã được tạo', type: CostItem })
  async create(@Body() createDto: CreateCostItemDto): Promise<CostItem> {
    return this.costItemService.create(createDto);
  }

  @Get()
  @RequirePermissions('cost_item:read')
  @ApiOperation({ summary: 'Lấy danh sách chi phí' })
  @ApiResponse({ status: 200, description: 'Danh sách chi phí', type: [CostItem] })
  async findAll(@Query() query: QueryCostItemDto): Promise<CostItem[]> {
    return this.costItemService.findAll(query);
  }

  @Get('crop/:cropId/summary')
  @RequirePermissions('cost_item:read')
  @ApiOperation({ summary: 'Lấy tổng hợp chi phí theo vụ lúa' })
  @ApiResponse({ status: 200, description: 'Tổng hợp chi phí' })
  async getSummary(@Param('cropId', ParseIntPipe) cropId: number) {
    return this.costItemService.getSummaryByCrop(cropId);
  }

  @Get(':id')
  @RequirePermissions('cost_item:read')
  @ApiOperation({ summary: 'Lấy chi tiết chi phí' })
  @ApiResponse({ status: 200, description: 'Chi tiết chi phí', type: CostItem })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<CostItem> {
    return this.costItemService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('cost_item:update')
  @ApiOperation({ summary: 'Cập nhật chi phí' })
  @ApiResponse({ status: 200, description: 'Chi phí đã được cập nhật', type: CostItem })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateCostItemDto,
  ): Promise<CostItem> {
    return this.costItemService.update(id, updateDto);
  }

  @Delete(':id')
  @RequirePermissions('cost_item:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa chi phí' })
  @ApiResponse({ status: 204, description: 'Chi phí đã được xóa' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.costItemService.remove(id);
  }
}
