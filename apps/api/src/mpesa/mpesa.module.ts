import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MpesaController } from './mpesa.controller';
import { MpesaService } from './mpesa.service';

@Module({
  imports: [PrismaModule],
  controllers: [MpesaController],
  providers: [MpesaService],
  exports: [MpesaService],
})
export class MpesaModule {}
