# Git Workflow Guide for Task-Based Development

## Branch Strategy

### Main Branch Protection
- **Never** commit directly to `main` or `master`
- All changes must go through feature branches
- Use pull requests for code review and merging

### Feature Branch Naming
```bash
# Format: task/<main-task-id>-<brief-description>
git checkout -b task/1-user-authentication
git checkout -b task/2-api-endpoints
git checkout -b task/3-database-schema
```

### Branch Lifecycle
1. Create branch when starting a main task
2. Work on all subtasks within the same branch
3. Create PR when main task is complete
4. Delete branch after merging

## Commit Strategy

### Commit Frequency
- Commit after EACH subtask completion
- Never combine multiple subtasks in one commit
- Keep commits atomic and focused

### Commit Message Format
```bash
# Conventional Commits with Task ID
<type>(<scope>): <description> [task <id>]

# Examples:
git commit -m "feat(auth): implement JWT token generation [task 1.2.1]"
git commit -m "test(auth): add unit tests for password hashing [task 1.2.2]"
git commit -m "fix(auth): handle expired token edge case [task 1.2.3]"
git commit -m "docs(api): update authentication endpoint docs [task 1.2.4]"
```

### Commit Types
- `feat`: New feature implementation
- `fix`: Bug fix
- `test`: Adding or updating tests
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `style`: Code style changes (formatting, etc.)
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### Commit Scopes
- Use module/component names: `auth`, `api`, `database`, `ui`
- Keep scopes consistent across the project
- Avoid overly broad scopes like `app` or `all`

## Git Commands Reference

### Starting Work on a Task
```bash
# Ensure you're on main
git checkout main

# Pull latest changes
git pull origin main

# Create and switch to feature branch
git checkout -b task/1-user-authentication

# Verify branch
git branch --show-current
```

### During Development
```bash
# Check status frequently
git status

# Stage specific files
git add src/auth/jwt.ts src/auth/jwt.test.ts

# Commit with task reference
git commit -m "feat(auth): add JWT token generation [task 1.2.1]"

# Push branch to remote
git push -u origin task/1-user-authentication

# Continue pushing commits
git push
```

### Keeping Branch Updated
```bash
# Fetch latest changes
git fetch origin

# Merge or rebase main into your branch
git merge origin/main
# OR
git rebase origin/main

# Resolve conflicts if any
git status
# Edit conflicted files
git add <resolved-files>
git rebase --continue
```

## GitHub Integration

### Creating Issues
```bash
# Create issue for main task
gh issue create \
  --title "Task 1: Implement User Authentication" \
  --body "Implementation of JWT-based authentication system" \
  --label "task-pending"

# List issues
gh issue list --label "task-in-progress"

# View specific issue
gh issue view 42
```

### Updating Issues
```bash
# Add progress comment
gh issue comment 42 --body "Completed JWT token generation (subtask 1.2.1)"

# Update labels
gh issue edit 42 --add-label "in-progress" --remove-label "pending"

# Close issue when done
gh issue close 42 --comment "Task completed and tested"
```

### Creating Pull Requests
```bash
# Create PR with task reference
gh pr create \
  --title "Complete task 1: User Authentication" \
  --body "Implements JWT-based authentication as specified in task 1" \
  --base main \
  --label "ready-for-review"

# Link PR to issue
gh pr create --title "..." --body "Closes #42"

# Check PR status
gh pr status

# View PR details
gh pr view
```

## Best Practices

### Before Starting Work
1. Always pull latest changes from main
2. Verify no one else is working on the same task
3. Create issue if it doesn't exist
4. Set task status to `in-progress`

### During Development
1. Commit frequently (after each subtask)
2. Write clear, descriptive commit messages
3. Include task IDs in every commit
4. Push regularly to backup work
5. Update issue with progress comments

### Before Creating PR
1. Ensure all subtasks are complete
2. Run tests locally
3. Update documentation if needed
4. Review your own changes
5. Ensure branch is up to date with main

### PR Description Template
```markdown
## Task Completion: [Task ID] - [Task Title]

### Summary
Brief description of what was implemented

### Subtasks Completed
- [x] 1.1 - Setup authentication module
- [x] 1.2 - Implement JWT tokens
- [x] 1.3 - Add password hashing
- [x] 1.4 - Create auth middleware

### Testing
- Unit tests added for all new functions
- Integration tests for auth flow
- Manual testing completed

### Documentation
- API documentation updated
- README updated with auth setup

Closes #42
```

## Conflict Resolution

### Merge Conflicts
```bash
# When conflicts occur during merge/rebase
git status

# See conflict markers in files
# <<<<<<< HEAD
# Your changes
# =======
# Their changes
# >>>>>>> main

# After resolving, stage files
git add <resolved-files>

# Continue merge or rebase
git merge --continue
# OR
git rebase --continue
```

### Best Practices for Avoiding Conflicts
1. Keep branches short-lived
2. Merge main frequently
3. Communicate with team about large changes
4. Break large tasks into smaller ones

## Git Aliases for Efficiency

Add to `.gitconfig`:
```ini
[alias]
    # Quick status
    s = status -s
    
    # Pretty log
    lg = log --oneline --graph --decorate
    
    # Create task branch
    task = "!f() { git checkout -b task/$1; }; f"
    
    # Commit with task ID
    ct = "!f() { git commit -m \"$1 [task $2]\"; }; f"
```

Usage:
```bash
git task 1-authentication
git ct "feat(auth): add JWT tokens" 1.2.1
```

## Emergency Procedures

### Undoing Last Commit (not pushed)
```bash
# Keep changes, undo commit
git reset --soft HEAD~1

# Discard changes and commit
git reset --hard HEAD~1
```

### Recovering Lost Work
```bash
# Find lost commits
git reflog

# Restore specific commit
git cherry-pick <commit-hash>
```

### Abandoning Changes
```bash
# Discard all local changes
git reset --hard origin/main

# Clean untracked files
git clean -fd
```

---

_Always follow the task-based workflow. One branch per main task, one commit per subtask._