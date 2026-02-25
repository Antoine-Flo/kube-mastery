// ═══════════════════════════════════════════════════════════════════════════
// SHELL COMMAND TYPES
// ═══════════════════════════════════════════════════════════════════════════
// Type definitions for shell command parsing and execution.
// Supports basic Unix commands (cd, ls, mkdir, touch, cat, rm, etc).

export type ShellCommand =
  | 'cd'
  | 'ls'
  | 'pwd'
  | 'mkdir'
  | 'touch'
  | 'cat'
  | 'rm'
  | 'clear'
  | 'help'
  | 'debug'
  | 'nano'
  | 'vi'
  | 'vim'
  | 'nslookup'
  | 'curl'
  | 'exit'

export interface ParsedShellCommand {
  command: ShellCommand
  args: string[]
  flags: Record<string, boolean | string>
}
