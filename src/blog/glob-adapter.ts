import type { MarkdownInstance } from 'astro'
import { buildSummary, sortByPublishedAtDesc } from './domain'
import type { BlogDataPort, BlogFrontmatter, BlogLang } from './types'

const blogMarkdownGlob = import.meta.glob<MarkdownInstance<BlogFrontmatter>>(
  './articles/*/{en,fr}/content.md',
  {
    eager: true
  }
)

function parsePath(path: string): { slug: string; lang: BlogLang } | null {
  const normalized = path.replace(/\\/g, '/')
  const match = normalized.match(/\/articles\/([^/]+)\/(en|fr)\/content\.md$/)

  if (!match) {
    return null
  }

  const slug = match[1]
  const lang = match[2] as BlogLang
  return { slug, lang }
}

function getEntryBySlugAndLang(
  slug: string,
  lang: BlogLang
): MarkdownInstance<BlogFrontmatter> | null {
  for (const [path, entry] of Object.entries(blogMarkdownGlob)) {
    const parsedPath = parsePath(path)
    if (!parsedPath) {
      continue
    }
    if (parsedPath.slug === slug && parsedPath.lang === lang) {
      return entry
    }
  }

  return null
}

export function createBlogGlobAdapter(): BlogDataPort {
  return {
    getAllSlugs(): string[] {
      const slugs = new Set<string>()
      for (const path of Object.keys(blogMarkdownGlob)) {
        const parsedPath = parsePath(path)
        if (!parsedPath) {
          continue
        }
        slugs.add(parsedPath.slug)
      }
      return Array.from(slugs).sort((a, b) => a.localeCompare(b))
    },

    getArticleMarkdown(
      slug: string,
      lang: BlogLang
    ): MarkdownInstance<BlogFrontmatter> | null {
      const exactMatch = getEntryBySlugAndLang(slug, lang)
      if (exactMatch) {
        return exactMatch
      }
      if (lang !== 'en') {
        return getEntryBySlugAndLang(slug, 'en')
      }
      return null
    },

    getPublishedSummaries(lang: BlogLang) {
      const summaries = []
      for (const slug of this.getAllSlugs()) {
        const entry = this.getArticleMarkdown(slug, lang)
        if (!entry) {
          continue
        }
        if (entry.frontmatter.isDraft === true) {
          continue
        }
        summaries.push(buildSummary(slug, lang, entry.frontmatter))
      }
      summaries.sort(sortByPublishedAtDesc)
      return summaries
    }
  }
}
