/**
 * Build-time data for course/module overview pages (chapters + lessons from markdown).
 */

import type { MarkdownInstance } from "astro";
import type { LocalCourse, CourseStructure, LocalModule } from "../courses/types.js";
import type { UiLang } from "./courses.js";

export interface OverviewLesson {
  id: string;
  title: string;
  hasEnvironment: boolean;
}

export interface OverviewChapter {
  id: string;
  moduleId?: string;
  title: string;
  description?: string;
  isFree?: boolean;
  environment?: string;
  lessons: OverviewLesson[];
}

export interface CourseOverview {
  id: string;
  title: string;
  description: string | null;
  shortDescription: string | null;
  level: string | null;
  isFree: boolean;
  comingSoon: boolean;
  content: { chapters: OverviewChapter[] };
}

// Re-export stripNumericPrefix for use in this file (courses.ts exports it but we need it here)
function stripNumericPrefix(name: string): string {
  return name.replace(/^\d+-/, "");
}

/** Parse first H1 from markdown content: "# Title" -> "Title" */
function parseH1(content: string): string {
  const line = content.split("\n").find((l) => l.startsWith("#"));
  if (!line) {
    return "";
  }
  return line.replace(/^#\s*/, "").trim();
}

/** Build map (moduleId, chapterId, lessonId, lang) -> title from content.md */
function buildLessonTitleIndex(): Map<string, string> {
  const index = new Map<string, string>();
  const glob = import.meta.glob<string>(
    "../courses/modules/**/content.md",
    { eager: true, as: "raw" }
  );
  for (const [path, content] of Object.entries(glob)) {
    const text = content ?? "";
    const parts = path.split("/");
    const modulesIdx = parts.indexOf("modules");
    if (modulesIdx === -1 || parts.length < modulesIdx + 5) {
      continue;
    }
    const moduleId = parts[modulesIdx + 1];
    const chapterDir = parts[modulesIdx + 2];
    const lessonDir = parts[modulesIdx + 3];
    const lang = parts[modulesIdx + 4];
    if (lang !== "en" && lang !== "fr") {
      continue;
    }
    const chapterId = stripNumericPrefix(chapterDir);
    const lessonId = stripNumericPrefix(lessonDir);
    const title = parseH1(text);
    const key = `${moduleId}:${chapterId}:${lessonId}:${lang}`;
    index.set(key, title);
  }
  return index;
}

/** Build map (moduleId, chapterId) -> { title, description, isFree, environment } from chapter.json */
function buildChapterMetaIndex(): Map<
  string,
  { title: Record<UiLang, string>; description?: Record<UiLang, string>; isFree?: boolean; environment?: string }
> {
  const index = new Map();
  const glob = import.meta.glob<{ default: Record<string, unknown> }>(
    "../courses/modules/*/*/chapter.json",
    { eager: true, import: "default" }
  );
  for (const [path, data] of Object.entries(glob)) {
    const parts = path.split("/");
    const modulesIdx = parts.indexOf("modules");
    if (modulesIdx === -1 || parts.length < modulesIdx + 3) {
      continue;
    }
    const moduleId = parts[modulesIdx + 1];
    const chapterDir = parts[modulesIdx + 2];
    const chapterId = stripNumericPrefix(chapterDir);
    const key = `${moduleId}:${chapterId}`;
    const raw = data as unknown as {
      title?: { en?: string; fr?: string };
      description?: { en?: string; fr?: string };
      isFree?: boolean;
      environment?: string;
    };
    index.set(key, {
      title: { en: raw.title?.en ?? "", fr: raw.title?.fr ?? "" },
      description: raw.description,
      isFree: raw.isFree,
      environment: raw.environment,
    });
  }
  return index;
}

function getLessonTitleIndex(): Map<string, string> {
  if (!(globalThis as any).__overview_lesson_titles) {
    (globalThis as any).__overview_lesson_titles = buildLessonTitleIndex();
  }
  return (globalThis as any).__overview_lesson_titles;
}

function getChapterMetaIndex(): Map<
  string,
  { title: Record<UiLang, string>; description?: Record<UiLang, string>; isFree?: boolean; environment?: string }
> {
  if (!(globalThis as any).__overview_chapter_meta) {
    (globalThis as any).__overview_chapter_meta = buildChapterMetaIndex();
  }
  return (globalThis as any).__overview_chapter_meta;
}

/** Get ordered (chapterDir, chapterId) for a module from filesystem (infer from content.md paths). */
function getChapterDirsByModule(): Map<string, Array<{ chapterDir: string; chapterId: string }>> {
  if (!(globalThis as any).__overview_chapter_dirs) {
    const seen = new Map<string, Set<string>>();
    const glob = import.meta.glob("../courses/modules/**/content.md");
    for (const path of Object.keys(glob)) {
      const parts = path.split("/");
      const modulesIdx = parts.indexOf("modules");
      if (modulesIdx === -1 || parts.length < modulesIdx + 4) {
        continue;
      }
      const moduleId = parts[modulesIdx + 1];
      const chapterDir = parts[modulesIdx + 2];
      const chapterId = stripNumericPrefix(chapterDir);
      if (!seen.has(moduleId)) {
        seen.set(moduleId, new Set());
      }
      seen.get(moduleId)!.add(JSON.stringify({ chapterDir, chapterId }));
    }
    const out = new Map<string, Array<{ chapterDir: string; chapterId: string }>>();
    for (const [moduleId, set] of seen) {
      const arr = Array.from(set).map((s) => JSON.parse(s) as { chapterDir: string; chapterId: string });
      arr.sort((a, b) => a.chapterDir.localeCompare(b.chapterDir));
      out.set(moduleId, arr);
    }
    (globalThis as any).__overview_chapter_dirs = out;
  }
  return (globalThis as any).__overview_chapter_dirs;
}

/** Get ordered lessonDir for (moduleId, chapterId) from filesystem. */
function getLessonDirsByChapter(): Map<string, string[]> {
  if (!(globalThis as any).__overview_lesson_dirs) {
    const seen = new Map<string, Set<string>>();
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
      const key = `${moduleId}:${chapterId}`;
      if (!seen.has(key)) {
        seen.set(key, new Set());
      }
      seen.get(key)!.add(lessonDir);
    }
    const out = new Map<string, string[]>();
    for (const [key, set] of seen) {
      const arr = Array.from(set).sort();
      out.set(key, arr);
    }
    (globalThis as any).__overview_lesson_dirs = out;
  }
  return (globalThis as any).__overview_lesson_dirs;
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

export function getCourseOverview(courseId: string, lang: UiLang): CourseOverview | null {
  const pathKey = Object.keys(coursesGlob).find((p) => p.includes(`/${courseId}/course.ts`));
  if (!pathKey) {
    return null;
  }
  const course = coursesGlob[pathKey].course;
  if (!course.isActive) {
    return null;
  }
  const structurePath = pathKey.replace("course.ts", "course-structure.ts");
  const structure = structuresGlob[structurePath]?.courseStructure ?? { chapters: [] };
  const lessonTitles = getLessonTitleIndex();
  const chapterMeta = getChapterMetaIndex();
  const lessonDirsMap = getLessonDirsByChapter();
  const chapters: OverviewChapter[] = [];
  for (const entry of structure.chapters) {
    const { moduleId, chapterId } = entry;
    const metaKey = `${moduleId}:${chapterId}`;
    const meta = chapterMeta.get(metaKey);
    const lessonDirs = chapterId === "all"
      ? getChapterDirsByModule().get(moduleId) ?? []
      : [{ chapterDir: "", chapterId }];
    if (chapterId === "all") {
      const chapterDirs = getChapterDirsByModule().get(moduleId) ?? [];
      for (const { chapterDir, chapterId: chId } of chapterDirs) {
        const m = chapterMeta.get(`${moduleId}:${chId}`);
        const dirs = lessonDirsMap.get(`${moduleId}:${chId}`) ?? [];
        const lessons: OverviewLesson[] = dirs.map((lessonDir) => {
          const lessonId = stripNumericPrefix(lessonDir);
          const title = lessonTitles.get(`${moduleId}:${chId}:${lessonId}:${lang}`) ?? lessonId;
          const hasEnvironment = !!(m?.environment && m.environment !== "empty");
          return { id: lessonId, title, hasEnvironment };
        });
        chapters.push({
          id: chId,
          moduleId,
          title: m?.title?.[lang] ?? m?.title?.en ?? chId,
          description: m?.description?.[lang] ?? m?.description?.en,
          isFree: m?.isFree,
          environment: m?.environment,
          lessons,
        });
      }
    } else {
      const dirs = lessonDirsMap.get(metaKey) ?? [];
      const lessons: OverviewLesson[] = dirs.map((lessonDir) => {
        const lessonId = stripNumericPrefix(lessonDir);
        const title = lessonTitles.get(`${moduleId}:${chapterId}:${lessonId}:${lang}`) ?? lessonId;
        const hasEnvironment = !!(meta?.environment && meta.environment !== "empty");
        return { id: lessonId, title, hasEnvironment };
      });
      chapters.push({
        id: chapterId,
        moduleId,
        title: meta?.title?.[lang] ?? meta?.title?.en ?? chapterId,
        description: meta?.description?.[lang] ?? meta?.description?.en,
        isFree: meta?.isFree,
        environment: meta?.environment,
        lessons,
      });
    }
  }
  return {
    id: courseId,
    title: course.title[lang] ?? course.title.en,
    description: course.description?.[lang] ?? course.description?.en ?? null,
    shortDescription: course.shortDescription?.[lang] ?? course.shortDescription?.en ?? null,
    level: course.level?.[lang] ?? course.level?.en ?? null,
    isFree: course.isFree ?? (course.price == null || course.price === 0),
    comingSoon: course.comingSoon ?? false,
    content: { chapters },
  };
}

export function getModuleOverview(moduleId: string, lang: UiLang): CourseOverview | null {
  const pathKey = Object.keys(modulesGlob).find((p) => p.endsWith(`/${moduleId}/module.ts`));
  if (!pathKey) {
    return null;
  }
  const mod = modulesGlob[pathKey].module;
  const chapterDirs = getChapterDirsByModule().get(moduleId) ?? [];
  if (chapterDirs.length === 0) {
    return null;
  }
  const lessonTitles = getLessonTitleIndex();
  const chapterMeta = getChapterMetaIndex();
  const lessonDirsMap = getLessonDirsByChapter();
  const chapters: OverviewChapter[] = chapterDirs.map(({ chapterDir, chapterId }) => {
    const meta = chapterMeta.get(`${moduleId}:${chapterId}`);
    const dirs = lessonDirsMap.get(`${moduleId}:${chapterId}`) ?? [];
    const lessons: OverviewLesson[] = dirs.map((lessonDir) => {
      const lessonId = stripNumericPrefix(lessonDir);
      const title = lessonTitles.get(`${moduleId}:${chapterId}:${lessonId}:${lang}`) ?? lessonId;
      const hasEnvironment = !!(meta?.environment && meta.environment !== "empty");
      return { id: lessonId, title, hasEnvironment };
    });
    return {
      id: chapterId,
      moduleId,
      title: meta?.title?.[lang] ?? meta?.title?.en ?? chapterId,
      description: meta?.description?.[lang] ?? meta?.description?.en,
      isFree: meta?.isFree,
      environment: meta?.environment,
      lessons,
    };
  });
  return {
    id: moduleId,
    title: mod.title[lang] ?? mod.title.en,
    description: mod.description?.[lang] ?? mod.description?.en ?? null,
    shortDescription: mod.description?.[lang] ?? mod.description?.en ?? null,
    level: null,
    isFree: false,
    comingSoon: false,
    content: { chapters },
  };
}

export type OverviewType = "courses" | "modules";

export interface LessonLocation {
  moduleId: string;
  chapterDir: string;
  lessonDir: string;
}

/** Resolve (type, id, lessonId) to filesystem location for content.md. */
export function getLessonLocation(
  type: OverviewType,
  id: string,
  lessonId: string
): LessonLocation | null {
  const lang: UiLang = "en";
  const overview =
    type === "courses" ? getCourseOverview(id, lang) : getModuleOverview(id, lang);
  if (!overview) {
    return null;
  }
  for (const chapter of overview.content.chapters) {
    const lesson = chapter.lessons.find((l) => l.id === lessonId);
    if (!lesson) {
      continue;
    }
    const moduleId = chapter.moduleId ?? overview.id;
    const chapterId = chapter.id;
    const chapterDirs = getChapterDirsByModule().get(moduleId) ?? [];
    const chapterEntry = chapterDirs.find((c) => c.chapterId === chapterId);
    if (!chapterEntry) {
      return null;
    }
    const lessonDirs = getLessonDirsByChapter().get(`${moduleId}:${chapterId}`) ?? [];
    const lessonDir = lessonDirs.find((d) => stripNumericPrefix(d) === lessonId);
    if (!lessonDir) {
      return null;
    }
    return { moduleId, chapterDir: chapterEntry.chapterDir, lessonDir };
  }
  return null;
}

const contentGlob = import.meta.glob<string>("../courses/modules/**/content.md", {
  eager: true,
  query: "?raw",
  import: "default",
});

function contentPath(loc: LessonLocation, lang: UiLang): string {
  return `modules/${loc.moduleId}/${loc.chapterDir}/${loc.lessonDir}/${lang}/content.md`;
}

/** Load raw markdown for a lesson. Returns null if not found. */
export function getLessonMarkdown(
  type: OverviewType,
  id: string,
  lessonId: string,
  lang: UiLang
): string | null {
  const loc = getLessonLocation(type, id, lessonId);
  if (!loc) {
    return null;
  }
  const suffix = contentPath(loc, lang);
  const found = Object.keys(contentGlob).find((k) => k.endsWith(suffix));
  return found ? (contentGlob[found] ?? null) : null;
}

// Glob that loads .md as Astro Markdown (compiled to Content component)
const contentAsMarkdownGlob = import.meta.glob<MarkdownInstance<Record<string, unknown>>>(
  "../courses/modules/**/content.md",
  { eager: true }
);

/** Load lesson as Astro Markdown instance (Content component). Returns null if not found. */
export function getLessonContent(
  type: OverviewType,
  id: string,
  lessonId: string,
  lang: UiLang
): MarkdownInstance<Record<string, unknown>> | null {
  const loc = getLessonLocation(type, id, lessonId);
  if (!loc) {
    return null;
  }
  const found = Object.keys(contentAsMarkdownGlob).find((k) => k.endsWith(contentPath(loc, lang)));
  return found ? (contentAsMarkdownGlob[found] ?? null) : null;
}
