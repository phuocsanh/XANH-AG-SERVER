import { IsNotEmpty, IsString } from 'class-validator';

export class AskDto {
  @IsNotEmpty()
  @IsString()
  question!: string;
}
