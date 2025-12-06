import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { User } from '../../entities/users.entity';
import { Product } from '../../entities/products.entity';
import { UploadService } from '../upload/upload.service';
import { ImageCleanupHelper } from '../../common/helpers/image-cleanup.helper';
import { UserProfile } from '../../entities/user-profiles.entity';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);
  private readonly CLEANUP_THRESHOLD_DAYS = 30;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserProfile)
    private readonly userProfileRepository: Repository<UserProfile>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * Chạy cron job dọn dẹp mỗi tuần vào 0h sáng Chủ Nhật
   */
  @Cron(CronExpression.EVERY_WEEK)
  async handleCleanup() {
    this.logger.log('Starting scheduled cleanup job...');
    
    await this.cleanupOldDeletedUsers();
    await this.cleanupOldDeletedProducts();
    
    this.logger.log('Cleanup job finished.');
  }

  private getThresholdDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() - this.CLEANUP_THRESHOLD_DAYS);
    return date;
  }

  /**
   * Dọn dẹp các user đã xóa mềm quá 30 ngày
   */
  async cleanupOldDeletedUsers() {
    const thresholdDate = this.getThresholdDate();
    this.logger.log(`Cleaning up users deleted before ${thresholdDate.toISOString()}...`);

    try {
      // Tìm các user đã xóa mềm lâu hơn ngưỡng cho phép
      // Cần withDeleted: true để tìm được record đã xóa mềm
      const usersToDelete = await this.userRepository.find({
        where: {
          deleted_at: LessThan(thresholdDate),
        },
        withDeleted: true,
        relations: ['profile'],
      });

      this.logger.log(`Found ${usersToDelete.length} users to permanently delete.`);

      for (const user of usersToDelete) {
        try {
          // 1. Xóa avatar nếu có
          if (user.profile?.avatar) {
            await ImageCleanupHelper.deleteImage(user.profile.avatar, this.uploadService);
          }

          // 2. Xóa cứng UserProfile (nếu chưa bị cascade)
          // Lưu ý: Nếu thiết lập DB cascade delete thì bước này có thể tự động, 
          // nhưng làm thủ công để đảm bảo an toàn.
          await this.userProfileRepository.delete({ user_id: user.id });

          // 3. Xóa cứng User
          await this.userRepository.delete(user.id);
          
          this.logger.log(`Permanently deleted user ID: ${user.id}`);
        } catch (error) {
          this.logger.error(`Failed to delete user ID ${user.id}`, (error as Error).stack);
        }
      }
    } catch (error) {
      this.logger.error('Error during user cleanup', (error as Error).stack);
    }
  }

  /**
   * Dọn dẹp các sản phẩm đã xóa mềm quá 30 ngày
   */
  async cleanupOldDeletedProducts() {
    const thresholdDate = this.getThresholdDate();
    this.logger.log(`Cleaning up products deleted before ${thresholdDate.toISOString()}...`);

    try {
      const productsToDelete = await this.productRepository.find({
        where: {
          deleted_at: LessThan(thresholdDate),
        },
        withDeleted: true,
      });

      this.logger.log(`Found ${productsToDelete.length} products to permanently delete.`);

      for (const product of productsToDelete) {
        try {
          // 1. Xóa ảnh thumbnail
          if (product.thumb) {
            await ImageCleanupHelper.deleteImage(product.thumb, this.uploadService);
          }

          // 2. Xóa danh sách ảnh (pictures)
          if (product.pictures && product.pictures.length > 0) {
            await ImageCleanupHelper.deleteImages(product.pictures, this.uploadService);
          }

          // 3. Xóa cứng Product
          await this.productRepository.delete(product.id);
          
          this.logger.log(`Permanently deleted product ID: ${product.id}`);
        } catch (error) {
          this.logger.error(`Failed to delete product ID ${product.id}`, (error as Error).stack);
        }
      }
    } catch (error) {
      this.logger.error('Error during product cleanup', (error as Error).stack);
    }
  }
}
