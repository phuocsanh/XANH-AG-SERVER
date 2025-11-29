import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DebtNoteService } from './debt-note.service';
import { CreateDebtNoteDto } from './dto/create-debt-note.dto';
import { UpdateDebtNoteDto } from './dto/update-debt-note.dto';
import { SearchDebtNoteDto } from './dto/search-debt-note.dto';

@Controller('debt-notes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DebtNoteController {
  constructor(private readonly debtNoteService: DebtNoteService) {}

  @Post()
  @RequirePermissions('SALES_MANAGE')
  create(@Body() createDto: CreateDebtNoteDto) {
    return this.debtNoteService.create(createDto);
  }

  @Get()
  @RequirePermissions('SALES_VIEW')
  findAll() {
    return this.debtNoteService.findAll();
  }

  @Post('search')
  search(@Body() searchDto: SearchDebtNoteDto) {
    return this.debtNoteService.search(searchDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.debtNoteService.findOne(+id);
  }

  @Patch(':id')
  @RequirePermissions('SALES_MANAGE')
  update(@Param('id') id: string, @Body() updateDto: UpdateDebtNoteDto) {
    return this.debtNoteService.update(+id, updateDto);
  }

  @Delete(':id')
  @RequirePermissions('SALES_MANAGE')
  remove(@Param('id') id: string) {
    return this.debtNoteService.remove(+id);
  }
}
