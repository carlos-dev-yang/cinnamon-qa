/**
 * Repository exports
 * 
 * Centralized exports for all repository classes
 */

export { BaseRepository } from './base.repository';
export { TestCaseRepository } from './testCase.repository';
export { TestRunRepository } from './testRun.repository';
export { TestStepRepository } from './testStep.repository';
export { StorageReferenceRepository } from './storageReference.repository';

import { TestCaseRepository } from './testCase.repository';
import { TestRunRepository } from './testRun.repository';
import { TestStepRepository } from './testStep.repository';
import { StorageReferenceRepository } from './storageReference.repository';

// Repository instances for immediate use
export const repositories = {
  testCase: new TestCaseRepository(),
  testRun: new TestRunRepository(),
  testStep: new TestStepRepository(),
  storageReference: new StorageReferenceRepository(),
};

// Factory function to create repositories with custom database client
export function createRepositories(client?: any) {
  return {
    testCase: new TestCaseRepository(client),
    testRun: new TestRunRepository(client),
    testStep: new TestStepRepository(client),
    storageReference: new StorageReferenceRepository(client),
  };
}