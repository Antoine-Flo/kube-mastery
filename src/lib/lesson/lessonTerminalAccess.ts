import type { OverviewType } from '../../content/overview/types'

export type LessonTerminalOverviewType = OverviewType

export function isLessonTerminalInteractive(args: {
  overviewType: LessonTerminalOverviewType
  hasUserSession: boolean
  learnableIsFree: boolean
  hasPaidSubscription: boolean
}): boolean {
  return args.learnableIsFree || args.hasPaidSubscription
}

type OverviewSection = {
  modules: Array<{
    lessons: Array<{ id: string; isPlaceholder: boolean }>
  }>
}

/**
 * First real lesson id in course overview order (skips placeholders).
 */
export function getFirstNonPlaceholderLessonIdFromSections(
  sections: OverviewSection[]
): string | null {
  for (const section of sections) {
    for (const mod of section.modules) {
      for (const lesson of mod.lessons) {
        if (!lesson.isPlaceholder) {
          return lesson.id
        }
      }
    }
  }

  return null
}
