import EventSource from 'eventsource';
import { HealthCheckResult } from './types';

export class SimpleHealthChecker {
  /**
   * Check if container is ready by testing SSE connection
   */
  async isContainerReady(port: number): Promise<boolean> {
    try {
      const sseUrl = `http://localhost:${port}/sse`;
      
      return new Promise((resolve) => {
        const eventSource = new EventSource(sseUrl);
        
        const timeout = setTimeout(() => {
          eventSource.close();
          resolve(false); // Timeout = not ready
        }, 5000); // 5 second timeout
        
        eventSource.onopen = () => {
          clearTimeout(timeout);
          eventSource.close();
          resolve(true); // Connected = ready
        };
        
        eventSource.onmessage = (event) => {
          // If we receive any message, the connection is working
          clearTimeout(timeout);
          eventSource.close();
          resolve(true);
        };
        
        eventSource.onerror = (error) => {
          clearTimeout(timeout);
          eventSource.close();
          // Don't immediately fail - might be initial connection
          resolve(false);
        };
      });
    } catch (error) {
      console.error(`Health check failed for port ${port}:`, error);
      return false;
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