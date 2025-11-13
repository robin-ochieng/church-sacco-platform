import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Prisma connected to database successfully');
      this.logger.log('✅ Using Prisma Client for all CRUD operations');
    } catch (error) {
      this.logger.error('❌ Failed to connect to database via Prisma:', error);
      this.logger.error('💡 Check your DATABASE_URL in .env file');
      this.logger.error('💡 Ensure direct database access is allowed (not via pgBouncer)');
      throw error; // Fail fast - database connection is required
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from database');
  }
}
