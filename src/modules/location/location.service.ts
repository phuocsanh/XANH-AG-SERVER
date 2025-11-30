import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModuleRef } from '@nestjs/core';
import { Location } from '../../entities/location.entity';
import { UpdateLocationDto } from './dto/update-location.dto';
import { WeatherService } from './weather.service';

/**
 * Service quản lý vị trí ruộng lúa
 */
@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    private weatherService: WeatherService,
    private moduleRef: ModuleRef,
  ) {}

  /**
   * Lấy vị trí hiện tại (id = 1)
   */
  async getLocation(): Promise<Location> {
    const location = await this.locationRepository.findOne({ where: { id: 1 } });
    if (!location) {
      // Tạo vị trí mặc định nếu chưa có
      return this.locationRepository.save({
        id: 1,
        name: 'Ruộng nhà ông Tư - Tân Lập, Vũ Thư',
        lat: 20.4167,
        lon: 106.3667,
      });
    }
    return location;
  }

  /**
   * Cập nhật vị trí (UPSERT với id = 1)
   * Sau khi cập nhật, tự động trigger phân tích cho cả 3 module
   */
  async updateLocation(dto: UpdateLocationDto): Promise<Location> {
    this.logger.log(`Cập nhật vị trí: ${dto.name} (${dto.lat}, ${dto.lon})`);
    
    let location = await this.locationRepository.findOne({ where: { id: 1 } });

    if (location) {
      await this.locationRepository.update(1, dto);
      location = await this.locationRepository.findOne({ where: { id: 1 } });
    } else {
      location = await this.locationRepository.save({
        id: 1,
        ...dto,
      });
    }

    if (!location) {
      throw new Error('Failed to update location');
    }

    // Sau khi cập nhật vị trí, trigger phân tích cho cả 3 module
    this.triggerAllAnalysis(location.lat, location.lon).catch(err => {
      this.logger.error(`Failed to trigger analysis: ${err.message}`);
    });

    return location;
  }

  /**
   * Trigger phân tích cho cả 3 module (Rice Blast, Bacterial Blight, Pest Warning)
   * Fetch weather data 1 lần duy nhất và chia sẻ cho cả 3 module
   */
  private async triggerAllAnalysis(lat: number, lon: number): Promise<void> {
    this.logger.log(`🔄 Triggering analysis for all modules...`);

    try {
      // Fetch weather data 1 lần duy nhất
      const weatherData = await this.weatherService.fetchWeatherData(lat, lon);

      // Dynamically get services to avoid circular dependency
      const { AiRiceBlastService } = await import('../ai-rice-blast/ai-rice-blast.service');
      const { AiBacterialBlightService } = await import('../ai-bacterial-blight/ai-bacterial-blight.service');
      const { AiStemBorerService } = await import('../ai-stem-borer/ai-stem-borer.service');
      const { AiGallMidgeService } = await import('../ai-gall-midge/ai-gall-midge.service');
      const { AiBrownPlantHopperService } = await import('../ai-brown-plant-hopper/ai-brown-plant-hopper.service');
      const { AiSheathBlightService } = await import('../ai-sheath-blight/ai-sheath-blight.service');
      const { AiGrainDiscolorationService } = await import('../ai-grain-discoloration/ai-grain-discoloration.service');

      const riceBlastService = this.moduleRef.get(AiRiceBlastService, { strict: false });
      const bacterialBlightService = this.moduleRef.get(AiBacterialBlightService, { strict: false });
      const stemBorerService = this.moduleRef.get(AiStemBorerService, { strict: false });
      const gallMidgeService = this.moduleRef.get(AiGallMidgeService, { strict: false });
      const brownPlantHopperService = this.moduleRef.get(AiBrownPlantHopperService, { strict: false });
      const sheathBlightService = this.moduleRef.get(AiSheathBlightService, { strict: false });
      const grainDiscolorationService = this.moduleRef.get(AiGrainDiscolorationService, { strict: false });

      // Trigger analysis for all modules in parallel
      await Promise.all([
        riceBlastService.runAnalysisWithWeatherData(weatherData),
        bacterialBlightService.runAnalysisWithWeatherData(weatherData),
        stemBorerService.runAnalysisWithWeatherData(weatherData),
        gallMidgeService.runAnalysisWithWeatherData(weatherData),
        brownPlantHopperService.runAnalysisWithWeatherData(weatherData),
        sheathBlightService.runAnalysisWithWeatherData(weatherData),
        grainDiscolorationService.runAnalysisWithWeatherData(weatherData),
      ]);

      this.logger.log(`✅ All analyses completed successfully`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Failed to complete all analyses: ${err.message}`);
      throw error;
    }
  }
}

