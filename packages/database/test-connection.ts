import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from root .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { db } from './src/client';
import { TestCaseRepository } from './src/repositories/testCase.repository';
import { TestRunRepository } from './src/repositories/testRun.repository';
import { TestStepRepository } from './src/repositories/testStep.repository';

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  
  try {
    // Test basic connection
    const isHealthy = await db.healthCheck();
    console.log('✅ Database connection:', isHealthy ? 'Healthy' : 'Failed');
    
    if (!isHealthy) {
      throw new Error('Database connection failed');
    }
    
    // Test repositories
    const testCaseRepo = new TestCaseRepository(db);
    const testRunRepo = new TestRunRepository(db);
    const testStepRepo = new TestStepRepository(db);
    
    // Create a test case
    console.log('\n📝 Creating test case...');
    const testCase = await testCaseRepo.create({
      name: 'Test Database Connection',
      url: 'https://example.com',
      original_scenario: 'Navigate to example.com and verify page loads',
      tags: ['test', 'connection'],
    });
    console.log('✅ Test case created:', testCase.id);
    
    // Create a test run
    console.log('\n🏃 Creating test run...');
    const testRun = await testRunRepo.create({
      test_case_id: testCase.id,
      status: 'running',
      started_at: new Date().toISOString(),
    });
    console.log('✅ Test run created:', testRun.id);
    
    // Create a test step
    console.log('\n👟 Creating test step...');
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
    console.log('✅ Test step created:', testStep.id);
    
    // Update test run
    console.log('\n📊 Updating test run...');
    await testRunRepo.update(testRun.id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      total_steps: 1,
      completed_steps: 1,
    });
    console.log('✅ Test run updated');
    
    // Fetch test case with runs
    console.log('\n🔍 Fetching test case with runs...');
    const testCaseWithRuns = await testCaseRepo.findByIdWithRuns(testCase.id);
    console.log('✅ Test case fetched:');
    console.log('  - Name:', testCaseWithRuns?.name);
    console.log('  - Runs:', testCaseWithRuns?.test_runs?.length);
    
    // Clean up
    console.log('\n🧹 Cleaning up test data...');
    await testCaseRepo.delete(testCase.id);
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎉 All tests passed! Database connection and repositories are working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testDatabaseConnection();