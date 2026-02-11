import type { UiLang } from '../courses/types'
import type { TaskGroupMeta, TaskLocation } from './types'

export interface TaskIndexPort {
  getGroupIds(): string[]
  getGroupMeta(groupId: string): TaskGroupMeta | undefined
  getTaskDirsByGroup(): Map<string, string[]>
  getTaskTitle(groupId: string, taskId: string, lang: UiLang): string
  getTaskDescription(groupId: string, taskId: string, lang: UiLang): string | null
}

export interface TaskContentPort {
  getTaskContent(groupId: string, taskId: string, lang: UiLang): unknown
}

export type TaskGlobAdapter = TaskIndexPort & TaskContentPort
