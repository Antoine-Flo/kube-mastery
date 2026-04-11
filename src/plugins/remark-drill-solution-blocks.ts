/**
 * Remark plugin to parse :::solution ... ::: blocks and render a collapsible
 * drill solution (details/summary). Visibility for exam mode is handled via CSS
 * on an ancestor [data-drill-mode="exam"].
 */

import type { Root, Paragraph, Text } from 'mdast'
import { visit } from 'unist-util-visit'
import { unified } from 'unified'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import { VFile } from 'vfile'

const SOLUTION_OPEN_REGEX = /^:::solution(?:\n([\s\S]*))?$/
const SOLUTION_CLOSE_REGEX = /^:::$/

const CHEVRON_ICON = `<svg class="drill-solution-chevron" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`

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

function buildSolutionHtml(innerNodes: Root['children']): string {
  const bodyHtml = mdastToHtml(innerNodes)
  return `<div class="drill-solution">
  <details class="drill-solution__details">
    <summary class="drill-solution__summary">${CHEVRON_ICON}<span class="drill-solution__summary-text">Solution</span></summary>
    <div class="drill-solution__body">${bodyHtml}</div>
  </details>
</div>`
}

function parseSolutionOpen(text: string): boolean {
  return SOLUTION_OPEN_REGEX.test(text)
}

function stripSolutionOpenPrefix(paragraph: Paragraph): Paragraph | null {
  const match = getParagraphText(paragraph).match(SOLUTION_OPEN_REGEX)
  if (!match) {
    return null
  }
  const rest = match[1]?.trim() ?? ''
  if (!rest) {
    return null
  }
  return {
    ...paragraph,
    children: [{ type: 'text', value: rest }]
  }
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

function collectSolutionNodes(
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

    if (SOLUTION_CLOSE_REGEX.test(text)) {
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

export default function remarkDrillSolutionBlocks() {
  return (tree: Root) => {
    const newChildren: Root['children'] = []

    for (let i = 0; i < tree.children.length; i++) {
      const node = tree.children[i]
      if (node.type !== 'paragraph') {
        newChildren.push(node)
        continue
      }

      const text = getParagraphText(node as Paragraph)
      if (!parseSolutionOpen(text)) {
        newChildren.push(node)
        continue
      }

      const firstLine = stripSolutionOpenPrefix(node as Paragraph)
      const collected = collectSolutionNodes(
        tree.children,
        i + 1,
        firstLine
      )
      if (!collected) {
        newChildren.push(node)
        continue
      }

      newChildren.push({
        type: 'html',
        value: buildSolutionHtml(collected.allNodes)
      })
      i = collected.endIndex
    }

    tree.children = newChildren
  }
}
