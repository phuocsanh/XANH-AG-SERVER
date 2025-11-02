import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../entities/users.entity';

@ValidatorConstraint({ name: 'UniqueAccount', async: true })
@Injectable()
export class UniqueAccountValidator implements ValidatorConstraintInterface {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async validate(account: string) {
    const user = await this.userRepository.findOne({
      where: { account },
    });
    return !user; // return true if account doesn't exist
  }

  defaultMessage() {
    return 'Account $value already exists';
  }
}
