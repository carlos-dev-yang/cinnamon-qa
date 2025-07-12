import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from '@cinnamon-qa/logger';
import { Container, ContainerStatus } from './types';

const execAsync = promisify(exec);

export class PlaywrightMcpContainer {
  private readonly logger = createLogger({ context: 'PlaywrightMcpContainer' });
  private container: Container;
  
  constructor(
    id: string,
    name: string,
    port: number
  ) {
    this.container = {
      id,
      name,
      port,
      sseUrl: `http://localhost:${port}/sse`,
      status: ContainerStatus.STARTING,
    };
  }

  get id(): string {
    return this.container.id;
  }

  get name(): string {
    return this.container.name;
  }

  get port(): number {
    return this.container.port;
  }

  get sseUrl(): string {
    return this.container.sseUrl;
  }

  get status(): ContainerStatus {
    return this.container.status;
  }

  /**
   * Start the container
   */
  async start(): Promise<void> {
    try {
      // Check if container already exists
      const { stdout: existingContainer } = await execAsync(
        `docker ps -a --filter name=${this.container.name} --format "{{.Names}}"`
      ).catch(() => ({ stdout: '' }));

      if (existingContainer.trim() === this.container.name) {
        // Container exists, just start it
        await execAsync(`docker start ${this.container.name}`);
      } else {
        // Create and start new container
        const createCommand = [
          'docker run -d',
          `--name ${this.container.name}`,
          `-p ${this.container.port}:3000`,
          '--network cinnamon-qa-network',
          '--memory=512m',
          '--cpus=0.5',
          `--env CONTAINER_POOL_ID=${this.container.id}`,
          'mcr.microsoft.com/playwright/mcp:latest',
          '--headless',
          '--host', '0.0.0.0',
          '--port', '3000',
          '--isolated'
        ].join(' ');

        await execAsync(createCommand);
      }

      // Wait for container to be ready
      await this.waitForReady();
      this.container.status = ContainerStatus.AVAILABLE;
    } catch (error) {
      this.logger.error('Failed to start container', { containerName: this.container.name, error });
      this.container.status = ContainerStatus.UNHEALTHY;
      throw error;
    }
  }

  /**
   * Stop the container
   */
  async stop(): Promise<void> {
    try {
      await execAsync(`docker stop ${this.container.name}`);
      this.container.status = ContainerStatus.AVAILABLE;
    } catch (error) {
      this.logger.error('Failed to stop container', { containerName: this.container.name, error });
      throw error;
    }
  }

  /**
   * Restart the container
   */
  async restart(): Promise<void> {
    try {
      this.container.status = ContainerStatus.RESTARTING;
      await execAsync(`docker restart ${this.container.name}`);
      await this.waitForReady();
      this.container.status = ContainerStatus.AVAILABLE;
    } catch (error) {
      this.logger.error('Failed to restart container', { containerName: this.container.name, error });
      this.container.status = ContainerStatus.UNHEALTHY;
      throw error;
    }
  }

  /**
   * Remove the container
   */
  async remove(): Promise<void> {
    try {
      await execAsync(`docker rm -f ${this.container.name}`);
    } catch (error) {
      this.logger.error('Failed to remove container', { containerName: this.container.name, error });
      throw error;
    }
  }

  /**
   * Wait for container to be ready
   */
  private async waitForReady(maxRetries = 30, delayMs = 1000): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Check if container is running
        const { stdout } = await execAsync(
          `docker ps --filter name=${this.container.name} --filter status=running --format "{{.Names}}"`
        );

        if (stdout.trim() === this.container.name) {
          return;
        }
      } catch (error) {
        // Ignore errors during waiting
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw new Error(`Container ${this.container.name} failed to become ready`);
  }

  /**
   * Mark container as allocated
   */
  allocate(testRunId: string): void {
    this.container.status = ContainerStatus.ALLOCATED;
  }

  /**
   * Mark container as available
   */
  release(): void {
    this.container.status = ContainerStatus.AVAILABLE;
  }

  /**
   * Get container info
   */
  getInfo(): Container {
    return { ...this.container };
  }
}