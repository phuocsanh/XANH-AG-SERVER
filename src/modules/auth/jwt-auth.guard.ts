import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  override handleRequest(err, user, info) {
    // Nếu có lỗi, log và ném lỗi
    if (err || !user) {
      this.logger.debug(`JWT authentication failed: ${info?.message || 'Unknown error'}`);
      
      if (err) {
        this.logger.error('JWT Guard Error:', err);
      }
      
      throw err || new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
