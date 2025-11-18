import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { MonthlyChargeJobData, MonthlyChargeResult, MonthlyChargesService } from './monthly-charges.service';

@Processor('monthly-charges')
export class MonthlyChargesProcessor {
  private readonly logger = new Logger(MonthlyChargesProcessor.name);

  constructor(private readonly monthlyChargesService: MonthlyChargesService) {}

  @Process('process-monthly-charges')
  async handleMonthlyCharges(job: Job<MonthlyChargeJobData>): Promise<MonthlyChargeResult> {
    this.logger.log(`Processing job ${job.id}: Monthly charges for ${job.data.from} to ${job.data.to}`);

    try {
      const result = await this.monthlyChargesService.processMonthlyCharges(job.data);
      
      this.logger.log(
        `Job ${job.id} completed: ${result.successCount} successful, ${result.failureCount} failed`,
      );

      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Job ${job.id} failed: ${err.message}`, err.stack);
      throw error;
    }
  }
}
