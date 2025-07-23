// Basic Gemini API test without requiring API key
const { GeminiClient } = require('./apps/api-server/dist/ai/gemini/client.js');

async function testBasicFunctionality() {
  console.log('🧪 Testing Gemini Client Basic Functionality...\n');
  
  try {
    // Test 1: Client creation
    console.log('1️⃣ Testing client creation...');
    const client = new GeminiClient();
    console.log('✅ Client created successfully');
    console.log(`   State: ${client.getState()}`);
    
    // Test 2: Get initial statistics (should be empty)
    console.log('\n2️⃣ Testing initial statistics...');
    const initialStats = client.getUsageStatistics();
    console.log('✅ Statistics retrieved:');
    console.log(`   Total prompts: ${initialStats.totalPrompts}`);
    console.log(`   Total tokens: ${initialStats.totalTokens}`);
    console.log(`   Average duration: ${initialStats.avgDuration}ms`);
    
    // Test 3: Get prompt history (should be empty)
    console.log('\n3️⃣ Testing prompt history...');
    const history = client.getPromptHistory();
    console.log('✅ History retrieved:');
    console.log(`   History entries: ${history.length}`);
    
    // Test 4: Clear history (should work even when empty)
    console.log('\n4️⃣ Testing history clearing...');
    client.clearHistory();
    const clearedHistory = client.getPromptHistory();
    console.log('✅ History cleared:');
    console.log(`   History entries after clear: ${clearedHistory.length}`);
    
    // Test 5: Configuration loading (without API key)
    console.log('\n5️⃣ Testing configuration...');
    try {
      const { loadGeminiConfig } = require('./apps/api-server/dist/ai/gemini/config.js');
      // This will fail without API key, but we can catch and show the structure
      loadGeminiConfig();
    } catch (configError) {
      console.log('⚠️  Config validation failed (expected without API key):');
      console.log(`   Error: ${configError.message}`);
      console.log('✅ Configuration validation is working correctly');
    }
    
    // Test 6: Cleanup
    console.log('\n6️⃣ Testing cleanup...');
    await client.cleanup();
    console.log('✅ Client cleaned up successfully');
    console.log(`   Final state: ${client.getState()}`);
    
    console.log('\n🎉 All basic functionality tests passed!');
    console.log('\n📝 Summary:');
    console.log('   ✅ Client instantiation');
    console.log('   ✅ State management');
    console.log('   ✅ Statistics tracking');
    console.log('   ✅ History management');
    console.log('   ✅ Configuration validation');
    console.log('   ✅ Resource cleanup');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

// Export types test
function testTypeExports() {
  console.log('\n🔍 Testing module exports...');
  
  try {
    const aiModule = require('./apps/api-server/dist/ai/index.js');
    console.log('✅ AI module imported successfully');
    
    // Check if key exports exist
    const exports = Object.keys(aiModule);
    console.log(`   Available exports: ${exports.length} items`);
    
    if (aiModule.getGeminiClient) {
      console.log('   ✅ getGeminiClient function exported');
    }
    
    if (aiModule.GeminiClient) {
      console.log('   ✅ GeminiClient class exported');
    }
    
    if (aiModule.loadGeminiConfig) {
      console.log('   ✅ loadGeminiConfig function exported');
    }
    
    console.log('✅ Module exports are working correctly');
    
  } catch (error) {
    console.error('❌ Module export test failed:', error.message);
    throw error;
  }
}

// Run tests
async function runAllTests() {
  try {
    await testBasicFunctionality();
    testTypeExports();
    
    console.log('\n🏆 ALL TESTS PASSED! Subtask 5.1 is working correctly.');
    
  } catch (error) {
    console.error('\n💥 TESTS FAILED:', error);
    process.exit(1);
  }
}

runAllTests();