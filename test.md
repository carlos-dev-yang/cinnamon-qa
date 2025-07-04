# AI Agent Working Principles & Task Master Integration Guide

## 🚨 CRITICAL: Core Working Principles

### These principles MUST be followed for EVERY task, without exception:

1. **Single Task Focus**
   - Work ONLY on the currently assigned task
   - Do NOT start working on other tasks without explicit permission
   - If you notice issues outside the current task scope, document them but DO NOT fix them

2. **Task Completion Protocol**
   - When a task is complete:
     - Change status to `done` using `task-master set-status --id=<id> --status=done`
     - STOP and ASK the user before proceeding to the next task
     - Never automatically continue to the next task

3. **Branch Management**
   - ALWAYS create a new feature branch for each task:
     ```bash
     git checkout -b task/<task-id>-<brief-description>
     # Example: git checkout -b task/1.2-user-authentication
     ```
   - Never work directly on main/master branch
   - One branch per task, no exceptions

4. **Granular Commits**
   - Commit after each small, logical unit of work
   - Use descriptive commit messages:
     ```bash
     git commit -m "feat(auth): add JWT token generation logic"
     git commit -m "test(auth): add unit tests for password hashing"
     git commit -m "docs(auth): update API documentation for login endpoint"
     ```
   - Follow conventional commit format: `type(scope): description`

5. **GitHub Issue Synchronization**
   - Create/update GitHub issue for each task:
     ```bash
     gh issue create --title "Task <id>: <title>" --label "task-<status>"
     gh issue edit <number> --add-label "in-progress" --remove-label "pending"
     ```
   - Log all progress as issue comments
   - Update issue status labels to match task status
   - Close issue when task is marked as done

---

## Task Management

### Use Task Master for:
- Finding next task: `task-master next`
- Viewing task details: `task-master show <id>`
- Updating task status: `task-master set-status --id=<id> --status=<status>`
- Logging progress: `task-master update-subtask --id=<id> --prompt="notes"`

Run `task-master help` for full command reference.

---
## Standard Workflow

1. **Get task** → `task-master next`
2. **Create branch** → `git checkout -b task/<id>-<description>`
3. **Create/update issue** → GitHub issue with task details
4. **Set status** → `task-master set-status --id=<id> --status=in-progress`
5. **Work & commit** → Small, frequent commits with clear messages
6. **Log progress** → Update subtask notes and issue comments
7. **Complete** → Set status to done, close issue
8. **STOP** → Ask user before proceeding

---

## Configuration

- **API Key**: Set `ANTHROPIC_API_KEY` or `PERPLEXITY_API_KEY` in `.env`
- **Models**: Configure with `task-master models --setup`

---

## Important Reminders

- **NEVER** work on multiple tasks simultaneously
- **NEVER** proceed to the next task without permission
- **ALWAYS** create a task-specific branch
- **ALWAYS** commit frequently with clear messages
- **ALWAYS** sync with GitHub issues
- **DOCUMENT** progress in both Task Master and GitHub
- **FOCUS** only on the assigned task scope

---

## Project Overview

This is an Nx monorepo containing a full-stack application with:
- **web-client**: React Router v7 web application with Tailwind CSS
- **api-server**: Fastify-based Node.js API server

## Essential Commands

### Development
```bash
# Run the web client development server
npx nx dev web-client

# Run the API server
npx nx serve api-server

# Run both in parallel
npx nx run-many -t dev,serve
```

### Building
```bash
# Build web client
npx nx build web-client

# Build API server  
npx nx build api-server

# Build all projects
npx nx run-many -t build
```

### Testing
```bash
# Run tests for a specific project
npx nx test web-client
npx nx test api-server

# Run all tests
npx nx run-many -t test

# Run tests in watch mode
npx nx test web-client --watch

# Run tests with coverage
npx nx test web-client --coverage
```

### Type Checking & Linting
```bash
# Type check a project
npx nx typecheck web-client
npx nx typecheck api-server

# Lint a project
npx nx lint web-client
npx nx lint api-server

# Run all checks
npx nx run-many -t typecheck,lint
```

### Nx-Specific Commands
```bash
# Visualize project graph
npx nx graph

# Show project details
npx nx show project web-client
npx nx show project api-server

# Generate new components/applications
npx nx g @nx/react:component my-component --project=web-client
npx nx g @nx/react:app new-app
```

## Architecture Overview

### Monorepo Structure
- **Nx Workspace**: Uses Nx for task orchestration, caching, and dependency management
- **Workspaces**: Configured with npm workspaces in `apps/*`
- **Shared Configuration**: TypeScript, ESLint, and build configurations are centralized

### Web Client (`apps/web-client`)
- **Framework**: React Router v7 (modern React framework with SSR capabilities)
- **Styling**: Tailwind CSS with PostCSS
- **Build Tool**: Vite for development and production builds
- **Testing**: Vitest with React Testing Library
- **Key Files**:
  - `react-router.config.ts`: React Router configuration
  - `vite.config.ts`: Vite and test configuration
  - `app/routes/`: File-based routing directory
  - `app/root.tsx`: Application root component
  - `app/entry.{client,server}.tsx`: Entry points for client/server

### API Server (`apps/api-server`)
- **Framework**: Fastify (high-performance Node.js web framework)
- **Build Tool**: esbuild for fast TypeScript compilation
- **Plugin System**: Uses Fastify's plugin architecture
- **Key Files**:
  - `src/main.ts`: Server entry point
  - `src/app/app.ts`: Main application setup
  - `src/app/routes/`: API route definitions
  - `src/app/plugins/`: Fastify plugins

### Development Workflow
1. **Dependency Graph**: Nx automatically handles build dependencies between projects
2. **Caching**: Build outputs are cached for faster subsequent builds
3. **Affected Commands**: Use `npx nx affected:*` commands to run tasks only for changed projects
4. **Task Orchestration**: Nx runs tasks in optimal order based on project dependencies

### Testing Strategy
- **Unit Tests**: Vitest for both frontend and backend
- **Test Location**: Tests are co-located with source files or in `tests/` directories
- **Coverage**: Coverage reports generated in `test-output/vitest/coverage`

### Important Configuration Files
- `nx.json`: Nx workspace configuration and task defaults
- `tsconfig.base.json`: Shared TypeScript configuration
- `vitest.workspace.ts`: Vitest workspace configuration
- `apps/*/tsconfig.json`: Project-specific TypeScript configs
- `apps/*/eslint.config.mjs`: Project-specific ESLint configs

---

_This guide enforces strict task boundaries and proper development practices for AI agents._