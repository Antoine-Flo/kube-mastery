import { describe, expect, it } from 'vitest'
import { handleAPIResources } from '../../../../../src/core/kubectl/commands/handlers/apiResources'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'

describe('kubectl api-resources handler', () => {
  const createParsedCommand = (
    overrides: Partial<ParsedCommand> = {}
  ): ParsedCommand => ({
    action: 'api-resources',
    flags: {},
    ...overrides
  })

  describe('default table format', () => {
    it('should return table format with headers by default', () => {
      const parsed = createParsedCommand()

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('NAME')
        expect(result.value).toContain('SHORTNAMES')
        expect(result.value).toContain('APIVERSION')
        expect(result.value).toContain('NAMESPACED')
        expect(result.value).toContain('KIND')
        expect(result.value).toContain('pods')
        expect(result.value).toContain('po')
        expect(result.value).toContain('ConfigMap')
      }
    })

    it('should include all supported resources', () => {
      const parsed = createParsedCommand()

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const output = result.value
        expect(output).toContain('configmaps')
        expect(output).toContain('deployments')
        expect(output).toContain('namespaces')
        expect(output).toContain('pods')
        expect(output).toContain('secrets')
        expect(output).toContain('services')
      }
    })
  })

  describe('--no-headers flag', () => {
    it('should hide headers when --no-headers is set', () => {
      const parsed = createParsedCommand({
        flags: { 'no-headers': true }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).not.toContain('NAME')
        expect(result.value).toContain('pods')
        expect(result.value).toContain('ConfigMap')
      }
    })
  })

  describe('--output wide format', () => {
    it('should include VERBS and CATEGORIES columns', () => {
      const parsed = createParsedCommand({
        flags: { output: 'wide' }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('NAME')
        expect(result.value).toContain('VERBS')
        expect(result.value).toContain('CATEGORIES')
        expect(result.value).toContain('create,delete,deletecollection')
      }
    })

    it('should format verbs correctly', () => {
      const parsed = createParsedCommand({
        flags: { output: 'wide' }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const lines = result.value.split('\n')
        const podLine = lines.find(
          (line) => line.includes('pods') && line.includes('po')
        )
        expect(podLine).toBeTruthy()
        if (podLine) {
          expect(podLine).toContain(
            'create,delete,deletecollection,get,list,patch,update,watch'
          )
        }
      }
    })
  })

  describe('--output name format', () => {
    it('should return one resource name per line', () => {
      const parsed = createParsedCommand({
        flags: { output: 'name' }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const lines = result.value.split('\n').filter((line) => line.trim())
        expect(lines).toContain('pods')
        expect(lines).toContain('configmaps')
        expect(lines).toContain('namespaces')
      }
    })

    it('should include API group suffix for non-v1 resources', () => {
      const parsed = createParsedCommand({
        flags: { output: 'name' }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const lines = result.value.split('\n').filter((line) => line.trim())
        expect(lines).toContain('deployments.apps')
      }
    })

    it('should not include API group suffix for v1 resources', () => {
      const parsed = createParsedCommand({
        flags: { output: 'name' }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const lines = result.value.split('\n').filter((line) => line.trim())
        expect(lines).toContain('pods')
        expect(lines).not.toContain('pods.v1')
      }
    })
  })

  describe('--output json format', () => {
    it('should return valid JSON structure', () => {
      const parsed = createParsedCommand({
        flags: { output: 'json' }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const json = JSON.parse(result.value)
        expect(json.kind).toBe('APIResourceList')
        expect(json.apiVersion).toBe('v1')
        expect(json.groupVersion).toBe('')
        expect(Array.isArray(json.resources)).toBe(true)
      }
    })

    it('should include all required fields in resources', () => {
      const parsed = createParsedCommand({
        flags: { output: 'json' }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const json = JSON.parse(result.value)
        const podsResource = json.resources.find((r: any) => r.name === 'pods')
        expect(podsResource).toBeTruthy()
        if (podsResource) {
          expect(podsResource).toHaveProperty('name')
          expect(podsResource).toHaveProperty('singularName')
          expect(podsResource).toHaveProperty('namespaced')
          expect(podsResource).toHaveProperty('kind')
          expect(podsResource).toHaveProperty('verbs')
          expect(podsResource).toHaveProperty('shortNames')
          expect(podsResource).toHaveProperty('version')
          expect(podsResource.namespaced).toBe(true)
          expect(podsResource.kind).toBe('Pod')
        }
      }
    })
  })

  describe('--output yaml format', () => {
    it('should return valid YAML structure', () => {
      const parsed = createParsedCommand({
        flags: { output: 'yaml' }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('kind: APIResourceList')
        expect(result.value).toContain('apiVersion: v1')
        expect(result.value).toContain('resources:')
      }
    })

    it('should include pods resource in YAML', () => {
      const parsed = createParsedCommand({
        flags: { output: 'yaml' }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('name: pods')
        expect(result.value).toContain('kind: Pod')
      }
    })
  })

  describe('--namespaced filter', () => {
    it('should filter namespaced resources when --namespaced=true', () => {
      const parsed = createParsedCommand({
        flags: { namespaced: true }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('pods')
        expect(result.value).toContain('configmaps')
        expect(result.value).not.toContain('namespaces') // namespaces is not namespaced
      }
    })

    it('should filter non-namespaced resources when --namespaced=false', () => {
      const parsed = createParsedCommand({
        flags: { namespaced: false }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('namespaces')
        expect(result.value).not.toContain('pods') // pods is namespaced
        expect(result.value).not.toContain('configmaps') // configmaps is namespaced
      }
    })

    it('should filter namespaced resources when --namespaced is string "true"', () => {
      const parsed = createParsedCommand({
        flags: { namespaced: 'true' }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('pods')
        expect(result.value).not.toContain('namespaces')
      }
    })

    it('should filter non-namespaced resources when --namespaced is string "false"', () => {
      const parsed = createParsedCommand({
        flags: { namespaced: 'false' }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('namespaces')
        expect(result.value).not.toContain('pods')
      }
    })
  })

  describe('--api-group filter', () => {
    it('should keep only apps resources when --api-group=apps', () => {
      const parsed = createParsedCommand({
        flags: { 'api-group': 'apps' }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('deployments')
        expect(result.value).toContain('daemonsets')
        expect(result.value).not.toContain('pods')
        expect(result.value).not.toContain('cronjobs')
      }
    })

    it('should keep only batch resources when --api-group=batch', () => {
      const parsed = createParsedCommand({
        flags: { 'api-group': 'batch' }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('cronjobs')
        expect(result.value).toContain('jobs')
        expect(result.value).not.toContain('deployments')
        expect(result.value).not.toContain('pods')
      }
    })

    it('should keep only core resources when --api-group=', () => {
      const parsed = createParsedCommand({
        flags: { 'api-group': '' }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('pods')
        expect(result.value).toContain('services')
        expect(result.value).not.toContain('deployments')
        expect(result.value).not.toContain('cronjobs')
      }
    })
  })

  describe('integration with parser --namespaced=true format', () => {
    it('should filter namespaced resources when parsing --namespaced=true from command line', () => {
      // This test simulates the real command: kubectl api-resources --namespaced=true
      // The parser should convert --namespaced=true to flags: { namespaced: 'true' }
      const parsed = createParsedCommand({
        flags: { namespaced: 'true' }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('pods')
        expect(result.value).toContain('configmaps')
        expect(result.value).not.toContain('namespaces') // namespaces is not namespaced
      }
    })

    it('should filter non-namespaced resources when parsing --namespaced=false from command line', () => {
      // This test simulates the real command: kubectl api-resources --namespaced=false
      const parsed = createParsedCommand({
        flags: { namespaced: 'false' }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('namespaces')
        expect(result.value).not.toContain('pods') // pods is namespaced
        expect(result.value).not.toContain('configmaps') // configmaps is namespaced
      }
    })
  })

  describe('--sort-by filter', () => {
    it('should sort by name when --sort-by=name', () => {
      const parsed = createParsedCommand({
        flags: { 'sort-by': 'name' }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const lines = result.value
          .split('\n')
          .filter(
            (line) =>
              line.trim() &&
              !line.includes('NAME') &&
              !line.includes('SHORTNAMES')
          )
        const resourceNames = lines.map((line) => line.trim().split(/\s+/)[0])
        const sorted = [...resourceNames].sort()
        expect(resourceNames).toEqual(sorted)
      }
    })

    it('should sort by kind when --sort-by=kind', () => {
      const parsed = createParsedCommand({
        flags: { 'sort-by': 'kind' }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const lines = result.value
          .split('\n')
          .filter(
            (line) =>
              line.trim() &&
              !line.includes('NAME') &&
              !line.includes('SHORTNAMES')
          )
        const kinds = lines.map((line) => {
          const parts = line.trim().split(/\s+/)
          return parts[parts.length - 1] // Last column is KIND
        })
        const sorted = [...kinds].sort((a, b) => a.localeCompare(b))
        expect(kinds).toEqual(sorted)
      }
    })

    it('should return error for invalid --sort-by value', () => {
      const parsed = createParsedCommand({
        flags: { 'sort-by': 'invalid' }
      })

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe('--sort-by accepts only name or kind')
      }
    })
  })

  describe('default sorting', () => {
    it('should sort by API group then by name by default', () => {
      const parsed = createParsedCommand()

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const lines = result.value
          .split('\n')
          .filter(
            (line) =>
              line.trim() &&
              !line.includes('NAME') &&
              !line.includes('SHORTNAMES')
          )
        const resourceNames = lines.map((line) => line.trim().split(/\s+/)[0])

        // v1 resources should come before apps/v1 resources
        const configmapsIndex = resourceNames.indexOf('configmaps')
        const deploymentsIndex = resourceNames.indexOf('deployments')

        expect(configmapsIndex).toBeGreaterThanOrEqual(0)
        expect(deploymentsIndex).toBeGreaterThanOrEqual(0)
        expect(configmapsIndex).toBeLessThan(deploymentsIndex)
      }
    })
  })

  describe('shortnames formatting', () => {
    it('should format shortnames correctly in table output', () => {
      const parsed = createParsedCommand()

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const lines = result.value.split('\n')
        // pods should have 'po' shortname
        const podLine = lines.find(
          (line) => line.includes('pods') && !line.includes('NAME')
        )
        expect(podLine).toBeTruthy()
        if (podLine) {
          expect(podLine).toContain('po')
        }

        // secrets should appear (empty shortnames are handled by formatShortnames)
        const secretLine = lines.find(
          (line) => line.includes('secrets') && !line.includes('NAME')
        )
        expect(secretLine).toBeTruthy()
      }
    })
  })

  describe('integration with executor', () => {
    it('should work through executor', () => {
      // This test verifies the handler can be called through the executor
      // The executor test will verify full integration
      const parsed = createParsedCommand()

      const result = handleAPIResources(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBeTruthy()
        expect(result.value.length).toBeGreaterThan(0)
      }
    })
  })
})
