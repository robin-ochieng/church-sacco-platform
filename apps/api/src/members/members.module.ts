import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { EncryptionService } from './encryption.service';
import { MemberNumberGenerator } from './member-number.generator';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  imports: [PrismaModule, SupabaseModule],
  controllers: [MembersController],
  providers: [MembersService, MemberNumberGenerator, EncryptionService],
  exports: [MembersService],
})
export class MembersModule {}
