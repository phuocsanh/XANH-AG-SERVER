import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { HarvestRecordService } from './harvest-record.service';
import { CreateHarvestRecordDto, UpdateHarvestRecordDto } from './harvest-record.dto';
import { HarvestRecord } from '../../entities/harvest-record.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Harvest Record Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('harvest-records')
export class HarvestRecordController {
  constructor(private readonly harvestRecordService: HarvestRecordService) {}

  @Post()
  @RequirePermissions('harvest:create')
  @ApiOperation({ summary: 'Ghi nhận thu hoạch' })
  @ApiResponse({ status: 201, type: HarvestRecord })
  create(@Body() createDto: CreateHarvestRecordDto): Promise<HarvestRecord> {
    return this.harvestRecordService.create(createDto);
  }

  @Get('crop/:cropId')
  @RequirePermissions('harvest:read')
  @ApiOperation({ summary: 'Lấy thu hoạch theo vụ lúa' })
  @ApiResponse({ status: 200, type: [HarvestRecord] })
  findByCrop(@Param('cropId', ParseIntPipe) cropId: number): Promise<HarvestRecord[]> {
    return this.harvestRecordService.findByCrop(cropId);
  }

  @Get(':id')
  @RequirePermissions('harvest:read')
  @ApiOperation({ summary: 'Lấy chi tiết thu hoạch' })
  @ApiResponse({ status: 200, type: HarvestRecord })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<HarvestRecord> {
    return this.harvestRecordService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('harvest:update')
  @ApiOperation({ summary: 'Cập nhật thu hoạch' })
  @ApiResponse({ status: 200, type: HarvestRecord })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateHarvestRecordDto): Promise<HarvestRecord> {
    return this.harvestRecordService.update(id, updateDto);
  }

  @Delete(':id')
  @RequirePermissions('harvest:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa thu hoạch' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.harvestRecordService.remove(id);
  }
}
