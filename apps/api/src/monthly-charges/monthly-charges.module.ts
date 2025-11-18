import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { MonthlyChargesController } from './monthly-charges.controller';
import { MonthlyChargesProcessor } from './monthly-charges.processor';
import { MonthlyChargesScheduler } from './monthly-charges.scheduler';
import { MonthlyChargesService } from './monthly-charges.service';

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
    BullModule.registerQueue({
      name: 'monthly-charges',
    }),
  ],
  controllers: [MonthlyChargesController],
  providers: [MonthlyChargesService, MonthlyChargesProcessor, MonthlyChargesScheduler],
  exports: [MonthlyChargesService],
})
export class MonthlyChargesModule {}
