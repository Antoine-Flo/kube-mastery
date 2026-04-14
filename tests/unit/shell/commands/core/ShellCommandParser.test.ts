import { describe, expect, it } from 'vitest'
import { parseShellCommand } from '../../../../../src/core/shell/commands/core/ShellCommandParser'
import { getShellRegistryCommandNames } from '../../../../../src/core/shell/commands'

describe('ShellCommandParser', () => {
  describe('parseShellCommand', () => {
    const registry = getShellRegistryCommandNames()
    it('should parse simple command without args', () => {
      const result = parseShellCommand('pwd', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('pwd')
        expect(result.value.args).toEqual([])
        expect(result.value.flags).toEqual({})
      }
    })

    it('should parse env command without args', () => {
      const result = parseShellCommand('env', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('env')
        expect(result.value.args).toEqual([])
        expect(result.value.flags).toEqual({})
      }
    })

    it('should parse sleep command with one arg', () => {
      const result = parseShellCommand('sleep 2', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('sleep')
        expect(result.value.args).toEqual(['2'])
      }
    })

    it('should parse command with single arg', () => {
      const result = parseShellCommand('cd /home', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('cd')
        expect(result.value.args).toEqual(['/home'])
        expect(result.value.flags).toEqual({})
      }
    })

    it('should parse command with multiple args', () => {
      const result = parseShellCommand('touch file1 file2', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('touch')
        expect(result.value.args).toEqual(['file1', 'file2'])
      }
    })

    it('should parse mv command with source and destination', () => {
      const result = parseShellCommand('mv old.txt new.txt', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('mv')
        expect(result.value.args).toEqual(['old.txt', 'new.txt'])
        expect(result.value.flags).toEqual({})
      }
    })

    it('should parse command with boolean flag', () => {
      const result = parseShellCommand('ls -l', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('ls')
        expect(result.value.args).toEqual([])
        expect(result.value.flags).toEqual({ l: true })
      }
    })

    it('should parse command with flag and args', () => {
      const result = parseShellCommand('ls -l /home', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('ls')
        expect(result.value.args).toEqual(['/home'])
        expect(result.value.flags).toEqual({ l: true })
      }
    })

    it('should parse command with multiple flags', () => {
      const result = parseShellCommand('rm -r -f dir', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('rm')
        expect(result.value.args).toEqual(['dir'])
        expect(result.value.flags).toEqual({ r: true, f: true })
      }
    })

    it('should handle aliases (vi, vim)', () => {
      const viResult = parseShellCommand('vi file.yaml', registry)
      expect(viResult.ok).toBe(true)
      if (viResult.ok) {
        expect(viResult.value.command).toBe('vi')
      }

      const vimResult = parseShellCommand('vim file.yaml', registry)
      expect(vimResult.ok).toBe(true)
      if (vimResult.ok) {
        expect(vimResult.value.command).toBe('vim')
      }
    })

    it('should reject unknown command', () => {
      const result = parseShellCommand('unknown-command', registry)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('command not found')
      }
    })

    it('should reject empty command', () => {
      const result = parseShellCommand('   ', registry)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('empty')
      }
    })

    it('should trim whitespace', () => {
      const result = parseShellCommand('  pwd  ', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('pwd')
      }
    })

    it('should validate all commands in registry', () => {
      for (const cmd of registry) {
        const result = parseShellCommand(cmd, registry)
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value.command).toBe(cmd)
        }
      }
    })

    // ─── Flags Combinés ────────────────────────────────────────────────────

    it('should parse combined flags like ls -la (realistic shell behavior)', () => {
      const result = parseShellCommand('ls -la', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('ls')
        expect(result.value.args).toEqual([])
        // Realistic shell behavior: -la should be decomposed into l and a
        expect(result.value.flags).toEqual({ l: true, a: true })
      }
    })

    it('should parse combined flags like rm -rf (realistic shell behavior)', () => {
      const result = parseShellCommand('rm -rf dir', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('rm')
        expect(result.value.args).toEqual(['dir'])
        // Realistic shell behavior: -rf should be decomposed into r and f
        expect(result.value.flags).toEqual({ r: true, f: true })
      }
    })

    it('should parse combined flags with arguments (realistic shell behavior)', () => {
      const result = parseShellCommand('ls -la /home', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('ls')
        expect(result.value.args).toEqual(['/home'])
        // Realistic shell behavior: -la should be decomposed
        expect(result.value.flags).toEqual({ l: true, a: true })
      }
    })

    it('should parse multiple combined flags (realistic shell behavior)', () => {
      const result = parseShellCommand('ls -la -R /home', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('ls')
        expect(result.value.args).toEqual(['/home'])
        // Realistic shell behavior: -la should be decomposed
        expect(result.value.flags).toEqual({ l: true, a: true, R: true })
      }
    })

    // ─── Cas Limites Parsing ───────────────────────────────────────────────

    it('should handle multiple spaces between tokens', () => {
      const result = parseShellCommand('ls    -l    /home', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('ls')
        expect(result.value.args).toEqual(['/home'])
        expect(result.value.flags).toEqual({ l: true })
      }
    })

    it('should handle command with only flags', () => {
      const result = parseShellCommand('ls -l -a', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('ls')
        expect(result.value.args).toEqual([])
        expect(result.value.flags).toEqual({ l: true, a: true })
      }
    })

    it('should handle double dash flag', () => {
      const result = parseShellCommand('ls --', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('ls')
        expect(result.value.args).toEqual([])
        // Double dash alone is treated as empty flag name
        expect(result.value.flags).toHaveProperty('')
      }
    })

    it('should handle triple dash', () => {
      const result = parseShellCommand('ls ---', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('ls')
        expect(result.value.flags).toHaveProperty('')
      }
    })

    // ─── Chemins avec Caractères Spéciaux ─────────────────────────────────

    it('should parse paths with dashes', () => {
      const result = parseShellCommand('cd my-dir', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('cd')
        expect(result.value.args).toEqual(['my-dir'])
      }
    })

    it('should parse paths with underscores', () => {
      const result = parseShellCommand('cd my_dir', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('cd')
        expect(result.value.args).toEqual(['my_dir'])
      }
    })

    it('should parse paths with dots', () => {
      const result = parseShellCommand('cat file.name.txt', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('cat')
        expect(result.value.args).toEqual(['file.name.txt'])
      }
    })

    it('should parse relative paths', () => {
      const result = parseShellCommand('cd ../dir', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('cd')
        expect(result.value.args).toEqual(['../dir'])
      }
    })

    it('should parse current directory path', () => {
      const result = parseShellCommand('cd .', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('cd')
        expect(result.value.args).toEqual(['.'])
      }
    })

    it('should parse parent directory path', () => {
      const result = parseShellCommand('cd ..', registry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe('cd')
        expect(result.value.args).toEqual(['..'])
      }
    })

    it('should parse absolute vs relative paths', () => {
      const absolute = parseShellCommand('cd /home/kube', registry)
      expect(absolute.ok).toBe(true)
      if (absolute.ok) {
        expect(absolute.value.args).toEqual(['/home/kube'])
      }

      const relative = parseShellCommand('cd ../dir', registry)
      expect(relative.ok).toBe(true)
      if (relative.ok) {
        expect(relative.value.args).toEqual(['../dir'])
      }
    })
  })
})
