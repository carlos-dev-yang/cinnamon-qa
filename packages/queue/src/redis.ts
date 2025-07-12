/**
 * Redis Client Configuration and Management
 */

import Redis from 'ioredis';
import { createLogger } from '@cinnamon-qa/logger';
import type { RedisConfig } from './types';

const logger = createLogger({ context: 'RedisClient' });

export class RedisClient {
  private client: Redis | null = null;
  private config: RedisConfig;

  constructor(config?: RedisConfig) {
    this.config = config || this.getDefaultConfig();
  }

  private getDefaultConfig(): RedisConfig {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true,
    };
  }

  async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    this.client = new Redis(this.config);

    // Handle connection events
    this.client.on('connect', () => {
      logger.info('Redis connected');
    });

    this.client.on('error', (error) => {
      logger.error('Redis connection error', { error: error.message, stack: error.stack });
    });

    this.client.on('close', () => {
      logger.info('Redis connection closed');
    });

    // Wait for connection
    await this.client.ping();
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  get instance(): Redis {
    if (!this.client) {
      throw new Error('Redis client not connected. Call connect() first.');
    }
    return this.client;
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }
      await this.client.ping();
      return true;
    } catch (error) {
      logger.error('Redis health check failed', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  async flushdb(): Promise<void> {
    if (this.client) {
      await this.client.flushdb();
    }
  }

  async info(): Promise<string> {
    if (!this.client) {
      throw new Error('Redis client not connected');
    }
    return await this.client.info();
  }
}

// Default Redis client instance
let defaultRedisClient: RedisClient | null = null;

export function getRedisClient(config?: RedisConfig): RedisClient {
  if (!defaultRedisClient) {
    defaultRedisClient = new RedisClient(config);
  }
  return defaultRedisClient;
}

export async function connectRedis(config?: RedisConfig): Promise<RedisClient> {
  const client = getRedisClient(config);
  await client.connect();
  return client;
}