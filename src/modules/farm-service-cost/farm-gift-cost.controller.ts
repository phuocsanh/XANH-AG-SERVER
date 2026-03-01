import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { FarmGiftCostService } from './farm-gift-cost.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Farm Gift Costs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('farm-gift-costs')
export class FarmGiftCostController {
  constructor(private readonly farmGiftCostService: FarmGiftCostService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo quà tặng mới' })
  create(@Body() createDto: any) {
    return this.farmGiftCostService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Tìm kiếm quà tặng với filter' })
  search(@Query() searchDto: any) {
    return this.farmGiftCostService.search(searchDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết quà tặng' })
  findOne(@Param('id') id: string) {
    return this.farmGiftCostService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật quà tặng' })
  update(@Param('id') id: string, @Body() updateDto: any) {
    return this.farmGiftCostService.update(+id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa quà tặng' })
  remove(@Param('id') id: string) {
    return this.farmGiftCostService.remove(+id);
  }
}
