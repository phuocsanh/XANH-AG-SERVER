import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CompatibilityMixingPesticidesController } from './compatibility-mixing-pesticides.controller';
import { CompatibilityMixingPesticidesService } from './compatibility-mixing-pesticides.service';

/**
 * CompatibilityMixingPesticidesModule - Module AI tư vấn phối trộn thuốc trừ sâu
 * 
 * Module này cung cấp các chức năng:
 * - Phân tích khả năng tương thích khi phối trộn các loại thuốc trừ sâu
 * - Tư vấn cách phối trộn an toàn và hiệu quả
 * - Đọc và phân tích tài liệu kỹ thuật về thuốc trừ sâu
 * - Trả lời câu hỏi về cách sử dụng thuốc trừ sâu
 */
@Module({
  imports: [ConfigModule],
  controllers: [CompatibilityMixingPesticidesController],
  providers: [CompatibilityMixingPesticidesService],
})
export class CompatibilityMixingPesticidesModule {}
