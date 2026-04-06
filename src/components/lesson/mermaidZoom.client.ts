const MERMAID_ZOOM_BUTTON_SELECTOR = '[data-mermaid-zoom-btn]'
const MERMAID_ZOOM_ANCHOR_ATTRIBUTE = 'data-mermaid-zoom-anchor'
const MERMAID_ZOOM_FOR_ATTRIBUTE = 'data-mermaid-zoom-for'
const MERMAID_ZOOM_SOURCE_ATTRIBUTE = 'data-mermaid-zoom-source'
const MERMAID_ZOOM_ID_ATTRIBUTE = 'data-mermaid-zoom-id'
const MERMAID_ZOOM_HOST_ATTRIBUTE = 'data-mermaid-zoom-host'

const MERMAID_ZOOM_ICON_PATH =
  'M10 4a6 6 0 1 0 3.87 10.59l4.77 4.77 1.41-1.41-4.77-4.77A6 6 0 0 0 10 4Zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-1 1v2H7v2h2v2h2v-2h2V9h-2V7H9Z'

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
  button.setAttribute('aria-label', 'Zoom diagram')
  button.setAttribute('data-mermaid-zoom-btn', 'true')

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  icon.setAttribute('viewBox', '0 0 24 24')
  icon.setAttribute('aria-hidden', 'true')

  const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  iconPath.setAttribute('d', MERMAID_ZOOM_ICON_PATH)
  icon.appendChild(iconPath)
  button.appendChild(icon)
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
