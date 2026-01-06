import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { UserDevice } from '../../entities/user-devices.entity';
import { FirebaseModule } from '../firebase/firebase.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([UserDevice]),
    FirebaseModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
