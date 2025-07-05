# Project Setup & Architecture Guide

## Project Overview

This is an Nx monorepo containing a full-stack application with modern web technologies.

### Technology Stack
- **Monorepo Tool**: Nx (for task orchestration and caching)
- **Frontend**: React Router v7 with Tailwind CSS
- **Backend**: Fastify (Node.js)
- **Language**: TypeScript
- **Testing**: Vitest with React Testing Library
- **Build Tools**: Vite (frontend), esbuild (backend)

## Project Structure

```
project-root/
├── apps/
│   ├── web-client/              # React Router v7 application
│   │   ├── app/
│   │   │   ├── routes/         # File-based routing
│   │   │   ├── components/     # Shared components
│   │   │   ├── root.tsx        # App root
│   │   │   ├── entry.client.tsx
│   │   │   └── entry.server.tsx
│   │   ├── public/             # Static assets
│   │   ├── react-router.config.ts
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.js
│   │   └── package.json
│   │
│   └── api-server/             # Fastify API server
│       ├── src/
│       │   ├── main.ts         # Server entry point
│       │   └── app/
│       │       ├── app.ts      # App configuration
│       │       ├── routes/     # API endpoints
│       │       └── plugins/    # Fastify plugins
│       ├── project.json        # Nx project config
│       └── package.json
│
├── libs/                       # Shared libraries (if any)
├── tools/                      # Custom scripts and tools
├── .taskmaster/               # Task Master configuration
├── nx.json                    # Nx workspace configuration
├── tsconfig.base.json         # Base TypeScript config
├── package.json               # Root package.json
└── vitest.workspace.ts        # Vitest workspace config
```

## Development Setup

### Prerequisites
- Node.js 18+ 
- npm 8+
- Git

### Initial Setup
```bash
# Clone repository
git clone <repository-url>
cd <project-name>

# Install dependencies
npm install

# Setup Task Master
task-master init
task-master models --setup

# Verify setup
npx nx graph  # View project dependency graph
```

### Environment Configuration
Create `.env` file in root:
```env
# API Keys for Task Master
ANTHROPIC_API_KEY=your_key_here
PERPLEXITY_API_KEY=your_key_here

# Application Environment Variables
NODE_ENV=development
API_PORT=3000
CLIENT_PORT=5173
```

## Development Commands

### Running Applications

```bash
# Start web client dev server (http://localhost:5173)
npx nx dev web-client

# Start API server (http://localhost:3000)
npx nx serve api-server

# Run both in parallel
npx nx run-many -t dev,serve

# Run with specific configuration
npx nx serve api-server --configuration=production
```

### Building Applications

```bash
# Build web client
npx nx build web-client

# Build API server
npx nx build api-server

# Build all projects
npx nx run-many -t build

# Build only affected projects
npx nx affected:build
```

### Testing

```bash
# Run tests for specific project
npx nx test web-client
npx nx test api-server

# Run all tests
npx nx run-many -t test

# Run tests in watch mode
npx nx test web-client --watch

# Run tests with coverage
npx nx test web-client --coverage

# Run only affected tests
npx nx affected:test
```

### Code Quality

```bash
# Type checking
npx nx typecheck web-client
npx nx typecheck api-server

# Linting
npx nx lint web-client
npx nx lint api-server

# Format code
npx nx format:write

# Run all checks
npx nx run-many -t typecheck,lint
```

## Nx-Specific Features

### Task Caching
Nx caches task outputs for faster subsequent runs:
```bash
# Clear cache if needed
npx nx reset

# Run without cache
npx nx build web-client --skip-nx-cache
```

### Dependency Graph
```bash
# Visualize project dependencies
npx nx graph

# Show affected projects
npx nx affected:graph
```

### Generators
```bash
# Generate new React component
npx nx g @nx/react:component Button --project=web-client

# Generate new React page/route
npx nx g @nx/react:component --project=web-client --directory=app/routes

# Generate new library
npx nx g @nx/workspace:lib shared-utils

# List available generators
npx nx list
```

## Application Architecture

### Web Client (React Router v7)

#### Key Files
- `react-router.config.ts` - Framework configuration
- `vite.config.ts` - Build and dev server config
- `app/root.tsx` - Application shell
- `app/routes/` - File-based routing

#### Routing Structure
```
app/routes/
├── _index.tsx          # Home page (/)
├── about.tsx          # About page (/about)
├── auth/
│   ├── login.tsx      # Login (/auth/login)
│   └── register.tsx   # Register (/auth/register)
└── dashboard/
    ├── _layout.tsx    # Dashboard layout
    └── index.tsx      # Dashboard home (/dashboard)
```

#### Styling with Tailwind
```tsx
// Using Tailwind classes
<div className="container mx-auto px-4 py-8">
  <h1 className="text-3xl font-bold text-gray-900">
    Welcome
  </h1>
</div>
```

### API Server (Fastify)

#### Key Concepts
- **Plugins**: Encapsulated functionality
- **Decorators**: Extend Fastify instance
- **Hooks**: Lifecycle event handlers
- **Schemas**: Request/response validation

#### Basic Route Structure
```typescript
// src/app/routes/users.ts
import { FastifyPluginAsync } from 'fastify';

const users: FastifyPluginAsync = async (fastify) => {
  fastify.get('/users', async (request, reply) => {
    return { users: [] };
  });
  
  fastify.post('/users', async (request, reply) => {
    // Create user logic
  });
};

export default users;
```

#### Plugin Registration
```typescript
// src/app/app.ts
import users from './routes/users';

export async function app(fastify: FastifyInstance) {
  // Register plugins
  await fastify.register(users, { prefix: '/api' });
}
```

## Configuration Files

### TypeScript Configuration

#### Base Config (tsconfig.base.json)
```json
{
  "compilerOptions": {
    "rootDir": ".",
    "sourceMap": true,
    "declaration": false,
    "moduleResolution": "node",
    "target": "es2022",
    "module": "esnext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": {
      "@web-client/*": ["apps/web-client/app/*"],
      "@api-server/*": ["apps/api-server/src/*"]
    }
  }
}
```

### Nx Configuration (nx.json)
```json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": [
          "build",
          "lint",
          "test",
          "typecheck"
        ]
      }
    }
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "cache": true
    },
    "test": {
      "cache": true
    }
  }
}
```

### Vitest Configuration
```typescript
// vitest.workspace.ts
export default defineWorkspace([
  './apps/web-client/vite.config.ts',
  './apps/api-server/vite.config.ts'
]);
```

## Deployment

### Building for Production
```bash
# Build all applications
npx nx run-many -t build --configuration=production

# Output locations
# - apps/web-client/dist/
# - apps/api-server/dist/
```

### Environment-Specific Builds
```bash
# Development build
npx nx build web-client --configuration=development

# Staging build
npx nx build web-client --configuration=staging

# Production build
npx nx build web-client --configuration=production
```

## Common Tasks

### Adding a New Feature
1. Create feature branch following git workflow
2. Generate component: `npx nx g @nx/react:component`
3. Add route file in `app/routes/`
4. Implement feature with tests
5. Update API endpoints if needed

### Adding API Endpoint
1. Create route file in `api-server/src/app/routes/`
2. Implement endpoint logic
3. Add validation schemas
4. Write tests
5. Update API documentation

### Sharing Code Between Apps
1. Generate shared library: `npx nx g @nx/workspace:lib`
2. Export functions/components
3. Import in apps using path aliases

## Troubleshooting

### Common Issues

**Port already in use**
```bash
# Find process using port
lsof -i :5173  # or :3000 for API

# Kill process
kill -9 <PID>
```

**Nx cache issues**
```bash
# Clear all caches
npx nx reset

# Delete node_modules and reinstall
rm -rf node_modules
npm install
```

**TypeScript path resolution**
- Check `tsconfig.base.json` paths
- Ensure imports match configured paths
- Restart TS server in IDE

**Build failures**
```bash
# Check for circular dependencies
npx nx graph

# Build with verbose logging
npx nx build web-client --verbose
```

### Performance Optimization

**Development**
- Use `npx nx affected:*` commands
- Enable Nx cache
- Run only necessary projects

**Production**
- Enable production builds
- Use environment-specific configs
- Optimize bundle sizes

## Best Practices

### Code Organization
1. Keep components small and focused
2. Use proper TypeScript types
3. Follow consistent naming conventions
4. Organize by feature, not by type

### Testing Strategy
1. Unit test business logic
2. Integration test API endpoints
3. E2E test critical user flows
4. Maintain good test coverage

### Performance
1. Use React.lazy for code splitting
2. Implement proper caching strategies
3. Optimize images and assets
4. Monitor bundle sizes

---

_This guide covers the essential aspects of the project structure and development workflow._