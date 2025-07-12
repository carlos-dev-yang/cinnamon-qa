import { SimpleHealthChecker } from './src/health-checker';
import { createLogger } from '@cinnamon-qa/logger';

async function testHealthDirect() {
  const logger = createLogger({ context: 'HealthDirectTest' });
  logger.info('Starting health check test on running container');
  
  const healthChecker = new SimpleHealthChecker();
  
  // Test the manually started container
  const port = 3001;
  const containerName = 'cinnamon-qa-mcp-1';
  
  logger.info('Testing container health', { containerName, port });
  
  // Test individual methods step by step
  logger.info('Step 1: Starting TCP port check');
  const tcpResult = await healthChecker['checkTcpPort'](port);
  logger.info('TCP port check completed', { port, success: tcpResult });
  
  if (!tcpResult) {
    logger.error('TCP check failed, stopping health test', { port });
    return;
  }
  
  logger.info('Step 2: Starting HTTP endpoint check');
  const httpResult = await healthChecker['checkHttpEndpoint'](port);
  logger.info('HTTP endpoint check completed', { port, success: httpResult });
  
  if (!httpResult) {
    logger.error('HTTP check failed, stopping health test', { port });
    return;
  }
  
  logger.info('Step 3: Starting container status check');
  const containerResult = await healthChecker['checkContainerStatus'](containerName);
  logger.info('Container status check completed', { containerName, success: containerResult });
  
  if (!containerResult) {
    logger.error('Container status check failed, stopping health test', { containerName });
    return;
  }
  
  // Test combined health check
  logger.info('Step 4: Starting combined health check');
  const combinedResult = await healthChecker.isContainerReady(port, containerName);
  logger.info('Combined health check completed', { containerName, port, success: combinedResult });
  
  if (combinedResult) {
    logger.info('All health checks passed successfully');
  } else {
    logger.error('Combined health check failed');
  }
  
  // Don't clean up - leave container for pool test
  logger.info('Health test completed - container left running for pool test');
}

// Run test
testHealthDirect().catch((error) => {
  const logger = createLogger({ context: 'HealthDirectTest' });
  logger.error('Health direct test execution failed', { error: error.message, stack: error.stack });
});