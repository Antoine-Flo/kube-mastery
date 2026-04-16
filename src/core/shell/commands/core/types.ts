// ═══════════════════════════════════════════════════════════════════════════
// SHELL COMMAND TYPES
// ═══════════════════════════════════════════════════════════════════════════
// Type definitions for shell command parsing and execution.
// Supports basic Unix commands (cd, ls, mkdir, touch, cat, rm, etc).

/** @deprecated Use string; command names come from the handler registry. */
export type ShellCommand = string

export interface ParsedShellCommand {
  command: string
  args: string[]
  flags: Record<string, boolean | string>
}

export interface ShellCommandIO {
  stdin?: string
}

export interface SingleCommandStep {
  kind: 'single'
  command: string
}

export interface PipelineStep {
  kind: 'pipeline'
  commands: string[]
}

export type ShellScriptStep = SingleCommandStep | PipelineStep
