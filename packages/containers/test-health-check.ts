import { SimpleHealthChecker } from './src/health-checker';

async function testHealthCheck() {
  console.log('🔍 Testing Health Check Methods...');
  
  const healthChecker = new SimpleHealthChecker();
  
  // Test port 3005 (manually started container)
  const port = 3005;
  const containerId = 'test-mcp-health';
  
  console.log(`\n🔗 Testing port ${port}...`);
  
  // Test individual methods
  console.log('1. TCP Port Check...');
  const tcpResult = await healthChecker['checkTcpPort'](port);
  console.log(`   TCP Check: ${tcpResult ? '✅ Success' : '❌ Failed'}`);
  
  console.log('2. HTTP Endpoint Check...');
  const httpResult = await healthChecker['checkHttpEndpoint'](port);
  console.log(`   HTTP Check: ${httpResult ? '✅ Success' : '❌ Failed'}`);
  
  console.log('3. Container Status Check...');
  const containerResult = await healthChecker['checkContainerStatus'](containerId);
  console.log(`   Container Check: ${containerResult ? '✅ Success' : '❌ Failed'}`);
  
  // Test combined health check
  console.log('4. Combined Health Check...');
  const combinedResult = await healthChecker.isContainerReady(port, containerId);
  console.log(`   Combined Check: ${combinedResult ? '✅ Success' : '❌ Failed'}`);
  
  // Test detailed health check
  console.log('5. Detailed Health Check...');
  const detailedResult = await healthChecker.checkDetailedHealth(port, containerId);
  console.log(`   Detailed Check: ${detailedResult.healthy ? '✅ Success' : '❌ Failed'}`);
  if (!detailedResult.healthy) {
    console.log(`   Error: ${detailedResult.error}`);
  }
  
  console.log('\n🧹 Cleaning up test container...');
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    await execAsync('docker rm -f test-mcp-health');
    console.log('✅ Test container removed');
  } catch (error) {
    console.log('⚠️ Failed to remove test container:', error);
  }
}

// Run test
testHealthCheck().catch(console.error);