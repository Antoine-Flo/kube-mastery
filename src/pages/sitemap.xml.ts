import type { APIContext } from 'astro'
import { CONFIG } from '../config'
import { getCourses } from '../content/courses/facade'
import { getCourseOverview } from '../content/overview/facade'
import { stripNumericPrefix } from '../content/utils'
import lastmodBySourcePath from '../generated/sitemap-lastmod.json'

type SitemapEntry = {
  loc: string
  changefreq?: string
  lastmod?: string
  alternates?: Array<{ hreflang: string; href: string }>
}

type LessonSource = {
  contentByLang: Partial<Record<string, string>>
  quizByLang: Partial<Record<string, string>>
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const lastmodIndex = lastmodBySourcePath as Record<string, string>

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function normalizeSite(site: string): string {
  if (site.endsWith('/')) {
    return site
  }
  return `${site}/`
}

function toAbsoluteUrl(site: string, pathname: string): string {
  const trimmedPath = pathname.startsWith('/') ? pathname.slice(1) : pathname
  return new URL(trimmedPath, normalizeSite(site)).href
}

function toSourcePath(globPath: string): string {
  const normalized = globPath.replaceAll('\\', '/')
  const withoutRelativePrefix = normalized.replace(/^(\.\.\/)+/, '')
  return `src/${withoutRelativePrefix}`
}

function collectStaticPublicPages(
  lang: string
): Array<{ pathname: string; sourcePaths: string[] }> {
  const pages: Array<{ pathname: string; sourcePaths: string[] }> = [
    { pathname: `/${lang}`, sourcePaths: ['src/pages/[lang]/index.astro'] },
    {
      pathname: `/${lang}/courses`,
      sourcePaths: ['src/pages/[lang]/courses.astro']
    },
    {
      pathname: `/${lang}/modules`,
      sourcePaths: ['src/pages/[lang]/modules.astro']
    },
    {
      pathname: `/${lang}/pricing`,
      sourcePaths: ['src/pages/[lang]/pricing.astro']
    },
    {
      pathname: `/${lang}/supported`,
      sourcePaths: ['src/pages/[lang]/supported.astro']
    },
    {
      pathname: `/${lang}/contact`,
      sourcePaths: ['src/pages/[lang]/contact.astro']
    },
    {
      pathname: `/${lang}/terms-of-service`,
      sourcePaths: ['src/pages/[lang]/terms-of-service.astro']
    },
    {
      pathname: `/${lang}/privacy-policy`,
      sourcePaths: ['src/pages/[lang]/privacy-policy.astro']
    }
  ]
  return pages
}

function buildCourseMarkdownByLang(): Map<string, Map<string, string>> {
  const index = new Map<string, Map<string, string>>()
  const courseMarkdownGlob = import.meta.glob(
    '../courses/learningPaths/*/{en,fr}.md'
  )

  for (const relativePath of Object.keys(courseMarkdownGlob)) {
    const sourcePath = toSourcePath(relativePath)
    const parts = sourcePath.split('/')
    if (parts.length < 5) {
      continue
    }

    const courseId = parts[3]
    const langSegment = parts[4]?.replace('.md', '')
    if (!courseId || !langSegment) {
      continue
    }

    if (!index.has(courseId)) {
      index.set(courseId, new Map<string, string>())
    }

    index.get(courseId)!.set(langSegment, sourcePath)
  }

  return index
}

function buildCourseStructurePathsByCourseId(): Map<string, string> {
  const index = new Map<string, string>()
  const structureGlob = import.meta.glob(
    '../courses/learningPaths/*/course-structure.ts'
  )

  for (const relativePath of Object.keys(structureGlob)) {
    const sourcePath = toSourcePath(relativePath)
    const parts = sourcePath.split('/')
    if (parts.length < 5) {
      continue
    }
    const courseId = parts[3]
    if (!courseId) {
      continue
    }
    index.set(courseId, sourcePath)
  }

  return index
}

function buildLessonSources(): Map<string, LessonSource> {
  const index = new Map<string, LessonSource>()
  const contentGlob = import.meta.glob('../courses/modules/**/content.md')
  const quizGlob = import.meta.glob('../courses/modules/**/quiz.ts')

  for (const relativePath of Object.keys(contentGlob)) {
    const sourcePath = toSourcePath(relativePath)
    const parts = sourcePath.split('/')
    if (parts.length < 7) {
      continue
    }

    const moduleId = parts[3]
    const topicDir = parts[4]
    const lang = parts[5]
    const topicId = stripNumericPrefix(topicDir)
    const key = `${moduleId}:${topicId}`

    if (!index.has(key)) {
      index.set(key, { contentByLang: {}, quizByLang: {} })
    }

    index.get(key)!.contentByLang[lang] = sourcePath
  }

  for (const relativePath of Object.keys(quizGlob)) {
    const sourcePath = toSourcePath(relativePath)
    const parts = sourcePath.split('/')
    if (parts.length < 7) {
      continue
    }

    const moduleId = parts[3]
    const topicDir = parts[4]
    const lang = parts[5]
    const topicId = stripNumericPrefix(topicDir)
    const key = `${moduleId}:${topicId}`

    if (!index.has(key)) {
      index.set(key, { contentByLang: {}, quizByLang: {} })
    }

    index.get(key)!.quizByLang[lang] = sourcePath
  }

  return index
}

function resolveLastmod(sourcePaths: string[]): string | undefined {
  const dates: string[] = []

  for (const sourcePath of sourcePaths) {
    const dateValue = lastmodIndex[sourcePath]
    if (typeof dateValue !== 'string') {
      continue
    }
    if (!DATE_PATTERN.test(dateValue)) {
      continue
    }
    dates.push(dateValue)
  }

  if (dates.length === 0) {
    return undefined
  }

  dates.sort((a, b) => a.localeCompare(b))
  return dates[dates.length - 1]
}

function addUrl(
  urlSources: Map<string, Set<string>>,
  url: string,
  sourcePaths: string[]
): void {
  if (!urlSources.has(url)) {
    urlSources.set(url, new Set<string>())
  }

  const sourceSet = urlSources.get(url)!
  for (const sourcePath of sourcePaths) {
    sourceSet.add(sourcePath)
  }
}

function parseLocalizedPath(
  pathname: string,
  enabledLanguages: string[]
): { lang: string; suffix: string } | null {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  const segments = normalizedPath.split('/').filter((segment) => segment !== '')
  const firstSegment = segments[0]

  if (!firstSegment || !enabledLanguages.includes(firstSegment)) {
    return null
  }

  const suffixSegments = segments.slice(1)
  const suffix = suffixSegments.length > 0 ? `/${suffixSegments.join('/')}` : ''
  return { lang: firstSegment, suffix }
}

function buildAlternateLinks(
  site: string,
  pathname: string,
  enabledLanguages: string[]
): Array<{ hreflang: string; href: string }> {
  if (enabledLanguages.length <= 1) {
    return []
  }

  const localizedPath = parseLocalizedPath(pathname, enabledLanguages)
  if (!localizedPath) {
    return []
  }

  const alternates: Array<{ hreflang: string; href: string }> = []
  for (const lang of enabledLanguages) {
    alternates.push({
      hreflang: lang,
      href: toAbsoluteUrl(site, `/${lang}${localizedPath.suffix}`)
    })
  }

  const defaultLang = CONFIG.i18n.defaultLang
  alternates.push({
    hreflang: 'x-default',
    href: toAbsoluteUrl(site, `/${defaultLang}${localizedPath.suffix}`)
  })

  return alternates
}

function buildSitemapEntries(site: string): SitemapEntry[] {
  const enabledLanguages = [...CONFIG.i18n.enabledLanguages]
  const urlSources = new Map<string, Set<string>>()
  const entries: SitemapEntry[] = []
  const seenCourseLessonKeys = new Set<string>()
  const courseMarkdownByLang = buildCourseMarkdownByLang()
  const courseStructurePathsByCourseId = buildCourseStructurePathsByCourseId()
  const lessonSources = buildLessonSources()

  for (const lang of enabledLanguages) {
    const staticPublicPages = collectStaticPublicPages(lang)
    for (const page of staticPublicPages) {
      addUrl(urlSources, toAbsoluteUrl(site, page.pathname), page.sourcePaths)
    }

    const courses = getCourses(lang)
    for (const course of courses) {
      const coursePageUrl = toAbsoluteUrl(site, `/${lang}/courses/${course.id}`)
      const coursePageSources: string[] = []
      const markdownByLang = courseMarkdownByLang.get(course.id)
      const courseMarkdownPath =
        markdownByLang?.get(lang) ?? markdownByLang?.get('en')
      if (courseMarkdownPath) {
        coursePageSources.push(courseMarkdownPath)
      }
      const structurePath = courseStructurePathsByCourseId.get(course.id)
      if (structurePath) {
        coursePageSources.push(structurePath)
      }
      addUrl(urlSources, coursePageUrl, coursePageSources)

      const overview = getCourseOverview(course.id, lang)
      if (!overview) {
        continue
      }

      for (const section of overview.content.sections) {
        for (const module of section.modules) {
          for (const lesson of module.lessons) {
            if (lesson.isPlaceholder) {
              continue
            }
            const lessonKey = `${lang}:${module.moduleId}:${lesson.id}`
            if (seenCourseLessonKeys.has(lessonKey)) {
              continue
            }
            seenCourseLessonKeys.add(lessonKey)

            const lessonUrl = toAbsoluteUrl(
              site,
              `/${lang}/courses/${course.id}/${lesson.id}`
            )
            const lessonSource = lessonSources.get(
              `${module.moduleId}:${lesson.id}`
            )
            const lessonSourcePaths: string[] = []
            if (lessonSource) {
              const contentPath =
                lessonSource.contentByLang[lang] ??
                lessonSource.contentByLang.en
              if (contentPath) {
                lessonSourcePaths.push(contentPath)
              }
              const quizPath =
                lessonSource.quizByLang[lang] ?? lessonSource.quizByLang.en
              if (quizPath) {
                lessonSourcePaths.push(quizPath)
              }
            }
            addUrl(urlSources, lessonUrl, lessonSourcePaths)
          }
        }
      }
    }
  }

  for (const [loc, sourceSet] of urlSources.entries()) {
    const pathname = new URL(loc).pathname
    entries.push({
      loc,
      changefreq: 'weekly',
      lastmod: resolveLastmod(Array.from(sourceSet)),
      alternates: buildAlternateLinks(site, pathname, enabledLanguages)
    })
  }

  entries.sort((a, b) => a.loc.localeCompare(b.loc))
  return entries
}

function renderSitemapXml(entries: SitemapEntry[]): string {
  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  const includeXhtmlNamespace = entries.some(
    (entry) => entry.alternates && entry.alternates.length > 0
  )
  if (includeXhtmlNamespace) {
    lines.push(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
    )
  } else {
    lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
  }

  for (const entry of entries) {
    lines.push('  <url>')
    lines.push(`    <loc>${escapeXml(entry.loc)}</loc>`)
    if (entry.changefreq) {
      lines.push(`    <changefreq>${entry.changefreq}</changefreq>`)
    }
    if (entry.lastmod) {
      lines.push(`    <lastmod>${entry.lastmod}</lastmod>`)
    }
    if (entry.alternates && entry.alternates.length > 0) {
      for (const alternate of entry.alternates) {
        lines.push(
          `    <xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hreflang)}" href="${escapeXml(alternate.href)}" />`
        )
      }
    }
    lines.push('  </url>')
  }

  lines.push('</urlset>')
  return lines.join('\n')
}

export async function GET(context: APIContext): Promise<Response> {
  const site = context.site?.toString() ?? 'https://kubemastery.com'
  const entries = buildSitemapEntries(site)
  const xml = renderSitemapXml(entries)

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}
