export interface DrillLocation {
  groupId: string
  drillDir: string
}

export interface DrillOverview {
  id: string
  title: string
  /** Short one-line description for the drill card. */
  description: string | null
}

export interface DrillGroupOverview {
  id: string
  title: string
  description: string | null
  drills: DrillOverview[]
  environment?: string
  /** Optional CKA-style time target in minutes (shown on completion). */
  ckaTargetMinutes?: number
}

export interface DrillGroupListItem {
  id: string
  title: string
  description: string | null
  totalDrills: number
}

export interface DrillGroupMeta {
  title: { en: string; fr: string }
  description?: { en?: string; fr?: string }
  environment?: string
  ckaTargetMinutes?: number
}
