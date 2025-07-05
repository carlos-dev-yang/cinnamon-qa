/**
 * @cinnamon-qa/database
 * 
 * Database abstraction layer for Cinnamon QA
 * Provides repository pattern access to database operations
 */

// Client exports
export { DatabaseClient, db, createDatabaseClient, createClientForApp } from './client';

// Type exports
export * from './types';

// Repository exports
export * from './repositories';

// Version info
export const version = '1.0.0';