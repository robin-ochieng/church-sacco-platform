import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Pool, PoolClient, QueryResultRow } from 'pg';

@Injectable()
export class SupabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase!: SupabaseClient;
  private supabaseAdmin!: SupabaseClient;
  private pool?: Pool;
  private piiEncryptionKey?: string;

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

    this.piiEncryptionKey = this.configService.get<string>('PII_ENCRYPTION_KEY');
    if (!this.piiEncryptionKey) {
      this.logger.warn(
        'PII_ENCRYPTION_KEY is not set. Encrypted member fields will remain inaccessible.'
      );
    }

    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    if (databaseUrl) {
      this.pool = new Pool({ connectionString: databaseUrl });
    } else {
      this.logger.warn(
        'DATABASE_URL is not set. Direct PostgreSQL access for encrypted data will be unavailable.'
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

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  /**
   * Run a callback with a dedicated PostgreSQL connection that has the PII key set for the session.
   * Use this helper whenever you need to read or write encrypted columns directly via SQL.
   */
  async withPIISession<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('DATABASE_URL must be defined to access encrypted data.');
    }
    if (!this.piiEncryptionKey) {
      throw new Error('PII_ENCRYPTION_KEY is not configured.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('SET app.pii_key = $1', [this.piiEncryptionKey]);
      return await callback(client);
    } finally {
      if (this.piiEncryptionKey) {
        await client.query('RESET app.pii_key');
      }
      client.release();
    }
  }

  /**
   * Convenience wrapper for common "SELECT" queries that require decrypted fields.
   */
  async queryWithPII<T extends QueryResultRow = QueryResultRow>(
    query: string,
    params: unknown[] = []
  ): Promise<T[]> {
    return this.withPIISession(async (client) => {
      const { rows } = await client.query<T>(query, params);
      return rows;
    });
  }
}
