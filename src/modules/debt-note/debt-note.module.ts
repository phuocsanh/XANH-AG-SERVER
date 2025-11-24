import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DebtNoteService } from './debt-note.service';
import { DebtNoteController } from './debt-note.controller';
import { DebtNote } from '../../entities/debt-note.entity';

/**
 * DebtNoteModule - Module quản lý phiếu ghi nợ
 * 
 * Module này cung cấp các chức năng:
 * - Tạo phiếu ghi nợ cho khách hàng
 * - Tra cứu và tìm kiếm phiếu ghi nợ
 * - Cập nhật và xóa phiếu ghi nợ
 * - Theo dõi công nợ của khách hàng
 */
@Module({
  imports: [TypeOrmModule.forFeature([DebtNote])],
  controllers: [DebtNoteController],
  providers: [DebtNoteService],
  exports: [DebtNoteService],
})
export class DebtNoteModule {}
