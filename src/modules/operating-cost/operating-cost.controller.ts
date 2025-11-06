import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Put,
  Delete,
  NotFoundException,
} from '@nestjs/common';
import { OperatingCostService } from './operating-cost.service';
import { CreateOperatingCostDto } from './dto/create-operating-cost.dto';
import { UpdateOperatingCostDto } from './dto/update-operating-cost.dto';
import { SearchOperatingCostDto } from './dto/search-operating-cost.dto';
import { OperatingCost } from '../../entities/operating-costs.entity';

/**
 * Controller xử lý các yêu cầu liên quan đến chi phí vận hành
 */
@Controller('operating-costs')
export class OperatingCostController {
  constructor(private readonly operatingCostService: OperatingCostService) {}

  /**
   * Test route without parameter
   * @returns Test message
   */
  @Get('test-no-param')
  async testNoParam(): Promise<{ message: string }> {
    return { message: 'Test successful without parameter' };
  }

  /**
   * Test route with parameter
   * @param id - Test parameter
   * @returns Test message
   */
  @Get('test/:id')
  async testWithParam(@Param('id') id: string): Promise<{ message: string }> {
    return { message: `Test successful with id: ${id}` };
  }

  /**
   * Lấy tổng tất cả chi phí
   * @returns Tổng tất cả chi phí
   */
  @Get('total')
  async getTotalCost(): Promise<{ total: number }> {
    const total = await this.operatingCostService.getTotalCost();
    return { total };
  }

  /**
   * Lấy tổng chi phí theo nhóm loại chi phí
   * @returns Tổng chi phí theo từng loại
   */
  @Get('summary-all')
  async getCostSummary(): Promise<Array<{ costType: string; total: number }>> {
    // Các loại chi phí phổ biến
    const costTypes = [
      'electricity',
      'water',
      'rent',
      'salary',
      'software',
      'marketing',
      'tax',
      'other',
    ];
    const summary: Array<{ costType: string; total: number }> = [];

    for (const costType of costTypes) {
      const total =
        await this.operatingCostService.getTotalCostByType(costType);
      summary.push({ costType, total });
    }

    return summary;
  }

  /**
   * Lấy tổng chi phí theo loại chi phí
   * @param costType - Loại chi phí cần tính tổng
   * @returns Tổng chi phí của loại chi phí tương ứng
   */
  @Get('type/:costType')
  async getTotalCostByType(
    @Param('costType') costType: string,
  ): Promise<{ total: number }> {
    const total = await this.operatingCostService.getTotalCostByType(costType);
    return { total };
  }

  /**
   * Tạo chi phí vận hành mới
   * @param createOperatingCostDto - Dữ liệu tạo chi phí vận hành mới
   * @returns Thông tin chi phí vận hành đã tạo
   */
  @Post()
  async create(
    @Body() createOperatingCostDto: CreateOperatingCostDto,
  ): Promise<OperatingCost> {
    return this.operatingCostService.create(createOperatingCostDto);
  }

  /**
   * Lấy danh sách tất cả chi phí vận hành
   * @returns Danh sách chi phí vận hành
   */
  @Get()
  async findAll(): Promise<OperatingCost[]> {
    return this.operatingCostService.findAll();
  }

  /**
   * Tìm chi phí vận hành theo ID
   * @param id - ID của chi phí vận hành cần tìm
   * @returns Thông tin chi phí vận hành
   */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<OperatingCost> {
    const operatingCost = await this.operatingCostService.findOne(id);
    if (!operatingCost) {
      throw new NotFoundException(
        `Không tìm thấy chi phí vận hành với ID ${id}`,
      );
    }
    return operatingCost;
  }

  /**
   * Cập nhật thông tin chi phí vận hành
   * @param id - ID của chi phí vận hành cần cập nhật
   * @param updateOperatingCostDto - Dữ liệu cập nhật chi phí vận hành
   * @returns Thông tin chi phí vận hành đã cập nhật
   */
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOperatingCostDto: UpdateOperatingCostDto,
  ): Promise<OperatingCost> {
    const operatingCost = await this.operatingCostService.update(
      id,
      updateOperatingCostDto,
    );
    if (!operatingCost) {
      throw new NotFoundException(
        `Không tìm thấy chi phí vận hành với ID ${id}`,
      );
    }
    return operatingCost;
  }

  /**
   * Xóa chi phí vận hành theo ID
   * @param id - ID của chi phí vận hành cần xóa
   */
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    const operatingCost = await this.operatingCostService.findOne(id);
    if (!operatingCost) {
      throw new NotFoundException(
        `Không tìm thấy chi phí vận hành với ID ${id}`,
      );
    }
    return this.operatingCostService.remove(id);
  }

  /**
   * Tìm kiếm chi phí vận hành nâng cao
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách chi phí vận hành phù hợp
   */
  @Post('search')
  async searchAdvanced(
    @Body() searchDto: SearchOperatingCostDto,
  ): Promise<any> {
    return this.operatingCostService.searchOperatingCostsAdvanced(searchDto);
  }
}
