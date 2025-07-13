import { FastifyPluginAsync } from 'fastify';

const apiRoutes: FastifyPluginAsync = async (fastify) => {
  // Test Cases
  fastify.post('/api/test-cases', async (request, reply) => {
    const { name, url, scenario } = request.body as any;
    
    const testCase = {
      id: Date.now().toString(),
      name,
      url,
      scenario,
      reliabilityScore: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    return reply.send(testCase);
  });

  fastify.get('/api/test-cases', async (request, reply) => {
    return reply.send({
      items: [],
      total: 0,
      hasMore: false,
    });
  });

  fastify.get('/api/test-cases/:id', async (request, reply) => {
    const { id } = request.params as any;
    
    return reply.send({
      id,
      name: 'Sample Test Case',
      url: 'https://example.com',
      scenario: 'Sample scenario',
      reliabilityScore: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  // Test Runs
  fastify.post('/api/test-runs', async (request, reply) => {
    const { testCaseId } = request.body as any;
    
    const testRun = {
      id: Date.now().toString(),
      testCaseId,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
    };
    
    return reply.send(testRun);
  });

  fastify.get('/api/test-runs/:id', async (request, reply) => {
    const { id } = request.params as any;
    
    return reply.send({
      id,
      testCaseId: 'test-case-1',
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
    });
  });

  // Test Steps
  fastify.get('/api/test-runs/:testRunId/steps', async (request, reply) => {
    return reply.send({
      steps: [],
      totalSteps: 0,
      completedSteps: 0,
      failedSteps: 0,
      adaptedSteps: 0,
    });
  });

  // Containers
  fastify.get('/api/containers', async (request, reply) => {
    return reply.send({
      containers: [],
      total: 0,
      healthy: 0,
      busy: 0,
      unhealthy: 0,
    });
  });

  // Health check
  fastify.get('/api/health', async (request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date(),
      uptime: process.uptime(),
    });
  });
};

export default apiRoutes;