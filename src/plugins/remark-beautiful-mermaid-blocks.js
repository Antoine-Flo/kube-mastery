import { renderMermaidSVG } from 'beautiful-mermaid'

const MERMAID_BLOCK_MARKER = '@@@'
const INLINE_MERMAID_PATTERN = /^@@@\s*([\s\S]*?)\s*@@@$/
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
  const match = trimmed.match(INLINE_MERMAID_PATTERN)
  if (!match) {
    return null
  }
  const source = (match[1] ?? '').trim()
  if (source.length === 0) {
    return null
  }
  return source
}

function normalizeMermaidSource(source) {
  return source
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()
}

function normalizeSvgMarkup(svgMarkup) {
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

function namespaceSvgIds(svgMarkup, namespace) {
  const rawIds = [...svgMarkup.matchAll(/\sid="([^"]+)"/g)].map((match) => {
    return match[1]
  })
  const ids = [...new Set(rawIds)]
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

function renderThemedSvg(source, theme, namespace) {
  const svgMarkup = normalizeSvgMarkup(renderMermaidSVG(source, theme))
  return namespaceSvgIds(svgMarkup, namespace)
}

function renderMermaidCustomThemeMarkup(source) {
  const renderId = String(++mermaidRenderCounter)
  const lightSvg = renderThemedSvg(
    source,
    SITE_LIGHT_MERMAID_THEME,
    `mermaid-${renderId}-light`
  )
  const darkSvg = renderThemedSvg(
    source,
    SITE_DARK_MERMAID_THEME,
    `mermaid-${renderId}-dark`
  )
  return `<div class="mermaid-theme-stack" data-mermaid-rendered="true"><pre class="mermaid mermaid--light" data-mermaid-rendered="true">${lightSvg}</pre><pre class="mermaid mermaid--dark" data-mermaid-rendered="true">${darkSvg}</pre></div>`
}

function renderMermaidNode(source) {
  try {
    return {
      type: 'html',
      value: renderMermaidCustomThemeMarkup(source)
    }
  } catch {
    return null
  }
}

function replaceWithRenderedMermaidNode(parentNode, startIndex, endIndex, source) {
  const renderedNode = renderMermaidNode(source)
  if (!renderedNode) {
    return false
  }

  parentNode.children.splice(startIndex, endIndex - startIndex + 1, renderedNode)
  return true
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
      const replacedInlineNode = replaceWithRenderedMermaidNode(
        parentNode,
        index,
        index,
        normalizedInlineSource
      )
      if (!replacedInlineNode) {
        continue
      }
      continue
    }

    const blockSource = collectBlockSource(parentNode, index)
    if (!blockSource) {
      continue
    }

    const replacedBlockNode = replaceWithRenderedMermaidNode(
      parentNode,
      index,
      blockSource.endIndex,
      blockSource.source
    )
    if (!replacedBlockNode) {
      continue
    }
  }
}

export default function remarkBeautifulMermaidBlocks() {
  return (tree) => {
    transformChildren(tree)
  }
}
