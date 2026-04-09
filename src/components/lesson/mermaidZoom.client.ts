const MERMAID_ZOOM_BUTTON_SELECTOR = '[data-mermaid-zoom-btn]'
const MERMAID_ZOOM_ANCHOR_ATTRIBUTE = 'data-mermaid-zoom-anchor'
const MERMAID_ZOOM_FOR_ATTRIBUTE = 'data-mermaid-zoom-for'
const MERMAID_ZOOM_SOURCE_ATTRIBUTE = 'data-mermaid-zoom-source'
const MERMAID_ZOOM_ID_ATTRIBUTE = 'data-mermaid-zoom-id'
const MERMAID_ZOOM_HOST_ATTRIBUTE = 'data-mermaid-zoom-host'

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Lucide "zoom-in" icon (same geometry as @lucide/astro ZoomIn).
 * @see https://lucide.dev/icons/zoom-in
 */
function createLucideZoomInSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('xmlns', SVG_NS)
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('class', 'lucide lucide-zoom-in')

  const circle = document.createElementNS(SVG_NS, 'circle')
  circle.setAttribute('cx', '11')
  circle.setAttribute('cy', '11')
  circle.setAttribute('r', '8')

  const handle = document.createElementNS(SVG_NS, 'line')
  handle.setAttribute('x1', '21')
  handle.setAttribute('x2', '16.65')
  handle.setAttribute('y1', '21')
  handle.setAttribute('y2', '16.65')

  const vBar = document.createElementNS(SVG_NS, 'line')
  vBar.setAttribute('x1', '11')
  vBar.setAttribute('x2', '11')
  vBar.setAttribute('y1', '8')
  vBar.setAttribute('y2', '14')

  const hBar = document.createElementNS(SVG_NS, 'line')
  hBar.setAttribute('x1', '8')
  hBar.setAttribute('x2', '14')
  hBar.setAttribute('y1', '11')
  hBar.setAttribute('y2', '11')

  svg.appendChild(circle)
  svg.appendChild(handle)
  svg.appendChild(vBar)
  svg.appendChild(hBar)
  return svg
}

function isMermaidHostActiveForTheme(host: HTMLElement) {
  const isLightVariant = host.classList.contains('mermaid--light')
  const isDarkVariant = host.classList.contains('mermaid--dark')
  if (!isLightVariant && !isDarkVariant) {
    const styles = window.getComputedStyle(host)
    return styles.display !== 'none' && styles.visibility !== 'hidden'
  }

  const activeTheme =
    document.documentElement.getAttribute('data-theme') === 'dark'
      ? 'dark'
      : 'light'
  if (activeTheme === 'dark') {
    return isDarkVariant
  }
  return isLightVariant
}

function getOrCreateMermaidAnchor(hostParent: Element, hostNode: HTMLElement) {
  if (
    hostParent instanceof HTMLElement &&
    hostParent.hasAttribute(MERMAID_ZOOM_ANCHOR_ATTRIBUTE)
  ) {
    return hostParent
  }

  const anchor = document.createElement('div')
  anchor.className = 'mermaid-zoom-anchor'
  anchor.setAttribute(MERMAID_ZOOM_ANCHOR_ATTRIBUTE, 'true')
  hostParent.insertBefore(anchor, hostNode)
  anchor.appendChild(hostNode)
  return anchor
}

function getOrCreateMermaidZoomButton(anchor: HTMLElement) {
  const existingButton = anchor.querySelector(
    MERMAID_ZOOM_BUTTON_SELECTOR
  ) as HTMLElement | null
  if (existingButton) {
    return existingButton
  }

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'mermaid-zoom-btn'
  const zoomLabel = 'Zoom diagram'
  button.setAttribute('aria-label', zoomLabel)
  button.setAttribute('title', zoomLabel)
  button.setAttribute('data-mermaid-zoom-btn', 'true')

  button.appendChild(createLucideZoomInSvg())
  anchor.appendChild(button)
  return button
}

export function syncMermaidZoomHost(hostNode: HTMLElement, hostId: string) {
  const hostParent = hostNode.parentElement
  if (!hostParent) {
    return
  }

  hostNode.setAttribute(MERMAID_ZOOM_ID_ATTRIBUTE, hostId)
  hostNode.setAttribute(MERMAID_ZOOM_HOST_ATTRIBUTE, 'true')

  const anchor = getOrCreateMermaidAnchor(hostParent, hostNode)
  anchor.setAttribute(MERMAID_ZOOM_FOR_ATTRIBUTE, hostId)

  const zoomButton = getOrCreateMermaidZoomButton(anchor)
  zoomButton.setAttribute(MERMAID_ZOOM_SOURCE_ATTRIBUTE, hostId)

  const hostVisible = isMermaidHostActiveForTheme(hostNode)
  if (!hostVisible) {
    zoomButton.style.display = 'none'
    return
  }

  zoomButton.style.removeProperty('display')
}
