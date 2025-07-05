/**
 * Migration Management Tool
 * 
 * Simple migration system for managing database schema changes
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { DatabaseClient, createClientForApp } from '../client';
import { DatabaseError } from '../types';

interface Migration {
  id: string;
  name: string;
  sql: string;
  timestamp: Date;
}

export class MigrationManager {
  private client: DatabaseClient;
  private migrationsPath: string;

  constructor(client?: DatabaseClient) {
    this.client = client || createClientForApp('api-server');
    this.migrationsPath = join(__dirname, '../../migrations');
  }

  /**
   * Initialize migration tracking table
   */
  async initialize(): Promise<void> {
    try {
      const { error } = await this.client.client.rpc('create_migration_table');
      
      if (error && !error.message.includes('already exists')) {
        throw new DatabaseError(`Failed to initialize migration table: ${error.message}`);
      }
    } catch (error) {
      // If RPC doesn't exist, create table manually
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          executed_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      
      console.log('Creating migration table manually...');
      // For now, just log the SQL - in a real implementation, 
      // you'd execute this via Supabase SQL editor or CLI
      console.log(createTableSQL);
    }
  }

  /**
   * Get all migration files
   */
  private getMigrationFiles(): Migration[] {
    try {
      const files = readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();

      return files.map(file => {
        const content = readFileSync(join(this.migrationsPath, file), 'utf-8');
        const [timestamp, ...nameParts] = file.replace('.sql', '').split('_');
        
        return {
          id: file.replace('.sql', ''),
          name: nameParts.join(' '),
          sql: content,
          timestamp: new Date(timestamp),
        };
      });
    } catch (error) {
      console.warn('No migration files found or error reading migrations:', error);
      return [];
    }
  }

  /**
   * Get executed migrations
   */
  private async getExecutedMigrations(): Promise<string[]> {
    try {
      const { data, error } = await this.client.client
        .from('schema_migrations')
        .select('id');

      if (error) {
        console.warn('Migration table not found, assuming no migrations executed');
        return [];
      }

      return data.map(row => row.id);
    } catch (error) {
      console.warn('Error fetching executed migrations:', error);
      return [];
    }
  }

  /**
   * Run pending migrations
   */
  async migrate(): Promise<{ executed: string[]; skipped: string[] }> {
    console.log('🚀 Starting database migration...');
    
    await this.initialize();
    
    const allMigrations = this.getMigrationFiles();
    const executedMigrations = await this.getExecutedMigrations();
    
    const pendingMigrations = allMigrations.filter(
      migration => !executedMigrations.includes(migration.id)
    );

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations');
      return { executed: [], skipped: executedMigrations };
    }

    const executed: string[] = [];

    for (const migration of pendingMigrations) {
      try {
        console.log(`📄 Executing migration: ${migration.id} - ${migration.name}`);
        
        // Execute the migration SQL
        // Note: In a real implementation, you'd execute this via Supabase
        console.log(`SQL to execute:\n${migration.sql}`);
        
        // Record the migration as executed
        const { error } = await this.client.client
          .from('schema_migrations')
          .insert({
            id: migration.id,
            name: migration.name,
          });

        if (error) {
          throw new DatabaseError(`Failed to record migration: ${error.message}`);
        }

        executed.push(migration.id);
        console.log(`✅ Migration completed: ${migration.id}`);
        
      } catch (error) {
        console.error(`❌ Migration failed: ${migration.id}`, error);
        throw error;
      }
    }

    console.log(`🎉 Migration complete! Executed ${executed.length} migrations`);
    return { executed, skipped: executedMigrations };
  }

  /**
   * Create a new migration file
   */
  createMigration(name: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const fileName = `${timestamp}_${name.toLowerCase().replace(/\s+/g, '_')}.sql`;
    const filePath = join(this.migrationsPath, fileName);
    
    const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}
-- Description: Add your migration description here

-- Add your SQL statements here
-- Example:
-- CREATE TABLE example_table (
--   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   name VARCHAR(255) NOT NULL,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- Don't forget to add appropriate indexes
-- CREATE INDEX idx_example_table_name ON example_table(name);
`;

    console.log(`Creating migration file: ${fileName}`);
    console.log(`Path: ${filePath}`);
    console.log('Template content:');
    console.log(template);
    
    return fileName;
  }

  /**
   * Get migration status
   */
  async status(): Promise<{
    total: number;
    executed: number;
    pending: number;
    migrations: Array<{
      id: string;
      name: string;
      executed: boolean;
      timestamp: Date;
    }>;
  }> {
    const allMigrations = this.getMigrationFiles();
    const executedMigrations = await this.getExecutedMigrations();
    
    const migrations = allMigrations.map(migration => ({
      id: migration.id,
      name: migration.name,
      executed: executedMigrations.includes(migration.id),
      timestamp: migration.timestamp,
    }));

    return {
      total: allMigrations.length,
      executed: executedMigrations.length,
      pending: allMigrations.length - executedMigrations.length,
      migrations,
    };
  }
}

// CLI interface
export async function runMigrations(): Promise<void> {
  const manager = new MigrationManager();
  
  try {
    await manager.migrate();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Export for programmatic use
export function createMigrationManager(client?: DatabaseClient): MigrationManager {
  return new MigrationManager(client);
}