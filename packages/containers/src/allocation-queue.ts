import { RedisClient } from '@cinnamon-qa/queue';

export interface QueuedRequest {
  testRunId: string;
  requestedAt: Date;
  timeout: number; // milliseconds
}

export class AllocationQueue {
  private redisClient: RedisClient;
  private queueKey = 'container:allocation:queue';
  private processingKey = 'container:allocation:processing';

  constructor(redisClient: RedisClient) {
    this.redisClient = redisClient;
  }

  /**
   * Add a container allocation request to the queue
   */
  async enqueue(testRunId: string, timeoutMs = 300000): Promise<void> { // 5 minutes default
    const request: QueuedRequest = {
      testRunId,
      requestedAt: new Date(),
      timeout: timeoutMs,
    };

    // Add to Redis list (FIFO queue)
    await this.redisClient.instance.lpush(this.queueKey, JSON.stringify(request));
    
    // Set expiration for the request
    const expirationKey = `${this.queueKey}:${testRunId}`;
    await this.redisClient.instance.setex(expirationKey, Math.ceil(timeoutMs / 1000), 'pending');

    console.log(`Queued allocation request for ${testRunId}`);
  }

  /**
   * Get the next request from the queue
   */
  async dequeue(): Promise<QueuedRequest | null> {
    // Get the oldest request (FIFO)
    const requestData = await this.redisClient.instance.rpop(this.queueKey);
    
    if (!requestData) {
      return null;
    }

    try {
      const request: QueuedRequest = JSON.parse(requestData);
      
      // Check if request has expired
      const expirationKey = `${this.queueKey}:${request.testRunId}`;
      const exists = await this.redisClient.instance.exists(expirationKey);
      
      if (!exists) {
        console.log(`Request ${request.testRunId} has expired, skipping`);
        return this.dequeue(); // Try next request
      }

      // Remove expiration key
      await this.redisClient.instance.del(expirationKey);
      
      return request;
    } catch (error) {
      console.error('Failed to parse queued request:', error);
      return this.dequeue(); // Try next request
    }
  }

  /**
   * Check queue size
   */
  async getQueueSize(): Promise<number> {
    return await this.redisClient.instance.llen(this.queueKey);
  }

  /**
   * Remove a specific request from the queue (if cancelled)
   */
  async remove(testRunId: string): Promise<boolean> {
    // Get all items in the queue
    const requests = await this.redisClient.instance.lrange(this.queueKey, 0, -1);
    
    for (let i = 0; i < requests.length; i++) {
      try {
        const request: QueuedRequest = JSON.parse(requests[i]);
        if (request.testRunId === testRunId) {
          // Remove this specific item
          await this.redisClient.instance.lrem(this.queueKey, 1, requests[i]);
          
          // Remove expiration key
          const expirationKey = `${this.queueKey}:${testRunId}`;
          await this.redisClient.instance.del(expirationKey);
          
          console.log(`Removed ${testRunId} from allocation queue`);
          return true;
        }
      } catch (error) {
        // Skip invalid entries
        continue;
      }
    }
    
    return false;
  }

  /**
   * Clear expired requests from the queue
   */
  async cleanupExpired(): Promise<number> {
    const requests = await this.redisClient.instance.lrange(this.queueKey, 0, -1);
    let cleanedCount = 0;
    
    for (const requestData of requests) {
      try {
        const request: QueuedRequest = JSON.parse(requestData);
        const expirationKey = `${this.queueKey}:${request.testRunId}`;
        const exists = await this.redisClient.instance.exists(expirationKey);
        
        if (!exists) {
          // Remove expired request
          await this.redisClient.instance.lrem(this.queueKey, 1, requestData);
          cleanedCount++;
        }
      } catch (error) {
        // Remove invalid entries
        await this.redisClient.instance.lrem(this.queueKey, 1, requestData);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired requests from queue`);
    }
    
    return cleanedCount;
  }

  /**
   * Get queue status for monitoring
   */
  async getQueueStatus(): Promise<{
    size: number;
    requests: Array<{ testRunId: string; requestedAt: string; waitingMs: number }>;
  }> {
    const requests = await this.redisClient.instance.lrange(this.queueKey, 0, -1);
    const now = new Date();
    
    const requestsInfo = [];
    for (const requestData of requests) {
      try {
        const request: QueuedRequest = JSON.parse(requestData);
        const expirationKey = `${this.queueKey}:${request.testRunId}`;
        const exists = await this.redisClient.instance.exists(expirationKey);
        
        if (exists) {
          requestsInfo.push({
            testRunId: request.testRunId,
            requestedAt: request.requestedAt.toString(),
            waitingMs: now.getTime() - new Date(request.requestedAt).getTime(),
          });
        }
      } catch (error) {
        // Skip invalid entries
      }
    }
    
    return {
      size: requestsInfo.length,
      requests: requestsInfo,
    };
  }
}