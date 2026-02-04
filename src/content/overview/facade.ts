import type { MarkdownInstance } from "astro";
import {
  getCourseMarkdown,
  getCourseStructure,
  getModule,
} from "../courses/facade";
import type { UiLang } from "../courses/types";
import { getChapterIdsFromStructure, buildChapter } from "./domain";
import { createOverviewGlobAdapter } from "./glob-adapter";
import { stripNumericPrefix } from "../utils";
import type {
  CourseOverview,
  LessonLocation,
  OverviewType,
} from "./types";
import type { Quiz } from "../../types/quiz";

let adapter: ReturnType<typeof createOverviewGlobAdapter> | null = null;

function getAdapter() {
  if (!adapter) {
    adapter = createOverviewGlobAdapter()
  };
  return adapter;
}

export type {
  CourseOverview,
  OverviewChapter,
  OverviewLesson,
  OverviewType,
  LessonLocation,
} from "./types";

export function getCourseOverview(
  courseId: string,
  lang: UiLang
): CourseOverview | null {
  const entry = getCourseMarkdown(courseId, lang);
  if (!entry) {
    return null
  };
  const fm = entry.frontmatter;
  if (fm.isActive === false) {
    return null
  };

  const structure = getCourseStructure(courseId);
  const structureOrEmpty = structure ?? { chapters: [] };
  const index = getAdapter();
  const chapterDirsByModule = index.getChapterDirsByModule();
  const chapterIds = getChapterIdsFromStructure(
    structureOrEmpty,
    chapterDirsByModule
  );
  const lessonTitles = index.getLessonTitleIndex();
  const chapterMeta = index.getChapterMetaIndex();
  const lessonDirsMap = index.getLessonDirsByChapter();

  const chapters = chapterIds.map(({ moduleId, chapterId }) =>
    buildChapter(
      moduleId,
      chapterId,
      chapterMeta.get(`${moduleId}:${chapterId}`),
      lessonDirsMap,
      lessonTitles,
      lang
    )
  );

  return {
    id: courseId,
    title: fm.title,
    shortDescription: fm.shortDescription ?? null,
    level: fm.level ?? null,
    isFree: fm.isFree ?? (fm.price == null || fm.price === 0),
    comingSoon: fm.comingSoon ?? false,
    content: { chapters },
    descriptionContent:
      entry as unknown as MarkdownInstance<Record<string, unknown>>,
    description: null,
  };
}

export function getModuleOverview(
  moduleId: string,
  lang: UiLang
): CourseOverview | null {
  const mod = getModule(moduleId);
  if (!mod) {
    return null
  };

  const index = getAdapter();
  const chapterDirs = index.getChapterDirsByModule().get(moduleId) ?? [];
  if (chapterDirs.length === 0) {
    return null
  };

  const lessonTitles = index.getLessonTitleIndex();
  const chapterMeta = index.getChapterMetaIndex();
  const lessonDirsMap = index.getLessonDirsByChapter();

  const chapters = chapterDirs.map(({ chapterId }) =>
    buildChapter(
      moduleId,
      chapterId,
      chapterMeta.get(`${moduleId}:${chapterId}`),
      lessonDirsMap,
      lessonTitles,
      lang
    )
  );

  return {
    id: moduleId,
    title: mod.title[lang] ?? mod.title.en,
    shortDescription: mod.description?.[lang] ?? mod.description?.en ?? null,
    level: null,
    isFree: false,
    comingSoon: false,
    content: { chapters },
    descriptionContent: null,
    description: mod.description?.[lang] ?? mod.description?.en ?? null,
  };
}

export function getLessonLocation(
  type: OverviewType,
  id: string,
  lessonId: string
): LessonLocation | null {
  const lang: UiLang = "en";
  const overview =
    type === "courses"
      ? getCourseOverview(id, lang)
      : getModuleOverview(id, lang);

  if (!overview) {
    return null
  };

  for (const chapter of overview.content.chapters) {
    const lesson = chapter.lessons.find((l) => l.id === lessonId);
    if (!lesson) {
      continue
    };

    const moduleId = chapter.moduleId ?? overview.id;
    const chapterId = chapter.id;
    const chapterDirs = getAdapter().getChapterDirsByModule().get(moduleId) ?? [];
    const chapterEntry = chapterDirs.find((c) => c.chapterId === chapterId);
    if (!chapterEntry) {
      return null
    };

    const lessonDirs =
      getAdapter().getLessonDirsByChapter().get(`${moduleId}:${chapterId}`) ??
      [];
    const lessonDir = lessonDirs.find(
      (d) => stripNumericPrefix(d) === lessonId
    );
    if (!lessonDir) {
      return null
    };

    return {
      moduleId,
      chapterDir: chapterEntry.chapterDir,
      lessonDir,
    };
  }
  return null;
}

export function getLessonMarkdown(
  type: OverviewType,
  id: string,
  lessonId: string,
  lang: UiLang
): string | null {
  const loc = getLessonLocation(type, id, lessonId);
  if (!loc) {
    return null
  }

  return getAdapter().getLessonMarkdown(loc, lang);
}

export function getLessonContent(
  type: OverviewType,
  id: string,
  lessonId: string,
  lang: UiLang
): MarkdownInstance<Record<string, unknown>> | null {
  const loc = getLessonLocation(type, id, lessonId);
  if (!loc) {
    return null
  }

  return getAdapter().getLessonContent(loc, lang);
}

export function getLessonQuiz(
  type: OverviewType,
  id: string,
  lessonId: string,
  lang: UiLang
): Quiz | null {
  const loc = getLessonLocation(type, id, lessonId);
  if (!loc) {
    return null
  }

  return getAdapter().getLessonQuiz(loc, lang);
}
