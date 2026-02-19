import type { CourseStructure } from './types'

export function countLessonsForModule(
  lessonIndex: Map<string, Map<string, Set<string>>>,
  moduleId: string
): number {
  const mod = lessonIndex.get(moduleId)
  if (!mod) {
    return 0
  }

  let n = 0
  for (const set of mod.values()) {
    n += set.size
  }

  return n
}

export function countLessonsForStructure(
  structure: CourseStructure,
  lessonIndex: Map<string, Map<string, Set<string>>>
): number {
  let n = 0

  for (const section of structure.sections) {
    for (const moduleId of section.moduleIds) {
      const mod = lessonIndex.get(moduleId)
      if (!mod) {
        continue
      }
      for (const set of mod.values()) {
        n += set.size
      }
    }
  }

  return n
}
