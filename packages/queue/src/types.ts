/**
 * Type definitions for queue operations
 */

// Test execution job data
export interface TestJobData {
  testCaseId: string;
  testRunId: string;
  userId?: string;
  config?: {
    timeout?: number;
    headless?: boolean;
    viewport?: {
      width: number;
      height: number;
    };
    adaptiveMode?: boolean;
    maxAdaptations?: number;
  };
}

// Job result data
export interface TestJobResult {
  testRunId: string;
  status: 'completed' | 'failed' | 'adapted';
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  adaptedSteps: number;
  duration: number;
  error?: string;
  adaptations?: Array<{
    stepNumber: number;
    adaptationType: string;
    reason: string;
    successful: boolean;
  }>;
}

// Queue names
export enum QueueNames {
  TEST_EXECUTION = 'test-execution',
  CLEANUP = 'cleanup',
  ADAPTATION_LEARNING = 'adaptation-learning'
}

// Job priorities
export enum JobPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
  URGENT = 20
}

// Redis connection configuration
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
  lazyConnect?: boolean;
}

// Queue configuration
export interface QueueConfig {
  redis: RedisConfig;
  defaultJobOptions?: {
    removeOnComplete?: number;
    removeOnFail?: number;
    attempts?: number;
    backoff?: {
      type: 'fixed' | 'exponential';
      delay: number;
    };
  };
}

// Progress update data
export interface JobProgress {
  testRunId: string;
  currentStep: number;
  totalSteps: number;
  percentage: number;
  message?: string;
  stepData?: {
    action: string;
    status: 'running' | 'completed' | 'failed' | 'adapted';
    duration?: number;
    error?: string;
  };
}