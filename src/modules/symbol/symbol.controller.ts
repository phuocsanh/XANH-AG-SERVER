import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SymbolService } from './symbol.service';
import { Symbol } from '../../entities/symbols.entity';
import { SearchSymbolDto } from './dto/search-symbol.dto';

/**
 * Controller xử lý các yêu cầu HTTP liên quan đến ký hiệu sản phẩm
 * Cung cấp các endpoint để quản lý ký hiệu
 */
@Controller('symbols')
export class SymbolController {
  /**
   * Constructor injection service cần thiết
   * @param symbolService - Service xử lý logic nghiệp vụ ký hiệu
   */
  constructor(private readonly symbolService: SymbolService) {}

  /**
   * Tạo ký hiệu mới
   * @param symbolData - Dữ liệu tạo ký hiệu mới
   * @returns Thông tin ký hiệu đã tạo
   */
  @Post()
  async create(@Body() symbolData: Partial<Symbol>): Promise<Symbol> {
    return this.symbolService.create(symbolData);
  }

  /**
   * Lấy danh sách tất cả ký hiệu
   * @returns Danh sách ký hiệu
   */
  @Get()
  async findAll(): Promise<Symbol[]> {
    return this.symbolService.findAll();
  }

  /**
   * Tìm ký hiệu theo ID
   * @param id - ID của ký hiệu cần tìm
   * @returns Thông tin ký hiệu
   */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Symbol> {
    const symbol = await this.symbolService.findOne(id);
    if (!symbol) {
      throw new NotFoundException(`Không tìm thấy ký hiệu với ID: ${id}`);
    }
    return symbol;
  }

  /**
   * Cập nhật thông tin ký hiệu
   * @param id - ID của ký hiệu cần cập nhật
   * @param updateData - Dữ liệu cập nhật ký hiệu
   * @returns Thông tin ký hiệu đã cập nhật
   */
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateData: Partial<Symbol>,
  ): Promise<Symbol> {
    const symbol = await this.symbolService.update(id, updateData);
    if (!symbol) {
      throw new NotFoundException(`Không tìm thấy ký hiệu với ID: ${id}`);
    }
    return symbol;
  }

  /**
   * Xóa ký hiệu theo ID
   * @param id - ID của ký hiệu cần xóa
   */
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.symbolService.remove(id);
  }

  /**
   * Tìm kiếm nâng cao ký hiệu
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách ký hiệu phù hợp
   */
  @Post('search')
  search(@Body() searchDto: SearchSymbolDto) {
    try {
      return this.symbolService.searchSymbols(searchDto);
    } catch (error) {
      throw new HttpException(
        'Error occurred while searching symbols',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
