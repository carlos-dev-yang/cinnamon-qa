import { SimpleHealthChecker } from './src/health-checker';
import { createLogger } from '@cinnamon-qa/logger';

async function testHealthCheck() {
  const logger = createLogger({ context: 'HealthCheckTest' });
  logger.info('Starting health check methods test');
  
  const healthChecker = new SimpleHealthChecker();
  
  // Test port 3005 (manually started container)
  const port = 3005;
  const containerId = 'test-mcp-health';
  
  logger.info('Testing container health check', { port, containerId });
  
  // Test individual methods
  logger.info('Step 1: Starting TCP port check');
  const tcpResult = await healthChecker['checkTcpPort'](port);
  logger.info('TCP port check completed', { port, success: tcpResult });
  
  logger.info('Step 2: Starting HTTP endpoint check');
  const httpResult = await healthChecker['checkHttpEndpoint'](port);
  logger.info('HTTP endpoint check completed', { port, success: httpResult });
  
  logger.info('Step 3: Starting container status check');
  const containerResult = await healthChecker['checkContainerStatus'](containerId);
  logger.info('Container status check completed', { containerId, success: containerResult });
  
  // Test combined health check
  logger.info('Step 4: Starting combined health check');
  const combinedResult = await healthChecker.isContainerReady(port, containerId);
  logger.info('Combined health check completed', { port, containerId, success: combinedResult });
  
  // Test detailed health check
  logger.info('Step 5: Starting detailed health check');
  const detailedResult = await healthChecker.checkDetailedHealth(port, containerId);
  logger.info('Detailed health check completed', {
    port,
    containerId,
    healthy: detailedResult.healthy
  });
  if (!detailedResult.healthy) {
    logger.error('Detailed health check failed', {
      port,
      containerId,
      error: detailedResult.error
    });
  }
  
  logger.info('Starting test container cleanup');
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    await execAsync('docker rm -f test-mcp-health');
    logger.info('Test container removed successfully', { containerId });
  } catch (error) {
    logger.warn('Failed to remove test container', {
      containerId,
      error: error.message
    });
  }
}

// Run test
testHealthCheck().catch((error) => {
  const logger = createLogger({ context: 'HealthCheckTest' });
  logger.error('Health check test execution failed', { error: error.message, stack: error.stack });
});