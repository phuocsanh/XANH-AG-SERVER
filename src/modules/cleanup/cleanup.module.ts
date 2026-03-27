import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CleanupService } from './cleanup.service';
import { User } from '../../entities/users.entity';
import { Product } from '../../entities/products.entity';
import { UserProfile } from '../../entities/user-profiles.entity';
import { UploadModule } from '../upload/upload.module';
import { News } from '../../entities/news.entity';
import { FileTrackingModule } from '../file-tracking/file-tracking.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserProfile, Product, News]),
    UploadModule,
    FileTrackingModule,
  ],
  providers: [CleanupService],
})
export class CleanupModule {}
