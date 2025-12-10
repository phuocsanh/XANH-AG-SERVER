import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OperatingCostCategoryService } from './operating-cost-category.service';
import { CreateOperatingCostCategoryDto } from './dto/create-operating-cost-category.dto';
import { UpdateOperatingCostCategoryDto } from './dto/update-operating-cost-category.dto';
import { SearchOperatingCostCategoryDto } from './dto/search-operating-cost-category.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

/**
 * Controller quản lý các loại chi phí vận hành
 */
@Controller('operating-cost-categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OperatingCostCategoryController {
  constructor(
    private readonly categoryService: OperatingCostCategoryService,
  ) {}

  /**
   * Tạo loại chi phí mới
   */
  @Post()
  @RequirePermissions('OPERATING_COST_MANAGE')
  create(@Body() createDto: CreateOperatingCostCategoryDto) {
    return this.categoryService.create(createDto);
  }

  /**
   * Lấy tất cả categories (cho dropdown) - Public access
   */
  @Get()
  findAll() {
    return this.categoryService.findAll();
  }

  /**
   * Tìm kiếm nâng cao
   */
  @Post('search')
  @RequirePermissions('OPERATING_COST_VIEW')
  search(@Body() searchDto: SearchOperatingCostCategoryDto) {
    return this.categoryService.search(searchDto);
  }

  /**
   * Lấy chi tiết category
   */
  @Get(':id')
  @RequirePermissions('OPERATING_COST_VIEW')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.findOne(id);
  }

  /**
   * Cập nhật category
   */
  @Patch(':id')
  @RequirePermissions('OPERATING_COST_MANAGE')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateOperatingCostCategoryDto,
  ) {
    return this.categoryService.update(id, updateDto);
  }

  /**
   * Xóa category (soft delete)
   */
  @Delete(':id')
  @RequirePermissions('OPERATING_COST_MANAGE')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.remove(id);
  }
}
