import { describe, expect, it } from 'vitest'
import {
  parseCustomColumnsSpec,
  relaxedJsonPathToKubectlTemplate,
  renderCustomColumnsTable
} from '../../../../../src/core/kubectl/commands/output/customColumns'

describe('relaxedJsonPathToKubectlTemplate', () => {
  it('converts .metadata.name to {.metadata.name}', () => {
    const result = relaxedJsonPathToKubectlTemplate('.metadata.name')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('{.metadata.name}')
    }
  })

  it('converts metadata.name to {.metadata.name}', () => {
    const result = relaxedJsonPathToKubectlTemplate('metadata.name')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('{.metadata.name}')
    }
  })

  it('converts {.metadata.name} to {.metadata.name}', () => {
    const result = relaxedJsonPathToKubectlTemplate('{.metadata.name}')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('{.metadata.name}')
    }
  })

  it('returns error for invalid path', () => {
    const result = relaxedJsonPathToKubectlTemplate('path.with{curly}')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('unexpected path string')
    }
  })
})

describe('parseCustomColumnsSpec', () => {
  it('parses single column', () => {
    const result = parseCustomColumnsSpec('NAME:.metadata.name')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual([
        { header: 'NAME', pathExpr: '.metadata.name' }
      ])
    }
  })

  it('parses multiple columns', () => {
    const result = parseCustomColumnsSpec(
      'NAME:.metadata.name,STATUS:.status.phase,NODE:.spec.nodeName'
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual([
        { header: 'NAME', pathExpr: '.metadata.name' },
        { header: 'STATUS', pathExpr: '.status.phase' },
        { header: 'NODE', pathExpr: '.spec.nodeName' }
      ])
    }
  })

  it('returns error when segment has no colon', () => {
    const result = parseCustomColumnsSpec('NAME')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('expected <header>:<json-path-expr>')
    }
  })

  it('returns error when path expression is empty', () => {
    const result = parseCustomColumnsSpec('NAME:')
    expect(result.ok).toBe(false)
  })
})

describe('renderCustomColumnsTable', () => {
  it('renders table with one row', () => {
    const items = [
      {
        metadata: { name: 'web' },
        status: { phase: 'Running' }
      }
    ]
    const result = renderCustomColumnsTable(
      'NAME:.metadata.name,STATUS:.status.phase',
      items
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toContain('NAME')
      expect(result.value).toContain('STATUS')
      expect(result.value).toContain('web')
      expect(result.value).toContain('Running')
    }
  })

  it('returns empty string for zero items', () => {
    const result = renderCustomColumnsTable('NAME:.metadata.name', [])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('')
    }
  })
})
