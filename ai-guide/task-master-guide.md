# Task Master AI - Complete Guide

## Overview

Task Master AI is a task management system designed for AI-assisted development workflows. It provides structured task hierarchies, AI-powered task generation from PRDs, and seamless integration with development tools.

## Installation & Setup

### Initial Setup
```bash
# Install globally
npm install -g task-master-ai

# Or use with npx
npx task-master-ai <command>

# Initialize in project
task-master init
```

### Configuration Requirements
At least ONE API key must be configured in `.env`:
- `ANTHROPIC_API_KEY` - Claude models (recommended)
- `PERPLEXITY_API_KEY` - Research features (highly recommended)
- `OPENAI_API_KEY` - GPT models
- `GOOGLE_API_KEY` - Gemini models
- `MISTRAL_API_KEY` - Mistral models
- `OPENROUTER_API_KEY` - Multiple models
- `XAI_API_KEY` - Grok models

### Model Configuration
```bash
# Interactive setup (recommended)
task-master models --setup

# Manual configuration
task-master models --set-main claude-3-5-sonnet-20241022
task-master models --set-research perplexity-llama-3.1-sonar-large-128k-online
task-master models --set-fallback gpt-4o-mini

# View current configuration
task-master models
```

## Core Commands

### Project Initialization
```bash
# Initialize Task Master in current directory
task-master init

# Parse PRD to generate tasks
task-master parse-prd .taskmaster/docs/prd.txt

# Append new tasks from additional PRD
task-master parse-prd .taskmaster/docs/updates.txt --append
```

### Daily Workflow Commands
```bash
# List all tasks with their status
task-master list

# Get next available task
task-master next

# View detailed task information
task-master show 1.2

# Update task status
task-master set-status --id=1.2 --status=in-progress
task-master set-status --id=1.2 --status=done

# Add implementation notes to subtask
task-master update-subtask --id=1.2.1 --prompt="Implemented JWT token generation using jsonwebtoken library"
```

### Task Management
```bash
# Add new task with AI assistance
task-master add-task --prompt="Add data validation middleware" --research

# Expand task into subtasks
task-master expand --id=2 --research --force

# Update specific task
task-master update-task --id=2.1 --prompt="Change to use Zod for validation"

# Update multiple tasks from ID onwards
task-master update --from=3 --prompt="Update all API tasks to use new auth system"

# Add task dependency
task-master add-dependency --id=2.1 --depends-on=1.2
```

### Analysis & Planning
```bash
# Analyze project complexity
task-master analyze-complexity --research

# Generate complexity report
task-master complexity-report

# Expand all eligible tasks
task-master expand --all --research

# Validate task dependencies
task-master validate-dependencies
```

### Organization & Maintenance
```bash
# Move task to different position
task-master move --from=3.2 --to=2.4

# Regenerate task markdown files
task-master generate

# Fix dependency issues
task-master fix-dependencies
```

## Task Structure

### Task ID Format
- **Main tasks**: `1`, `2`, `3`, etc.
- **Subtasks**: `1.1`, `1.2`, `2.1`, etc.
- **Sub-subtasks**: `1.1.1`, `1.1.2`, etc.

### Task Status Values
- `pending` - Ready to work on
- `in-progress` - Currently being worked on
- `done` - Completed and verified
- `deferred` - Postponed for later
- `cancelled` - No longer needed
- `blocked` - Waiting on external factors

### Task Fields
```json
{
  "id": "1.2",
  "title": "Implement user authentication",
  "description": "Set up JWT-based auth system",
  "status": "pending",
  "priority": "high",
  "dependencies": ["1.1"],
  "details": "Use bcrypt for password hashing, JWT for tokens...",
  "testStrategy": "Unit tests for auth functions, integration tests for login flow",
  "subtasks": []
}
```

## File Structure

```
.taskmaster/
├── tasks/
│   ├── tasks.json          # Main task database (auto-managed)
│   ├── task-1.md          # Individual task files (auto-generated)
│   └── task-2.md
├── docs/
│   ├── prd.txt            # Product requirements document
│   └── updates.txt        # Additional requirements
├── reports/
│   └── task-complexity-report.json
├── templates/
│   └── example_prd.txt    # Example PRD template
└── config.json            # AI model configuration
```

## AI-Powered Features

### Commands That Use AI
These commands make AI calls and may take 10-60 seconds:
- `parse-prd` - Generate tasks from PRD
- `analyze-complexity` - Analyze task complexity
- `expand` - Break tasks into subtasks
- `add-task` - Create new task with AI
- `update` - Update multiple tasks
- `update-task` - Update single task
- `update-subtask` - Add implementation notes

### Research Mode
Add `--research` flag to enable web research:
```bash
task-master add-task --prompt="implement OAuth2 integration" --research
task-master expand --id=3 --research
task-master analyze-complexity --research
```

Research mode requires `PERPLEXITY_API_KEY` or similar research-capable model.

## MCP Server Integration

### Configuration (.mcp.json)
```json
{
  "mcpServers": {
    "task-master-ai": {
      "command": "npx",
      "args": ["-y", "--package=task-master-ai", "task-master-ai"],
      "env": {
        "ANTHROPIC_API_KEY": "your_key_here",
        "PERPLEXITY_API_KEY": "your_key_here"
      }
    }
  }
}
```

### MCP Tools Available
- `help` - Show available commands
- `initialize_project` - Initialize Task Master
- `parse_prd` - Parse PRD file
- `get_tasks` - List all tasks
- `next_task` - Get next available task
- `get_task` - Show task details
- `set_task_status` - Update task status
- `add_task` - Add new task
- `expand_task` - Expand into subtasks
- `update_task` - Update task details
- `update_subtask` - Add implementation notes
- `analyze_project_complexity` - Analyze complexity
- `complexity_report` - View complexity report

## Best Practices

### Task Creation
1. Write clear, comprehensive PRDs
2. Use `analyze-complexity` before expanding
3. Keep tasks focused and atomic
4. Define clear acceptance criteria

### Progress Tracking
1. Update subtask notes during implementation
2. Log blockers and decisions
3. Keep GitHub issues synchronized
4. Commit frequently with clear messages

### Research Usage
1. Use `--research` for technical tasks
2. Helpful for architecture decisions
3. Good for finding best practices
4. Useful for complex integrations

## Troubleshooting

### Common Issues

**AI commands failing**
```bash
# Check API keys
cat .env

# Verify model configuration
task-master models

# Try different model
task-master models --set-fallback gpt-4o-mini
```

**Task file sync issues**
```bash
# Regenerate markdown files
task-master generate

# Fix dependencies
task-master fix-dependencies
```

**MCP connection problems**
- Verify `.mcp.json` configuration
- Check Node.js installation
- Use `--mcp-debug` flag in Claude Code
- Fallback to CLI if needed

### Important Notes
- Never manually edit `tasks.json`
- Don't modify `.taskmaster/config.json` directly
- Task markdown files are auto-generated
- Always use commands for task management

## Advanced Features

### Batch Operations
```bash
# Update all API-related tasks
task-master update --from=2 --prompt="ensure all API endpoints use new auth middleware"

# Expand multiple tasks
task-master expand --all --research
```

### Complex Dependencies
```bash
# Create dependency chain
task-master add-dependency --id=3.1 --depends-on=2.3
task-master add-dependency --id=3.2 --depends-on=3.1
task-master add-dependency --id=4.1 --depends-on=3.2

# Validate entire dependency tree
task-master validate-dependencies
```

### Custom Workflows
```bash
# Generate tasks for specific module
task-master parse-prd modules/auth/requirements.md --append

# Analyze specific task range
task-master analyze-complexity --from=10 --to=15 --research
```

---

_For integration with AI agents and development workflows, see agents.md_