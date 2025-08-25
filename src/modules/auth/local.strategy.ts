import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'userAccount',
      passwordField: 'userPassword',
    });
  }

  async validate(userAccount: string, userPassword: string): Promise<any> {
    const user = await this.authService.validateUser(userAccount, userPassword);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }
}