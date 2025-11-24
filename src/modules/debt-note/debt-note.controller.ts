import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DebtNoteService } from './debt-note.service';
import { CreateDebtNoteDto } from './dto/create-debt-note.dto';
import { UpdateDebtNoteDto } from './dto/update-debt-note.dto';
import { SearchDebtNoteDto } from './dto/search-debt-note.dto';

@Controller('debt-notes')
export class DebtNoteController {
  constructor(private readonly debtNoteService: DebtNoteService) {}

  @Post()
  create(@Body() createDto: CreateDebtNoteDto) {
    return this.debtNoteService.create(createDto);
  }

  @Get()
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
  update(@Param('id') id: string, @Body() updateDto: UpdateDebtNoteDto) {
    return this.debtNoteService.update(+id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.debtNoteService.remove(+id);
  }
}
