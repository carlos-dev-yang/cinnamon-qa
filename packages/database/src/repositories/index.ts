/**
 * Enhanced Repository exports for Adaptive Testing
 * 
 * Centralized exports for all repository classes
 */

export { BaseRepository } from './base.repository';
export { TestCaseRepository } from './testCase.repository';
export { TestRunRepository } from './testRun.repository';
export { TestStepRepository } from './testStep.repository';
export { StorageReferenceRepository } from './storageReference.repository';
export { ContainerAllocationRepository } from './containerAllocation.repository';
export { AIAnalysisRepository } from './aiAnalysis.repository';
export { TestExecutionEventsRepository } from './testExecutionEvents.repository';

import { TestCaseRepository } from './testCase.repository';
import { TestRunRepository } from './testRun.repository';
import { TestStepRepository } from './testStep.repository';
import { StorageReferenceRepository } from './storageReference.repository';
import { ContainerAllocationRepository } from './containerAllocation.repository';
import { AIAnalysisRepository } from './aiAnalysis.repository';
import { TestExecutionEventsRepository } from './testExecutionEvents.repository';

// Repository instances for immediate use
export const repositories = {
  testCase: new TestCaseRepository(),
  testRun: new TestRunRepository(),
  testStep: new TestStepRepository(),
  storageReference: new StorageReferenceRepository(),
  containerAllocation: new ContainerAllocationRepository(),
  aiAnalysis: new AIAnalysisRepository(),
  testExecutionEvents: new TestExecutionEventsRepository(),
};

// Factory function to create repositories with custom database client
export function createRepositories(client?: any) {
  return {
    testCase: new TestCaseRepository(client),
    testRun: new TestRunRepository(client),
    testStep: new TestStepRepository(client),
    storageReference: new StorageReferenceRepository(client),
    containerAllocation: new ContainerAllocationRepository(client),
    aiAnalysis: new AIAnalysisRepository(client),
    testExecutionEvents: new TestExecutionEventsRepository(client),
  };
}