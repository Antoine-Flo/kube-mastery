import { createBlogGlobAdapter } from './glob-adapter'
import type { BlogDataPort, BlogLang } from './types'

let adapter: BlogDataPort | null = null

function getAdapter(): BlogDataPort {
  if (!adapter) {
    adapter = createBlogGlobAdapter()
  }
  return adapter
}

export type { BlogArticleSummary, BlogFrontmatter, BlogLang } from './types'

export function getAllBlogSlugs(): string[] {
  return getAdapter().getAllSlugs()
}

export function getBlogArticleMarkdown(slug: string, lang: BlogLang) {
  return getAdapter().getArticleMarkdown(slug, lang)
}

export function getPublishedBlogSummaries(lang: BlogLang) {
  return getAdapter().getPublishedSummaries(lang)
}
