import type { UiLang } from "../courses/types";
import type { LessonLocation } from "./types";
import type { Quiz } from "../../types/quiz";
import type { MarkdownInstance } from "astro";

export type ChapterMeta = {
  title: Record<UiLang, string>;
  description?: Record<UiLang, string>;
  isFree?: boolean;
  environment?: string;
};

export interface OverviewIndexPort {
  getLessonTitleIndex(): Map<string, string>;
  getChapterMetaIndex(): Map<string, ChapterMeta>;
  getChapterDirsByModule(): Map<
    string,
    Array<{ chapterDir: string; chapterId: string }>
  >;
  getLessonDirsByChapter(): Map<string, string[]>;
}

export interface LessonContentPort {
  getLessonMarkdown(loc: LessonLocation, lang: UiLang): string | null;
  getLessonContent(
    loc: LessonLocation,
    lang: UiLang
  ): MarkdownInstance<Record<string, unknown>> | null;
  getLessonQuiz(loc: LessonLocation, lang: UiLang): Quiz | null;
}
