import type { BlogArticleSummary, BlogFrontmatter, BlogLang } from './types'

function toTimestamp(value: string): number {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    return 0
  }
  return timestamp
}

export function sortByPublishedAtDesc(
  left: BlogArticleSummary,
  right: BlogArticleSummary
): number {
  return toTimestamp(right.publishedAt) - toTimestamp(left.publishedAt)
}

export function buildSummary(
  slug: string,
  lang: BlogLang,
  frontmatter: BlogFrontmatter
): BlogArticleSummary {
  return {
    slug,
    lang,
    title: frontmatter.title,
    description: frontmatter.description,
    excerpt: frontmatter.excerpt,
    publishedAt: frontmatter.publishedAt,
    updatedAt: frontmatter.updatedAt ?? null,
    author: frontmatter.author,
    tags: frontmatter.tags ?? [],
    canonical: frontmatter.canonical ?? null
  }
}
