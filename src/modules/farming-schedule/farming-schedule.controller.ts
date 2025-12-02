import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FarmingScheduleService } from './farming-schedule.service';
import { CreateFarmingScheduleDto, UpdateFarmingScheduleDto } from './farming-schedule.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Farming Schedule')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('farming-schedules')
export class FarmingScheduleController {
  constructor(private readonly service: FarmingScheduleService) {}

  @Post()
  @RequirePermissions('schedule:create')
  @ApiOperation({ summary: 'Tạo lịch canh tác' })
  create(@Body() createDto: CreateFarmingScheduleDto) {
    return this.service.create(createDto);
  }

  @Get('upcoming')
  @RequirePermissions('schedule:read')
  @ApiOperation({ summary: 'Lấy lịch sắp tới' })
  findUpcoming(@Query('days', ParseIntPipe) days: number = 7) {
    return this.service.findUpcoming(days);
  }

  @Get('crop/:cropId')
  @RequirePermissions('schedule:read')
  @ApiOperation({ summary: 'Lấy lịch theo vụ lúa' })
  findByCrop(@Param('cropId', ParseIntPipe) cropId: number) {
    return this.service.findByCrop(cropId);
  }

  @Get(':id')
  @RequirePermissions('schedule:read')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('schedule:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateFarmingScheduleDto) {
    return this.service.update(id, updateDto);
  }

  @Patch(':id/complete')
  @RequirePermissions('schedule:update')
  @ApiOperation({ summary: 'Đánh dấu hoàn thành' })
  markAsCompleted(@Param('id', ParseIntPipe) id: number) {
    return this.service.markAsCompleted(id);
  }

  @Delete(':id')
  @RequirePermissions('schedule:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
