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

import type { Root, Paragraph, Text, List, ListItem } from 'mdast'
import { visit } from 'unist-util-visit'
import { unified } from 'unified'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import { VFile } from 'vfile'

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
    <span class="quiz-label">Quiz</span>
  </div>
  <div class="quiz-question">${questionHtml}</div>
  <details class="quiz-reveal">
    <summary>${CHEVRON_ICON}<span>Reveal answer</span></summary>
    <div class="quiz-answer">${answerHtml}</div>
  </details>
</div>`
}

function parseQuizOpen(text: string): boolean {
  const t = text.trimStart()
  return /^:::quiz(?=$|[ \t\n\r])/.test(t)
}

function stripQuizOpenPrefix(paragraph: Paragraph): Paragraph | null {
  if (paragraph.children.length === 0) {
    return null
  }

  let markerRemoved = false
  const children = paragraph.children.map((child, index) => {
    if (index === 0 && child.type === 'text') {
      const value = (child as Text).value
      let updated = value.replace(/^:::quiz(?:[ \t]+|\n+)/, '')
      if (updated === value) {
        updated = value.replace(/^:::quiz$/, '')
      }
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

function findLastParagraphInListItem(item: ListItem): Paragraph | null {
  for (let i = item.children.length - 1; i >= 0; i--) {
    const child = item.children[i]
    if (child.type === 'paragraph') {
      return child as Paragraph
    }
  }
  return null
}

/**
 * When a quiz uses a bullet list, CommonMark often attaches the closing ::: line
 * to the last list item instead of a top-level paragraph. Detect that and strip it.
 */
function stripQuizCloseFromList(list: List): List | null {
  if (list.children.length === 0) {
    return null
  }

  const lastItem = list.children[list.children.length - 1]
  if (lastItem.type !== 'listItem') {
    return null
  }

  const lastParagraph = findLastParagraphInListItem(lastItem)
  if (!lastParagraph) {
    return null
  }

  const text = getParagraphText(lastParagraph)
  const itemChildren = lastItem.children
  const lastIndex = itemChildren.length - 1
  const lastBlock = itemChildren[lastIndex]
  if (lastBlock !== lastParagraph) {
    return null
  }

  if (QUIZ_CLOSE_REGEX.test(text)) {
    const newItemChildren = itemChildren.slice(0, -1)
    if (newItemChildren.length === 0) {
      return null
    }
    return {
      ...list,
      children: [
        ...list.children.slice(0, -1),
        { ...lastItem, children: newItemChildren }
      ]
    }
  }

  if (!paragraphEndsWithClose(text)) {
    return null
  }

  const closingNode = stripTrailingClose(lastParagraph, text)
  if (!closingNode) {
    const newItemChildren = itemChildren.slice(0, -1)
    if (newItemChildren.length === 0) {
      return null
    }
    return {
      ...list,
      children: [
        ...list.children.slice(0, -1),
        { ...lastItem, children: newItemChildren }
      ]
    }
  }

  return {
    ...list,
    children: [
      ...list.children.slice(0, -1),
      {
        ...lastItem,
        children: [...itemChildren.slice(0, -1), closingNode]
      }
    ]
  }
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
  openingContentNode: Paragraph | null,
  openParagraphIndex: number
): { allNodes: Root['children']; endIndex: number } | null {
  const allNodes: Root['children'] = []

  if (openingContentNode) {
    const openingText = getParagraphText(openingContentNode)
    if (paragraphEndsWithClose(openingText)) {
      const closingNode = stripTrailingClose(openingContentNode, openingText)
      if (closingNode) {
        return { allNodes: [closingNode], endIndex: openParagraphIndex }
      }
      return { allNodes: [], endIndex: openParagraphIndex }
    }
    allNodes.push(openingContentNode)
  }

  for (let j = startIndex; j < children.length; j++) {
    const node = children[j]
    if (node.type === 'list') {
      const withoutClose = stripQuizCloseFromList(node as List)
      if (withoutClose) {
        allNodes.push(withoutClose)
        return { allNodes, endIndex: j }
      }
      allNodes.push(node)
      continue
    }
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

function strongIsAnswerMarker(node: Paragraph['children'][number]): boolean {
  if (node.type !== 'strong') {
    return false
  }
  const innerText = (node.children as Text[])
    .map((c) => c.value ?? '')
    .join('')
    .trim()
  return innerText === 'Answer:'
}

function findAnswerStrongChildIndex(paragraph: Paragraph): number {
  for (let i = 0; i < paragraph.children.length; i++) {
    if (strongIsAnswerMarker(paragraph.children[i])) {
      return i
    }
  }
  return -1
}

function splitParagraphAtInlineAnswer(
  paragraph: Paragraph
): { question: Paragraph; answer: Paragraph } | null {
  const idx = findAnswerStrongChildIndex(paragraph)
  if (idx <= 0) {
    return null
  }
  return {
    question: { ...paragraph, children: paragraph.children.slice(0, idx) },
    answer: { ...paragraph, children: paragraph.children.slice(idx) }
  }
}

function isAnswerParagraph(node: Paragraph): boolean {
  const firstChild = node.children[0]
  if (firstChild && strongIsAnswerMarker(firstChild)) {
    return true
  }
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

function transformListWithEmbeddedAnswer(
  list: List
): { list: List; answerParagraph: Paragraph } | null {
  if (list.children.length === 0) {
    return null
  }

  const lastItem = list.children[list.children.length - 1]
  if (lastItem.type !== 'listItem') {
    return null
  }

  const lastParagraph = findLastParagraphInListItem(lastItem)
  if (!lastParagraph) {
    return null
  }

  const itemChildren = lastItem.children
  const lastBlockIndex = itemChildren.length - 1
  if (itemChildren[lastBlockIndex] !== lastParagraph) {
    return null
  }

  let answerParagraph: Paragraph
  let replacementParagraph: Paragraph | null

  if (isAnswerParagraph(lastParagraph)) {
    answerParagraph = lastParagraph
    replacementParagraph = null
  } else {
    const inlineSplit = splitParagraphAtInlineAnswer(lastParagraph)
    if (!inlineSplit) {
      return null
    }
    answerParagraph = inlineSplit.answer
    replacementParagraph = inlineSplit.question
  }

  const newLastItemChildren =
    replacementParagraph === null
      ? itemChildren.slice(0, -1)
      : [...itemChildren.slice(0, -1), replacementParagraph]

  if (newLastItemChildren.length === 0) {
    return null
  }

  const newLastItem: ListItem = {
    ...lastItem,
    children: newLastItemChildren
  }

  const newList: List = {
    ...list,
    children: [...list.children.slice(0, -1), newLastItem]
  }

  return { list: newList, answerParagraph }
}

function splitAtAnswer(nodes: Root['children']): {
  questionNodes: Root['children']
  answerNodes: Root['children']
} {
  const questionNodes: Root['children'] = []
  const answerNodes: Root['children'] = []
  let answerStarted = false

  for (const node of nodes) {
    if (!answerStarted && node.type === 'list') {
      const transformed = transformListWithEmbeddedAnswer(node as List)
      if (transformed) {
        answerStarted = true
        questionNodes.push(transformed.list)
        const stripped = stripAnswerPrefix(transformed.answerParagraph)
        if (stripped) {
          answerNodes.push(stripped)
        }
        continue
      }
    }

    if (!answerStarted && node.type === 'paragraph') {
      const asParagraph = node as Paragraph
      if (isAnswerParagraph(asParagraph)) {
        answerStarted = true
        const stripped = stripAnswerPrefix(asParagraph)
        if (stripped) {
          answerNodes.push(stripped)
        }
        continue
      }
      const inlineSplit = splitParagraphAtInlineAnswer(asParagraph)
      if (inlineSplit) {
        answerStarted = true
        questionNodes.push(inlineSplit.question)
        const stripped = stripAnswerPrefix(inlineSplit.answer)
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
        openingContentNode,
        i
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
