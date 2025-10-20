import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiDocumentController } from './ai-document.controller';
import { AiDocumentService } from './ai-document.service';

@Module({
  imports: [ConfigModule],
  controllers: [AiDocumentController],
  providers: [AiDocumentService],
})
export class AiDocumentModule {}
