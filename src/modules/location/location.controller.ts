import { Controller, Get, Post, Body, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LocationService } from './location.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { Location } from '../../entities/location.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

/**
 * Controller xử lý các API endpoint cho quản lý vị trí ruộng lúa
 */
@ApiTags('Location Management')
@Controller('location')
export class LocationController {
  private readonly logger = new Logger(LocationController.name);

  constructor(private readonly locationService: LocationService) {}

  /**
   * GET /location
   * Lấy vị trí ruộng lúa hiện tại
   */
  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('RICE_BLAST_VIEW')
  @ApiOperation({ summary: 'Lấy vị trí ruộng lúa hiện tại' })
  @ApiResponse({ 
    status: 200, 
    description: 'Thành công', 
    type: Location 
  })
  async getLocation(): Promise<Location> {
    this.logger.log('GET /location');
    return this.locationService.getLocation();
  }

  /**
   * POST /location
   * Cập nhật vị trí ruộng lúa (UPSERT id = 1)
   * Chỉ Admin/Super Admin
   */
  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('RICE_BLAST_MANAGE')
  @ApiOperation({ summary: 'Cập nhật vị trí ruộng lúa' })
  @ApiResponse({ 
    status: 200, 
    description: 'Cập nhật thành công', 
    type: Location 
  })
  async updateLocation(@Body() dto: UpdateLocationDto): Promise<Location> {
    this.logger.log(`POST /location - ${dto.name}`);
    return this.locationService.updateLocation(dto);
  }
}
