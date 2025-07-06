/**
 * Type definitions for Worker process
 */

export interface TestJob {
  id: string;
  testRunId: string;
  testCaseId: string;
  priority: number;
  createdAt: Date;
}

export interface TestCase {
  id: string;
  name: string;
  url: string;
  originalScenario: string;
  refinedScenario?: string;
  testSteps?: TestStep[];
}

export interface TestStep {
  id: string;
  stepNumber: number;
  action: string;
  selector?: string;
  value?: string;
  expectedResult?: string;
}

export interface TestRun {
  id: string;
  testCaseId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
}

export interface TestProgressEvent {
  type: 'step_start' | 'step_complete' | 'step_error' | 'test_complete';
  stepId: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  message?: string;
  snapshot?: string;
  timestamp: Date;
}