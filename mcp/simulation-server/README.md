# Simulation MCP Server

This MCP server exposes KubeMastery simulation sessions over stdio.

## Start

```bash
npm run mcp:simulation
```

## Tools

- `sim_create_session`
- `sim_list_sessions`
- `sim_run_command`
- `sim_destroy_session`

## Notes

- Sessions are in-memory for now.
- `kind` commands are intentionally not part of this MCP server.
- Use native `kubectl` on your machine for real cluster checks.
