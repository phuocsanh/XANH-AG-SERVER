import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CostItem } from '../../entities/cost-item.entity';
import { CostItemService } from './cost-item.service';
import { CostItemController } from './cost-item.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CostItem])],
  controllers: [CostItemController],
  providers: [CostItemService],
  exports: [CostItemService],
})
export class CostItemModule {}
