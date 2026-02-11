import type { UiLang } from '../courses/types'
import type { TaskGroupOverview, TaskGroupListItem } from './types'
import type { TaskIndexPort } from './port'
import { stripNumericPrefix } from '../utils'

export function buildTaskGroupOverview(port: TaskIndexPort, groupId: string, lang: UiLang): TaskGroupOverview | null {
  const meta = port.getGroupMeta(groupId)
  if (!meta) {
    return null
  }

  const taskDirs = port.getTaskDirsByGroup().get(groupId)
  if (!taskDirs || taskDirs.length === 0) {
    return null
  }

  const tasks = taskDirs.map((taskDir) => {
    const id = stripNumericPrefix(taskDir)
    const title = port.getTaskTitle(groupId, id, lang)
    const description = port.getTaskDescription(groupId, id, lang)
    return { id, title, description }
  })

  const title = meta.title[lang] ?? meta.title.en
  const description = meta.description?.[lang] ?? meta.description?.en ?? null

  return {
    id: groupId,
    title,
    description,
    tasks,
    environment: meta.environment
  }
}

export function buildTaskGroupList(port: TaskIndexPort, lang: UiLang): TaskGroupListItem[] {
  const groupIds = port.getGroupIds()
  const list: TaskGroupListItem[] = []

  for (const groupId of groupIds) {
    const meta = port.getGroupMeta(groupId)
    if (!meta) {
      continue
    }

    const taskDirs = port.getTaskDirsByGroup().get(groupId)
    const totalTasks = taskDirs?.length ?? 0
    if (totalTasks === 0) {
      continue
    }

    const title = meta.title[lang] ?? meta.title.en
    const description = meta.description?.[lang] ?? meta.description?.en ?? null

    list.push({
      id: groupId,
      title,
      description,
      totalTasks
    })
  }

  return list
}
