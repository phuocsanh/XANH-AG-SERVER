import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { GrowthTrackingService } from './growth-tracking.service';
import { CreateGrowthTrackingDto, UpdateGrowthTrackingDto } from './growth-tracking.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Growth Tracking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('growth-trackings')
export class GrowthTrackingController {
  constructor(private readonly service: GrowthTrackingService) {}

  @Post()
  @RequirePermissions('growth:create')
  create(@Body() createDto: CreateGrowthTrackingDto) {
    return this.service.create(createDto);
  }

  @Get('crop/:cropId')
  @RequirePermissions('growth:read')
  findByCrop(@Param('cropId', ParseIntPipe) cropId: number) {
    return this.service.findByCrop(cropId);
  }

  @Get(':id')
  @RequirePermissions('growth:read')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('growth:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateGrowthTrackingDto) {
    return this.service.update(id, updateDto);
  }

  @Delete(':id')
  @RequirePermissions('growth:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
