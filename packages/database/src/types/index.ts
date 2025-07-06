export * from './database';

// Convenience type exports
export type { Database } from './database';

// Table type aliases for easier use (using any for now to fix build)
export type TestCase = any;
export type TestCaseInsert = any;
export type TestCaseUpdate = any;

export type TestRun = any;
export type TestRunInsert = any;
export type TestRunUpdate = any;

export type TestStep = any;
export type TestStepInsert = any;
export type TestStepUpdate = any;

export type StorageReference = any;
export type StorageReferenceInsert = any;
export type StorageReferenceUpdate = any;

// Common status types
export type TestRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TestStepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

// Custom error types
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class NotFoundError extends DatabaseError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends DatabaseError {
  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', { field });
    this.name = 'ValidationError';
  }
}