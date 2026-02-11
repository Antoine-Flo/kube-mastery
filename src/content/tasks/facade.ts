import type { MarkdownInstance } from 'astro'
import type { UiLang } from '../courses/types'
import type { TaskGroupOverview, TaskGroupListItem, TaskLocation } from './types'
import type { TaskGlobAdapter } from './port'
import { buildTaskGroupOverview, buildTaskGroupList } from './domain'
import { createTaskGlobAdapter } from './glob-adapter'
import { stripNumericPrefix } from '../utils'

let adapter: TaskGlobAdapter | null = null

function getAdapter(): TaskGlobAdapter {
  if (!adapter) {
    adapter = createTaskGlobAdapter()
  }
  return adapter
}

export type { TaskGroupOverview, TaskGroupListItem, TaskLocation, TaskOverview } from './types'

export function getTaskGroups(lang: UiLang): TaskGroupListItem[] {
  return buildTaskGroupList(getAdapter(), lang)
}

export function getTaskGroupOverview(groupId: string, lang: UiLang): TaskGroupOverview | null {
  return buildTaskGroupOverview(getAdapter(), groupId, lang)
}

export function getTaskContent(
  groupId: string,
  taskId: string,
  lang: UiLang
): MarkdownInstance<Record<string, unknown>> | null {
  const content = getAdapter().getTaskContent(groupId, taskId, lang)
  if (!content) {
    return null
  }
  return content as MarkdownInstance<Record<string, unknown>>
}

export function getTaskLocation(groupId: string, taskId: string): TaskLocation | null {
  const taskDirs = getAdapter().getTaskDirsByGroup().get(groupId)
  if (!taskDirs) {
    return null
  }

  const taskDir = taskDirs.find((d) => stripNumericPrefix(d) === taskId)
  if (!taskDir) {
    return null
  }

  return { groupId, taskDir }
}
