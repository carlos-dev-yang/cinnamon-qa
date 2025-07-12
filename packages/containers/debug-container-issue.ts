import { PlaywrightMcpContainer } from './src/container';

async function debugContainerIssue() {
  console.log('🔍 Debugging Container Startup Issue...');
  
  try {
    // Test 1: Create container with our code
    console.log('📦 Test 1: Creating container with our code...');
    const container = new PlaywrightMcpContainer(
      'debug-container-1',
      'debug-test-mcp-1',
      3006
    );
    
    console.log('🚀 Starting container...');
    await container.start();
    console.log('✅ Container started successfully');
    
    // Check if it's running
    console.log('🔍 Checking container status...');
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { stdout: runningContainers } = await execAsync('docker ps --filter name=debug-test-mcp-1 --format "{{.Names}} {{.Status}}"');
    console.log('Running containers:', runningContainers || 'None');
    
    const { stdout: allContainers } = await execAsync('docker ps -a --filter name=debug-test-mcp-1 --format "{{.Names}} {{.Status}}"');
    console.log('All containers:', allContainers || 'None');
    
    // Check logs if container exists
    if (allContainers.includes('debug-test-mcp-1')) {
      console.log('📋 Container logs:');
      try {
        const { stdout: logs } = await execAsync('docker logs debug-test-mcp-1');
        console.log(logs || 'No logs');
      } catch (error) {
        console.log('Failed to get logs:', error.message);
      }
    }
    
    // Test 2: Compare with manual docker run command
    console.log('\n📦 Test 2: Manual docker run for comparison...');
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
    
    console.log('Command:', manualCommand);
    await execAsync(manualCommand);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { stdout: manualStatus } = await execAsync('docker ps --filter name=manual-test-mcp --format "{{.Names}} {{.Status}}"');
    console.log('Manual container status:', manualStatus || 'Not running');
    
    if (manualStatus.includes('manual-test-mcp')) {
      console.log('✅ Manual container is running');
      const { stdout: manualLogs } = await execAsync('docker logs manual-test-mcp');
      console.log('Manual container logs:', manualLogs);
    } else {
      console.log('❌ Manual container failed too');
      const { stdout: manualAllStatus } = await execAsync('docker ps -a --filter name=manual-test-mcp --format "{{.Names}} {{.Status}}"');
      console.log('Manual container all status:', manualAllStatus);
    }
    
    // Test 3: Check our container creation command
    console.log('\n🔍 Test 3: Examining our container creation logic...');
    
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
    
    console.log('Our command would be:', ourCommand);
    
    // Test the command directly
    console.log('Running our command directly...');
    const { stdout: ourResult } = await execAsync(ourCommand);
    console.log('Container ID:', ourResult.trim());
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const { stdout: ourStatus } = await execAsync('docker ps --filter name=debug-test-examine --format "{{.Names}} {{.Status}}"');
    console.log('Our direct command status:', ourStatus || 'Not running');
    
    // Cleanup
    console.log('\n🧹 Cleaning up test containers...');
    try {
      await execAsync('docker rm -f debug-test-mcp-1 manual-test-mcp debug-test-examine debug-mcp');
      console.log('✅ Cleanup complete');
    } catch (error) {
      console.log('Cleanup error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Debug test failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stderr: error.stderr
    });
  }
}

// Run debug test
debugContainerIssue().catch(console.error);