export interface TaskLocation {
  groupId: string
  taskDir: string
}

export interface TaskOverview {
  id: string
  title: string
  /** Short one-line description for the task card. */
  description: string | null
}

export interface TaskGroupOverview {
  id: string
  title: string
  description: string | null
  tasks: TaskOverview[]
  environment?: string
}

export interface TaskGroupListItem {
  id: string
  title: string
  description: string | null
  totalTasks: number
}

export interface TaskGroupMeta {
  title: { en: string; fr: string }
  description?: { en?: string; fr?: string }
  environment?: string
}
