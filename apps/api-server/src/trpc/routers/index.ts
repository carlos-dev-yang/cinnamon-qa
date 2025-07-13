import { router } from '../trpc';
import { testCaseRouter } from './testCase';
import { testRunRouter } from './testRun';
import { testStepRouter } from './testStep';
import { containerRouter } from './container';
import { aiRouter } from './ai';

export const appRouter = router({
  testCase: testCaseRouter,
  testRun: testRunRouter,
  testStep: testStepRouter,
  container: containerRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;