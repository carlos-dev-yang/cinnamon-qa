/**
 * Database Client Abstraction
 * 
 * This module provides an abstraction layer over Supabase client.
 * In the future, this can be easily replaced with other database clients
 * (Prisma, Drizzle, etc.) without changing the application code.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types/database';
import { DatabaseError } from './types';

export interface DatabaseConfig {
  url: string;
  key: string;
  options?: {
    auth?: {
      autoRefreshToken?: boolean;
      persistSession?: boolean;
    };
    global?: {
      headers?: Record<string, string>;
    };
  };
}

export class DatabaseClient {
  private _client: SupabaseClient<Database>;
  private _config: DatabaseConfig;

  constructor(config?: DatabaseConfig) {
    this._config = config || this.getDefaultConfig();
    this._client = createClient<Database>(
      this._config.url,
      this._config.key,
      this._config.options
    );
  }

  private getDefaultConfig(): DatabaseConfig {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new DatabaseError(
        'Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.'
      );
    }

    return {
      url,
      key,
      options: {
        auth: {
          autoRefreshToken: true,
          persistSession: false, // Server-side usage
        },
      },
    };
  }

  /**
   * Get the underlying Supabase client
   * Use this when you need direct access to Supabase features
   */
  get client(): SupabaseClient<Database> {
    return this._client;
  }

  /**
   * Get storage client for file operations
   */
  get storage() {
    return this._client.storage;
  }

  /**
   * Test database connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this._client
        .from('test_cases')
        .select('id')
        .limit(1);
      
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Execute a raw SQL query (use with caution)
   */
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    try {
      const { data, error } = await this._client.rpc('execute_sql', {
        query: sql,
        params: params || [],
      });

      if (error) {
        throw new DatabaseError(`SQL query failed: ${error.message}`, error.code);
      }

      return data;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error executing query: ${error}`);
    }
  }

  /**
   * Begin a transaction (Note: Supabase doesn't support transactions natively)
   * This is a placeholder for future database migration
   */
  async transaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T> {
    // For now, just execute the callback
    // In the future, this could be implemented with a proper transaction-supporting database
    console.warn('Transactions are not supported with Supabase. Operations will be executed sequentially.');
    return callback(this);
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    // Supabase doesn't require explicit connection closing
    // This is here for future database compatibility
    return Promise.resolve();
  }
}

// Default database instance
export const db = new DatabaseClient();

// Factory function for creating custom database clients
export function createDatabaseClient(config: DatabaseConfig): DatabaseClient {
  return new DatabaseClient(config);
}

// Export client for apps that need different configurations
export function createClientForApp(appName: 'api-server' | 'worker'): DatabaseClient {
  const baseConfig = {
    url: process.env.SUPABASE_URL!,
    key: process.env.SUPABASE_ANON_KEY!,
  };

  // Different configurations per app if needed
  switch (appName) {
    case 'worker':
      return new DatabaseClient({
        ...baseConfig,
        key: process.env.SUPABASE_SERVICE_ROLE_KEY || baseConfig.key,
        options: {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      });
    case 'api-server':
    default:
      return new DatabaseClient(baseConfig);
  }
}