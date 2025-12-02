import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ApplicationRecordService } from './application-record.service';
import { CreateApplicationRecordDto, UpdateApplicationRecordDto } from './application-record.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Application Records')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('application-records')
export class ApplicationRecordController {
  constructor(private readonly service: ApplicationRecordService) {}

  @Post()
  @RequirePermissions('application:create')
  create(@Body() createDto: CreateApplicationRecordDto) {
    return this.service.create(createDto);
  }

  @Get('crop/:cropId')
  @RequirePermissions('application:read')
  findByCrop(@Param('cropId', ParseIntPipe) cropId: number) {
    return this.service.findByCrop(cropId);
  }

  @Get(':id')
  @RequirePermissions('application:read')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('application:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateApplicationRecordDto) {
    return this.service.update(id, updateDto);
  }

  @Delete(':id')
  @RequirePermissions('application:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
