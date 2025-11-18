import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { TellerController } from './teller.controller';
import { TellerService } from './teller.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [TellerController],
  providers: [TellerService],
})
export class TellerModule {}
