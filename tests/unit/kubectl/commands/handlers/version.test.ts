import { describe, expect, it } from 'vitest'
import { handleVersion } from '../../../../../src/core/kubectl/commands/handlers/version'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'

describe('kubectl version handler', () => {
  const createParsedCommand = (
    overrides: Partial<ParsedCommand> = {}
  ): ParsedCommand => ({
    action: 'version',
    flags: {},
    ...overrides
  })

  describe('basic usage', () => {
    it('should return client version when --client flag is set', () => {
      const parsed = createParsedCommand({
        flags: { client: true }
      })

      const result = handleVersion(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('Client Version: v1.35.0')
        expect(result.value).toContain('Kustomize Version: v5.7.1')
        expect(result.value).not.toContain('Server Version')
      }
    })

    it('should return client version when --client flag is set with string key', () => {
      const parsed = createParsedCommand({
        flags: { client: true }
      })

      const result = handleVersion(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('Client Version: v1.35.0')
        expect(result.value).toContain('Kustomize Version: v5.7.1')
      }
    })

    it('should return client and server version when no --client flag is set', () => {
      const parsed = createParsedCommand({
        flags: {}
      })

      const result = handleVersion(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('Client Version: v1.35.0')
        expect(result.value).toContain('Kustomize Version: v5.7.1')
        expect(result.value).toContain('Server Version: v1.35.0')
      }
    })

    it('should format version info correctly in simple format', () => {
      const parsed = createParsedCommand({
        flags: { client: true }
      })

      const result = handleVersion(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        // Check format matches kubectl style (simple GitVersion only)
        expect(result.value).toMatch(
          /^Client Version: v1\.35\.0\nKustomize Version: v5\.7\.1$/
        )
      }
    })
  })

  describe('output formats', () => {
    it('should return JSON format when --output json is specified', () => {
      const parsed = createParsedCommand({
        flags: {},
        output: 'json'
      })

      const result = handleVersion(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const json = JSON.parse(result.value)
        expect(json).toHaveProperty('clientVersion')
        expect(json).toHaveProperty('kustomizeVersion', 'v5.7.1')
        expect(json).toHaveProperty('serverVersion')
        expect(json.clientVersion).toHaveProperty('gitVersion', 'v1.35.0')
      }
    })

    it('should return YAML format when --output yaml is specified', () => {
      const parsed = createParsedCommand({
        flags: {},
        output: 'yaml'
      })

      const result = handleVersion(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('clientVersion:')
        expect(result.value).toContain('kustomizeVersion: v5.7.1')
        expect(result.value).toContain('serverVersion:')
        expect(result.value).toContain('gitVersion: v1.35.0')
      }
    })

    it('should return error when --output has invalid value', () => {
      const parsed = createParsedCommand({
        flags: {},
        output: 'invalid' as any
      })

      const result = handleVersion(parsed)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain("--output must be 'yaml' or 'json'")
      }
    })

    it('should return JSON format with --client flag', () => {
      const parsed = createParsedCommand({
        flags: { client: true },
        output: 'json'
      })

      const result = handleVersion(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const json = JSON.parse(result.value)
        expect(json).toHaveProperty('clientVersion')
        expect(json).toHaveProperty('kustomizeVersion', 'v5.7.1')
        expect(json).not.toHaveProperty('serverVersion')
      }
    })
  })
})
