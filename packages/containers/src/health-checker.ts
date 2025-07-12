import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from '@cinnamon-qa/logger';
import { HealthCheckResult } from './types';

const execAsync = promisify(exec);

export class SimpleHealthChecker {
  private readonly logger = createLogger({ context: 'SimpleHealthChecker' });
  /**
   * Check if container is ready using multiple verification methods
   */
  async isContainerReady(port: number, containerId?: string): Promise<boolean> {
    try {
      // Method 1: TCP Port Check (fastest)
      const isPortOpen = await this.checkTcpPort(port);
      if (!isPortOpen) {
        return false;
      }

      // Method 2: HTTP Basic Check
      const isHttpResponding = await this.checkHttpEndpoint(port);
      if (!isHttpResponding) {
        return false;
      }

      // Method 3: Container Status Check (if container ID provided)
      if (containerId) {
        const isContainerRunning = await this.checkContainerStatus(containerId);
        if (!isContainerRunning) {
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Health check failed', { port, error });
      return false;
    }
  }

  /**
   * Check if TCP port is open and accepting connections
   */
  private async checkTcpPort(port: number): Promise<boolean> {
    try {
      // Use bash TCP check with command timeout - if successful, port is open
      await execAsync(
        `bash -c "</dev/tcp/localhost/${port}"`,
        { timeout: 3000 }
      );
      return true;
    } catch {
      // Port is not open or connection failed
      return false;
    }
  }

  /**
   * Check if HTTP endpoint is responding
   */
  private async checkHttpEndpoint(port: number): Promise<boolean> {
    try {
      // Simple HTTP HEAD request to check if server is responding
      const { stdout } = await execAsync(
        `curl -s -I --connect-timeout 3 --max-time 5 http://localhost:${port}/sse | head -1`,
        { timeout: 6000 }
      );
      
      // Check if response contains HTTP status (any status is fine, we just want a response)
      return stdout.includes('HTTP/');
    } catch {
      return false;
    }
  }

  /**
   * Check container status via Docker
   */
  private async checkContainerStatus(containerId: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        `docker inspect --format='{{.State.Status}}' ${containerId}`,
        { timeout: 3000 }
      );
      
      return stdout.trim() === 'running';
    } catch {
      return false;
    }
  }

  /**
   * Comprehensive health check with detailed results
   */
  async checkDetailedHealth(port: number, containerId?: string): Promise<HealthCheckResult> {
    const checks = {
      tcpPort: false,
      httpEndpoint: false,
      containerStatus: false,
    };

    try {
      // Run all checks
      checks.tcpPort = await this.checkTcpPort(port);
      checks.httpEndpoint = await this.checkHttpEndpoint(port);
      
      if (containerId) {
        checks.containerStatus = await this.checkContainerStatus(containerId);
      } else {
        checks.containerStatus = true; // Skip if no container ID
      }

      const allHealthy = checks.tcpPort && checks.httpEndpoint && checks.containerStatus;

      return {
        healthy: allHealthy,
        error: allHealthy ? undefined : `Health check failed: ${JSON.stringify(checks)}`,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown health check error',
      };
    }
  }

  /**
   * Perform health check and return detailed result
   */
  async checkHealth(port: number): Promise<HealthCheckResult> {
    try {
      const isReady = await this.isContainerReady(port);
      
      if (isReady) {
        return { healthy: true };
      } else {
        return { 
          healthy: false, 
          error: 'Container is not responding to SSE connection' 
        };
      }
    } catch (error) {
      return { 
        healthy: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}