import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MonthlyChargesService } from './monthly-charges.service';

@Injectable()
export class MonthlyChargesScheduler {
  private readonly logger = new Logger(MonthlyChargesScheduler.name);

  constructor(private readonly monthlyChargesService: MonthlyChargesService) {}

  /**
   * Scheduled job: Run on 1st of every month at 02:00
   * Cron: 0 2 1 * * (minute hour day-of-month month day-of-week)
   */
  @Cron('0 2 1 * *', {
    name: 'monthly-charges',
    timeZone: 'Africa/Nairobi', // East Africa Time (EAT) - adjust as needed
  })
  async handleMonthlyChargesSchedule() {
    this.logger.log('Scheduled monthly charges job triggered');

    try {
      const dateRange = this.monthlyChargesService.calculateCurrentMonthRange();
      
      await this.monthlyChargesService.scheduleMonthlyCharges({
        from: dateRange.from,
        to: dateRange.to,
        triggeredBy: 'scheduler',
        manual: false,
      });

      this.logger.log('Monthly charges job scheduled successfully');
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to schedule monthly charges: ${err.message}`, err.stack);
    }
  }
}
