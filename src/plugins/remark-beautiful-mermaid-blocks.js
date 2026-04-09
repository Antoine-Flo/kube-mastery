import { renderMermaidSVG } from 'beautiful-mermaid'

// @@@ blocks: build-time SVG via beautiful-mermaid (light + dark, namespaced ids).
// Invalid diagrams throw: Astro build / tests fail instead of publishing broken HTML.

const MERMAID_BLOCK_MARKER = '@@@'

const SITE_LIGHT_MERMAID_THEME = {
  bg: '#fcfcfd',
  fg: '#1c2024',
  accent: '#00a2c7',
  muted: '#60646c'
}
const SITE_DARK_MERMAID_THEME = {
  bg: '#111113',
  fg: '#edeef0',
  accent: '#00a2c7',
  muted: '#b0b4ba'
}

let mermaidRenderCounter = 0

function throwMermaidPluginError(source, cause) {
  const firstLine = source.trim().split(/\n/)[0] ?? ''
  const causeMessage =
    cause instanceof Error ? cause.message : String(cause)
  const err = new Error(
    `[remark-beautiful-mermaid-blocks] Mermaid render failed: ${causeMessage}. First line: ${firstLine}`
  )
  err.cause = cause
  throw err
}

function assertMermaidSvgMarkup(svgMarkup, variantLabel) {
  if (typeof svgMarkup !== 'string' || !/<svg\b/i.test(svgMarkup)) {
    throw new Error(
      `[remark-beautiful-mermaid-blocks] beautiful-mermaid returned no SVG for ${variantLabel}`
    )
  }
}

function mdastNodeToText(node) {
  if (!node || typeof node !== 'object') {
    return ''
  }

  if (typeof node.value === 'string') {
    return node.value
  }

  if (!Array.isArray(node.children)) {
    return ''
  }

  let value = ''
  for (const childNode of node.children) {
    if (childNode.type === 'break') {
      value += '\n'
      continue
    }
    value += mdastNodeToText(childNode)
  }
  return value
}

function extractMermaidSource(paragraphValue) {
  const trimmed = paragraphValue.trim()
  if (!trimmed.startsWith(MERMAID_BLOCK_MARKER)) {
    return null
  }
  const closeIndex = trimmed.lastIndexOf(MERMAID_BLOCK_MARKER)
  if (closeIndex < MERMAID_BLOCK_MARKER.length) {
    return null
  }
  const inner = trimmed.slice(
    MERMAID_BLOCK_MARKER.length,
    closeIndex
  )
  const source = inner.trim()
  if (source.length === 0) {
    return null
  }
  return source
}

function normalizeMermaidSource(source) {
  return source
    .replace(/\u2192/g, '-->')
    .replace(/\u27f6/g, '-->')
    .replace(/\u2794/g, '-->')
    .replace(/\u21d2/g, '==>')
    .replace(/\u2013>/g, '-->')
    .replace(/\u2014>/g, '-->')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()
}

export function kubemasteryNormalizeSvgMarkupForTests(svgMarkup) {
  return svgMarkup.replace(/<svg\b([^>]*)>/i, (_match, rawAttributes) => {
    const withoutSizeAttributes = rawAttributes
      .replace(/\swidth="[^"]*"/gi, '')
      .replace(/\sheight="[^"]*"/gi, '')
    const styleMatch = withoutSizeAttributes.match(/\sstyle="([^"]*)"/i)
    let cleanedAttributes = withoutSizeAttributes
    let mergedStyle =
      'width:100%;max-width:100%;height:auto;display:block;margin:0 auto;'

    if (styleMatch) {
      const existingStyle = styleMatch[1].trim()
      mergedStyle = `${existingStyle};${mergedStyle}`
      cleanedAttributes = withoutSizeAttributes.replace(/\sstyle="[^"]*"/i, '')
    }

    return `<svg${cleanedAttributes} style="${mergedStyle}">`
  })
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function kubemasteryNamespaceSvgIdsForTests(svgMarkup, namespace) {
  const rawIds = [...svgMarkup.matchAll(/\sid="([^"]+)"/g)].map((match) => {
    return match[1]
  })
  const ids = [...new Set(rawIds)].sort((a, b) => {
    return b.length - a.length
  })
  if (ids.length === 0) {
    return svgMarkup
  }

  let namespacedSvg = svgMarkup
  for (const idValue of ids) {
    const nextId = `${namespace}-${idValue}`
    const escapedId = escapeRegExp(idValue)
    namespacedSvg = namespacedSvg
      .replace(new RegExp(`(\\sid=")${escapedId}(")`, 'g'), `$1${nextId}$2`)
      .replace(new RegExp(`url\\(#${escapedId}\\)`, 'g'), `url(#${nextId})`)
      .replace(new RegExp(`="#${escapedId}"`, 'g'), `="#${nextId}"`)
  }

  return namespacedSvg
}

function renderThemedSvg(source, theme, namespace, variantLabel) {
  let rawSvg
  try {
    rawSvg = renderMermaidSVG(source, theme)
  } catch (cause) {
    throwMermaidPluginError(source, cause)
  }
  assertMermaidSvgMarkup(rawSvg, variantLabel)
  const normalized = kubemasteryNormalizeSvgMarkupForTests(rawSvg)
  return kubemasteryNamespaceSvgIdsForTests(normalized, namespace)
}

function renderMermaidCustomThemeMarkup(source) {
  const renderId = String(++mermaidRenderCounter)
  const lightSvg = renderThemedSvg(
    source,
    SITE_LIGHT_MERMAID_THEME,
    `mermaid-${renderId}-light`,
    'light theme'
  )
  const darkSvg = renderThemedSvg(
    source,
    SITE_DARK_MERMAID_THEME,
    `mermaid-${renderId}-dark`,
    'dark theme'
  )
  return `<div class="mermaid-theme-stack" data-mermaid-rendered="true"><div class="mermaid mermaid--light" data-mermaid-rendered="true">${lightSvg}</div><div class="mermaid mermaid--dark" data-mermaid-rendered="true">${darkSvg}</div></div>`
}

function renderMermaidNode(source) {
  return {
    type: 'html',
    value: renderMermaidCustomThemeMarkup(source)
  }
}

function replaceWithRenderedMermaidNode(
  parentNode,
  startIndex,
  endIndex,
  source
) {
  const renderedNode = renderMermaidNode(source)
  parentNode.children.splice(startIndex, endIndex - startIndex + 1, renderedNode)
}

function collectBlockSource(parentNode, startIndex) {
  const startNode = parentNode.children[startIndex]
  if (!startNode || startNode.type !== 'paragraph') {
    return null
  }

  const startText = mdastNodeToText(startNode)
  const startMarkerIndex = startText.indexOf(MERMAID_BLOCK_MARKER)
  if (startMarkerIndex === -1) {
    return null
  }

  let source = startText.slice(startMarkerIndex + MERMAID_BLOCK_MARKER.length)
  let endIndex = startIndex
  let foundEnd = false

  for (let index = startIndex + 1; index < parentNode.children.length; index += 1) {
    const node = parentNode.children[index]
    endIndex = index

    if (node.type === 'paragraph') {
      const text = mdastNodeToText(node)
      const markerIndex = text.indexOf(MERMAID_BLOCK_MARKER)
      if (markerIndex !== -1) {
        source += `\n${text.slice(0, markerIndex)}`
        foundEnd = true
        break
      }
      source += `\n${text}`
      continue
    }

    if (node.type === 'code') {
      source += `\n${node.value ?? ''}`
      continue
    }

    const nodeText = mdastNodeToText(node).trim()
    if (nodeText.length > 0) {
      source += `\n${nodeText}`
      continue
    }

    source += '\n'
  }

  if (!foundEnd) {
    return null
  }

  const normalized = normalizeMermaidSource(source)
  if (normalized.length === 0) {
    return null
  }

  return {
    source: normalized,
    endIndex
  }
}

function transformChildren(parentNode) {
  if (!parentNode || !Array.isArray(parentNode.children)) {
    return
  }

  for (const childNode of parentNode.children) {
    transformChildren(childNode)
  }

  for (let index = 0; index < parentNode.children.length; index += 1) {
    const node = parentNode.children[index]
    if (node.type !== 'paragraph') {
      continue
    }

    const paragraphValue = mdastNodeToText(node)
    if (!paragraphValue.includes(MERMAID_BLOCK_MARKER)) {
      continue
    }

    const inlineSource = extractMermaidSource(paragraphValue)
    if (inlineSource) {
      const normalizedInlineSource = normalizeMermaidSource(inlineSource)
      replaceWithRenderedMermaidNode(
        parentNode,
        index,
        index,
        normalizedInlineSource
      )
      continue
    }

    const blockSource = collectBlockSource(parentNode, index)
    if (!blockSource) {
      continue
    }

    replaceWithRenderedMermaidNode(
      parentNode,
      index,
      blockSource.endIndex,
      blockSource.source
    )
  }
}

export default function remarkBeautifulMermaidBlocks() {
  return (tree) => {
    transformChildren(tree)
  }
}
