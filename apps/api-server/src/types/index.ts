import { z } from 'zod';

// Test Case Types
export const TestCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  scenario: z.string(),
  aiAnalysis: z.object({
    steps: z.array(z.object({
      action: z.string(),
      selector: z.string().optional(),
      value: z.string().optional(),
      description: z.string(),
    })),
    patterns: z.array(z.string()),
  }).optional(),
  reliabilityScore: z.number().min(0).max(100),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TestCase = z.infer<typeof TestCaseSchema>;

// Test Run Types
export const TestRunStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);

export const TestRunSchema = z.object({
  id: z.string(),
  testCaseId: z.string(),
  status: TestRunStatusSchema,
  progress: z.number().min(0).max(100),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  containerId: z.string().optional(),
  results: z.object({
    totalSteps: z.number(),
    completedSteps: z.number(),
    failedSteps: z.number(),
    adaptations: z.number(),
  }).optional(),
  createdAt: z.date(),
});

export type TestRun = z.infer<typeof TestRunSchema>;
export type TestRunStatus = z.infer<typeof TestRunStatusSchema>;

// Test Step Types
export const TestStepStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'adapted']);

export const TestStepSchema = z.object({
  id: z.string(),
  testRunId: z.string(),
  stepIndex: z.number(),
  action: z.string(),
  selector: z.string().optional(),
  value: z.string().optional(),
  status: TestStepStatusSchema,
  screenshot: z.string().optional(), // Base64 encoded WebP
  pageState: z.object({
    url: z.string(),
    title: z.string(),
    html: z.string(),
  }).optional(),
  adaptation: z.object({
    originalSelector: z.string().optional(),
    newSelector: z.string().optional(),
    reason: z.string(),
    confidence: z.number().min(0).max(1),
  }).optional(),
  error: z.string().optional(),
  executedAt: z.date().optional(),
});

export type TestStep = z.infer<typeof TestStepSchema>;
export type TestStepStatus = z.infer<typeof TestStepStatusSchema>;

// Container Types
export const ContainerStatusSchema = z.enum(['creating', 'ready', 'busy', 'unhealthy', 'stopped']);

export const ContainerSchema = z.object({
  id: z.string(),
  dockerId: z.string(),
  status: ContainerStatusSchema,
  createdAt: z.date(),
  lastHealthCheck: z.date(),
  allocatedTo: z.string().optional(), // Test run ID
  metrics: z.object({
    cpu: z.number(),
    memory: z.number(),
  }).optional(),
});

export type Container = z.infer<typeof ContainerSchema>;
export type ContainerStatus = z.infer<typeof ContainerStatusSchema>;

// SSE Event Types
export const TestProgressEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('step_start'),
    stepIndex: z.number(),
    action: z.string(),
  }),
  z.object({
    type: z.literal('step_complete'),
    stepIndex: z.number(),
    status: TestStepStatusSchema,
    screenshot: z.string().optional(),
  }),
  z.object({
    type: z.literal('step_error'),
    stepIndex: z.number(),
    error: z.string(),
  }),
  z.object({
    type: z.literal('step_adapted'),
    stepIndex: z.number(),
    adaptation: z.object({
      originalSelector: z.string().optional(),
      newSelector: z.string().optional(),
      reason: z.string(),
      confidence: z.number(),
    }),
  }),
  z.object({
    type: z.literal('recovery_attempted'),
    stepIndex: z.number(),
    strategy: z.string(),
  }),
  z.object({
    type: z.literal('test_complete'),
    status: TestRunStatusSchema,
    results: z.object({
      totalSteps: z.number(),
      completedSteps: z.number(),
      failedSteps: z.number(),
      adaptations: z.number(),
    }),
  }),
]);

export type TestProgressEvent = z.infer<typeof TestProgressEventSchema>;