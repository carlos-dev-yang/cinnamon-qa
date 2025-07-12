import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function monitorContainerLifecycle() {
  console.log('📊 Monitoring Container Lifecycle...');
  
  try {
    // Start a new container to monitor
    console.log('🚀 Starting monitored container...');
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
    
    console.log('Container ID:', containerId.trim());
    
    // Monitor Docker events for this container
    console.log('👀 Starting Docker events monitor...');
    const dockerEvents = spawn('docker', ['events', '--filter', 'container=monitored-mcp', '--format', '{{.Time}} {{.Action}} {{.Actor.Attributes.name}}']);
    
    dockerEvents.stdout.on('data', (data) => {
      console.log('🔔 Docker Event:', data.toString().trim());
    });
    
    dockerEvents.stderr.on('data', (data) => {
      console.log('❌ Docker Events Error:', data.toString().trim());
    });
    
    // Periodically check container status
    const statusInterval = setInterval(async () => {
      try {
        const { stdout: status } = await execAsync('docker ps --filter name=monitored-mcp --format "{{.Names}} {{.Status}}"');
        if (status.trim()) {
          console.log('📊 Container Status:', status.trim());
          
          // Get logs
          try {
            const { stdout: logs } = await execAsync('docker logs --tail 5 monitored-mcp 2>&1');
            if (logs.trim()) {
              console.log('📋 Recent Logs:', logs.trim());
            }
          } catch (logError) {
            console.log('⚠️ Failed to get logs:', logError.message);
          }
        } else {
          console.log('❌ Container is no longer running');
          
          // Check if it exists in stopped state
          const { stdout: allStatus } = await execAsync('docker ps -a --filter name=monitored-mcp --format "{{.Names}} {{.Status}}"');
          console.log('📊 All Container Status:', allStatus.trim() || 'Container removed');
          
          // If container exists but stopped, get exit code and logs
          if (allStatus.includes('monitored-mcp')) {
            try {
              const { stdout: inspectOutput } = await execAsync('docker inspect monitored-mcp --format "{{.State.ExitCode}} {{.State.Error}}"');
              console.log('🔍 Exit Code and Error:', inspectOutput.trim());
              
              const { stdout: allLogs } = await execAsync('docker logs monitored-mcp 2>&1');
              console.log('📋 Full Logs:', allLogs.trim() || 'No logs');
            } catch (inspectError) {
              console.log('⚠️ Failed to inspect:', inspectError.message);
            }
          }
          
          clearInterval(statusInterval);
          dockerEvents.kill();
          
          // Cleanup
          try {
            await execAsync('docker rm -f monitored-mcp');
            console.log('🧹 Container cleaned up');
          } catch (cleanupError) {
            console.log('⚠️ Cleanup failed:', cleanupError.message);
          }
          
          process.exit(0);
        }
      } catch (error) {
        console.log('❌ Status check error:', error.message);
      }
    }, 5000); // Check every 5 seconds
    
    // Stop monitoring after 2 minutes
    setTimeout(() => {
      console.log('⏰ Monitoring timeout - stopping');
      clearInterval(statusInterval);
      dockerEvents.kill();
      
      // Final cleanup
      execAsync('docker rm -f monitored-mcp').catch(() => {
        console.log('⚠️ Cleanup failed');
      });
      process.exit(0);
    }, 120000); // 2 minutes
    
    console.log('🕐 Monitoring for 2 minutes... Press Ctrl+C to stop early');
    
  } catch (error) {
    console.error('❌ Monitoring setup failed:', error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Stopping monitor...');
  try {
    await execAsync('docker rm -f monitored-mcp');
    console.log('🧹 Container cleaned up');
  } catch (error) {
    // Ignore cleanup errors
  }
  process.exit(0);
});

// Run monitor
monitorContainerLifecycle().catch(console.error);