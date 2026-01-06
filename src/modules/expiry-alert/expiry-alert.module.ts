import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpiryAlertService } from './expiry-alert.service';
import { ExpiryAlertController } from './expiry-alert.controller';
import { ExpiryCheckCron } from './expiry-check.cron';
import { ExpiryAlert } from '../../entities/expiry-alerts.entity';
import { InventoryBatch } from '../../entities/inventories.entity';
import { Product } from '../../entities/products.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExpiryAlert, InventoryBatch, Product]),
  ],
  controllers: [ExpiryAlertController],
  providers: [ExpiryAlertService, ExpiryCheckCron],
  exports: [ExpiryAlertService],
})

export class ExpiryAlertModule {}
