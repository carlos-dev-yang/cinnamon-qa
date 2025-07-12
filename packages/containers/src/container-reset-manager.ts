import { EventEmitter } from 'events';
import { createLogger } from '@cinnamon-qa/logger';
import { CleanupService, CleanupResult } from './cleanup-service';
import { PlaywrightMcpContainer } from './container';
import { SimpleHealthChecker } from './health-checker';

export interface ResetConfig {
  enableAutoReset: boolean;
  resetOnAllocation: boolean;
  resetOnRelease: boolean;
  resetOnHealthFailure: boolean;
  maxResetAttempts: number;
  resetTimeoutMs: number;
  validateAfterReset: boolean;
}

export interface ResetResult {
  success: boolean;
  method: 'cleanup' | 'restart' | 'recreate';
  durationMs: number;
  cleanupResult?: CleanupResult;
  healthCheckPassed: boolean;
  errors: string[];
}

export interface ResetStrategy {
  name: string;
  priority: number;
  execute: (container: PlaywrightMcpContainer) => Promise<ResetResult>;
}

export class ContainerResetManager extends EventEmitter {
  private readonly logger = createLogger({ context: 'ContainerResetManager' });
  private cleanupService: CleanupService;
  private healthChecker: SimpleHealthChecker;
  private config: ResetConfig;
  private resetStrategies: ResetStrategy[];
  private activeResets: Map<string, Promise<ResetResult>> = new Map();

  constructor(
    cleanupService: CleanupService,
    healthChecker: SimpleHealthChecker,
    config?: Partial<ResetConfig>
  ) {
    super();
    this.cleanupService = cleanupService;
    this.healthChecker = healthChecker;
    this.config = {
      enableAutoReset: true,
      resetOnAllocation: true,
      resetOnRelease: true,
      resetOnHealthFailure: true,
      maxResetAttempts: 3,
      resetTimeoutMs: 60000, // 1 minute
      validateAfterReset: true,
      ...config,
    };

    this.resetStrategies = this.initializeResetStrategies();
  }

  /**
   * Reset container using the most appropriate strategy
   */
  async resetContainer(container: PlaywrightMcpContainer, reason?: string): Promise<ResetResult> {
    const resetId = `${container.id}-${Date.now()}`;
    
    // Check if reset is already in progress for this container
    if (this.activeResets.has(container.id)) {
      this.logger.info('Reset already in progress for container, waiting', { containerId: container.id });
      return await this.activeResets.get(container.id)!;
    }

    const resetPromise = this.executeReset(container, reason);
    this.activeResets.set(container.id, resetPromise);

    try {
      const result = await resetPromise;
      return result;
    } finally {
      this.activeResets.delete(container.id);
    }
  }

  /**
   * Execute container reset with multiple strategies
   */
  private async executeReset(container: PlaywrightMcpContainer, reason?: string): Promise<ResetResult> {
    const startTime = Date.now();
    this.logger.info('Starting container reset', { containerName: container.name, reason: reason || 'manual' });
    
    this.emit('resetStarted', { 
      containerId: container.id, 
      containerName: container.name, 
      reason 
    });

    let lastError: Error | null = null;
    
    // Try each reset strategy in order of priority
    for (const strategy of this.resetStrategies) {
      try {
        this.logger.info('Trying reset strategy', { strategy: strategy.name });
        
        const result = await Promise.race([
          strategy.execute(container),
          this.createTimeoutPromise(this.config.resetTimeoutMs)
        ]);

        if (result.success) {
          result.durationMs = Date.now() - startTime;
          this.logger.info('Container reset successful', { strategy: strategy.name, durationMs: result.durationMs });
          
          this.emit('resetCompleted', { 
            containerId: container.id, 
            containerName: container.name, 
            strategy: strategy.name,
            result 
          });
          
          return result;
        } else {
          this.logger.warn('Reset strategy failed', { strategy: strategy.name, errors: result.errors });
          lastError = new Error(`Strategy ${strategy.name} failed: ${result.errors.join(', ')}`);
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn('Reset strategy threw error', { strategy: strategy.name, error: errorMessage });
        lastError = error instanceof Error ? error : new Error(errorMessage);
      }
    }

    // All strategies failed
    const failedResult: ResetResult = {
      success: false,
      method: 'recreate',
      durationMs: Date.now() - startTime,
      healthCheckPassed: false,
      errors: lastError ? [lastError.message] : ['All reset strategies failed'],
    };

    this.logger.error('Container reset failed after trying all strategies', { containerName: container.name });
    this.emit('resetFailed', { 
      containerId: container.id, 
      containerName: container.name, 
      result: failedResult 
    });

    return failedResult;
  }

  /**
   * Initialize reset strategies in order of preference
   */
  private initializeResetStrategies(): ResetStrategy[] {
    return [
      {
        name: 'Cleanup Reset',
        priority: 1,
        execute: async (container) => this.executeCleanupReset(container),
      },
      {
        name: 'Container Restart',
        priority: 2,
        execute: async (container) => this.executeContainerRestart(container),
      },
      {
        name: 'Container Recreate',
        priority: 3,
        execute: async (container) => this.executeContainerRecreate(container),
      },
    ].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Strategy 1: Cleanup reset (fastest, least disruptive)
   */
  private async executeCleanupReset(container: PlaywrightMcpContainer): Promise<ResetResult> {
    const startTime = Date.now();
    
    try {
      // Perform comprehensive cleanup
      const cleanupResult = await this.cleanupService.resetContainer(container.id, container.name);
      
      // Validate container health after cleanup
      let healthCheckPassed = false;
      if (this.config.validateAfterReset) {
        healthCheckPassed = await this.healthChecker.isContainerReady(container.port, container.name);
      } else {
        healthCheckPassed = true; // Skip validation
      }

      return {
        success: cleanupResult.success && healthCheckPassed,
        method: 'cleanup',
        durationMs: Date.now() - startTime,
        cleanupResult,
        healthCheckPassed,
        errors: cleanupResult.success ? [] : cleanupResult.errors,
      };
      
    } catch (error) {
      return {
        success: false,
        method: 'cleanup',
        durationMs: Date.now() - startTime,
        healthCheckPassed: false,
        errors: [error instanceof Error ? error.message : 'Cleanup reset failed'],
      };
    }
  }

  /**
   * Strategy 2: Container restart (medium disruption)
   */
  private async executeContainerRestart(container: PlaywrightMcpContainer): Promise<ResetResult> {
    const startTime = Date.now();
    
    try {
      // Restart the container
      await container.restart();
      
      // Wait for container to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Validate container health
      let healthCheckPassed = false;
      if (this.config.validateAfterReset) {
        healthCheckPassed = await this.healthChecker.isContainerReady(container.port, container.name);
      } else {
        healthCheckPassed = true;
      }

      return {
        success: healthCheckPassed,
        method: 'restart',
        durationMs: Date.now() - startTime,
        healthCheckPassed,
        errors: healthCheckPassed ? [] : ['Container failed health check after restart'],
      };
      
    } catch (error) {
      return {
        success: false,
        method: 'restart',
        durationMs: Date.now() - startTime,
        healthCheckPassed: false,
        errors: [error instanceof Error ? error.message : 'Container restart failed'],
      };
    }
  }

  /**
   * Strategy 3: Container recreate (most disruptive, highest success rate)
   */
  private async executeContainerRecreate(container: PlaywrightMcpContainer): Promise<ResetResult> {
    const startTime = Date.now();
    
    try {
      // Stop and remove the container
      await container.stop();
      await container.remove();
      
      // Start a fresh container
      await container.start();
      
      // Wait for container to be ready
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Validate container health
      let healthCheckPassed = false;
      if (this.config.validateAfterReset) {
        healthCheckPassed = await this.healthChecker.isContainerReady(container.port, container.name);
      } else {
        healthCheckPassed = true;
      }

      return {
        success: healthCheckPassed,
        method: 'recreate',
        durationMs: Date.now() - startTime,
        healthCheckPassed,
        errors: healthCheckPassed ? [] : ['Container failed health check after recreation'],
      };
      
    } catch (error) {
      return {
        success: false,
        method: 'recreate',
        durationMs: Date.now() - startTime,
        healthCheckPassed: false,
        errors: [error instanceof Error ? error.message : 'Container recreation failed'],
      };
    }
  }

  /**
   * Automatic reset trigger for container allocation
   */
  async resetOnAllocation(container: PlaywrightMcpContainer): Promise<ResetResult | null> {
    if (!this.config.enableAutoReset || !this.config.resetOnAllocation) {
      return null;
    }

    this.logger.info('Auto-reset on allocation', { containerName: container.name });
    return await this.resetContainer(container, 'allocation');
  }

  /**
   * Automatic reset trigger for container release
   */
  async resetOnRelease(container: PlaywrightMcpContainer): Promise<ResetResult | null> {
    if (!this.config.enableAutoReset || !this.config.resetOnRelease) {
      return null;
    }

    this.logger.info('Auto-reset on release', { containerName: container.name });
    return await this.resetContainer(container, 'release');
  }

  /**
   * Automatic reset trigger for health failures
   */
  async resetOnHealthFailure(container: PlaywrightMcpContainer): Promise<ResetResult | null> {
    if (!this.config.enableAutoReset || !this.config.resetOnHealthFailure) {
      return null;
    }

    this.logger.info('Auto-reset on health failure', { containerName: container.name });
    return await this.resetContainer(container, 'health_failure');
  }

  /**
   * Create a timeout promise for reset operations
   */
  private createTimeoutPromise(timeoutMs: number): Promise<ResetResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Reset operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Get reset configuration
   */
  getConfig(): ResetConfig {
    return { ...this.config };
  }

  /**
   * Update reset configuration
   */
  updateConfig(newConfig: Partial<ResetConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  /**
   * Get active reset operations
   */
  getActiveResets(): string[] {
    return Array.from(this.activeResets.keys());
  }

  /**
   * Check if container is currently being reset
   */
  isResetInProgress(containerId: string): boolean {
    return this.activeResets.has(containerId);
  }

  /**
   * Get reset statistics
   */
  getResetStats(): {
    strategies: Array<{ name: string; priority: number }>;
    activeResets: number;
    config: ResetConfig;
  } {
    return {
      strategies: this.resetStrategies.map(s => ({ name: s.name, priority: s.priority })),
      activeResets: this.activeResets.size,
      config: this.getConfig(),
    };
  }
}