import { spawnSync } from 'node:child_process'
import type { CommandExecutionResult } from '../conformance-types'
export interface KindCommandRunnerOptions {
  timeoutMs?: number
  trimOutput?: boolean
}

export interface KindCommandRunner {
  run: (
    command: string,
    options?: { timeoutMs?: number }
  ) => CommandExecutionResult
}

export const createKindCommandRunner = (
  options: KindCommandRunnerOptions = {}
): KindCommandRunner => {
  const defaultTimeoutMs = options.timeoutMs ?? 60000
  const trimOutput = options.trimOutput ?? false

  return {
    run(command, runOptions = {}) {
      const timeoutMs = runOptions.timeoutMs ?? defaultTimeoutMs
      const result = spawnSync(command.trim(), {
        encoding: 'utf-8',
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeoutMs
      })
      const rawStdout = result.stdout ?? ''
      const rawStderr = result.stderr ?? ''
      const stdout = trimOutput ? rawStdout.trim() : rawStdout
      const stderr = trimOutput ? rawStderr.trim() : rawStderr
      const signal = result.signal == null ? '' : String(result.signal)
      const timeoutMessage =
        result.error != null && signal.length > 0
          ? `Command interrupted by signal ${signal}`
          : result.error != null
            ? result.error.message
            : ''
      const combined =
        stdout.length > 0 && stderr.length > 0
          ? `${stdout}\n${stderr}`
          : stdout.length > 0
            ? stdout
            : stderr.length > 0
              ? stderr
              : timeoutMessage
      const exitCode = typeof result.status === 'number' ? result.status : 1

      return {
        command: command.trim(),
        exitCode,
        stdout,
        stderr: stderr.length > 0 ? stderr : timeoutMessage,
        combined
      }
    }
  }
}
