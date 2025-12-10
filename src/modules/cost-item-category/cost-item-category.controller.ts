import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Get,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CostItemCategoryService } from './cost-item-category.service';
import { CreateCostItemCategoryDto } from './dto/create-cost-item-category.dto';
import { UpdateCostItemCategoryDto } from './dto/update-cost-item-category.dto';
import { SearchCostItemCategoryDto } from './dto/search-cost-item-category.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

/**
 * Controller quản lý các loại chi phí canh tác
 */
@Controller('cost-item-categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CostItemCategoryController {
  constructor(
    private readonly categoryService: CostItemCategoryService,
  ) {}

  /**
   * Tạo loại chi phí mới
   */
  @Post()
  @RequirePermissions('COST_ITEM_MANAGE')
  create(@Body() createDto: CreateCostItemCategoryDto) {
    return this.categoryService.create(createDto);
  }

  /**
   * Tìm kiếm (hoặc lấy tất cả nếu body rỗng)
   */
  @Post('search')
  @RequirePermissions('COST_ITEM_VIEW')
  search(@Body() searchDto: SearchCostItemCategoryDto) {
    return this.categoryService.search(searchDto);
  }

  /**
   * Lấy chi tiết
   */
  @Get(':id')
  @RequirePermissions('COST_ITEM_VIEW')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.findOne(id);
  }

  /**
   * Cập nhật
   */
  @Patch(':id')
  @RequirePermissions('COST_ITEM_MANAGE')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateCostItemCategoryDto,
  ) {
    return this.categoryService.update(id, updateDto);
  }

  /**
   * Xóa (soft delete)
   */
  @Delete(':id')
  @RequirePermissions('COST_ITEM_MANAGE')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.remove(id);
  }
}
