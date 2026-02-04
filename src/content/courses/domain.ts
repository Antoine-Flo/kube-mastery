import type { CourseStructure } from "../../courses/types";

export function countLessonsForModule(
  lessonIndex: Map<string, Map<string, Set<string>>>,
  moduleId: string
): number {
  const mod = lessonIndex.get(moduleId);
  if (!mod) {
    return 0;
  }

  let n = 0;
  for (const set of mod.values()) {
    n += set.size;
  }

  return n;
}

export function countLessonsForChapters(
  structure: CourseStructure,
  lessonIndex: Map<string, Map<string, Set<string>>>
): number {
  let n = 0;

  for (const ch of structure.chapters) {
    const mod = lessonIndex.get(ch.moduleId);
    if (!mod) {
      continue;
    }
    if (ch.chapterId === "all") {
      for (const set of mod.values()) {
        n += set.size;
      }
    } else {
      n += mod.get(ch.chapterId)?.size ?? 0;
    }
  }

  return n;
}
