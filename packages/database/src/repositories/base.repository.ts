/**
 * Base Repository
 * 
 * Provides common database operations that can be inherited by specific repositories.
 * This abstraction helps maintain consistency and provides a foundation for
 * database-agnostic operations.
 */

import { DatabaseClient, db } from '../client';
import { DatabaseError, NotFoundError } from '../types';

export abstract class BaseRepository<T, TInsert, TUpdate> {
  protected client: DatabaseClient;
  protected abstract tableName: string;

  constructor(client: DatabaseClient = db) {
    this.client = client;
  }

  /**
   * Find a record by ID
   */
  async findById(id: string): Promise<T | null> {
    try {
      const { data, error } = await this.client.client
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No row found
        }
        throw new DatabaseError(`Failed to find ${this.tableName} by id: ${error.message}`, error.code);
      }

      return data as T;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error finding ${this.tableName}: ${error}`);
    }
  }

  /**
   * Find a record by ID, throw error if not found
   */
  async findByIdOrThrow(id: string): Promise<T> {
    const record = await this.findById(id);
    if (!record) {
      throw new NotFoundError(this.tableName, id);
    }
    return record;
  }

  /**
   * Find all records with optional pagination
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    ascending?: boolean;
  }): Promise<T[]> {
    try {
      let query = this.client.client.from(this.tableName).select('*');

      if (options?.orderBy) {
        query = query.order(options.orderBy, { ascending: options.ascending ?? true });
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
      }

      const { data, error } = await query;

      if (error) {
        throw new DatabaseError(`Failed to find all ${this.tableName}: ${error.message}`, error.code);
      }

      return data as T[];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error finding all ${this.tableName}: ${error}`);
    }
  }

  /**
   * Create a new record
   */
  async create(data: TInsert): Promise<T> {
    try {
      const { data: record, error } = await this.client.client
        .from(this.tableName)
        .insert(data)
        .select()
        .single();

      if (error) {
        throw new DatabaseError(`Failed to create ${this.tableName}: ${error.message}`, error.code);
      }

      return record as T;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error creating ${this.tableName}: ${error}`);
    }
  }

  /**
   * Update a record by ID
   */
  async updateById(id: string, data: TUpdate): Promise<T> {
    try {
      const { data: record, error } = await this.client.client
        .from(this.tableName)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError(this.tableName, id);
        }
        throw new DatabaseError(`Failed to update ${this.tableName}: ${error.message}`, error.code);
      }

      return record as T;
    } catch (error) {
      if (error instanceof DatabaseError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error updating ${this.tableName}: ${error}`);
    }
  }

  /**
   * Delete a record by ID
   */
  async deleteById(id: string): Promise<void> {
    try {
      const { error } = await this.client.client
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) {
        throw new DatabaseError(`Failed to delete ${this.tableName}: ${error.message}`, error.code);
      }
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error deleting ${this.tableName}: ${error}`);
    }
  }

  /**
   * Count total records
   */
  async count(filters?: Record<string, any>): Promise<number> {
    try {
      let query = this.client.client
        .from(this.tableName)
        .select('*', { count: 'exact', head: true });

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      const { count, error } = await query;

      if (error) {
        throw new DatabaseError(`Failed to count ${this.tableName}: ${error.message}`, error.code);
      }

      return count || 0;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error counting ${this.tableName}: ${error}`);
    }
  }

  /**
   * Check if a record exists by ID
   */
  async exists(id: string): Promise<boolean> {
    const record = await this.findById(id);
    return record !== null;
  }
}