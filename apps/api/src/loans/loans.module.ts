import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GuarantorsController, MemberGuarantorExposureController } from './guarantors.controller';
import { GuarantorsService } from './guarantors.service';
import { LoanScheduleService } from './loan-schedule.service';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';

@Module({
  imports: [PrismaModule],
  controllers: [LoansController, GuarantorsController, MemberGuarantorExposureController],
  providers: [LoansService, GuarantorsService, LoanScheduleService],
  exports: [GuarantorsService, LoanScheduleService],
})
export class LoansModule {}
