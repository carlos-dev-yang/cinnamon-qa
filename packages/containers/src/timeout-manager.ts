import { EventEmitter } from 'events';
import { createLogger } from '@cinnamon-qa/logger';

export interface TimeoutConfig {
  defaultTimeoutMs: number;
  maxTimeoutMs: number;
  warningThresholdMs: number;
  enableAdaptiveTimeout: boolean;
  enableTimeoutExtension: boolean;
  maxExtensions: number;
  extensionDurationMs: number;
  timeoutStrategy: 'strict' | 'graceful' | 'adaptive';
}

export interface TimeoutSession {
  id: string;
  testRunId: string;
  startTime: Date;
  timeoutMs: number;
  originalTimeoutMs: number;
  warningsSent: number;
  extensionsUsed: number;
  strategy: 'strict' | 'graceful' | 'adaptive';
  metadata?: Record<string, any>;
}

export interface TimeoutEvent {
  sessionId: string;
  testRunId: string;
  eventType: 'warning' | 'timeout' | 'extension' | 'completed';
  remainingTimeMs: number;
  totalElapsedMs: number;
  message: string;
}

export interface TimeoutMetrics {
  totalSessions: number;
  completedSessions: number;
  timedOutSessions: number;
  extendedSessions: number;
  averageExecutionTime: number;
  averageTimeoutUtilization: number;
  timeoutPatterns: {
    shortTests: number; // < 30 seconds
    mediumTests: number; // 30s - 5 minutes
    longTests: number; // 5+ minutes
  };
}

export class TimeoutManager extends EventEmitter {
  private readonly logger = createLogger({ context: 'TimeoutManager' });
  private config: TimeoutConfig;
  private activeSessions: Map<string, TimeoutSession> = new Map();
  private sessionTimers: Map<string, NodeJS.Timeout> = new Map();
  private warningTimers: Map<string, NodeJS.Timeout> = new Map();
  private metrics: TimeoutMetrics;
  private executionHistory: Array<{
    testRunId: string;
    executionTimeMs: number;
    timeoutMs: number;
    completed: boolean;
    timestamp: Date;
  }> = [];

  constructor(config?: Partial<TimeoutConfig>) {
    super();
    this.config = {
      defaultTimeoutMs: 300000, // 5 minutes
      maxTimeoutMs: 1800000, // 30 minutes
      warningThresholdMs: 60000, // 1 minute before timeout
      enableAdaptiveTimeout: true,
      enableTimeoutExtension: true,
      maxExtensions: 2,
      extensionDurationMs: 300000, // 5 minutes
      timeoutStrategy: 'adaptive',
      ...config,
    };

    this.initializeMetrics();
  }

  /**
   * Start timeout session for a test
   */
  startSession(testRunId: string, customTimeoutMs?: number): string {
    const sessionId = `timeout-${testRunId}-${Date.now()}`;
    const timeoutMs = this.determineTimeout(testRunId, customTimeoutMs);

    const session: TimeoutSession = {
      id: sessionId,
      testRunId,
      startTime: new Date(),
      timeoutMs,
      originalTimeoutMs: timeoutMs,
      warningsSent: 0,
      extensionsUsed: 0,
      strategy: this.config.timeoutStrategy,
    };

    this.activeSessions.set(sessionId, session);
    this.setupSessionTimers(session);

    this.logger.info('Timeout session started', {
      sessionId,
      testRunId,
      timeoutMs,
      strategy: session.strategy,
    });

    this.emit('sessionStarted', { session });
    return sessionId;
  }

  /**
   * Complete timeout session
   */
  completeSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn('Session not found for completion', { sessionId });
      return;
    }

    const executionTime = Date.now() - session.startTime.getTime();
    this.cleanupSession(sessionId);

    // Record execution history
    this.executionHistory.push({
      testRunId: session.testRunId,
      executionTimeMs: executionTime,
      timeoutMs: session.timeoutMs,
      completed: true,
      timestamp: new Date(),
    });

    // Update metrics
    this.metrics.completedSessions++;
    this.updateExecutionMetrics(executionTime, session.timeoutMs);

    this.logger.info('Timeout session completed', {
      sessionId,
      testRunId: session.testRunId,
      executionTimeMs: executionTime,
      timeoutUtilization: (executionTime / session.timeoutMs * 100).toFixed(1) + '%',
    });

    this.emit('sessionCompleted', {
      session,
      executionTimeMs: executionTime,
      timeoutUtilization: executionTime / session.timeoutMs,
    });
  }

  /**
   * Request timeout extension
   */
  async requestExtension(sessionId: string, reason?: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn('Session not found for extension', { sessionId });
      return false;
    }

    if (!this.config.enableTimeoutExtension) {
      this.logger.info('Timeout extension disabled', { sessionId });
      return false;
    }

    if (session.extensionsUsed >= this.config.maxExtensions) {
      this.logger.warn('Maximum extensions reached', { 
        sessionId,
        extensionsUsed: session.extensionsUsed,
        maxExtensions: this.config.maxExtensions,
      });
      return false;
    }

    const newTimeoutMs = session.timeoutMs + this.config.extensionDurationMs;
    if (newTimeoutMs > this.config.maxTimeoutMs) {
      this.logger.warn('Extension would exceed maximum timeout', {
        sessionId,
        currentTimeout: session.timeoutMs,
        extensionDuration: this.config.extensionDurationMs,
        maxTimeout: this.config.maxTimeoutMs,
      });
      return false;
    }

    // Grant extension
    session.timeoutMs = newTimeoutMs;
    session.extensionsUsed++;
    
    // Reset timers
    this.cleanupSessionTimers(sessionId);
    this.setupSessionTimers(session);

    // Update metrics
    this.metrics.extendedSessions++;

    this.logger.info('Timeout extension granted', {
      sessionId,
      testRunId: session.testRunId,
      extensionDuration: this.config.extensionDurationMs,
      newTimeout: newTimeoutMs,
      extensionsUsed: session.extensionsUsed,
      reason,
    });

    const event: TimeoutEvent = {
      sessionId,
      testRunId: session.testRunId,
      eventType: 'extension',
      remainingTimeMs: session.timeoutMs - (Date.now() - session.startTime.getTime()),
      totalElapsedMs: Date.now() - session.startTime.getTime(),
      message: `Timeout extended by ${this.config.extensionDurationMs / 1000}s. Reason: ${reason || 'No reason provided'}`,
    };

    this.emit('timeoutExtended', { session, event });
    return true;
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId: string): {
    session?: TimeoutSession;
    remainingTimeMs: number;
    elapsedTimeMs: number;
    utilization: number;
  } | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    const elapsedTimeMs = Date.now() - session.startTime.getTime();
    const remainingTimeMs = Math.max(0, session.timeoutMs - elapsedTimeMs);
    const utilization = elapsedTimeMs / session.timeoutMs;

    return {
      session,
      remainingTimeMs,
      elapsedTimeMs,
      utilization,
    };
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): TimeoutSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get timeout metrics
   */
  getMetrics(): TimeoutMetrics {
    return { ...this.metrics };
  }

  /**
   * Get adaptive timeout recommendation
   */
  getAdaptiveTimeoutRecommendation(testRunId?: string): number {
    if (!this.config.enableAdaptiveTimeout || this.executionHistory.length < 5) {
      return this.config.defaultTimeoutMs;
    }

    // Filter relevant history
    const relevantHistory = testRunId
      ? this.executionHistory.filter(h => h.testRunId === testRunId)
      : this.executionHistory;

    if (relevantHistory.length === 0) {
      return this.config.defaultTimeoutMs;
    }

    // Calculate statistics
    const executionTimes = relevantHistory
      .filter(h => h.completed)
      .map(h => h.executionTimeMs)
      .slice(-20); // Last 20 executions

    if (executionTimes.length === 0) {
      return this.config.defaultTimeoutMs;
    }

    const avg = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
    const max = Math.max(...executionTimes);
    const p95 = this.calculatePercentile(executionTimes, 95);

    // Use P95 + 50% buffer as recommended timeout
    const recommendedTimeout = Math.min(
      Math.max(p95 * 1.5, avg * 2),
      this.config.maxTimeoutMs
    );

    this.logger.debug('Adaptive timeout calculated', {
      testRunId,
      sampleSize: executionTimes.length,
      average: avg,
      max,
      p95,
      recommendedTimeout,
    });

    return recommendedTimeout;
  }

  /**
   * Update timeout configuration
   */
  updateConfig(newConfig: Partial<TimeoutConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Timeout configuration updated', { config: newConfig });
    this.emit('configUpdated', this.config);
  }

  /**
   * Determine appropriate timeout for a test
   */
  private determineTimeout(testRunId: string, customTimeoutMs?: number): number {
    if (customTimeoutMs) {
      return Math.min(customTimeoutMs, this.config.maxTimeoutMs);
    }

    if (this.config.enableAdaptiveTimeout) {
      return this.getAdaptiveTimeoutRecommendation(testRunId);
    }

    return this.config.defaultTimeoutMs;
  }

  /**
   * Setup timers for a session
   */
  private setupSessionTimers(session: TimeoutSession): void {
    const { id: sessionId } = session;

    // Setup warning timer
    const warningTime = session.timeoutMs - this.config.warningThresholdMs;
    if (warningTime > 0) {
      const warningTimer = setTimeout(() => {
        this.handleTimeoutWarning(sessionId);
      }, warningTime);
      this.warningTimers.set(sessionId, warningTimer);
    }

    // Setup timeout timer
    const timeoutTimer = setTimeout(() => {
      this.handleTimeout(sessionId);
    }, session.timeoutMs);
    this.sessionTimers.set(sessionId, timeoutTimer);
  }

  /**
   * Handle timeout warning
   */
  private handleTimeoutWarning(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.warningsSent++;
    const remainingTimeMs = session.timeoutMs - (Date.now() - session.startTime.getTime());

    const event: TimeoutEvent = {
      sessionId,
      testRunId: session.testRunId,
      eventType: 'warning',
      remainingTimeMs,
      totalElapsedMs: Date.now() - session.startTime.getTime(),
      message: `Test will timeout in ${Math.round(remainingTimeMs / 1000)}s`,
    };

    this.logger.warn('Timeout warning issued', {
      sessionId,
      testRunId: session.testRunId,
      remainingTimeMs,
      warningsSent: session.warningsSent,
    });

    this.emit('timeoutWarning', { session, event });
  }

  /**
   * Handle session timeout
   */
  private handleTimeout(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const executionTime = Date.now() - session.startTime.getTime();
    
    // For graceful strategy, try to allow some extra time
    if (session.strategy === 'graceful' && session.extensionsUsed === 0) {
      this.logger.info('Applying graceful timeout strategy', { sessionId });
      this.requestExtension(sessionId, 'Graceful timeout strategy');
      return;
    }

    this.cleanupSession(sessionId);

    // Record execution history
    this.executionHistory.push({
      testRunId: session.testRunId,
      executionTimeMs: executionTime,
      timeoutMs: session.timeoutMs,
      completed: false,
      timestamp: new Date(),
    });

    // Update metrics
    this.metrics.timedOutSessions++;

    const event: TimeoutEvent = {
      sessionId,
      testRunId: session.testRunId,
      eventType: 'timeout',
      remainingTimeMs: 0,
      totalElapsedMs: executionTime,
      message: `Test timed out after ${Math.round(executionTime / 1000)}s`,
    };

    this.logger.error('Session timed out', {
      sessionId,
      testRunId: session.testRunId,
      executionTimeMs: executionTime,
      timeoutMs: session.timeoutMs,
      strategy: session.strategy,
    });

    this.emit('sessionTimeout', { session, event });
  }

  /**
   * Cleanup session and timers
   */
  private cleanupSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
    this.cleanupSessionTimers(sessionId);
  }

  /**
   * Cleanup session timers
   */
  private cleanupSessionTimers(sessionId: string): void {
    const timeoutTimer = this.sessionTimers.get(sessionId);
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      this.sessionTimers.delete(sessionId);
    }

    const warningTimer = this.warningTimers.get(sessionId);
    if (warningTimer) {
      clearTimeout(warningTimer);
      this.warningTimers.delete(sessionId);
    }
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): void {
    this.metrics = {
      totalSessions: 0,
      completedSessions: 0,
      timedOutSessions: 0,
      extendedSessions: 0,
      averageExecutionTime: 0,
      averageTimeoutUtilization: 0,
      timeoutPatterns: {
        shortTests: 0,
        mediumTests: 0,
        longTests: 0,
      },
    };
  }

  /**
   * Update execution metrics
   */
  private updateExecutionMetrics(executionTimeMs: number, timeoutMs: number): void {
    this.metrics.totalSessions++;
    
    // Update average execution time
    this.metrics.averageExecutionTime = 
      (this.metrics.averageExecutionTime * (this.metrics.totalSessions - 1) + executionTimeMs) / 
      this.metrics.totalSessions;

    // Update timeout utilization
    const utilization = executionTimeMs / timeoutMs;
    this.metrics.averageTimeoutUtilization = 
      (this.metrics.averageTimeoutUtilization * (this.metrics.totalSessions - 1) + utilization) / 
      this.metrics.totalSessions;

    // Update timeout patterns
    if (executionTimeMs < 30000) {
      this.metrics.timeoutPatterns.shortTests++;
    } else if (executionTimeMs < 300000) {
      this.metrics.timeoutPatterns.mediumTests++;
    } else {
      this.metrics.timeoutPatterns.longTests++;
    }
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || sorted[sorted.length - 1];
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    // Complete all active sessions
    for (const sessionId of this.activeSessions.keys()) {
      this.cleanupSession(sessionId);
    }

    this.activeSessions.clear();
    this.sessionTimers.clear();
    this.warningTimers.clear();
    this.executionHistory = [];

    this.logger.info('Timeout manager shutdown complete');
  }
}