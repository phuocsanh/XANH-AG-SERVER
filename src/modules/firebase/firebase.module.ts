import { Module, Global } from '@nestjs/common';
import { FirebaseService } from './firebase.service';

/**
 * Global module để FirebaseService có thể được inject ở bất kỳ đâu
 */
@Global()
@Module({
  providers: [FirebaseService],
  exports: [FirebaseService],
})
export class FirebaseModule {}
