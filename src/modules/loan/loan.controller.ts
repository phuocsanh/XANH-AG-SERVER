import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LoanService } from './loan.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { SearchLoanDto } from './dto/search-loan.dto';
import { RepayLoanDto } from './dto/repay-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';

@Controller('loans')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LoanController {
  constructor(private readonly loanService: LoanService) {}

  @Post()
  @RequirePermissions('sales:manage')
  create(@Body() dto: CreateLoanDto, @CurrentUser('id') userId: number) {
    return this.loanService.create(dto, userId);
  }

  @Post('search')
  @RequirePermissions('sales:read')
  search(@Body() dto: SearchLoanDto) {
    return this.loanService.search(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.loanService.findOne(+id);
  }

  @Patch(':id')
  @RequirePermissions('sales:manage')
  update(@Param('id') id: string, @Body() dto: UpdateLoanDto) {
    return this.loanService.update(+id, dto);
  }

  @Post(':id/repay')
  @RequirePermissions('sales:manage')
  repay(@Param('id') id: string, @Body() dto: RepayLoanDto, @CurrentUser('id') userId: number) {
    return this.loanService.repay(+id, dto, userId);
  }

  @Delete(':id')
  @RequirePermissions('sales:manage')
  remove(@Param('id') id: string) {
    return this.loanService.remove(+id);
  }
}
