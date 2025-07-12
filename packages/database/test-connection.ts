import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from root .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { createLogger } from '@cinnamon-qa/logger';
import { db } from './src/client';
import { TestCaseRepository } from './src/repositories/testCase.repository';
import { TestRunRepository } from './src/repositories/testRun.repository';
import { TestStepRepository } from './src/repositories/testStep.repository';

const logger = createLogger({ context: 'DatabaseTest' });

async function testDatabaseConnection() {
  logger.info('Testing database connection...');
  
  try {
    // Test basic connection
    const isHealthy = await db.healthCheck();
    logger.info('Database connection status', { healthy: isHealthy });
    
    if (!isHealthy) {
      throw new Error('Database connection failed');
    }
    
    // Test repositories
    const testCaseRepo = new TestCaseRepository(db);
    const testRunRepo = new TestRunRepository(db);
    const testStepRepo = new TestStepRepository(db);
    
    // Create a test case
    logger.info('Creating test case...');
    const testCase = await testCaseRepo.create({
      name: 'Test Database Connection',
      url: 'https://example.com',
      original_scenario: 'Navigate to example.com and verify page loads',
      tags: ['test', 'connection'],
    });
    logger.info('Test case created', { id: testCase.id });
    
    // Create a test run
    logger.info('Creating test run...');
    const testRun = await testRunRepo.create({
      test_case_id: testCase.id,
      status: 'running',
      started_at: new Date().toISOString(),
    });
    logger.info('Test run created', { id: testRun.id });
    
    // Create a test step
    logger.info('Creating test step...');
    const testStep = await testStepRepo.create({
      test_run_id: testRun.id,
      step_number: 1,
      action: 'navigate',
      target: { url: 'https://example.com' },
      status: 'success',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: 1500,
    });
    logger.info('Test step created', { id: testStep.id });
    
    // Update test run
    logger.info('Updating test run...');
    await testRunRepo.update(testRun.id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      total_steps: 1,
      completed_steps: 1,
    });
    logger.info('Test run updated successfully');
    
    // Fetch test case with runs
    logger.info('Fetching test case with runs...');
    const testCaseWithRuns = await testCaseRepo.findByIdWithRuns(testCase.id);
    logger.info('Test case fetched', { name: testCaseWithRuns?.name, runsCount: testCaseWithRuns?.test_runs?.length });
    
    // Clean up
    logger.info('Cleaning up test data...');
    await testCaseRepo.delete(testCase.id);
    logger.info('Test data cleaned up successfully');
    
    logger.info('All tests passed! Database connection and repositories are working correctly.');
    
  } catch (error) {
    logger.error('Test failed', { error });
    process.exit(1);
  }
}

// Run the test
testDatabaseConnection();