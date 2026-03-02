import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesInvoice } from '../../entities/sales-invoices.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { Product } from '../../entities/products.entity';
import { DebtNote } from '../../entities/debt-note.entity';
import { DeliveryLog } from '../../entities/delivery-log.entity';
import { DeliveryLogItem } from '../../entities/delivery-log-item.entity';
import { OperatingCost } from '../../entities/operating-costs.entity';
import { Payment } from '../../entities/payment.entity';
import { PaymentAllocation } from '../../entities/payment-allocation.entity';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { DeliveryController } from './delivery.controller';
import { DebtNoteModule } from '../debt-note/debt-note.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { OperatingCostModule } from '../operating-cost/operating-cost.module';
import { OperatingCostCategoryModule } from '../operating-cost-category/operating-cost-category.module';
import { User } from '../../entities/users.entity';
import { UserProfile } from '../../entities/user-profiles.entity';
import { DeliveryNotificationService } from './delivery-notification.service';
import { FarmServiceCostModule } from '../farm-service-cost/farm-service-cost.module';
import { InventoryModule } from '../inventory/inventory.module';
import { CustomerRewardModule } from '../customer-reward/customer-reward.module';

/**
 * SalesModule - Module quản lý bán hàng
 * 
 * Module này cung cấp các chức năng:
 * - Tạo và quản lý hóa đơn bán hàng
 * - Quản lý chi tiết sản phẩm trong hóa đơn
 * - Tính toán tổng tiền, thuế, chiết khấu
 * - Hỗ trợ thanh toán một phần và theo dõi công nợ
 * - Liên kết với khách hàng, mùa vụ và sản phẩm
 * - Tự động tính lợi nhuận mỗi đơn hàng
 * - Quản lý phiếu giao hàng
 */
@Module({
  imports: [
    // Import TypeOrmModule feature module với các entity liên quan đến bán hàng
    TypeOrmModule.forFeature([
      SalesInvoice, // Entity quản lý hóa đơn bán hàng
      SalesInvoiceItem, // Entity quản lý chi tiết hóa đơn bán hàng
      Product, // Entity sản phẩm (để tính giá vốn)
      DebtNote, // Entity phiếu công nợ (để tự động tạo theo mùa vụ)
      DeliveryLog, // Entity phiếu giao hàng
      DeliveryLogItem, // Entity chi tiết sản phẩm trong phiếu giao hàng
      OperatingCost, // Entity chi phí vận hành (cho quà tặng khách hàng)
      User, // Entity người dùng (tài xế)
      UserProfile, // Entity profile người dùng (fcm_token)
      Payment,
      PaymentAllocation,
    ]),
    FirebaseModule, // Module Firebase cho push notification
    OperatingCostModule, // Module chi phí vận hành (cho chức năng tạo phiếu chi quà tặng)
    OperatingCostCategoryModule, // Module loại chi phí (cho chức năng tạo phiếu chi quà tặng)
    FarmServiceCostModule,
    InventoryModule,
    DebtNoteModule,
    CustomerRewardModule,
  ],
  controllers: [SalesController, DeliveryController], // Controllers xử lý các request
  providers: [SalesService, DeliveryNotificationService], // Service xử lý logic nghiệp vụ bán hàng và thông báo
  exports: [SalesService], // Xuất SalesService để các module khác có thể sử dụng
})
export class SalesModule {}
