import { describe, expect, it } from 'vitest'
import type { TaskGroupMeta } from '../../../../src/content/tasks/types'
import type { TaskIndexPort } from '../../../../src/content/tasks/port'
import type { UiLang } from '../../../../src/content/courses/types'
import { buildTaskGroupOverview, buildTaskGroupList } from '../../../../src/content/tasks/domain'

function createMockPort(overrides: {
  groupIds?: string[]
  getGroupMeta?: (groupId: string) => TaskGroupMeta | undefined
  taskDirsByGroup?: Map<string, string[]>
  getTaskDirsByGroup?: () => Map<string, string[]>
  getTaskTitle?: (groupId: string, taskId: string, lang: UiLang) => string
  getTaskDescription?: (groupId: string, taskId: string, lang: UiLang) => string | null
}): TaskIndexPort {
  return {
    getGroupIds: () => overrides.groupIds ?? [],
    getGroupMeta: overrides.getGroupMeta ?? (() => undefined),
    getTaskDirsByGroup: overrides.getTaskDirsByGroup ?? (() => overrides.taskDirsByGroup ?? new Map()),
    getTaskTitle: overrides.getTaskTitle ?? (() => ''),
    getTaskDescription: overrides.getTaskDescription ?? (() => null)
  }
}

describe('buildTaskGroupOverview', () => {
  it('returns null when getGroupMeta returns undefined', () => {
    const port = createMockPort({
      getGroupMeta: () => undefined
    })
    expect(buildTaskGroupOverview(port, 'any-group', 'en')).toBeNull()
  })

  it('returns null when group has no tasks', () => {
    const port = createMockPort({
      getGroupMeta: () => ({
        title: { en: 'Group', fr: 'Groupe' }
      }),
      getTaskDirsByGroup: () => new Map([['g1', []]])
    })
    expect(buildTaskGroupOverview(port, 'g1', 'en')).toBeNull()
  })

  it('returns null when group is absent from taskDirsByGroup', () => {
    const port = createMockPort({
      getGroupMeta: () => ({ title: { en: 'Group', fr: 'Groupe' } }),
      getTaskDirsByGroup: () => new Map()
    })
    expect(buildTaskGroupOverview(port, 'g1', 'en')).toBeNull()
  })

  it('returns overview with id, title, description, tasks, environment', () => {
    const port = createMockPort({
      getGroupMeta: (groupId) => {
        if (groupId !== 'my-group') {
          return undefined
        }
        return {
          title: { en: 'My Group', fr: 'Mon Groupe' },
          description: { en: 'Desc en', fr: 'Desc fr' },
          environment: 'minimal'
        }
      },
      getTaskDirsByGroup: () => new Map([['my-group', ['01-first-task', '02-second-task']]]),
      getTaskTitle: (groupId, taskId) => {
        if (groupId === 'my-group' && taskId === 'first-task') {
          return 'First Task'
        }
        if (groupId === 'my-group' && taskId === 'second-task') {
          return 'Second Task'
        }
        return taskId
      },
      getTaskDescription: (groupId, taskId) => {
        if (groupId === 'my-group' && taskId === 'first-task') {
          return 'First description'
        }
        if (groupId === 'my-group' && taskId === 'second-task') {
          return null
        }
        return null
      }
    })

    const result = buildTaskGroupOverview(port, 'my-group', 'en')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('my-group')
    expect(result!.title).toBe('My Group')
    expect(result!.description).toBe('Desc en')
    expect(result!.environment).toBe('minimal')
    expect(result!.tasks).toHaveLength(2)
    expect(result!.tasks[0]).toEqual({
      id: 'first-task',
      title: 'First Task',
      description: 'First description'
    })
    expect(result!.tasks[1]).toEqual({
      id: 'second-task',
      title: 'Second Task',
      description: null
    })
  })

  it('uses lang for title and description with fallback to en', () => {
    const port = createMockPort({
      getGroupMeta: () => ({
        title: { en: 'English', fr: 'Français' },
        description: { en: 'Desc en', fr: 'Desc fr' }
      }),
      getTaskDirsByGroup: () => new Map([['g1', ['01-task']]]),
      getTaskTitle: () => 'Task',
      getTaskDescription: () => null
    })

    const enResult = buildTaskGroupOverview(port, 'g1', 'en')
    expect(enResult!.title).toBe('English')
    expect(enResult!.description).toBe('Desc en')

    const frResult = buildTaskGroupOverview(port, 'g1', 'fr')
    expect(frResult!.title).toBe('Français')
    expect(frResult!.description).toBe('Desc fr')
  })
})

describe('buildTaskGroupList', () => {
  it('returns empty list when no groups', () => {
    const port = createMockPort({ groupIds: [] })
    expect(buildTaskGroupList(port, 'en')).toEqual([])
  })

  it('excludes groups without meta', () => {
    const port = createMockPort({
      groupIds: ['g1', 'g2'],
      getGroupMeta: (groupId) => (groupId === 'g1' ? { title: { en: 'G1', fr: 'G1' } } : undefined),
      getTaskDirsByGroup: () =>
        new Map([
          ['g1', ['01-a']],
          ['g2', ['01-b']]
        ])
    })
    const list = buildTaskGroupList(port, 'en')
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('g1')
  })

  it('excludes groups with zero tasks', () => {
    const port = createMockPort({
      groupIds: ['g1', 'g2'],
      getGroupMeta: () => ({ title: { en: 'Group', fr: 'Groupe' } }),
      getTaskDirsByGroup: () =>
        new Map([
          ['g1', ['01-a']],
          ['g2', []]
        ])
    })
    const list = buildTaskGroupList(port, 'en')
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('g1')
    expect(list[0].totalTasks).toBe(1)
  })

  it('returns list with id, title, description, totalTasks for each group', () => {
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
      getTaskDirsByGroup: () =>
        new Map([
          ['ga', ['01-one', '02-two']],
          ['gb', ['01-solo']]
        ])
    })

    const list = buildTaskGroupList(port, 'en')
    expect(list).toHaveLength(2)
    expect(list[0]).toEqual({
      id: 'ga',
      title: 'Group A',
      description: 'Desc A',
      totalTasks: 2
    })
    expect(list[1]).toEqual({
      id: 'gb',
      title: 'Group B',
      description: null,
      totalTasks: 1
    })
  })
})
