/**
 * Repository Index
 * Export all repository classes for easy access
 */

export { TestCaseRepository } from './testCase.repository';
export { TestRunRepository } from './testRun.repository';
export { TestStepRepository } from './testStep.repository';

// Export as a convenience object
import { DatabaseClient, db } from '../client';
import { TestCaseRepository } from './testCase.repository';
import { TestRunRepository } from './testRun.repository';
import { TestStepRepository } from './testStep.repository';

export function createRepositories(client: DatabaseClient = db) {
  return {
    testCase: new TestCaseRepository(client),
    testRun: new TestRunRepository(client),
    testStep: new TestStepRepository(client),
  };
}

// Default repositories instance
export const repositories = createRepositories();