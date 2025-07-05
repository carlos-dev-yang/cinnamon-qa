# AI Agent Core Working Principles

## 🚨 CRITICAL: These principles MUST be followed for EVERY task, without exception

### 1. Single Task Focus
- Work ONLY on the currently assigned task from Task Master
- Do NOT start working on other tasks without explicit permission
- Do NOT expand or create new tasks on your own
- If you notice issues outside the current task scope, document them but DO NOT fix them

### 2. Task Completion Protocol
- When a task is complete:
  - Change status to `done` using Task Master
  - STOP and ASK the user before proceeding to the next task
  - Never automatically continue to the next task

### 3. Branch Management
- ALWAYS create a new feature branch for each MAIN task
- Never work directly on main/master branch
- One branch per main task, subtasks are committed within the same branch

### 4. Granular Commits
- Commit after EACH subtask completion
- Use descriptive commit messages with task reference
- Follow conventional commit format: `type(scope): description [task-id]`

### 5. GitHub Issue Synchronization
- Create/update GitHub issue for each main task
- Log all progress as issue comments
- Update issue status labels to match task status
- Close issue when task is marked as done

### 6. Task Management via Task Master
- NEVER manually create or modify tasks
- Use Task Master commands exclusively
- All task modifications must go through Task Master

## Standard Workflow

1. **Get task** → Use Task Master to get next task
2. **Create branch** → `git checkout -b task/<main-task-id>-<description>`
3. **Create/update issue** → GitHub issue with task details
4. **Set status** → Update task status to in-progress
5. **Work on subtasks** → Complete each with individual commits
6. **Log progress** → Update notes and issue comments
7. **Complete** → Set status to done, close issue
8. **STOP** → Ask user before proceeding

## Quick Command Reference

```bash
task-master next                                    # Get next task
task-master show <id>                              # View task details
task-master set-status --id=<id> --status=done    # Complete task
task-master update-subtask --id=<id> --prompt=""  # Log progress
```

## Important Reminders

- **NEVER** work on multiple tasks simultaneously
- **NEVER** proceed to next task without permission
- **ALWAYS** create task-specific branch for main tasks
- **ALWAYS** commit after each subtask completion
- **ALWAYS** sync with GitHub issues
- **FOCUS** only on the assigned task scope

---

## Reference Documents

- **Task Master Guide**: `./task-master-guide.md` - Full CLI documentation
- **Git Workflow**: `./git-workflow.md` - Detailed Git procedures
- **Project Setup**: `./project-setup.md` - Architecture and configuration

_This guide enforces strict task boundaries for AI agents. Refer to other guides for detailed instructions._