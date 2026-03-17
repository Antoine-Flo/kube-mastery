import type { MarkdownInstance } from 'astro'

export type BlogLang = 'en' | 'fr'

export interface BlogFrontmatter {
  title: string
  description: string
  excerpt: string
  publishedAt: string
  updatedAt?: string
  author: string
  tags?: string[]
  canonical?: string
  isDraft?: boolean
}

export interface BlogArticleSummary {
  slug: string
  lang: BlogLang
  title: string
  description: string
  excerpt: string
  publishedAt: string
  updatedAt: string | null
  author: string
  tags: string[]
  canonical: string | null
}

export interface BlogDataPort {
  getAllSlugs(): string[]
  getArticleMarkdown(
    slug: string,
    lang: BlogLang
  ): MarkdownInstance<BlogFrontmatter> | null
  getPublishedSummaries(lang: BlogLang): BlogArticleSummary[]
}
