import { PartialType } from '@nestjs/mapped-types';
import { CreatePaymentAllocationDto } from './create-payment-allocation.dto';

export class UpdatePaymentAllocationDto extends PartialType(CreatePaymentAllocationDto) {}
