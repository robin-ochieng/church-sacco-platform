import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private isConnected = false;

  async onModuleInit() {
    try {
      await this.$connect();
      this.isConnected = true;
      this.logger.log('✅ Prisma connected to database');
    } catch (error) {
      this.logger.warn('⚠️  Could not connect to database via Prisma. Using Supabase SDK instead.');
      this.logger.warn('This is normal if direct database access is restricted.');
      // Don't throw - allow app to start with Supabase SDK only
      this.isConnected = false;
    }
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await this.$disconnect();
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}
