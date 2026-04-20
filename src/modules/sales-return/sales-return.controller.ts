import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { SalesReturnService } from './sales-return.service';
import { CreateSalesReturnDto } from './dto/create-sales-return.dto';
import { SearchSalesReturnDto } from './dto/search-sales-return.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('sales-returns')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalesReturnController {
  constructor(private readonly salesReturnService: SalesReturnService) {}

  @Post()
  @RequirePermissions('sales:manage')
  create(
    @Body() createDto: CreateSalesReturnDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.salesReturnService.create(createDto, userId);
  }

  @Post('search')
  @RequirePermissions('sales:read')
  search(@Body() searchDto: SearchSalesReturnDto) {
    return this.salesReturnService.search(searchDto);
  }

  @Post(':id/cancel')
  @RequirePermissions('sales:manage')
  cancel(
    @Body('id') id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.salesReturnService.cancel(id, userId);
  }
}
