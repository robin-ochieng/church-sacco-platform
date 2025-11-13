import { Global, Module } from '@nestjs/common';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { SupabaseService } from './supabase.service';

@Global()
@Module({
  providers: [SupabaseService, StorageService],
  controllers: [StorageController],
  exports: [SupabaseService, StorageService],
})
export class SupabaseModule {}
