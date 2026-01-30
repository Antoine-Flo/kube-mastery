/**
 * Build-time loader for courses and modules from src/courses/ (no API).
 * Uses import.meta.glob; all data is resolved at build time.
 */

import type { LocalCourse, CourseStructure, LocalModule } from "../courses/types.js";

export type UiLang = "en" | "fr";

export interface CourseListItem {
  id: string;
  title: string;
  description: string | null;
  shortDescription: string | null;
  level: string | null;
  isFree: boolean;
  comingSoon: boolean;
  order: number;
  totalLessons: number;
}

export interface ModuleListItem {
  id: string;
  title: string;
  description: string | null;
  totalLessons: number;
}

/** Strip numeric prefix from folder name: "01-onboarding" -> "onboarding" */
function stripNumericPrefix(name: string): string {
  return name.replace(/^\d+-/, "");
}

/** Build map: moduleId -> chapterId -> Set of lessonId */
function buildLessonIndex(): Map<string, Map<string, Set<string>>> {
  const index = new Map<string, Map<string, Set<string>>>();
  const glob = import.meta.glob("../courses/modules/**/content.md");
  for (const path of Object.keys(glob)) {
    const parts = path.split("/");
    const modulesIdx = parts.indexOf("modules");
    if (modulesIdx === -1 || parts.length < modulesIdx + 4) continue;
    const moduleId = parts[modulesIdx + 1];
    const chapterDir = parts[modulesIdx + 2];
    const lessonDir = parts[modulesIdx + 3];
    const chapterId = stripNumericPrefix(chapterDir);
    const lessonId = stripNumericPrefix(lessonDir);
    if (!index.has(moduleId)) index.set(moduleId, new Map());
    const mod = index.get(moduleId)!;
    if (!mod.has(chapterId)) mod.set(chapterId, new Set());
    mod.get(chapterId)!.add(lessonId);
  }
  return index;
}

function getLessonIndex(): Map<string, Map<string, Set<string>>> {
  if (!(globalThis as any).__courses_lesson_index) {
    (globalThis as any).__courses_lesson_index = buildLessonIndex();
  }
  return (globalThis as any).__courses_lesson_index;
}

function countLessonsForModule(moduleId: string): number {
  const index = getLessonIndex();
  const mod = index.get(moduleId);
  if (!mod) return 0;
  let n = 0;
  for (const set of mod.values()) n += set.size;
  return n;
}

function countLessonsForChapters(
  structure: CourseStructure,
  index: Map<string, Map<string, Set<string>>>
): number {
  let n = 0;
  for (const ch of structure.chapters) {
    const mod = index.get(ch.moduleId);
    if (!mod) continue;
    if (ch.chapterId === "all") {
      for (const set of mod.values()) n += set.size;
    } else {
      n += mod.get(ch.chapterId)?.size ?? 0;
    }
  }
  return n;
}

const coursesGlob = import.meta.glob("../courses/*/course.ts", { eager: true }) as Record<
  string,
  { course: LocalCourse }
>;
const structuresGlob = import.meta.glob("../courses/*/course-structure.ts", { eager: true }) as Record<
  string,
  { courseStructure: CourseStructure }
>;
const modulesGlob = import.meta.glob("../courses/modules/*/module.ts", { eager: true }) as Record<
  string,
  { module: LocalModule }
>;

export function getCourses(lang: UiLang): CourseListItem[] {
  const index = getLessonIndex();
  const list: CourseListItem[] = [];
  for (const path of Object.keys(coursesGlob)) {
    if (path.includes("modules")) continue;
    const courseId = path.split("/").slice(-2)[0];
    const course = coursesGlob[path].course;
    if (!course.isActive) continue;
    const structurePath = path.replace("course.ts", "course-structure.ts");
    const structure = structuresGlob[structurePath]?.courseStructure ?? { chapters: [] };
    const totalLessons = countLessonsForChapters(structure, index);
    list.push({
      id: courseId,
      title: course.title[lang] ?? course.title.en,
      description: course.description?.[lang] ?? course.description?.en ?? null,
      shortDescription: course.shortDescription?.[lang] ?? course.shortDescription?.en ?? null,
      level: course.level?.[lang] ?? course.level?.en ?? null,
      isFree: course.isFree ?? (course.price == null || course.price === 0),
      comingSoon: course.comingSoon ?? false,
      order: course.order ?? 999,
      totalLessons,
    });
  }
  list.sort((a, b) => a.order - b.order);
  return list;
}

export function getModules(lang: UiLang): ModuleListItem[] {
  const list: ModuleListItem[] = [];
  for (const path of Object.keys(modulesGlob)) {
    const parts = path.split("/");
    const moduleId = parts[parts.length - 2];
    const mod = modulesGlob[path].module;
    const totalLessons = countLessonsForModule(moduleId);
    if (totalLessons === 0) continue;
    list.push({
      id: moduleId,
      title: mod.title[lang] ?? mod.title.en,
      description: mod.description?.[lang] ?? mod.description?.en ?? null,
      totalLessons,
    });
  }
  list.sort((a, b) => a.id.localeCompare(b.id));
  return list;
}
