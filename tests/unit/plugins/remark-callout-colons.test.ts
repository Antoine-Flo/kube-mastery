import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkSmartypants from 'remark-smartypants'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { VFile } from 'vfile'
import { describe, expect, it } from 'vitest'
import remarkCalloutColons from '../../../src/plugins/remark-callout-colons.ts'

function processMarkdown(markdown: string): string {
  const file = new VFile({ path: 'virtual.md', value: markdown })
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkSmartypants)
    .use(remarkCalloutColons)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
  return String(processor.processSync(file))
}

describe('remarkCalloutColons', () => {
  it('parses :::warning when the body starts on the same line as the marker', () => {
    const md = `:::warning Watch out: \`kubectl edit\` changes live state.
:::

Next.`
    const html = processMarkdown(md)
    expect(html).toContain('callout-warning')
    expect(html).toContain('kubectl edit')
    expect(html).toContain('Next.')
    expect(html).not.toContain(':::')
  })
})
