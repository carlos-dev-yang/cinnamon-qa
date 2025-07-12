import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { createLogger } from '@cinnamon-qa/logger';

const execAsync = promisify(exec);
const logger = createLogger({ context: 'MonitorContainerLifecycle' });

async function monitorContainerLifecycle() {
  logger.info('Monitoring Container Lifecycle');
  
  try {
    // Start a new container to monitor
    logger.info('Starting monitored container');
    const { stdout: containerId } = await execAsync([
      'docker run -d',
      '--name monitored-mcp',
      '--network cinnamon-qa-network',
      '-p 3009:3000',
      '--memory=512m',
      '--cpus=0.5',
      'mcr.microsoft.com/playwright/mcp:latest',
      '--headless',
      '--host', '0.0.0.0',
      '--port', '3000',
      '--isolated'
    ].join(' '));
    
    logger.info('Container started', { containerId: containerId.trim() });
    
    // Monitor Docker events for this container
    logger.info('Starting Docker events monitor');
    const dockerEvents = spawn('docker', ['events', '--filter', 'container=monitored-mcp', '--format', '{{.Time}} {{.Action}} {{.Actor.Attributes.name}}']);
    
    dockerEvents.stdout.on('data', (data) => {
      logger.info('Docker Event', { event: data.toString().trim() });
    });
    
    dockerEvents.stderr.on('data', (data) => {
      logger.error('Docker Events Error', { error: data.toString().trim() });
    });
    
    // Periodically check container status
    const statusInterval = setInterval(async () => {
      try {
        const { stdout: status } = await execAsync('docker ps --filter name=monitored-mcp --format "{{.Names}} {{.Status}}"');
        if (status.trim()) {
          logger.info('Container Status', { status: status.trim() });
          
          // Get logs
          try {
            const { stdout: logs } = await execAsync('docker logs --tail 5 monitored-mcp 2>&1');
            if (logs.trim()) {
              logger.info('Recent Logs', { logs: logs.trim() });
            }
          } catch (logError) {
            logger.warn('Failed to get logs', { error: logError.message });
          }
        } else {
          logger.info('Container is no longer running');
          
          // Check if it exists in stopped state
          const { stdout: allStatus } = await execAsync('docker ps -a --filter name=monitored-mcp --format "{{.Names}} {{.Status}}"');
          logger.info('All Container Status', { status: allStatus.trim() || 'Container removed' });
          
          // If container exists but stopped, get exit code and logs
          if (allStatus.includes('monitored-mcp')) {
            try {
              const { stdout: inspectOutput } = await execAsync('docker inspect monitored-mcp --format "{{.State.ExitCode}} {{.State.Error}}"');
              logger.info('Exit Code and Error', { info: inspectOutput.trim() });
              
              const { stdout: allLogs } = await execAsync('docker logs monitored-mcp 2>&1');
              logger.info('Full Logs', { logs: allLogs.trim() || 'No logs' });
            } catch (inspectError) {
              logger.warn('Failed to inspect', { error: inspectError.message });
            }
          }
          
          clearInterval(statusInterval);
          dockerEvents.kill();
          
          // Cleanup
          try {
            await execAsync('docker rm -f monitored-mcp');
            logger.info('Container cleaned up');
          } catch (cleanupError) {
            logger.warn('Cleanup failed', { error: cleanupError.message });
          }
          
          process.exit(0);
        }
      } catch (error) {
        logger.error('Status check error', { error: error.message });
      }
    }, 5000); // Check every 5 seconds
    
    // Stop monitoring after 2 minutes
    setTimeout(() => {
      logger.info('Monitoring timeout - stopping');
      clearInterval(statusInterval);
      dockerEvents.kill();
      
      // Final cleanup
      execAsync('docker rm -f monitored-mcp').catch(() => {
        logger.warn('Cleanup failed');
      });
      process.exit(0);
    }, 120000); // 2 minutes
    
    logger.info('Monitoring for 2 minutes... Press Ctrl+C to stop early');
    
  } catch (error) {
    logger.error('Monitoring setup failed', { error });
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Stopping monitor');
  try {
    await execAsync('docker rm -f monitored-mcp');
    logger.info('Container cleaned up successfully');
  } catch (error) {
    // Ignore cleanup errors
  }
  process.exit(0);
});

// Run monitor
monitorContainerLifecycle().catch(error => logger.error('Monitor container lifecycle failed', { error }));