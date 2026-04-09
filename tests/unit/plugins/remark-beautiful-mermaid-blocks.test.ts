import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { VFile } from 'vfile'
import { describe, expect, it } from 'vitest'
import { renderMermaidSVG } from 'beautiful-mermaid'
import remarkCalloutColons from '../../../src/plugins/remark-callout-colons.ts'
import remarkQuizBlocks from '../../../src/plugins/remark-quiz-blocks.ts'
import remarkBeautifulMermaidBlocks, {
  kubemasteryNamespaceSvgIdsForTests,
  kubemasteryNormalizeSvgMarkupForTests
} from '../../../src/plugins/remark-beautiful-mermaid-blocks.js'

const lessonPath = fileURLToPath(
  new URL(
    '../../../src/courses/modules/crash-course-foundations/05-your-first-pod/en/content.md',
    import.meta.url
  )
)

function stripYamlFrontmatter(raw: string): string {
  const normalized = raw.replace(/\r\n/g, '\n').trim()
  if (!normalized.startsWith('---\n')) {
    return normalized
  }
  return normalized.replace(/^---[\s\S]*?\n---\n?/, '').trim()
}

function processLessonMarkdown(markdown: string): string {
  const file = new VFile({ path: 'virtual.md', value: markdown })
  const processor = unified()
    .use(remarkParse)
    .use(remarkCalloutColons)
    .use(remarkQuizBlocks)
    .use(remarkBeautifulMermaidBlocks)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
  return String(processor.processSync(file))
}

/**
 * Every url(#id) reference in an SVG fragment must target an id that exists on that same fragment.
 */
function assertSvgLocalUrlRefsResolve(svgInner: string): void {
  const idSet = new Set(
    [...svgInner.matchAll(/\sid="([^"]+)"/g)].map((match) => {
      return match[1]
    })
  )
  const urlRefs = [
    ...svgInner.matchAll(/url\(#([^)]+)\)/g)
  ].map((match) => {
    return match[1]
  })
  for (const ref of urlRefs) {
    expect(idSet.has(ref), `missing id for url(#${ref})`).toBe(true)
  }
  const hrefRefs = [
    ...svgInner.matchAll(/href="#([^"]+)"/g)
  ].map((match) => {
    return match[1]
  })
  for (const ref of hrefRefs) {
    expect(idSet.has(ref), `missing id for href="#${ref}"`).toBe(true)
  }
}

describe('remarkBeautifulMermaidBlocks', () => {
  it('renders every mermaid block in crash-course first pod lesson with expected labels', () => {
    const markdown = stripYamlFrontmatter(readFileSync(lessonPath, 'utf8'))
    const html = processLessonMarkdown(markdown)
    const stackCount = html.split('mermaid-theme-stack').length - 1
    expect(stackCount).toBe(6)

    expect(html).toContain('Pod manifest (YAML)')
    expect(html).toContain('apiVersion')
    expect(html).toContain('data-label="Pending"')
    expect(html).toContain('data-label="Running"')
    expect(html).toContain('data-label="Stays deleted"')
    expect(html).toContain('data-label="Pods replaced if deleted"')
    expect(html).not.toMatch(/\n@@@\n/)
    const polylineCount = (html.match(/<polyline/g) || []).length
    expect(polylineCount).toBeGreaterThanOrEqual(12)
  })

  it('keeps svg fragment url(#...) refs consistent after namespacing (manifest flowchart)', () => {
    const source = `flowchart TB
    Root["Pod manifest (YAML)"]
    Root --> AV["apiVersion"]
    Root --> K["kind"]
    Root --> MD["metadata<br/>(name, labels, ...)"]
    Root --> SP["spec<br/>(containers, ports, volumes, ...)"]`
    const rawSvg = renderMermaidSVG(source, {
      bg: '#fcfcfd',
      fg: '#1c2024',
      accent: '#00a2c7',
      muted: '#60646c'
    })
    const normalized = kubemasteryNormalizeSvgMarkupForTests(rawSvg)
    const namespaced = kubemasteryNamespaceSvgIdsForTests(
      normalized,
      'mermaid-test-light'
    )
    assertSvgLocalUrlRefsResolve(namespaced)
    expect(namespaced).toContain('mermaid-test-light-')
  })

  it('parses inline @@@ block when label text contains @@@ (not a real closing marker)', () => {
    const md = `Test

@@@
flowchart LR
  A["note: @@@ is rare"]
  A --> B["ok"]
@@@

Done.
`
    const html = processLessonMarkdown(md)
    expect(html).toContain('mermaid-theme-stack')
    expect(html).toContain('note: @@@ is rare')
    expect(html).not.toMatch(/\n@@@\n/)
  })
})
