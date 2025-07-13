import { router } from '../trpc';
import { testCaseRouter } from './testCase';
import { testRunRouter } from './testRun';
import { testStepRouter } from './testStep';
import { containerRouter } from './container';

export const appRouter = router({
  testCase: testCaseRouter,
  testRun: testRunRouter,
  testStep: testStepRouter,
  container: containerRouter,
});

export type AppRouter = typeof appRouter;