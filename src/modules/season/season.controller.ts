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
  @RequirePermissions('product:manage')
  create(@Body() createSeasonDto: CreateSeasonDto) {
    return this.seasonService.create(createSeasonDto);
  }

  @Post('search')
  @RequirePermissions('product:read')
  search(@Body() searchDto: any) {
    return this.seasonService.search(searchDto);
  }





  @Get(':id')
  @RequirePermissions('product:read')
  findOne(@Param('id') id: string) {
    return this.seasonService.findOne(+id);
  }

  @Patch(':id')
  @RequirePermissions('product:manage')
  update(@Param('id') id: string, @Body() updateSeasonDto: UpdateSeasonDto) {
    return this.seasonService.update(+id, updateSeasonDto);
  }

  @Delete(':id')
  @RequirePermissions('product:manage')
  remove(@Param('id') id: string) {
    return this.seasonService.remove(+id);
  }
}
