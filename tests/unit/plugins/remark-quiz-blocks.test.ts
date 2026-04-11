import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkSmartypants from 'remark-smartypants'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { VFile } from 'vfile'
import { describe, expect, it } from 'vitest'
import remarkQuizBlocks from '../../../src/plugins/remark-quiz-blocks.ts'

function processMarkdown(markdown: string): string {
  const file = new VFile({ path: 'virtual.md', value: markdown })
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkSmartypants)
    .use(remarkQuizBlocks)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
  return String(processor.processSync(file))
}

describe('remarkQuizBlocks', () => {
  it('closes quiz when ::: is attached to the last list item paragraph', () => {
    const md = `Intro paragraph.

:::quiz
Pick one:
- a
- b
**Answer:** b is correct.
:::

Next section.`
    const html = processMarkdown(md)
    expect(html.split('quiz-block').length - 1).toBe(1)
    expect(html).toContain('Next section.')
    expect(html).toContain('b is correct.')
  })

  it('closes quiz when question, answer, and ::: are in one paragraph', () => {
    const md = `:::quiz
One line question?
**Answer:** Yes.
:::`
    const html = processMarkdown(md)
    expect(html.split('quiz-block').length - 1).toBe(1)
    expect(html).toContain('Yes.')
  })

  it('recognizes :::quiz when the question starts on the same line as the marker', () => {
    const md = `:::quiz Same-line question text here?
**Answer:** Because.
:::`
    const html = processMarkdown(md)
    expect(html.split('quiz-block').length - 1).toBe(1)
    expect(html).toContain('Same-line question')
    expect(html).toContain('Because')
  })

  it('splits MCQ answer from the last bullet paragraph into the reveal block', () => {
    const md = `:::quiz
Question text
- opt1
- opt2
- opt3 and more
**Answer:** The explanation here.
:::`
    const html = processMarkdown(md)
    const answerMatch = html.match(/<div class="quiz-answer">([\s\S]*?)<\/div>/)
    expect(answerMatch).toBeTruthy()
    expect(answerMatch![1]).toContain('The explanation here')
    expect(html).not.toContain(':::')
  })
})
