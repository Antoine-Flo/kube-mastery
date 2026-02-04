import type { UiLang } from "./types";
import type { CourseDataPort } from "./port";
import { countLessonsForModule, countLessonsForChapters } from "./domain";
import { createCourseGlobAdapter } from "./glob-adapter";
import type { CourseListItem, ModuleListItem } from "./types";

let adapter: CourseDataPort | null = null;

function getAdapter(): CourseDataPort {
  if (!adapter) {
    adapter = createCourseGlobAdapter();
  }
  return adapter;
}

export type { CourseFrontmatter, CourseListItem, ModuleListItem, UiLang } from "./types";

export function getCourseMarkdown(
  courseId: string,
  lang: UiLang
): ReturnType<CourseDataPort["getCourseMarkdown"]> {
  return getAdapter().getCourseMarkdown(courseId, lang);
}

export function getCourseStructure(
  courseId: string
): ReturnType<CourseDataPort["getCourseStructure"]> {
  return getAdapter().getCourseStructure(courseId);
}

export function getModule(
  moduleId: string
): ReturnType<CourseDataPort["getModule"]> {
  return getAdapter().getModule(moduleId);
}

export function getCourses(lang: UiLang): CourseListItem[] {
  const port = getAdapter();
  const index = port.getLessonIndex();
  const list: CourseListItem[] = [];

  for (const courseId of port.getCourseIds()) {
    const entry = port.getCourseMarkdown(courseId, lang);
    if (!entry) {
      continue;
    }
    const fm = entry.frontmatter;
    if (fm.isActive === false) {
      continue;
    }

    const structure = port.getCourseStructure(courseId);
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
  const port = getAdapter();
  const list: ModuleListItem[] = [];

  for (const { moduleId, module } of port.getModuleEntries()) {
    const totalLessons = countLessonsForModule(port.getLessonIndex(), moduleId);

    if (totalLessons === 0) {
      continue;
    }

    list.push({
      id: moduleId,
      title: module.title[lang] ?? module.title.en,
      description: module.description?.[lang] ?? module.description?.en ?? null,
      totalLessons,
    });
  }

  list.sort((a, b) => a.id.localeCompare(b.id));
  return list;
}
