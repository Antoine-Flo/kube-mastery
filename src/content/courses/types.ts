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
