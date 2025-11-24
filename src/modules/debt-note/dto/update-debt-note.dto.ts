import { PartialType } from '@nestjs/mapped-types';
import { CreateDebtNoteDto } from './create-debt-note.dto';

export class UpdateDebtNoteDto extends PartialType(CreateDebtNoteDto) {}
