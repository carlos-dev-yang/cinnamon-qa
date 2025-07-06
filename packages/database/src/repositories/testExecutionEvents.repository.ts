import { BaseRepository } from './base.repository';
import type { 
  TestExecutionEvent, 
  TestExecutionEventInsert, 
  EventType,
  StepAdaptation 
} from '../types/database';

export class TestExecutionEventsRepository extends BaseRepository {
  private readonly tableName = 'test_execution_events';

  /**
   * Create a new test execution event
   */
  async create(data: TestExecutionEventInsert): Promise<TestExecutionEvent> {
    const { data: result, error } = await this.client
      .from(this.tableName)
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test execution event: ${error.message}`);
    }

    return result;
  }

  /**
   * Get events for a test run
   */
  async getByTestRunId(testRunId: string): Promise<TestExecutionEvent[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('test_run_id', testRunId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get events for test run: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get events for a test step
   */
  async getByTestStepId(testStepId: string): Promise<TestExecutionEvent[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('test_step_id', testStepId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get events for test step: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get events by type for a test run
   */
  async getByTypeAndTestRun(
    testRunId: string, 
    eventType: EventType
  ): Promise<TestExecutionEvent[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('test_run_id', testRunId)
      .eq('event_type', eventType)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get events by type: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get latest events for real-time monitoring
   */
  async getLatestEvents(limit: number = 50): Promise<TestExecutionEvent[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get latest events: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create step start event
   */
  async createStepStartEvent(
    testRunId: string,
    testStepId: string,
    stepData: {
      stepNumber: number;
      action: string;
      target?: any;
    }
  ): Promise<TestExecutionEvent> {
    const event: TestExecutionEventInsert = {
      test_run_id: testRunId,
      test_step_id: testStepId,
      event_type: 'step_start',
      event_data: {
        stepNumber: stepData.stepNumber,
        action: stepData.action,
        target: stepData.target,
        timestamp: new Date().toISOString()
      },
      message: `Starting step ${stepData.stepNumber}: ${stepData.action}`
    };

    return this.create(event);
  }

  /**
   * Create step complete event
   */
  async createStepCompleteEvent(
    testRunId: string,
    testStepId: string,
    stepData: {
      stepNumber: number;
      action: string;
      duration?: number;
      hasScreenshot?: boolean;
    }
  ): Promise<TestExecutionEvent> {
    const event: TestExecutionEventInsert = {
      test_run_id: testRunId,
      test_step_id: testStepId,
      event_type: 'step_complete',
      event_data: {
        stepNumber: stepData.stepNumber,
        action: stepData.action,
        duration: stepData.duration,
        hasScreenshot: stepData.hasScreenshot || false,
        timestamp: new Date().toISOString()
      },
      message: `Completed step ${stepData.stepNumber} in ${stepData.duration}ms`
    };

    return this.create(event);
  }

  /**
   * Create step error event
   */
  async createStepErrorEvent(
    testRunId: string,
    testStepId: string,
    stepData: {
      stepNumber: number;
      action: string;
      errorType: string;
      errorMessage: string;
      duration?: number;
    }
  ): Promise<TestExecutionEvent> {
    const event: TestExecutionEventInsert = {
      test_run_id: testRunId,
      test_step_id: testStepId,
      event_type: 'step_error',
      event_data: {
        stepNumber: stepData.stepNumber,
        action: stepData.action,
        errorType: stepData.errorType,
        duration: stepData.duration,
        timestamp: new Date().toISOString()
      },
      message: stepData.errorMessage
    };

    return this.create(event);
  }

  /**
   * Create step adapted event
   */
  async createStepAdaptedEvent(
    testRunId: string,
    testStepId: string,
    stepData: {
      stepNumber: number;
      action: string;
    },
    adaptation: StepAdaptation
  ): Promise<TestExecutionEvent> {
    const event: TestExecutionEventInsert = {
      test_run_id: testRunId,
      test_step_id: testStepId,
      event_type: 'step_adapted',
      event_data: {
        stepNumber: stepData.stepNumber,
        action: stepData.action,
        originalAction: adaptation.originalAction,
        adaptedAction: adaptation.adaptedAction,
        confidence: adaptation.confidence,
        timestamp: new Date().toISOString()
      },
      adaptation,
      message: `Step ${stepData.stepNumber} adapted: ${adaptation.reason}`
    };

    return this.create(event);
  }

  /**
   * Create recovery attempted event
   */
  async createRecoveryAttemptedEvent(
    testRunId: string,
    testStepId: string,
    stepData: {
      stepNumber: number;
      action: string;
    },
    recovery: {
      strategy: string;
      reason: string;
      success: boolean;
      waitTime?: number;
    }
  ): Promise<TestExecutionEvent> {
    const event: TestExecutionEventInsert = {
      test_run_id: testRunId,
      test_step_id: testStepId,
      event_type: 'recovery_attempted',
      event_data: {
        stepNumber: stepData.stepNumber,
        action: stepData.action,
        strategy: recovery.strategy,
        success: recovery.success,
        waitTime: recovery.waitTime,
        timestamp: new Date().toISOString()
      },
      message: `Recovery ${recovery.success ? 'succeeded' : 'failed'}: ${recovery.reason}`
    };

    return this.create(event);
  }

  /**
   * Create test complete event
   */
  async createTestCompleteEvent(
    testRunId: string,
    summary: {
      status: string;
      totalSteps: number;
      completedSteps: number;
      failedSteps: number;
      adaptedSteps: number;
      duration: number;
      adaptationCount: number;
    }
  ): Promise<TestExecutionEvent> {
    const event: TestExecutionEventInsert = {
      test_run_id: testRunId,
      event_type: 'test_complete',
      event_data: {
        ...summary,
        timestamp: new Date().toISOString()
      },
      message: `Test ${summary.status} - ${summary.completedSteps}/${summary.totalSteps} steps completed`
    };

    return this.create(event);
  }

  /**
   * Get event timeline for a test run (for UI display)
   */
  async getEventTimeline(testRunId: string): Promise<Array<{
    timestamp: string;
    eventType: EventType;
    stepNumber?: number;
    message: string;
    details: any;
    adaptation?: StepAdaptation;
  }>> {
    const events = await this.getByTestRunId(testRunId);

    return events.map(event => ({
      timestamp: event.created_at,
      eventType: event.event_type,
      stepNumber: event.event_data?.stepNumber,
      message: event.message || '',
      details: event.event_data,
      adaptation: event.adaptation
    }));
  }

  /**
   * Get adaptation events for learning purposes
   */
  async getAdaptationEvents(
    testCaseId?: string,
    limit: number = 100
  ): Promise<TestExecutionEvent[]> {
    let query = this.client
      .from(this.tableName)
      .select(`
        *,
        test_runs!inner(test_case_id)
      `)
      .eq('event_type', 'step_adapted')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (testCaseId) {
      query = query.eq('test_runs.test_case_id', testCaseId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get adaptation events: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get event statistics for monitoring
   */
  async getEventStats(
    startDate?: string,
    endDate?: string
  ): Promise<{
    totalEvents: number;
    eventsByType: Record<EventType, number>;
    adaptationRate: number;
    recoverySuccessRate: number;
  }> {
    let query = this.client
      .from(this.tableName)
      .select('event_type, event_data');

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get event stats: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return {
        totalEvents: 0,
        eventsByType: {} as Record<EventType, number>,
        adaptationRate: 0,
        recoverySuccessRate: 0
      };
    }

    const stats = data.reduce(
      (acc, event) => {
        acc.totalEvents += 1;
        acc.eventsByType[event.event_type] = (acc.eventsByType[event.event_type] || 0) + 1;

        // Track recovery success rate
        if (event.event_type === 'recovery_attempted') {
          acc.recoveryAttempts += 1;
          if (event.event_data?.success) {
            acc.recoverySuccesses += 1;
          }
        }

        return acc;
      },
      {
        totalEvents: 0,
        eventsByType: {} as Record<EventType, number>,
        recoveryAttempts: 0,
        recoverySuccesses: 0
      }
    );

    const stepStarts = stats.eventsByType.step_start || 0;
    const stepAdapted = stats.eventsByType.step_adapted || 0;
    const adaptationRate = stepStarts > 0 ? stepAdapted / stepStarts : 0;
    const recoverySuccessRate = stats.recoveryAttempts > 0 ? 
      stats.recoverySuccesses / stats.recoveryAttempts : 0;

    return {
      totalEvents: stats.totalEvents,
      eventsByType: stats.eventsByType,
      adaptationRate,
      recoverySuccessRate
    };
  }

  /**
   * Subscribe to real-time events for SSE
   * Note: This would typically use Supabase realtime subscriptions
   */
  subscribeToTestRunEvents(
    testRunId: string,
    callback: (event: TestExecutionEvent) => void
  ) {
    return this.client
      .channel(`test_run_${testRunId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: this.tableName,
          filter: `test_run_id=eq.${testRunId}`
        },
        (payload) => {
          callback(payload.new as TestExecutionEvent);
        }
      )
      .subscribe();
  }

  /**
   * Delete old event records
   */
  async deleteOldEvents(olderThanDays: number = 30): Promise<number> {
    const threshold = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await this.client
      .from(this.tableName)
      .delete()
      .lt('created_at', threshold)
      .select('id');

    if (error) {
      throw new Error(`Failed to delete old events: ${error.message}`);
    }

    return data?.length || 0;
  }
}