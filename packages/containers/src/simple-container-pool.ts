import { RedisClient } from '@cinnamon-qa/queue';
import { PlaywrightMcpContainer } from './container';
import { SimpleHealthChecker } from './health-checker';
import { DockerInspector } from './docker-inspector';
import { Container, ContainerState, ContainerPoolConfig } from './types';

export class SimpleContainerPool {
  private containers: Map<string, PlaywrightMcpContainer> = new Map();
  private healthChecker: SimpleHealthChecker;
  private dockerInspector: DockerInspector;
  private redisClient: RedisClient;
  
  // Fixed pool configuration for 2 containers
  private readonly poolConfig: ContainerPoolConfig = {
    containers: [
      { id: 'container-1', name: 'cinnamon-qa-mcp-1', port: 3001 },
      { id: 'container-2', name: 'cinnamon-qa-mcp-2', port: 3002 },
    ],
  };

  constructor(redisClient: RedisClient) {
    this.redisClient = redisClient;
    this.healthChecker = new SimpleHealthChecker();
    this.dockerInspector = new DockerInspector();
  }

  /**
   * Initialize the container pool
   */
  async initialize(): Promise<void> {
    console.log('Initializing container pool...');
    
    // Initialize Docker environment
    await this.dockerInspector.initialize();

    // Create and start containers
    for (const config of this.poolConfig.containers) {
      const container = new PlaywrightMcpContainer(
        config.id,
        config.name,
        config.port
      );
      
      try {
        await container.start();
        this.containers.set(config.id, container);
        
        // Initialize Redis state
        await this.updateContainerState(config.id, {
          containerId: config.id,
          port: config.port,
          allocated: false,
          lastCheckedAt: new Date(),
        });
        
        console.log(`Container ${config.id} started successfully on port ${config.port}`);
      } catch (error) {
        console.error(`Failed to start container ${config.id}:`, error);
      }
    }

    console.log('Container pool initialized');
  }

  /**
   * Allocate a container for a test run
   */
  async allocateContainer(testRunId: string): Promise<Container | null> {
    // Find available container
    const availableContainer = await this.findAvailableContainer();
    if (!availableContainer) {
      console.log('No available containers in pool');
      return null;
    }

    // Health check with container name for comprehensive verification
    const containerObj = this.containers.get(availableContainer.containerId);
    const containerName = containerObj?.name;
    
    console.log(`Checking health for container ${availableContainer.containerId} (${containerName}) on port ${availableContainer.port}`);
    
    const isHealthy = await this.healthChecker.isContainerReady(
      availableContainer.port, 
      containerName
    );
    
    if (!isHealthy) {
      console.log(`Container ${availableContainer.id} is unhealthy, attempting restart...`);
      
      // Restart unhealthy container
      const container = this.containers.get(availableContainer.id);
      if (container) {
        try {
          await container.restart();
          console.log(`Container ${availableContainer.id} restarted, checking health...`);
          
          // Wait a bit for container to fully start
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check health after restart
          const isHealthyAfterRestart = await this.healthChecker.isContainerReady(
            availableContainer.port, 
            containerName
          );
          
          if (isHealthyAfterRestart) {
            console.log(`Container ${availableContainer.id} is healthy after restart`);
            await this.markAsAllocated(availableContainer.id, testRunId);
            container.allocate(testRunId);
            return container.getInfo();
          } else {
            console.log(`Container ${availableContainer.id} still unhealthy after restart`);
          }
        } catch (error) {
          console.error(`Failed to restart container ${availableContainer.id}:`, error);
        }
      }
      
      // Try to find another available container (single attempt, no recursion)
      const availableContainers = [];
      for (const containerId of this.containers.keys()) {
        if (containerId !== availableContainer.id) {
          const state = await this.getContainerState(containerId);
          if (state && !state.allocated) {
            availableContainers.push(state);
          }
        }
      }
      
      // Try each alternative container once
      for (const otherContainer of availableContainers) {
        console.log(`Trying alternative container ${otherContainer.containerId}...`);
        const altContainer = this.containers.get(otherContainer.containerId);
        const altContainerName = altContainer?.name;
        
        const isOtherHealthy = await this.healthChecker.isContainerReady(
          otherContainer.port, 
          altContainerName
        );
        
        if (isOtherHealthy) {
          await this.markAsAllocated(otherContainer.containerId, testRunId);
          const containerObj = this.containers.get(otherContainer.containerId);
          if (containerObj) {
            containerObj.allocate(testRunId);
            console.log(`Successfully allocated alternative container ${otherContainer.containerId}`);
            return containerObj.getInfo();
          }
        } else {
          console.log(`Alternative container ${otherContainer.containerId} is also unhealthy`);
        }
      }
      
      // No healthy containers available
      console.log('No healthy containers available in pool');
      return null;
    }

    // Mark as allocated
    await this.markAsAllocated(availableContainer.id, testRunId);
    
    const container = this.containers.get(availableContainer.id);
    if (container) {
      container.allocate(testRunId);
      return container.getInfo();
    }

    return null;
  }

  /**
   * Release a container after test completion
   */
  async releaseContainer(containerId: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) {
      console.error(`Container ${containerId} not found`);
      return;
    }

    // Update Redis state
    await this.updateContainerState(containerId, {
      containerId,
      port: container.port,
      allocated: false,
      lastCheckedAt: new Date(),
    });

    container.release();
    console.log(`Container ${containerId} released`);
  }

  /**
   * Shutdown all containers
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down container pool...');
    
    for (const container of this.containers.values()) {
      try {
        await container.stop();
        await container.remove();
      } catch (error) {
        console.error(`Failed to shutdown container ${container.id}:`, error);
      }
    }
    
    // Clear Redis states
    for (const containerId of this.containers.keys()) {
      await this.redisClient.instance.del(`container:${containerId}`);
    }
    
    this.containers.clear();
    console.log('Container pool shutdown complete');
  }

  /**
   * Get pool status
   */
  async getPoolStatus(): Promise<{
    total: number;
    available: number;
    allocated: number;
    containers: ContainerState[];
  }> {
    const states: ContainerState[] = [];
    let available = 0;
    let allocated = 0;

    for (const containerId of this.containers.keys()) {
      const state = await this.getContainerState(containerId);
      if (state) {
        states.push(state);
        if (state.allocated) {
          allocated++;
        } else {
          available++;
        }
      }
    }

    return {
      total: this.containers.size,
      available,
      allocated,
      containers: states,
    };
  }

  /**
   * Find an available container
   */
  private async findAvailableContainer(): Promise<ContainerState | null> {
    for (const containerId of this.containers.keys()) {
      const state = await this.getContainerState(containerId);
      if (state && !state.allocated) {
        return state;
      }
    }
    return null;
  }

  /**
   * Mark container as allocated in Redis
   */
  private async markAsAllocated(containerId: string, testRunId: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) return;

    await this.updateContainerState(containerId, {
      containerId,
      port: container.port,
      allocated: true,
      allocatedTo: testRunId,
      allocatedAt: new Date(),
      lastCheckedAt: new Date(),
    });
  }

  /**
   * Get container state from Redis
   */
  private async getContainerState(containerId: string): Promise<ContainerState | null> {
    const data = await this.redisClient.instance.hgetall(`container:${containerId}`);
    
    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      containerId: data.containerId,
      port: parseInt(data.port),
      allocated: data.allocated === 'true',
      allocatedTo: data.allocatedTo || undefined,
      allocatedAt: data.allocatedAt ? new Date(data.allocatedAt) : undefined,
      lastCheckedAt: data.lastCheckedAt ? new Date(data.lastCheckedAt) : undefined,
    };
  }

  /**
   * Update container state in Redis
   */
  private async updateContainerState(
    containerId: string,
    state: ContainerState
  ): Promise<void> {
    const data: Record<string, string> = {
      containerId: state.containerId,
      port: state.port.toString(),
      allocated: state.allocated.toString(),
      lastCheckedAt: state.lastCheckedAt?.toISOString() || new Date().toISOString(),
    };

    if (state.allocatedTo) {
      data.allocatedTo = state.allocatedTo;
    }
    if (state.allocatedAt) {
      data.allocatedAt = state.allocatedAt.toISOString();
    }

    await this.redisClient.instance.hset(`container:${containerId}`, data);
    
    // Set expiration for allocated state (30 minutes safety timeout)
    if (state.allocated && state.allocatedTo) {
      await this.redisClient.instance.expire(`container:${containerId}`, 1800);
    }
  }
}