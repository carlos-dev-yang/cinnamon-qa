/**
 * Storage Reference Repository
 * 
 * Handles all database operations related to storage references
 */

import { BaseRepository } from './base.repository';
import type { StorageReference, StorageReferenceInsert, StorageReferenceUpdate } from '../types';
import { DatabaseError } from '../types';

export class StorageReferenceRepository extends BaseRepository<StorageReference, StorageReferenceInsert, StorageReferenceUpdate> {
  protected tableName = 'storage_references';

  /**
   * Find storage references by test run ID
   */
  async findByTestRunId(testRunId: string): Promise<StorageReference[]> {
    try {
      const { data, error } = await this.client.client
        .from(this.tableName)
        .select('*')
        .eq('test_run_id', testRunId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new DatabaseError(`Failed to find storage references by test run: ${error.message}`, error.code);
      }

      return data as StorageReference[];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error finding storage references by test run: ${error}`);
    }
  }

  /**
   * Find storage references by test step ID
   */
  async findByTestStepId(testStepId: string): Promise<StorageReference[]> {
    try {
      const { data, error } = await this.client.client
        .from(this.tableName)
        .select('*')
        .eq('test_step_id', testStepId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new DatabaseError(`Failed to find storage references by test step: ${error.message}`, error.code);
      }

      return data as StorageReference[];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error finding storage references by test step: ${error}`);
    }
  }

  /**
   * Find storage references by file type
   */
  async findByFileType(fileType: string, limit?: number): Promise<StorageReference[]> {
    try {
      let query = this.client.client
        .from(this.tableName)
        .select('*')
        .eq('file_type', fileType)
        .order('created_at', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        throw new DatabaseError(`Failed to find storage references by file type: ${error.message}`, error.code);
      }

      return data as StorageReference[];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error finding storage references by file type: ${error}`);
    }
  }

  /**
   * Find expired storage references
   */
  async findExpired(): Promise<StorageReference[]> {
    try {
      const { data, error } = await this.client.client
        .from(this.tableName)
        .select('*')
        .lt('expires_at', new Date().toISOString())
        .eq('is_archived', false)
        .order('expires_at', { ascending: true });

      if (error) {
        throw new DatabaseError(`Failed to find expired storage references: ${error.message}`, error.code);
      }

      return data as StorageReference[];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error finding expired storage references: ${error}`);
    }
  }

  /**
   * Archive a storage reference
   */
  async archive(id: string): Promise<StorageReference> {
    return await this.updateById(id, {
      is_archived: true,
      archived_at: new Date().toISOString(),
    } as StorageReferenceUpdate);
  }

  /**
   * Archive multiple storage references
   */
  async archiveBatch(ids: string[]): Promise<void> {
    try {
      const { error } = await this.client.client
        .from(this.tableName)
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
        })
        .in('id', ids);

      if (error) {
        throw new DatabaseError(`Failed to archive storage references: ${error.message}`, error.code);
      }
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error archiving storage references: ${error}`);
    }
  }

  /**
   * Update access time and increment access count
   */
  async recordAccess(id: string): Promise<StorageReference> {
    try {
      // Get current access count
      const current = await this.findByIdOrThrow(id);
      
      return await this.updateById(id, {
        last_accessed_at: new Date().toISOString(),
        access_count: current.access_count + 1,
      } as StorageReferenceUpdate);
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error recording access: ${error}`);
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStatistics(): Promise<{
    totalFiles: number;
    totalSize: number;
    archivedFiles: number;
    archivedSize: number;
    byFileType: Record<string, { count: number; size: number }>;
    expiredFiles: number;
  }> {
    try {
      const { data, error } = await this.client.client
        .from(this.tableName)
        .select('*');

      if (error) {
        throw new DatabaseError(`Failed to get storage statistics: ${error.message}`, error.code);
      }

      const files = data as StorageReference[];
      const now = new Date().toISOString();
      
      const totalFiles = files.length;
      const totalSize = files.reduce((sum, f) => sum + (f.file_size_bytes || 0), 0);
      
      const archivedFiles = files.filter(f => f.is_archived).length;
      const archivedSize = files
        .filter(f => f.is_archived)
        .reduce((sum, f) => sum + (f.file_size_bytes || 0), 0);

      const expiredFiles = files.filter(f => 
        f.expires_at && f.expires_at < now && !f.is_archived
      ).length;

      const byFileType: Record<string, { count: number; size: number }> = {};
      files.forEach(f => {
        if (!byFileType[f.file_type]) {
          byFileType[f.file_type] = { count: 0, size: 0 };
        }
        byFileType[f.file_type].count++;
        byFileType[f.file_type].size += f.file_size_bytes || 0;
      });

      return {
        totalFiles,
        totalSize,
        archivedFiles,
        archivedSize,
        byFileType,
        expiredFiles,
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error getting storage statistics: ${error}`);
    }
  }

  /**
   * Find storage references that haven't been accessed recently
   */
  async findUnused(daysThreshold: number = 30): Promise<StorageReference[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

      const { data, error } = await this.client.client
        .from(this.tableName)
        .select('*')
        .lt('last_accessed_at', cutoffDate.toISOString())
        .eq('is_archived', false)
        .order('last_accessed_at', { ascending: true });

      if (error) {
        throw new DatabaseError(`Failed to find unused storage references: ${error.message}`, error.code);
      }

      return data as StorageReference[];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error finding unused storage references: ${error}`);
    }
  }

  /**
   * Create storage reference for uploaded file
   */
  async createForUpload(data: {
    bucket_name: string;
    file_path: string;
    file_type: string;
    file_size_bytes?: number;
    mime_type?: string;
    test_run_id?: string;
    test_step_id?: string;
    metadata?: Record<string, any>;
  }): Promise<StorageReference> {
    const insertData: StorageReferenceInsert = {
      ...data,
      created_at: new Date().toISOString(),
      last_accessed_at: new Date().toISOString(),
      access_count: 0,
    };

    return await this.create(insertData);
  }

  /**
   * Find orphaned storage references (referenced files that don't exist)
   */
  async findOrphaned(): Promise<StorageReference[]> {
    // This would require checking against actual Supabase Storage
    // For now, we'll return references that are very old and never accessed
    return await this.findUnused(90); // Files not accessed in 90 days
  }

  /**
   * Clean up expired and archived storage references
   */
  async cleanup(olderThanDays: number = 7): Promise<{
    deletedCount: number;
    deletedIds: string[];
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // Find archived storage references older than cutoff
      const { data: toDelete, error: findError } = await this.client.client
        .from(this.tableName)
        .select('id')
        .eq('is_archived', true)
        .lt('archived_at', cutoffDate.toISOString());

      if (findError) {
        throw new DatabaseError(`Failed to find storage references for cleanup: ${findError.message}`, findError.code);
      }

      if (!toDelete || toDelete.length === 0) {
        return { deletedCount: 0, deletedIds: [] };
      }

      const idsToDelete = toDelete.map(ref => ref.id);

      // Delete the references
      const { error: deleteError } = await this.client.client
        .from(this.tableName)
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        throw new DatabaseError(`Failed to delete storage references: ${deleteError.message}`, deleteError.code);
      }

      return {
        deletedCount: idsToDelete.length,
        deletedIds: idsToDelete,
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error during storage cleanup: ${error}`);
    }
  }
}