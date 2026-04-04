import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { createSimulationSessionManager } from '../../bin/lib/parity/simulation-session-manager'

const server = new McpServer(
  {
    name: 'kubemastery-simulation-mcp',
    version: '0.1.0'
  },
  {
    instructions:
      'Use this server to create simulation sessions and run kubectl commands against KubeMastery simulation.'
  }
)

const sessionManager = createSimulationSessionManager()

const asTextResult = (payload: unknown) => {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload, null, 2)
      }
    ]
  }
}

server.registerTool(
  'sim_create_session',
  {
    title: 'Create simulation session',
    description: 'Creates a new in-memory simulation session.',
    inputSchema: {
      sessionId: z.string().min(1).optional(),
      clusterName: z.string().min(1).optional()
    }
  },
  ({ sessionId, clusterName }) => {
    const session = sessionManager.createSession({
      sessionId,
      clusterName
    })
    return asTextResult({
      ok: true,
      session
    })
  }
)

server.registerTool(
  'sim_list_sessions',
  {
    title: 'List simulation sessions',
    description: 'Returns active simulation sessions.'
  },
  () => {
    return asTextResult({
      ok: true,
      sessions: sessionManager.listSessions()
    })
  }
)

server.registerTool(
  'sim_run_command',
  {
    title: 'Run simulation command',
    description: 'Runs one kubectl command against a simulation session.',
    inputSchema: {
      sessionId: z.string().min(1),
      command: z.string().min(1)
    }
  },
  ({ sessionId, command }) => {
    const result = sessionManager.runCommand(sessionId, command)
    return asTextResult({
      ok: result.exitCode === 0,
      sessionId,
      result
    })
  }
)

server.registerTool(
  'sim_destroy_session',
  {
    title: 'Destroy simulation session',
    description: 'Destroys one in-memory simulation session.',
    inputSchema: {
      sessionId: z.string().min(1)
    }
  },
  ({ sessionId }) => {
    return asTextResult({
      ok: sessionManager.destroySession(sessionId),
      sessionId
    })
  }
)

const startServer = async (): Promise<void> => {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

startServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`Failed to start simulation MCP server: ${message}\n`)
  process.exit(1)
})
