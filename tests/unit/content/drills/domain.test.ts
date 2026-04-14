import { describe, expect, it } from 'vitest'
import type { DrillFile } from '../../../../src/content/drills/types'
import type { DrillIndexPort } from '../../../../src/content/drills/port'
import type { UiLang } from '../../../../src/content/courses/types'
import {
  buildDrillList,
  buildDrillDetail
} from '../../../../src/content/drills/domain'

function createMockPort(overrides: {
  drillIds?: string[]
  getDrillFile?: (drillId: string, lang: UiLang) => DrillFile | null
}): DrillIndexPort {
  return {
    getDrillIds: () => overrides.drillIds ?? [],
    getDrillFile: overrides.getDrillFile ?? (() => null)
  }
}

const SAMPLE_TASK = {
  task: 'List all nodes in the cluster',
  commandBlocks: [{ lang: 'bash' as const, code: 'kubectl get nodes' }],
  explanation: 'Lists all nodes.',
  solutionSegments: [
    { kind: 'code' as const, lang: 'bash' as const, code: 'kubectl get nodes' },
    { kind: 'text' as const, markdown: 'Lists all nodes.' }
  ]
}

const SAMPLE_FILE: DrillFile = {
  title: 'Inspect Nodes',
  description: 'Learn to inspect nodes.',
  environment: 'minimal',
  ckaTargetMinutes: 5,
  tasks: [SAMPLE_TASK]
}

describe('buildDrillList', () => {
  it('returns empty list when no drills', () => {
    const port = createMockPort({ drillIds: [] })
    expect(buildDrillList(port, 'en')).toEqual([])
  })

  it('excludes drills with no file', () => {
    const port = createMockPort({
      drillIds: ['inspect-nodes', 'other'],
      getDrillFile: (id) => (id === 'inspect-nodes' ? SAMPLE_FILE : null)
    })
    const list = buildDrillList(port, 'en')
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('inspect-nodes')
  })

  it('excludes drills with zero tasks', () => {
    const port = createMockPort({
      drillIds: ['inspect-nodes'],
      getDrillFile: () => ({ ...SAMPLE_FILE, tasks: [] })
    })
    expect(buildDrillList(port, 'en')).toHaveLength(0)
  })

  it('returns full list item with correct fields', () => {
    const fileWithTwo: DrillFile = {
      ...SAMPLE_FILE,
      tasks: [
        SAMPLE_TASK,
        {
          task: 'Describe a node',
          commandBlocks: [
            { lang: 'bash' as const, code: 'kubectl describe node x' }
          ],
          explanation: 'Details.',
          solutionSegments: [
            {
              kind: 'code' as const,
              lang: 'bash' as const,
              code: 'kubectl describe node x'
            },
            { kind: 'text' as const, markdown: 'Details.' }
          ]
        }
      ]
    }
    const port = createMockPort({
      drillIds: ['inspect-nodes'],
      getDrillFile: () => fileWithTwo
    })
    const list = buildDrillList(port, 'en')
    expect(list).toHaveLength(1)
    expect(list[0]).toEqual({
      id: 'inspect-nodes',
      title: 'Inspect Nodes',
      description: 'Learn to inspect nodes.',
      totalTasks: 2,
      isFree: false,
      tag: null
    })
  })

  it('includes tag when present on file', () => {
    const port = createMockPort({
      drillIds: ['debug'],
      getDrillFile: () => ({ ...SAMPLE_FILE, tag: 'troubleshooting' })
    })
    const list = buildDrillList(port, 'en')
    expect(list[0].tag).toBe('troubleshooting')
  })

  it('excludes draft drills', () => {
    const port = createMockPort({
      drillIds: ['published', 'wip'],
      getDrillFile: (id) =>
        id === 'published'
          ? SAMPLE_FILE
          : { ...SAMPLE_FILE, title: 'WIP', isDraft: true }
    })
    const list = buildDrillList(port, 'en')
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('published')
  })
})

describe('buildDrillDetail', () => {
  it('returns null when drill has no file', () => {
    const port = createMockPort({ getDrillFile: () => null })
    expect(buildDrillDetail(port, 'inspect-nodes', 'en')).toBeNull()
  })

  it('returns full detail with all fields', () => {
    const port = createMockPort({
      getDrillFile: () => SAMPLE_FILE
    })
    const detail = buildDrillDetail(port, 'inspect-nodes', 'en')
    expect(detail).not.toBeNull()
    expect(detail!.id).toBe('inspect-nodes')
    expect(detail!.title).toBe('Inspect Nodes')
    expect(detail!.description).toBe('Learn to inspect nodes.')
    expect(detail!.environment).toBe('minimal')
    expect(detail!.ckaTargetMinutes).toBe(5)
    expect(detail!.tasks).toHaveLength(1)
    expect(detail!.tasks[0]).toEqual(SAMPLE_TASK)
    expect(detail!.tag).toBeNull()
    expect(detail!.isFree).toBe(false)
  })

  it('includes isFree when set on file', () => {
    const port = createMockPort({
      drillIds: ['inspect-nodes'],
      getDrillFile: () => ({ ...SAMPLE_FILE, isFree: true })
    })
    expect(buildDrillList(port, 'en')[0].isFree).toBe(true)
    expect(buildDrillDetail(port, 'inspect-nodes', 'en')!.isFree).toBe(true)
  })

  it('uses lang to fetch the correct file', () => {
    const enFile: DrillFile = { ...SAMPLE_FILE, title: 'Inspect Nodes' }
    const frFile: DrillFile = { ...SAMPLE_FILE, title: 'Inspecter les noeuds' }
    const port = createMockPort({
      getDrillFile: (_, lang) => (lang === 'fr' ? frFile : enFile)
    })

    const enDetail = buildDrillDetail(port, 'inspect-nodes', 'en')
    expect(enDetail!.title).toBe('Inspect Nodes')

    const frDetail = buildDrillDetail(port, 'inspect-nodes', 'fr')
    expect(frDetail!.title).toBe('Inspecter les noeuds')
  })

  it('returns null for draft drills', () => {
    const port = createMockPort({
      getDrillFile: () => ({ ...SAMPLE_FILE, isDraft: true })
    })
    expect(buildDrillDetail(port, 'inspect-nodes', 'en')).toBeNull()
  })
})
