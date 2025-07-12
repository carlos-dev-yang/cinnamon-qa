import { SimpleHealthChecker } from './src/health-checker';

async function testHealthDirect() {
  console.log('🔍 Testing Health Check on Running Container...');
  
  const healthChecker = new SimpleHealthChecker();
  
  // Test the manually started container
  const port = 3001;
  const containerName = 'cinnamon-qa-mcp-1';
  
  console.log(`\n🔗 Testing ${containerName} on port ${port}...`);
  
  // Test individual methods step by step
  console.log('1. TCP Port Check...');
  const tcpResult = await healthChecker['checkTcpPort'](port);
  console.log(`   TCP Check: ${tcpResult ? '✅ Success' : '❌ Failed'}`);
  
  if (!tcpResult) {
    console.log('❌ TCP check failed, stopping here');
    return;
  }
  
  console.log('2. HTTP Endpoint Check...');
  const httpResult = await healthChecker['checkHttpEndpoint'](port);
  console.log(`   HTTP Check: ${httpResult ? '✅ Success' : '❌ Failed'}`);
  
  if (!httpResult) {
    console.log('❌ HTTP check failed, stopping here');
    return;
  }
  
  console.log('3. Container Status Check...');
  const containerResult = await healthChecker['checkContainerStatus'](containerName);
  console.log(`   Container Check: ${containerResult ? '✅ Success' : '❌ Failed'}`);
  
  if (!containerResult) {
    console.log('❌ Container status check failed, stopping here');
    return;
  }
  
  // Test combined health check
  console.log('4. Combined Health Check...');
  const combinedResult = await healthChecker.isContainerReady(port, containerName);
  console.log(`   Combined Check: ${combinedResult ? '✅ Success' : '❌ Failed'}`);
  
  if (combinedResult) {
    console.log('🎉 All health checks passed!');
  } else {
    console.log('❌ Combined health check failed');
  }
  
  // Don't clean up - leave container for pool test
  console.log('\n✅ Test complete - container left running for pool test');
}

// Run test
testHealthDirect().catch(console.error);