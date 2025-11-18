import { BullModule } from '@nestjs/bull';
import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CashierModule } from './cashier/cashier.module';
import { envValidationSchema } from './config/env.validation';
import { KycModule } from './kyc/kyc.module';
import { MembersModule } from './members/members.module';
import { MonthlyChargesModule } from './monthly-charges/monthly-charges.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { SupabaseModule } from './supabase/supabase.module';
import { UsersModule } from './users/users.module';

// Build module imports conditionally based on environment
const imports: any[] = [
  ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: '.env',
    validationSchema: envValidationSchema,
    validationOptions: {
      abortEarly: false, // Show all validation errors at once
      allowUnknown: true, // Allow extra env vars (e.g., system vars)
    },
  }),
  BullModule.forRootAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
      redis: {
        host: config.get('REDIS_HOST', 'localhost'),
        port: parseInt(config.get('REDIS_PORT', '6379'), 10),
        password: config.get('REDIS_PASSWORD'),
        maxRetriesPerRequest: null,
      },
    }),
  }),
  PrismaModule,
  SupabaseModule,
  AuthModule,
  UsersModule,
  MembersModule,
  KycModule,
  CashierModule,
  ReceiptsModule,
  MonthlyChargesModule,
];

// Only enable rate limiting in non-test environments
if (process.env.NODE_ENV !== 'test') {
  imports.splice(1, 0, ThrottlerModule.forRootAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (config: ConfigService) => [{
      ttl: parseInt(config.get('THROTTLE_TTL') || '60', 10) * 1000, // milliseconds
      limit: parseInt(config.get('THROTTLE_LIMIT') || '10', 10),
    }],
  }));
}

// Build module providers conditionally based on environment
const providers: Provider[] = [AppService];

// Only enable rate limiting guard in non-test environments
if (process.env.NODE_ENV !== 'test') {
  providers.push({
    provide: APP_GUARD,
    useClass: ThrottlerGuard,
  });
}

@Module({
  imports,
  controllers: [AppController],
  providers,
})
export class AppModule {}
