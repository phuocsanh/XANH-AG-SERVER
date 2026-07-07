import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Loan } from '../../entities/loan.entity';
import { Customer } from '../../entities/customer.entity';
import { User } from '../../entities/users.entity';
import { LoanService } from './loan.service';
import { LoanController } from './loan.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Loan, Customer, User])],
  controllers: [LoanController],
  providers: [LoanService],
  exports: [LoanService],
})
export class LoanModule {}
