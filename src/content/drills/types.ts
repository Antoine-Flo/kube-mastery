/** Set `tag:` in drill YAML to one of these string ids (see `messages/*` for labels). */
export const DRILL_TAG_IDS = [
  'storage',
  'troubleshooting',
  'services_networking',
  'cluster_architecture_installation'
] as const

export type DrillTagId = (typeof DRILL_TAG_IDS)[number]

export interface DrillTask {
  task: string
  command: string
  explanation: string
}

export interface DrillFile {
  title: string
  description?: string
  environment?: string
  ckaTargetMinutes?: number
  tag?: DrillTagId
  tasks: DrillTask[]
}

export interface DrillListItem {
  id: string
  title: string
  description: string | null
  totalTasks: number
  tag: DrillTagId | null
}

export interface DrillDetail {
  id: string
  title: string
  description: string | null
  environment?: string
  ckaTargetMinutes?: number
  tasks: DrillTask[]
  tag: DrillTagId | null
}
