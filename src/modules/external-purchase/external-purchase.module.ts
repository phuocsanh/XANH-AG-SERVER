import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalPurchase, ExternalPurchaseItem } from '../../entities/external-purchase.entity';
import { RiceCrop } from '../../entities/rice-crop.entity';
import { ExternalPurchaseController } from './external-purchase.controller';
import { ExternalPurchaseService } from './external-purchase.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExternalPurchase,
      ExternalPurchaseItem,
      RiceCrop,
    ]),
  ],
  controllers: [ExternalPurchaseController],
  providers: [ExternalPurchaseService],
  exports: [ExternalPurchaseService],
})
export class ExternalPurchaseModule {}
