import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override handleRequest(err, user, info) {
    // Nếu có lỗi, ném lỗi đó
    if (err || !user) {
      console.log('JWT Guard Error:', err);
      console.log('JWT Guard Info:', info);
      console.log('JWT Guard User:', user);
      throw err || new Error('Unauthorized');
    }
    return user;
  }
}
