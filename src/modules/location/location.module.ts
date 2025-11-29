import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';
import { WeatherService } from './weather.service';
import { Location } from '../../entities/location.entity';

/**
 * Module quản lý vị trí ruộng lúa
 * Module này được share cho các module cảnh báo bệnh
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Location]),
  ],
  controllers: [LocationController],
  providers: [LocationService, WeatherService],
  exports: [LocationService, WeatherService], // Export cả WeatherService
})
export class LocationModule {}
