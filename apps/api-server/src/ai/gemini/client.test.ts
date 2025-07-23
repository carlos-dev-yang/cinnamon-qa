import { getGeminiClient } from '../index';
import { PromptCategory } from './types';
import { createLogger } from '@cinnamon-qa/logger';

const logger = createLogger({ context: 'GeminiClientTest' });

/**
 * Test Gemini client functionality
 * Run with: npx tsx src/ai/gemini/client.test.ts
 */
async function testGeminiClient() {
  logger.info('Starting Gemini client test...');

  const client = getGeminiClient();

  try {
    // Test 1: Initialize client
    logger.info('Test 1: Initializing client...');
    await client.initialize({
      // Override config if needed
      temperature: 0.3,
    });
    logger.info('✅ Client initialized successfully');

    // Test 2: Validate connection
    logger.info('Test 2: Validating connection...');
    const validation = await client.validateConnection();
    logger.info('✅ Connection validation:', validation);

    // Test 3: Generate simple text
    logger.info('Test 3: Generating simple text...');
    const response1 = await client.generateText({
      prompt: 'What is 2 + 2? Answer with just the number.',
      category: PromptCategory.SCENARIO_ANALYSIS,
    });
    logger.info('✅ Simple response:', response1.text.trim());

    // Test 4: Generate test scenario analysis
    logger.info('Test 4: Analyzing test scenario...');
    const response2 = await client.generateText({
      prompt: `
        Analyze this test scenario and break it down into steps:
        "User logs into the website with email and password, then navigates to profile settings"
        
        Provide a JSON array of steps with action and description.
      `,
      category: PromptCategory.SCENARIO_ANALYSIS,
      temperature: 0.1,
    });
    logger.info('✅ Scenario analysis:', response2.text);

    // Test 5: Get usage statistics
    logger.info('Test 5: Getting usage statistics...');
    const stats = client.getUsageStatistics();
    logger.info('✅ Usage statistics:', stats);

    // Test 6: Get prompt history
    logger.info('Test 6: Getting prompt history...');
    const history = client.getPromptHistory(5);
    logger.info(`✅ Recent prompts: ${history.length} entries`);

  } catch (error) {
    logger.error('❌ Test failed:', error);
    throw error;
  } finally {
    // Cleanup
    await client.cleanup();
    logger.info('Client cleaned up');
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testGeminiClient()
    .then(() => {
      logger.info('All tests passed! 🎉');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Tests failed:', error);
      process.exit(1);
    });
}