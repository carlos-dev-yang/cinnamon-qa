# Project Context for Claude Code

This is an AI-assisted development project using Task Master for structured task management.

## 🚨 CRITICAL: Read `agents.md` First

**ALWAYS** follow the core working principles outlined in [`agents.md`](./agents.md):
- Single task focus - work on ONE task at a time
- Create feature branches for main tasks
- Commit after each subtask completion
- Sync with GitHub issues
- Use Task Master for all task management

## Quick Start

```bash
# Get your next task
task-master next

# View task details
task-master show <id>

# When done with task
task-master set-status --id=<id> --status=done
```

## Documentation Structure

### Essential Reading
1. **[`agents.md`](./agents.md)** - Core working principles (READ FIRST)
   - Critical rules for AI agents
   - Standard workflow
   - Quick command reference

### Reference Guides
2. **[`task-master-guide.md`](./ai-guide/task-master-guide.md)** - Complete Task Master documentation
   - All available commands
   - AI-powered features
   - MCP integration details
   - Troubleshooting

3. **[`git-workflow.md`](./ai-guide/git-workflow-guide.md.md)** - Git procedures
   - Branch naming conventions
   - Commit message format
   - GitHub issue integration
   - PR guidelines

4. **[`project-setup.md`](./ai-guide/project-architecture.md.md)** - Project architecture
   - Technology stack overview
   - Directory structure
   - Development commands
   - Build and deployment

## Current Project Status

### Active Tasks
Check current tasks with:
```bash
task-master list
task-master next
```

### Project Structure
- **Frontend**: React Router v7 app in `apps/web-client/`
- **Backend**: Fastify API in `apps/api-server/`
- **Tasks**: Managed in `.taskmaster/tasks/`

## Common Workflows

### Starting a New Task
1. `task-master next` - Get next available task
2. `git checkout -b task/<id>-<description>` - Create branch
3. `task-master set-status --id=<id> --status=in-progress` - Update status
4. Work on subtasks, committing after each
5. `task-master set-status --id=<id> --status=done` - Complete task

### Need More Details?
- For Task Master commands → See [`task-master-guide.md`](./task-master-guide.md)
- For Git procedures → See [`git-workflow.md`](./git-workflow.md)
- For project info → See [`project-setup.md`](./project-setup.md)

## Environment Setup

Required API keys in `.env`:
```env
ANTHROPIC_API_KEY=<your-key>
PERPLEXITY_API_KEY=<your-key>  # For research features
```

## Important Reminders

1. **Never** work on multiple tasks simultaneously
2. **Always** create a feature branch for main tasks
3. **Always** use Task Master commands (never edit tasks.json directly)
4. **Always** commit after completing each subtask
5. **Always** ask before moving to the next task

---

_This file is auto-loaded by Claude Code. Always start by reviewing the current task with `task-master next`._