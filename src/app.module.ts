import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ProductModule } from './modules/product/product.module';
import { SupplierModule } from './modules/supplier/supplier.module';
import { ProductTypeModule } from './modules/product-type/product-type.module';
import { ProductSubtypeModule } from './modules/product-subtype/product-subtype.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { FileTrackingModule } from './modules/file-tracking/file-tracking.module';
import { SalesModule } from './modules/sales/sales.module';
import { UploadModule } from './modules/upload/upload.module';
import { AiAnalysisModule } from './modules/ai-analysis-rice/ai-analysis.module';

import { RiceMarketData } from './entities/rice-market.entity';
import typeOrmConfig from './config/typeorm.config';
import { CompatibilityMixingPesticidesModule } from './modules/ai-compatibility-mixing-pesticides/compatibility-mixing-pesticides.module';
import { UnitModule } from './modules/unit/unit.module';
import { SymbolModule } from './modules/symbol/symbol.module';
import { OperatingCostModule } from './modules/operating-cost/operating-cost.module';
import { OperatingCostCategoryModule } from './modules/operating-cost-category/operating-cost-category.module';
import { SeasonModule } from './modules/season/season.module';
import { CustomerModule } from './modules/customer/customer.module';
import { PaymentModule } from './modules/payment/payment.module';
import { PaymentAllocationModule } from './modules/payment-allocation/payment-allocation.module';
import { DebtNoteModule } from './modules/debt-note/debt-note.module';
import { SalesReturnModule } from './modules/sales-return/sales-return.module';
import { AiRiceBlastModule } from './modules/ai-rice-blast/ai-rice-blast.module';
import { LocationModule } from './modules/location/location.module';
import { AiBacterialBlightModule } from './modules/ai-bacterial-blight/ai-bacterial-blight.module';
import { AiStemBorerModule } from './modules/ai-stem-borer/ai-stem-borer.module';
import { AiGallMidgeModule } from './modules/ai-gall-midge/ai-gall-midge.module';
import { AiBrownPlantHopperModule } from './modules/ai-brown-plant-hopper/ai-brown-plant-hopper.module';
import { AiSheathBlightModule } from './modules/ai-sheath-blight/ai-sheath-blight.module';
import { AiGrainDiscolorationModule } from './modules/ai-grain-discoloration/ai-grain-discoloration.module';
import { RiceCropModule } from './modules/rice-crop/rice-crop.module';
import { CostItemModule } from './modules/cost-item/cost-item.module';
import { CostItemCategoryModule } from './modules/cost-item-category/cost-item-category.module';
import { HarvestRecordModule } from './modules/harvest-record/harvest-record.module';
import { FarmingScheduleModule } from './modules/farming-schedule/farming-schedule.module';
import { ApplicationRecordModule } from './modules/application-record/application-record.module';
import { GrowthTrackingModule } from './modules/growth-tracking/growth-tracking.module';
import { ProfitReportModule } from './modules/profit-report/profit-report.module';
import { StoreProfitReportModule } from './modules/store-profit-report/store-profit-report.module';
import { FirebaseModule } from './modules/firebase/firebase.module';
import { HealthModule } from './health/health.module';
import { CleanupModule } from './modules/cleanup/cleanup.module';
import { AreaOfEachPlotOfLandModule } from './modules/area-of-each-plot-of-land/area-of-each-plot-of-land.module';
import { ExternalPurchaseModule } from './modules/external-purchase/external-purchase.module';
import { FarmServiceCostModule } from './modules/farm-service-cost/farm-service-cost.module';
import { ExpiryAlertModule } from './modules/expiry-alert/expiry-alert.module';
import { NotificationModule } from './modules/notification/notification.module';
import { SeedController } from './seed.controller';
import { ProductUnitConversionModule } from './modules/product-unit-conversion/product-unit-conversion.module';
import { ProductMixtureModule } from './modules/product-mixture/product-mixture.module';
import { SupplierReportModule } from './modules/supplier-report/supplier-report.module';
import { CustomerRewardModule } from './modules/customer-reward/customer-reward.module';
import { NewsModule } from './modules/news/news.module';
import { PromotionCampaignModule } from './modules/promotion-campaign/promotion-campaign.module';


/**
 * Module chính của ứng dụng NestJS
 * Import tất cả các module con và cấu hình các thành phần global
 */
@Module({
  imports: [
    // Cấu hình module environment variables với scope global
    ConfigModule.forRoot({ isGlobal: true }),

    // Cấu hình kết nối database với TypeORM
    TypeOrmModule.forRoot({
      ...typeOrmConfig,
      entities: [
        __dirname + '/entities/*.entity{.ts,.js}',
        RiceMarketData,
      ],
    }),

    // Cấu hình ScheduleModule để chạy cron jobs
    ScheduleModule.forRoot(),

    // Cấu hình rate limiting để bảo vệ API khỏi DDoS
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 giây
        limit: 10, // Tối đa 10 requests trong 1 giây
      },
      {
        name: 'medium',
        ttl: 10000, // 10 giây
        limit: 50, // Tối đa 50 requests trong 10 giây
      },
      {
        name: 'long',
        ttl: 60000, // 1 phút
        limit: 200, // Tối đa 200 requests trong 1 phút
      },
    ]),

    // Import các module chức năng
    ProductModule,
    ProductTypeModule,
    ProductSubtypeModule,
    UserModule,
    AuthModule,
    InventoryModule,
    FileTrackingModule,
    SalesModule,
    UploadModule,
    AiAnalysisModule,
    CompatibilityMixingPesticidesModule,
    UnitModule,
    SymbolModule,
    SupplierModule,
    OperatingCostModule,
    OperatingCostCategoryModule,
    SeasonModule,
    CustomerModule,
    PaymentModule,
    PaymentAllocationModule,
    DebtNoteModule,
    SalesReturnModule,
    FirebaseModule, // Module kết nối Firebase Remote Config
    LocationModule, // Module quản lý vị trí ruộng lúa (shared)
    AiRiceBlastModule, // Module cảnh báo bệnh đạo ôn
    AiBacterialBlightModule, // Module cảnh báo bệnh cháy bìa lá
    AiStemBorerModule, // Module cảnh báo Sâu Đục Thân
    AiGallMidgeModule, // Module cảnh báo Muỗi Hành
    AiBrownPlantHopperModule, // Module cảnh báo Rầy Nâu
    AiSheathBlightModule, // Module cảnh báo Bệnh Khô Vằn
    AiGrainDiscolorationModule, // Module cảnh báo Bệnh Lem Lép Hạt
    RiceCropModule, // Module quản lý mảnh ruộng của nông dân
    CostItemModule, // Module quản lý chi phí đầu vào
    CostItemCategoryModule, // Module quản lý loại chi phí canh tác
    HarvestRecordModule, // Module ghi nhận thu hoạch & doanh thu
    FarmingScheduleModule, // Module lịch canh tác
    ApplicationRecordModule, // Module nhật ký phun thuốc/bón phân
    GrowthTrackingModule, // Module theo dõi sinh trưởng
    ProfitReportModule, // Module báo cáo lợi nhuận (nông dân)
    StoreProfitReportModule, // Module báo cáo lợi nhuận (cửa hàng)
    HealthModule, // Module health check để tránh Render free tier sleep
    CleanupModule, // Module dọn dẹp dữ liệu rác định kỳ
    AreaOfEachPlotOfLandModule, // Module quản lý các vùng/lô đất
    ExternalPurchaseModule, // Module quản lý hóa đơn mua hàng từ bên ngoài
    FarmServiceCostModule, // Module quản lý chi phí dịch vụ/quà tặng cho nông dân
    ExpiryAlertModule, // Module quản lý cảnh báo hạn dùng sản phẩm
    NotificationModule, // Module quản lý thông báo (FCM)
    ProductUnitConversionModule, // Module quản lý quy đổi đơn vị tính sản phẩm (1 BAO = 50 KG)
    ProductMixtureModule, // Module quản lý phối trộn sản phẩm
    SupplierReportModule, // Module báo cáo nhà cung cấp
    CustomerRewardModule,
    NewsModule,
    PromotionCampaignModule,
  ],
  controllers: [SeedController], // Seed controller để seed RBAC qua API
  providers: [
    // Đăng ký ThrottlerGuard như một global guard để áp dụng rate limiting
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
