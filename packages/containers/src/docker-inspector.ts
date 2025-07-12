import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from '@cinnamon-qa/logger';

const execAsync = promisify(exec);

export class DockerInspector {
  private readonly logger = createLogger({ context: 'DockerInspector' });
  private readonly playwrightMcpImage = 'mcr.microsoft.com/playwright/mcp:latest';

  /**
   * Check if Docker is installed and running
   */
  async checkDockerInstallation(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('docker --version');
      this.logger.info('Docker version detected', { version: stdout.trim() });
      return true;
    } catch (error) {
      this.logger.error('Docker not installed or not accessible', { error });
      return false;
    }
  }

  /**
   * Check if Docker daemon is running
   */
  async checkDockerService(): Promise<boolean> {
    try {
      await execAsync('docker info');
      return true;
    } catch (error) {
      this.logger.error('Docker daemon is not running', { error });
      return false;
    }
  }

  /**
   * Check if Playwright-MCP image exists, pull if not
   */
  async ensurePlaywrightMCPImage(): Promise<boolean> {
    try {
      // Check if image exists
      const { stdout } = await execAsync(`docker images -q ${this.playwrightMcpImage}`);
      
      if (stdout.trim()) {
        this.logger.info('Playwright-MCP image already exists');
        return true;
      }

      // Pull image if not exists
      this.logger.info('Pulling Playwright-MCP image', { image: this.playwrightMcpImage });
      await execAsync(`docker pull ${this.playwrightMcpImage}`);
      this.logger.info('Playwright-MCP image pulled successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to ensure Playwright-MCP image', { error });
      return false;
    }
  }

  /**
   * Setup Docker network for containers
   */
  async setupDockerNetwork(): Promise<string> {
    const networkName = 'cinnamon-qa-network';
    
    try {
      // Check if network exists
      const { stdout } = await execAsync(`docker network ls --filter name=${networkName} --format "{{.Name}}"`);
      
      if (stdout.trim() === networkName) {
        this.logger.info('Docker network already exists', { networkName });
        return networkName;
      }

      // Create network if not exists
      await execAsync(`docker network create ${networkName}`);
      this.logger.info('Docker network created', { networkName });
      return networkName;
    } catch (error) {
      // Check if error is about network already existing
      if (error instanceof Error && error.message.includes('already exists')) {
        this.logger.info('Docker network already exists', { networkName });
        return networkName;
      }
      this.logger.error('Failed to setup Docker network', { error });
      throw error;
    }
  }

  /**
   * Initialize Docker environment for containers
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing Docker environment');
    
    // Check Docker installation
    const isDockerInstalled = await this.checkDockerInstallation();
    if (!isDockerInstalled) {
      throw new Error('Docker is not installed. Please install Docker first.');
    }

    // Check Docker service
    const isDockerRunning = await this.checkDockerService();
    if (!isDockerRunning) {
      throw new Error('Docker daemon is not running. Please start Docker.');
    }

    // Ensure Playwright-MCP image
    const hasImage = await this.ensurePlaywrightMCPImage();
    if (!hasImage) {
      throw new Error('Failed to ensure Playwright-MCP image');
    }

    // Setup network
    await this.setupDockerNetwork();

    this.logger.info('Docker environment initialized successfully');
  }
}