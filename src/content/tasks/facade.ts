import type { MarkdownInstance } from 'astro'
import type { UiLang } from '../courses/types'
import type {
  TaskGroupOverview,
  TaskGroupListItem,
} from './types'
import type { TaskGlobAdapter } from './port'
import { buildTaskGroupOverview, buildTaskGroupList } from './domain'
import { createTaskGlobAdapter } from './glob-adapter'
import { DEMO_TASK_GROUP_ID } from './constants'

let adapter: TaskGlobAdapter | null = null

function getAdapter(): TaskGlobAdapter {
  if (!adapter) {
    adapter = createTaskGlobAdapter()
  }
  return adapter
}

export type {
  TaskGroupOverview,
  TaskGroupListItem,
  TaskLocation,
  TaskOverview
} from './types'

export function getTaskGroups(lang: UiLang): TaskGroupListItem[] {
  return buildTaskGroupList(getAdapter(), lang).filter(
    (g) => g.id !== DEMO_TASK_GROUP_ID
  )
}

export function getTaskGroupOverview(
  groupId: string,
  lang: UiLang
): TaskGroupOverview | null {
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
