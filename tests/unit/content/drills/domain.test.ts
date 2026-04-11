import { describe, expect, it } from 'vitest'
import type { DrillGroupMeta } from '../../../../src/content/drills/types'
import type { DrillIndexPort } from '../../../../src/content/drills/port'
import type { UiLang } from '../../../../src/content/courses/types'
import {
  buildDrillGroupOverview,
  buildDrillGroupList
} from '../../../../src/content/drills/domain'

function createMockPort(overrides: {
  groupIds?: string[]
  getGroupMeta?: (groupId: string) => DrillGroupMeta | undefined
  drillDirsByGroup?: Map<string, string[]>
  getDrillDirsByGroup?: () => Map<string, string[]>
  getDrillTitle?: (groupId: string, drillId: string, lang: UiLang) => string
  getDrillDescription?: (
    groupId: string,
    drillId: string,
    lang: UiLang
  ) => string | null
}): DrillIndexPort {
  return {
    getGroupIds: () => overrides.groupIds ?? [],
    getGroupMeta: overrides.getGroupMeta ?? (() => undefined),
    getDrillDirsByGroup:
      overrides.getDrillDirsByGroup ??
      (() => overrides.drillDirsByGroup ?? new Map()),
    getDrillTitle: overrides.getDrillTitle ?? (() => ''),
    getDrillDescription: overrides.getDrillDescription ?? (() => null)
  }
}

describe('buildDrillGroupOverview', () => {
  it('returns null when getGroupMeta returns undefined', () => {
    const port = createMockPort({
      getGroupMeta: () => undefined
    })
    expect(buildDrillGroupOverview(port, 'any-group', 'en')).toBeNull()
  })

  it('returns null when group has no drills', () => {
    const port = createMockPort({
      getGroupMeta: () => ({
        title: { en: 'Group', fr: 'Groupe' }
      }),
      getDrillDirsByGroup: () => new Map([['g1', []]])
    })
    expect(buildDrillGroupOverview(port, 'g1', 'en')).toBeNull()
  })

  it('returns null when group is absent from drillDirsByGroup', () => {
    const port = createMockPort({
      getGroupMeta: () => ({ title: { en: 'Group', fr: 'Groupe' } }),
      getDrillDirsByGroup: () => new Map()
    })
    expect(buildDrillGroupOverview(port, 'g1', 'en')).toBeNull()
  })

  it('returns overview with id, title, description, drills, environment', () => {
    const port = createMockPort({
      getGroupMeta: (groupId) => {
        if (groupId !== 'my-group') {
          return undefined
        }
        return {
          title: { en: 'My Group', fr: 'Mon Groupe' },
          description: { en: 'Desc en', fr: 'Desc fr' },
          environment: 'minimal',
          ckaTargetMinutes: 7
        }
      },
      getDrillDirsByGroup: () =>
        new Map([['my-group', ['01-first-drill', '02-second-drill']]]),
      getDrillTitle: (groupId, drillId) => {
        if (groupId === 'my-group' && drillId === 'first-drill') {
          return 'First Drill'
        }
        if (groupId === 'my-group' && drillId === 'second-drill') {
          return 'Second Drill'
        }
        return drillId
      },
      getDrillDescription: (groupId, drillId) => {
        if (groupId === 'my-group' && drillId === 'first-drill') {
          return 'First description'
        }
        if (groupId === 'my-group' && drillId === 'second-drill') {
          return null
        }
        return null
      }
    })

    const result = buildDrillGroupOverview(port, 'my-group', 'en')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('my-group')
    expect(result!.title).toBe('My Group')
    expect(result!.description).toBe('Desc en')
    expect(result!.environment).toBe('minimal')
    expect(result!.ckaTargetMinutes).toBe(7)
    expect(result!.drills).toHaveLength(2)
    expect(result!.drills[0]).toEqual({
      id: 'first-drill',
      title: 'First Drill',
      description: 'First description'
    })
    expect(result!.drills[1]).toEqual({
      id: 'second-drill',
      title: 'Second Drill',
      description: null
    })
  })

  it('uses lang for title and description with fallback to en', () => {
    const port = createMockPort({
      getGroupMeta: () => ({
        title: { en: 'English', fr: 'Français' },
        description: { en: 'Desc en', fr: 'Desc fr' }
      }),
      getDrillDirsByGroup: () => new Map([['g1', ['01-drill']]]),
      getDrillTitle: () => 'Drill',
      getDrillDescription: () => null
    })

    const enResult = buildDrillGroupOverview(port, 'g1', 'en')
    expect(enResult!.title).toBe('English')
    expect(enResult!.description).toBe('Desc en')

    const frResult = buildDrillGroupOverview(port, 'g1', 'fr')
    expect(frResult!.title).toBe('Français')
    expect(frResult!.description).toBe('Desc fr')
  })
})

describe('buildDrillGroupList', () => {
  it('returns empty list when no groups', () => {
    const port = createMockPort({ groupIds: [] })
    expect(buildDrillGroupList(port, 'en')).toEqual([])
  })

  it('excludes groups without meta', () => {
    const port = createMockPort({
      groupIds: ['g1', 'g2'],
      getGroupMeta: (groupId) =>
        groupId === 'g1' ? { title: { en: 'G1', fr: 'G1' } } : undefined,
      getDrillDirsByGroup: () =>
        new Map([
          ['g1', ['01-a']],
          ['g2', ['01-b']]
        ])
    })
    const list = buildDrillGroupList(port, 'en')
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('g1')
  })

  it('excludes groups with zero drills', () => {
    const port = createMockPort({
      groupIds: ['g1', 'g2'],
      getGroupMeta: () => ({ title: { en: 'Group', fr: 'Groupe' } }),
      getDrillDirsByGroup: () =>
        new Map([
          ['g1', ['01-a']],
          ['g2', []]
        ])
    })
    const list = buildDrillGroupList(port, 'en')
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('g1')
    expect(list[0].totalDrills).toBe(1)
  })

  it('returns list with id, title, description, totalDrills for each group', () => {
    const port = createMockPort({
      groupIds: ['ga', 'gb'],
      getGroupMeta: (groupId) => {
        if (groupId === 'ga') {
          return {
            title: { en: 'Group A', fr: 'Groupe A' },
            description: { en: 'Desc A', fr: 'Desc A fr' }
          }
        }
        if (groupId === 'gb') {
          return { title: { en: 'Group B', fr: 'Groupe B' } }
        }
        return undefined
      },
      getDrillDirsByGroup: () =>
        new Map([
          ['ga', ['01-one', '02-two']],
          ['gb', ['01-solo']]
        ])
    })

    const list = buildDrillGroupList(port, 'en')
    expect(list).toHaveLength(2)
    expect(list[0]).toEqual({
      id: 'ga',
      title: 'Group A',
      description: 'Desc A',
      totalDrills: 2
    })
    expect(list[1]).toEqual({
      id: 'gb',
      title: 'Group B',
      description: null,
      totalDrills: 1
    })
  })
})
