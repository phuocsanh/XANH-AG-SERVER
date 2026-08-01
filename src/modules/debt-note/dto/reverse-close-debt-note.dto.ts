import { IsString, MinLength } from 'class-validator';

export class ReverseCloseDebtNoteDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
