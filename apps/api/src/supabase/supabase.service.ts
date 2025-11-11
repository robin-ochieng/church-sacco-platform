import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private supabase!: SupabaseClient;
  private supabaseAdmin!: SupabaseClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');
    const supabaseServiceKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY'
    );

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_ANON_KEY must be defined in environment variables'
      );
    }

    // Client with anon key (respects RLS)
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Admin client with service role key (bypasses RLS)
    if (supabaseServiceKey) {
      this.supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
  }

  /**
   * Get Supabase client (respects Row Level Security)
   * Use this for user-specific operations
   */
  getClient(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Get Supabase admin client (bypasses Row Level Security)
   * Use this for administrative operations
   */
  getAdminClient(): SupabaseClient {
    if (!this.supabaseAdmin) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY must be defined to use admin client'
      );
    }
    return this.supabaseAdmin;
  }

  /**
   * Set auth token for user-specific operations
   */
  setAuthToken(token: string) {
    this.supabase.auth.setSession({
      access_token: token,
      refresh_token: '',
    });
  }
}
