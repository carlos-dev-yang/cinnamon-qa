# Playwright MCP Integration Guide

## Overview

Playwright MCP (Model Context Protocol) is a browser automation server that enables AI agents to interact with web pages using structured accessibility snapshots. It's already provided as a Docker container and can be accessed as `mcp-server-playwright-mcp`.

## Key Information

- **GitHub Repository**: https://github.com/microsoft/playwright-mcp
- **Purpose**: Browser automation for AI agents using Playwright's accessibility tree
- **Docker Image**: `mcr.microsoft.com/playwright/mcp`
- **Current Status**: Already running as Docker container (check with `docker ps`)

## Architecture

### How It Works
1. Uses Playwright's accessibility tree instead of pixel-based input
2. Operates on structured data (LLM-friendly)
3. Provides deterministic tool application
4. Fast and lightweight browser automation

### Supported Modes
- **Snapshot Mode** (default): Uses accessibility snapshots
- **Vision Mode**: Uses screenshots for visual interactions

## Available Capabilities

### Browser Interactions
- Click elements
- Type text
- Hover over elements
- Submit forms

### Navigation
- Navigate to URLs
- Go back/forward in history
- Open new tabs
- Switch between tabs

### Resource Capture
- Take screenshots
- Monitor network requests
- Extract page content

### Tab Management
- Create/close tabs
- Switch between tabs
- Manage multiple browser contexts

## Integration with Cinnamon-QA

### Usage in Our Project
```javascript
// Example connection setup for our Worker process
import { createConnection } from '@playwright/mcp';

const connection = await createConnection({ 
  browser: { 
    launchOptions: { 
      headless: true // Run in headless mode for automation
    } 
  } 
});
```

### Docker Configuration
Since the container is already running, we can connect to it directly:
```json
{
  "mcpServers": {
    "playwright": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "--init", "--pull=always", "mcr.microsoft.com/playwright/mcp"]
    }
  }
}
```

### Communication Flow
1. Worker process receives test job from Redis queue
2. Worker connects to Playwright MCP container
3. AI (Gemini) analyzes test scenario and generates commands
4. Commands are sent to Playwright MCP for execution
5. Results are captured and stored in Supabase

## Important Notes

1. **Container Already Running**: No need to set up Docker for Playwright MCP - it's already provided
2. **Accessibility-First**: Uses accessibility tree for more reliable automation
3. **AI-Friendly**: Designed specifically for LLM integration
4. **Deterministic**: Provides consistent results for the same inputs

## Common Commands

Check if Playwright MCP container is running:
```bash
docker ps | grep mcp-server-playwright-mcp
```

View container logs:
```bash
docker logs mcp-server-playwright-mcp
```

## Best Practices for Cinnamon-QA

1. **Use Snapshot Mode** for most test scenarios (faster and more reliable)
2. **Use Vision Mode** only when visual verification is required
3. **Keep browser contexts isolated** for each test run
4. **Clean up resources** after each test (close tabs, clear cookies)
5. **Handle timeouts gracefully** - web pages can be slow

## Error Handling

Common issues and solutions:
- **Container not running**: Check Docker status
- **Connection refused**: Verify container ports and network settings
- **Timeout errors**: Increase wait times for slow pages
- **Element not found**: Use more specific selectors or wait for elements

## References

- [Official GitHub Repository](https://github.com/microsoft/playwright-mcp)
- [Playwright Documentation](https://playwright.dev/)
- [Model Context Protocol Spec](https://modelcontextprotocol.io/)