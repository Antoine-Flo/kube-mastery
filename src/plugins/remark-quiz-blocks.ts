/**
 * Remark plugin to parse :::quiz ... ::: blocks and render them as
 * interactive quiz cards using native <details>/<summary> (no client JS required).
 *
 * Content before "**Answer:**" is shown as the question area.
 * Content after "**Answer:**" is hidden inside <details> and revealed on click.
 *
 * Supports three quiz types via markdown content only — the plugin does not
 * distinguish between them, the HTML structure is always the same:
 *   Type 1 - MCQ: question + bullet options
 *   Type 2 - Terminal: question + **Try it:** `command`
 *   Type 3 - Reveal: open-ended question, no options
 */

import type { Root, Paragraph, Text } from 'mdast'
import { visit } from 'unist-util-visit'
import { unified } from 'unified'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import { VFile } from 'vfile'

const QUIZ_OPEN_REGEX = /^:::quiz(?:\n([\s\S]*))?$/
const QUIZ_CLOSE_REGEX = /^:::$/

// getParagraphText returns plain text (strong nodes stripped of markers),
// so we match "Answer:" not "**Answer:**"
const ANSWER_PARAGRAPH_REGEX = /^Answer:/

const QUIZ_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`

const CHEVRON_ICON = `<svg class="quiz-chevron" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`

function getParagraphText(node: Paragraph): string {
  const parts: string[] = []
  visit(node, 'text', (n: Text) => {
    parts.push(n.value)
  })
  return parts.join('').trim()
}

function mdastToHtml(children: Root['children']): string {
  const root: Root = { type: 'root', children }
  const processor = unified()
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify)
  const hastTree = processor.runSync(root, new VFile())
  return processor.stringify(hastTree, new VFile()) as string
}

function buildQuizHtml(
  questionNodes: Root['children'],
  answerNodes: Root['children']
): string {
  const questionHtml = mdastToHtml(questionNodes)
  const answerHtml = mdastToHtml(answerNodes)
  return `<div class="quiz-block">
  <div class="quiz-header">
    <span class="quiz-icon">${QUIZ_ICON}</span>
    <span class="quiz-label">Quick check</span>
  </div>
  <div class="quiz-question">${questionHtml}</div>
  <details class="quiz-reveal">
    <summary>${CHEVRON_ICON}<span>Reveal answer</span></summary>
    <div class="quiz-answer">${answerHtml}</div>
  </details>
</div>`
}

function parseQuizOpen(text: string): boolean {
  const match = text.match(QUIZ_OPEN_REGEX)
  if (!match) {
    return false
  }
  return true
}

function stripQuizOpenPrefix(paragraph: Paragraph): Paragraph | null {
  if (paragraph.children.length === 0) {
    return null
  }

  let markerRemoved = false
  const children = paragraph.children.map((child, index) => {
    if (index === 0 && child.type === 'text') {
      const value = (child as Text).value
      const updated = value.replace(/^:::quiz(?:\s*\n)?/, '')
      if (updated !== value) {
        markerRemoved = true
      }
      return { ...child, value: updated }
    }
    return child
  })

  if (!markerRemoved) {
    return null
  }

  const withoutEmpty = children.filter((child) => {
    if (child.type !== 'text') {
      return true
    }
    return (child as Text).value.length > 0
  })

  if (withoutEmpty.length === 0) {
    return null
  }

  const trimmed = withoutEmpty.map((child, index) => {
    if (index === 0 && child.type === 'text') {
      return { ...child, value: (child as Text).value.replace(/^\s*/, '') }
    }
    return child
  })

  const nonEmpty = trimmed.filter((child) => {
    if (child.type !== 'text') {
      return true
    }
    return (child as Text).value.trim() !== ''
  })

  if (nonEmpty.length === 0) {
    return null
  }

  return { ...paragraph, children: nonEmpty }
}

function paragraphEndsWithClose(text: string): boolean {
  return text.endsWith(':::') || text.includes('\n:::')
}

function stripTrailingClose(
  paragraph: Paragraph,
  text: string
): Paragraph | null {
  const lastChild = paragraph.children[paragraph.children.length - 1]
  if (lastChild?.type === 'text' && typeof lastChild.value === 'string') {
    const newValue = lastChild.value.replace(/\n:::\s*$/, '')
    if (newValue === lastChild.value) {
      return paragraph
    }
    if (newValue.length === 0) {
      const children = paragraph.children.slice(0, -1)
      return children.length > 0 ? { ...paragraph, children } : null
    }
    return {
      ...paragraph,
      children: [
        ...paragraph.children.slice(0, -1),
        { ...lastChild, value: newValue }
      ]
    }
  }
  if (!text.endsWith(':::')) {
    return paragraph
  }
  const newValue = text.slice(0, -3).trim()
  if (!newValue) {
    return null
  }
  return { ...paragraph, children: [{ type: 'text', value: newValue }] }
}

function collectQuizNodes(
  children: Root['children'],
  startIndex: number,
  openingContentNode: Paragraph | null
): { allNodes: Root['children']; endIndex: number } | null {
  const allNodes: Root['children'] = []

  if (openingContentNode) {
    allNodes.push(openingContentNode)
  }

  for (let j = startIndex; j < children.length; j++) {
    const node = children[j]
    if (node.type !== 'paragraph') {
      allNodes.push(node)
      continue
    }

    const text = getParagraphText(node as Paragraph)

    if (QUIZ_CLOSE_REGEX.test(text)) {
      return { allNodes, endIndex: j }
    }

    if (!paragraphEndsWithClose(text)) {
      allNodes.push(node)
      continue
    }

    const closingNode = stripTrailingClose(node as Paragraph, text)
    if (closingNode) {
      allNodes.push(closingNode)
    }
    return { allNodes, endIndex: j }
  }

  return null
}

function isAnswerParagraph(node: Paragraph): boolean {
  // The paragraph starts with a **Answer:** strong node
  const firstChild = node.children[0]
  if (firstChild?.type === 'strong') {
    const innerText = (firstChild.children as Text[])
      .map((c) => c.value ?? '')
      .join('')
      .trim()
    return innerText === 'Answer:'
  }
  // Fallback: plain text match (for single-paragraph callouts that lost structure)
  return ANSWER_PARAGRAPH_REGEX.test(getParagraphText(node))
}

function stripAnswerPrefix(paragraph: Paragraph): Paragraph | null {
  // Remove the leading **Answer:** strong node and any trailing whitespace text
  const withoutStrong = paragraph.children.filter((child) => {
    if (child.type === 'strong') {
      const inner = (child.children as Text[])
        .map((c) => c.value ?? '')
        .join('')
        .trim()
      return inner !== 'Answer:'
    }
    return true
  })

  // Trim leading whitespace from the first remaining text node
  const trimmed = withoutStrong.map((child, idx) => {
    if (idx === 0 && child.type === 'text') {
      return { ...child, value: (child as Text).value.replace(/^\s*/, '') }
    }
    return child
  })

  const nonEmpty = trimmed.filter((child) => {
    if (child.type === 'text') {
      return (child as Text).value.trim() !== ''
    }
    return true
  })

  return nonEmpty.length > 0
    ? ({ ...paragraph, children: nonEmpty } as Paragraph)
    : null
}

function splitAtAnswer(nodes: Root['children']): {
  questionNodes: Root['children']
  answerNodes: Root['children']
} {
  const questionNodes: Root['children'] = []
  const answerNodes: Root['children'] = []
  let answerStarted = false

  for (const node of nodes) {
    if (!answerStarted && node.type === 'paragraph') {
      if (isAnswerParagraph(node as Paragraph)) {
        answerStarted = true
        const stripped = stripAnswerPrefix(node as Paragraph)
        if (stripped) {
          answerNodes.push(stripped)
        }
        continue
      }
    }

    if (answerStarted) {
      answerNodes.push(node)
    } else {
      questionNodes.push(node)
    }
  }

  return { questionNodes, answerNodes }
}

export default function remarkQuizBlocks() {
  return (tree: Root) => {
    const newChildren: Root['children'] = []

    for (let i = 0; i < tree.children.length; i++) {
      const node = tree.children[i]
      if (node.type !== 'paragraph') {
        newChildren.push(node)
        continue
      }

      const text = getParagraphText(node as Paragraph)
      const open = parseQuizOpen(text)
      if (!open) {
        newChildren.push(node)
        continue
      }

      const openingContentNode = stripQuizOpenPrefix(node as Paragraph)
      const collected = collectQuizNodes(
        tree.children,
        i + 1,
        openingContentNode
      )
      if (!collected) {
        newChildren.push(node)
        continue
      }

      const { questionNodes, answerNodes } = splitAtAnswer(collected.allNodes)

      newChildren.push({
        type: 'html',
        value: buildQuizHtml(questionNodes, answerNodes)
      })
      i = collected.endIndex
    }

    tree.children = newChildren
  }
}
