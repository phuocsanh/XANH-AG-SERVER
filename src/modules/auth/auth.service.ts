import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { User } from '../../entities/user.entity';
import { CreateUserDto } from '../user/dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async validateUser(userAccount: string, pass: string): Promise<any> {
    const user = await this.userService.findByAccount(userAccount);
    if (user) {
      const isPasswordValid = await bcrypt.compare(pass, user.userPassword);
      if (isPasswordValid) {
        const { userPassword, ...result } = user;
        return result;
      }
    }
    return null;
  }

  async login(user: User) {
    const payload = {
      userAccount: user.userAccount,
      sub: user.userId,
      userId: user.userId,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        userId: user.userId,
        userAccount: user.userAccount,
      },
    };
  }

  async register(createUserDto: CreateUserDto) {
    // Hash password before saving
    const hashedPassword = await this.hashPassword(createUserDto.userPassword);

    // Create user with hashed password
    const user = await this.userService.create({
      ...createUserDto,
      userPassword: hashedPassword,
    });

    // Return user without password
    const { userPassword, ...result } = user;
    return result;
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }
}
