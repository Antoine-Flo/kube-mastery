/**
 * Remark plugin to parse :::(info|warning|important) ... ::: blocks
 * and render them as callout divs with icons.
 */

import type { Root, Paragraph, Text } from 'mdast'
import { visit } from 'unist-util-visit'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import { VFile } from 'vfile'

const CALLOUT_SINGLE_REGEX = /^:::(info|warning|important)\n([\s\S]*?)\n:::\s*$/
const CALLOUT_OPEN_REGEX = /^:::(info|warning|important)(?:\n([\s\S]*))?$/
const CALLOUT_CLOSE_REGEX = /^:::$/

const CALLOUT_ICONS: Record<string, string> = {
  info: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
  warning: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>`,
  important: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
}

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

function markdownStringToHtml(md: string): string {
  const processor = unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify)
  return String(processor.processSync(md))
}

function buildCalloutHtml(calloutType: string, htmlContent: string): string {
  const icon = CALLOUT_ICONS[calloutType] ?? CALLOUT_ICONS.info
  return `<div class="callout callout-${calloutType}">
  <div class="callout-icon">${icon}</div>
  <div class="callout-content">${htmlContent}</div>
</div>`
}

function parseSingleParagraphCallout(
  text: string
): { type: string; content: string } | null {
  const match = text.match(CALLOUT_SINGLE_REGEX)
  if (!match) {
    return null
  }
  return { type: match[1], content: match[2].trim() }
}

function parseCalloutOpen(
  text: string
): { type: string; firstLine: string } | null {
  const match = text.match(CALLOUT_OPEN_REGEX)
  if (!match) {
    return null
  }
  return {
    type: match[1],
    firstLine: match[2]?.trim() ?? ''
  }
}

function paragraphEndsWithClose(closeText: string): boolean {
  return closeText.endsWith(':::') || closeText.includes('\n:::')
}

function stripTrailingCloseFromParagraph(
  paragraph: Paragraph,
  closeText: string
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
  if (!closeText.endsWith(':::')) {
    return paragraph
  }
  const newValue = closeText.slice(0, -3).trim()
  if (!newValue) {
    return null
  }
  return { ...paragraph, children: [{ type: 'text', value: newValue }] }
}

function collectMultiNodeCallout(
  children: Root['children'],
  startIndex: number,
  firstLineContent: string
): { contentNodes: Root['children']; endIndex: number } | null {
  const contentNodes: Root['children'] = []
  if (firstLineContent) {
    contentNodes.push({
      type: 'paragraph',
      children: [{ type: 'text', value: firstLineContent }]
    } as Paragraph)
  }

  for (let j = startIndex; j < children.length; j++) {
    const node = children[j]
    if (node.type !== 'paragraph') {
      contentNodes.push(node)
      continue
    }

    const closeText = getParagraphText(node as Paragraph)

    if (CALLOUT_CLOSE_REGEX.test(closeText)) {
      return { contentNodes, endIndex: j }
    }

    if (!paragraphEndsWithClose(closeText)) {
      contentNodes.push(node)
      continue
    }

    const closingNode = stripTrailingCloseFromParagraph(
      node as Paragraph,
      closeText
    )
    if (closingNode) {
      contentNodes.push(closingNode)
    }
    return { contentNodes, endIndex: j }
  }

  return null
}

export default function remarkCalloutColons() {
  return (tree: Root) => {
    const newChildren: Root['children'] = []

    for (let i = 0; i < tree.children.length; i++) {
      const node = tree.children[i]
      if (node.type !== 'paragraph') {
        newChildren.push(node)
        continue
      }

      const text = getParagraphText(node as Paragraph)

      const single = parseSingleParagraphCallout(text)
      if (single) {
        newChildren.push({
          type: 'html',
          value: buildCalloutHtml(
            single.type,
            markdownStringToHtml(single.content)
          )
        })
        continue
      }

      const open = parseCalloutOpen(text)
      if (!open) {
        newChildren.push(node)
        continue
      }

      const multi = collectMultiNodeCallout(
        tree.children,
        i + 1,
        open.firstLine
      )
      if (!multi) {
        newChildren.push(node)
        continue
      }

      newChildren.push({
        type: 'html',
        value: buildCalloutHtml(open.type, mdastToHtml(multi.contentNodes))
      })
      i = multi.endIndex
    }

    tree.children = newChildren
  }
}
