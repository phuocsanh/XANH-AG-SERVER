import { Controller, Get, Post, Body } from '@nestjs/common';
import { SalesReturnService } from './sales-return.service';
import { CreateSalesReturnDto } from './dto/create-sales-return.dto';
import { SearchSalesReturnDto } from './dto/search-sales-return.dto';

@Controller('sales-returns')
export class SalesReturnController {
  constructor(private readonly salesReturnService: SalesReturnService) {}

  @Post()
  create(@Body() createDto: CreateSalesReturnDto) {
    return this.salesReturnService.create(createDto);
  }

  @Get()
  findAll() {
    return this.salesReturnService.findAll();
  }

  @Post('search')
  search(@Body() searchDto: SearchSalesReturnDto) {
    return this.salesReturnService.search(searchDto);
  }
}
