/**
 * Build-time loader for courses and modules from src/courses/ (no API).
 * Uses import.meta.glob; all data is resolved at build time.
 */

import type { MarkdownInstance } from "astro";
import type { CourseStructure, LocalModule } from "../courses/types.js";

export type UiLang = "en" | "fr";

export interface CourseFrontmatter {
  title: string;
  shortDescription: string;
  isActive?: boolean;
  price?: number;
  isFree?: boolean;
  comingSoon?: boolean;
  order?: number;
  level?: string;
}

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
    if (modulesIdx === -1 || parts.length < modulesIdx + 4) {
      continue;
    }
    const moduleId = parts[modulesIdx + 1];
    const chapterDir = parts[modulesIdx + 2];
    const lessonDir = parts[modulesIdx + 3];
    const chapterId = stripNumericPrefix(chapterDir);
    const lessonId = stripNumericPrefix(lessonDir);
    if (!index.has(moduleId)) {
      index.set(moduleId, new Map());
    }
    const mod = index.get(moduleId)!;
    if (!mod.has(chapterId)) {
      mod.set(chapterId, new Set());
    }
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
  if (!mod) {
    return 0;
  }
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
    if (!mod) {
      continue;
    }
    if (ch.chapterId === "all") {
      for (const set of mod.values()) n += set.size;
    } else {
      n += mod.get(ch.chapterId)?.size ?? 0;
    }
  }
  return n;
}

const courseMdGlob = import.meta.glob<MarkdownInstance<CourseFrontmatter>>(
  "../courses/*/{en,fr}.md",
  { eager: true }
);
const structuresGlob = import.meta.glob("../courses/*/course-structure.ts", { eager: true }) as Record<
  string,
  { courseStructure: CourseStructure }
>;
const modulesGlob = import.meta.glob("../courses/modules/*/module.ts", { eager: true }) as Record<
  string,
  { module: LocalModule }
>;

function getCourseIds(): string[] {
  const ids = new Set<string>();
  for (const path of Object.keys(courseMdGlob)) {
    const parts = path.split("/");
    const courseId = parts[parts.length - 2];
    ids.add(courseId);
  }
  return Array.from(ids);
}

export function getCourseMarkdown(
  courseId: string,
  lang: UiLang
): (typeof courseMdGlob)[string] | null {
  for (const [path, entry] of Object.entries(courseMdGlob)) {
    const parts = path.replace(/\\/g, "/").split("/");
    const pathCourseId = parts[parts.length - 2];
    const pathLang = parts[parts.length - 1]?.replace(".md", "") ?? "";
    if (pathCourseId === courseId && pathLang === lang) return entry;
  }
  if (lang !== "en") {
    return getCourseMarkdown(courseId, "en");
  }
  return null;
}

export function getCourses(lang: UiLang): CourseListItem[] {
  const index = getLessonIndex();
  const list: CourseListItem[] = [];
  for (const courseId of getCourseIds()) {
    const entry = getCourseMarkdown(courseId, lang);
    if (!entry) continue;
    const fm = entry.frontmatter;
    if (fm.isActive === false) continue;
    const structurePath = Object.keys(structuresGlob).find((p) => p.includes(`/${courseId}/`));
    const structure = structurePath ? structuresGlob[structurePath]?.courseStructure : undefined;
    const structureOrEmpty = structure ?? { chapters: [] };
    const totalLessons = countLessonsForChapters(structureOrEmpty, index);
    list.push({
      id: courseId,
      title: fm.title,
      description: fm.shortDescription,
      shortDescription: fm.shortDescription,
      level: fm.level ?? null,
      isFree: fm.isFree ?? (fm.price == null || fm.price === 0),
      comingSoon: fm.comingSoon ?? false,
      order: fm.order ?? 999,
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
    if (totalLessons === 0) {
      continue;
    }
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
