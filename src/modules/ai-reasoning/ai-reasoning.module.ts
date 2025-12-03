import { Module } from '@nestjs/common';
import { AiReasoningService } from './ai-reasoning.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [AiReasoningService],
  exports: [AiReasoningService],
})
export class AiReasoningModule {}
