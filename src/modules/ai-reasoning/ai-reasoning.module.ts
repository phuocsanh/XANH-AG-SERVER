import { Module } from '@nestjs/common';
import { AiReasoningService } from './ai-reasoning.service';
import { ConfigModule } from '@nestjs/config';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [ConfigModule, FirebaseModule],
  providers: [AiReasoningService],
  exports: [AiReasoningService],
})
export class AiReasoningModule {}
