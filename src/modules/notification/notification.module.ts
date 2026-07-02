import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { UserDevice } from '../../entities/user-devices.entity';
import { User } from '../../entities/users.entity';
import { FirebaseModule } from '../firebase/firebase.module';

@Global()
@Module({
  imports: [
    // Thêm User entity để có thể JOIN với role khi gửi thông báo cho SUPER_ADMIN
    TypeOrmModule.forFeature([UserDevice, User]),
    FirebaseModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
