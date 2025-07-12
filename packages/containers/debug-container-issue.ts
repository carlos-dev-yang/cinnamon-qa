import { PlaywrightMcpContainer } from './src/container';
import { createLogger } from '@cinnamon-qa/logger';

async function debugContainerIssue() {
  const logger = createLogger({ context: 'DebugContainerIssue' });
  logger.info('Starting container startup issue debugging');
  
  try {
    // Test 1: Create container with our code
    logger.info('Starting Test 1: Creating container with our code');
    const container = new PlaywrightMcpContainer(
      'debug-container-1',
      'debug-test-mcp-1',
      3006
    );
    
    logger.info('Starting container');
    await container.start();
    logger.info('Container started successfully');
    
    // Check if it's running
    logger.info('Checking container status');
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { stdout: runningContainers } = await execAsync('docker ps --filter name=debug-test-mcp-1 --format "{{.Names}} {{.Status}}"');
    logger.info('Running containers found', { containers: runningContainers || 'None' });
    
    const { stdout: allContainers } = await execAsync('docker ps -a --filter name=debug-test-mcp-1 --format "{{.Names}} {{.Status}}"');
    logger.info('All containers found', { containers: allContainers || 'None' });
    
    // Check logs if container exists
    if (allContainers.includes('debug-test-mcp-1')) {
      logger.info('Retrieving container logs');
      try {
        const { stdout: logs } = await execAsync('docker logs debug-test-mcp-1');
        logger.info('Container logs retrieved', { logs: logs || 'No logs available' });
      } catch (error) {
        logger.warn('Failed to retrieve container logs', { error: error.message });
      }
    }
    
    // Test 2: Compare with manual docker run command
    logger.info('Starting Test 2: Manual docker run for comparison');
    const manualCommand = [
      'docker run -d',
      '--name manual-test-mcp',
      '-p 3007:3000',
      '--network cinnamon-qa-network',
      '--memory=512m',
      '--cpus=0.5',
      '--env CONTAINER_POOL_ID=manual-test',
      'mcr.microsoft.com/playwright/mcp:latest',
      '--headless',
      '--host', '0.0.0.0',
      '--port', '3000',
      '--isolated'
    ].join(' ');
    
    logger.info('Manual docker command prepared', { command: manualCommand });
    await execAsync(manualCommand);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { stdout: manualStatus } = await execAsync('docker ps --filter name=manual-test-mcp --format "{{.Names}} {{.Status}}"');
    logger.info('Manual container status checked', { status: manualStatus || 'Not running' });
    
    if (manualStatus.includes('manual-test-mcp')) {
      logger.info('Manual container is running successfully');
      const { stdout: manualLogs } = await execAsync('docker logs manual-test-mcp');
      logger.info('Manual container logs retrieved', { logs: manualLogs });
    } else {
      logger.error('Manual container failed to start');
      const { stdout: manualAllStatus } = await execAsync('docker ps -a --filter name=manual-test-mcp --format "{{.Names}} {{.Status}}"');
      logger.info('Manual container status (all)', { status: manualAllStatus });
    }
    
    // Test 3: Check our container creation command
    logger.info('Starting Test 3: Examining our container creation logic');
    
    // Get the exact command that would be run
    const ourCommand = [
      'docker run -d',
      '--name debug-test-examine',
      '-p 3008:3000',
      '--network cinnamon-qa-network',
      '--memory=512m',
      '--cpus=0.5',
      '--env CONTAINER_POOL_ID=debug-container-examine',
      'mcr.microsoft.com/playwright/mcp:latest',
      '--headless',
      '--host', '0.0.0.0',
      '--port', '3000',
      '--isolated'
    ].join(' ');
    
    logger.info('Our container command prepared', { command: ourCommand });
    
    // Test the command directly
    logger.info('Executing our command directly');
    const { stdout: ourResult } = await execAsync(ourCommand);
    logger.info('Container created with ID', { containerId: ourResult.trim() });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const { stdout: ourStatus } = await execAsync('docker ps --filter name=debug-test-examine --format "{{.Names}} {{.Status}}"');
    logger.info('Our direct command status checked', { status: ourStatus || 'Not running' });
    
    // Cleanup
    logger.info('Starting cleanup of test containers');
    try {
      await execAsync('docker rm -f debug-test-mcp-1 manual-test-mcp debug-test-examine debug-mcp');
      logger.info('Container cleanup completed successfully');
    } catch (error) {
      logger.warn('Container cleanup encountered error', { error: error.message });
    }
    
  } catch (error) {
    logger.error('Debug container test failed', {
      error: error.message,
      code: error.code,
      stderr: error.stderr,
      stack: error.stack
    });
  }
}

// Run debug test
debugContainerIssue().catch((error) => {
  const logger = createLogger({ context: 'DebugContainerIssue' });
  logger.error('Debug container issue execution failed', { error: error.message, stack: error.stack });
});