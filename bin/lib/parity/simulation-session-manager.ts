import { randomUUID } from 'node:crypto'
import { CONFIG } from '../../../src/config'
import type { CommandExecutionResult } from '../execution-types'
import {
  createRunnerExecutor,
  type RunnerExecutor
} from '../executors/runner-executor'

export interface SimulationSession {
  id: string
  clusterName: string
  createdAt: string
}

interface SessionEntry {
  session: SimulationSession
  runner: RunnerExecutor
}

export interface CreateSimulationSessionOptions {
  sessionId?: string
  clusterName?: string
}

export interface SimulationSessionManager {
  createSession: (options?: CreateSimulationSessionOptions) => SimulationSession
  listSessions: () => SimulationSession[]
  runCommand: (sessionId: string, command: string) => CommandExecutionResult
  destroySession: (sessionId: string) => boolean
  hasSession: (sessionId: string) => boolean
}

const createSessionId = (): string => {
  return `sim_${randomUUID()}`
}

const notFoundResult = (
  sessionId: string,
  command: string
): CommandExecutionResult => {
  const message =
    `Simulation session "${sessionId}" not found.` +
    ' Create one with sim_create_session first.'
  return {
    command,
    exitCode: 1,
    stdout: '',
    stderr: message,
    combined: message
  }
}

export const createSimulationSessionManager = (): SimulationSessionManager => {
  const sessions = new Map<string, SessionEntry>()

  return {
    createSession(options = {}): SimulationSession {
      const clusterName =
        options.clusterName ?? CONFIG.cluster.conformanceClusterName
      const id = options.sessionId ?? createSessionId()
      const existing = sessions.get(id)
      if (existing != null) {
        return existing.session
      }
      const session: SimulationSession = {
        id,
        clusterName,
        createdAt: new Date().toISOString()
      }
      sessions.set(id, {
        session,
        runner: createRunnerExecutor(clusterName)
      })
      return session
    },
    listSessions(): SimulationSession[] {
      return Array.from(sessions.values()).map((entry) => {
        return entry.session
      })
    },
    runCommand(sessionId: string, command: string): CommandExecutionResult {
      const entry = sessions.get(sessionId)
      if (entry == null) {
        return notFoundResult(sessionId, command)
      }
      return entry.runner.executeCommand(command)
    },
    destroySession(sessionId: string): boolean {
      return sessions.delete(sessionId)
    },
    hasSession(sessionId: string): boolean {
      return sessions.has(sessionId)
    }
  }
}
