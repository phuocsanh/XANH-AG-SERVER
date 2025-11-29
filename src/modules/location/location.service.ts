import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../../entities/location.entity';
import { UpdateLocationDto } from './dto/update-location.dto';

/**
 * Service quản lý vị trí ruộng lúa
 */
@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
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

    return location;
  }
}
