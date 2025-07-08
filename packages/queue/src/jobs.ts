/**
 * Job Processors and Utilities
 */

import type { Job } from 'bullmq';
import type { TestJobData, TestJobResult, JobProgress } from './types';

/**
 * Abstract base class for job processors
 */
export abstract class BaseJobProcessor {
  abstract process(job: Job<TestJobData, TestJobResult>): Promise<TestJobResult>;

  protected async updateProgress(
    job: Job<TestJobData, TestJobResult>,
    progress: JobProgress
  ): Promise<void> {
    await job.updateProgress(progress);
  }

  protected handleError(error: Error, context: string): TestJobResult {
    console.error(`Error in ${context}:`, error);
    
    return {
      testRunId: '',
      status: 'failed',
      totalSteps: 0,
      completedSteps: 0,
      failedSteps: 0,
      adaptedSteps: 0,
      duration: 0,
      error: error.message,
    };
  }
}

/**
 * Test execution job processor
 */
export class TestExecutionProcessor extends BaseJobProcessor {
  async process(job: Job<TestJobData, TestJobResult>): Promise<TestJobResult> {
    const { testCaseId, testRunId, config } = job.data;
    
    try {
      console.log(`🏃 Starting test execution for case ${testCaseId}, run ${testRunId}`);
      
      // Update initial progress
      await this.updateProgress(job, {
        testRunId,
        currentStep: 0,
        totalSteps: 0,
        percentage: 0,
        message: 'Initializing test execution...',
      });

      // TODO: Implement actual test execution logic
      // This will involve:
      // 1. Loading test case from database
      // 2. Starting Playwright browser
      // 3. Executing test steps with adaptation
      // 4. Updating progress throughout
      // 5. Saving results to database

      // Placeholder implementation
      const result: TestJobResult = {
        testRunId,
        status: 'completed',
        totalSteps: 1,
        completedSteps: 1,
        failedSteps: 0,
        adaptedSteps: 0,
        duration: 1000,
      };

      console.log(`✅ Test execution completed for run ${testRunId}`);
      return result;
      
    } catch (error) {
      return this.handleError(error as Error, `test execution ${testRunId}`);
    }
  }
}

/**
 * Cleanup job processor for removing old data
 */
export class CleanupJobProcessor extends BaseJobProcessor {
  async process(job: Job<TestJobData, TestJobResult>): Promise<TestJobResult> {
    try {
      console.log('🧹 Starting cleanup job');
      
      // TODO: Implement cleanup logic
      // This will involve:
      // 1. Cleaning old test runs
      // 2. Cleaning old storage files
      // 3. Cleaning old container allocations
      // 4. Cleaning old analysis data

      const result: TestJobResult = {
        testRunId: 'cleanup',
        status: 'completed',
        totalSteps: 1,
        completedSteps: 1,
        failedSteps: 0,
        adaptedSteps: 0,
        duration: 500,
      };

      console.log('✅ Cleanup job completed');
      return result;
      
    } catch (error) {
      return this.handleError(error as Error, 'cleanup job');
    }
  }
}

/**
 * Adaptation learning job processor
 */
export class AdaptationLearningProcessor extends BaseJobProcessor {
  async process(job: Job<TestJobData, TestJobResult>): Promise<TestJobResult> {
    const { testCaseId } = job.data;
    
    try {
      console.log(`🧠 Starting adaptation learning for case ${testCaseId}`);
      
      // TODO: Implement adaptation learning logic
      // This will involve:
      // 1. Analyzing recent test runs for patterns
      // 2. Identifying successful adaptations
      // 3. Updating test case adaptation patterns
      // 4. Training/updating adaptation models

      const result: TestJobResult = {
        testRunId: 'learning',
        status: 'completed',
        totalSteps: 1,
        completedSteps: 1,
        failedSteps: 0,
        adaptedSteps: 0,
        duration: 2000,
      };

      console.log(`✅ Adaptation learning completed for case ${testCaseId}`);
      return result;
      
    } catch (error) {
      return this.handleError(error as Error, `adaptation learning ${testCaseId}`);
    }
  }
}

/**
 * Job factory for creating appropriate processors
 */
export class JobProcessorFactory {
  static createProcessor(jobType: string): BaseJobProcessor {
    switch (jobType) {
      case 'execute-test':
        return new TestExecutionProcessor();
      case 'cleanup':
        return new CleanupJobProcessor();
      case 'adaptation-learning':
        return new AdaptationLearningProcessor();
      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }
  }
}

/**
 * Utility functions for job management
 */
export class JobUtils {
  /**
   * Create a unique job ID
   */
  static createJobId(testCaseId: string, timestamp?: Date): string {
    const ts = timestamp || new Date();
    return `${testCaseId}-${ts.getTime()}`;
  }

  /**
   * Calculate job priority based on various factors
   */
  static calculatePriority(
    isUrgent = false,
    userPriority = 5,
    queueLength = 0
  ): number {
    let priority = userPriority;
    
    if (isUrgent) {
      priority += 10;
    }
    
    // Increase priority if queue is long
    if (queueLength > 50) {
      priority = Math.max(1, priority - 2);
    }
    
    return Math.max(1, Math.min(20, priority));
  }

  /**
   * Estimate job duration based on test case complexity
   */
  static estimateJobDuration(stepCount: number): number {
    // Base time: 30 seconds + 5 seconds per step
    return 30000 + (stepCount * 5000);
  }
}