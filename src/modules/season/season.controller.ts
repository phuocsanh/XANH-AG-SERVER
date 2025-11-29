import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { SeasonService } from './season.service';
import { CreateSeasonDto } from './dto/create-season.dto';
import { UpdateSeasonDto } from './dto/update-season.dto';

@Controller('season')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SeasonController {
  constructor(private readonly seasonService: SeasonService) {}

  @Post()
  @RequirePermissions('PRODUCT_MANAGE')
  create(@Body() createSeasonDto: CreateSeasonDto) {
    return this.seasonService.create(createSeasonDto);
  }

  @Get()
  @RequirePermissions('PRODUCT_VIEW')
  findAll() {
    return this.seasonService.findAll();
  }

  @Get('active')
  @RequirePermissions('PRODUCT_VIEW')
  findActive() {
    return this.seasonService.findActive();
  }

  @Get(':id')
  @RequirePermissions('PRODUCT_VIEW')
  findOne(@Param('id') id: string) {
    return this.seasonService.findOne(+id);
  }

  @Patch(':id')
  @RequirePermissions('PRODUCT_MANAGE')
  update(@Param('id') id: string, @Body() updateSeasonDto: UpdateSeasonDto) {
    return this.seasonService.update(+id, updateSeasonDto);
  }

  @Delete(':id')
  @RequirePermissions('PRODUCT_MANAGE')
  remove(@Param('id') id: string) {
    return this.seasonService.remove(+id);
  }
}
