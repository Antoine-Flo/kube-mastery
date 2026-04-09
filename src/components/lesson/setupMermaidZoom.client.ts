import { syncMermaidZoomHost } from './mermaidZoom.client'

let mermaidZoomBound = false
let mermaidObserver: MutationObserver | null = null
let mermaidZoomHostCounter = 0
let mermaidObserverRoot: HTMLElement | null = null
let mermaidThemeObserver: MutationObserver | null = null

function ensureMermaidZoomModal() {
  const existing = document.querySelector('.mermaid-zoom-modal') as HTMLElement | null
  if (existing) {
    return existing
  }

  const modal = document.createElement('div')
  modal.className = 'mermaid-zoom-modal'
  modal.setAttribute('aria-hidden', 'true')
  modal.innerHTML = `
    <div class="mermaid-zoom-modal__backdrop" data-mermaid-zoom-close></div>
    <div class="mermaid-zoom-modal__panel" role="dialog" aria-modal="true" aria-label="Diagram zoom">
      <button
        type="button"
        class="mermaid-zoom-modal__close"
        aria-label="Close zoom"
        title="Close zoom"
        data-mermaid-zoom-close
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
      <div class="mermaid-zoom-modal__content"></div>
    </div>
  `
  document.body.appendChild(modal)
  return modal
}

function closeMermaidZoomModal() {
  const modal = document.querySelector('.mermaid-zoom-modal') as HTMLElement | null
  if (!modal) {
    return
  }

  modal.classList.remove('mermaid-zoom-modal--open')
  modal.setAttribute('aria-hidden', 'true')

  const content = modal.querySelector('.mermaid-zoom-modal__content') as HTMLElement | null
  const panel = modal.querySelector('.mermaid-zoom-modal__panel') as HTMLElement | null

  if (content) {
    content.innerHTML = ''
  }
  if (panel) {
    panel.style.removeProperty('width')
  }
  document.body.classList.remove('mermaid-zoom-open')
}

function openMermaidZoomModal(sourceContainer: Element) {
  const sourceSvg = sourceContainer.querySelector('svg')
  if (!(sourceSvg instanceof SVGElement)) {
    return
  }

  const modal = ensureMermaidZoomModal()
  const content = modal.querySelector('.mermaid-zoom-modal__content') as HTMLElement | null
  const panel = modal.querySelector('.mermaid-zoom-modal__panel') as HTMLElement | null
  if (!content) {
    return
  }

  const clonedSvg = sourceSvg.cloneNode(true)
  if (!(clonedSvg instanceof SVGElement)) {
    return
  }

  const sourceRect = sourceSvg.getBoundingClientRect()
  const sourceWidth = Math.max(1, sourceRect.width)
  const sourceHeight = Math.max(1, sourceRect.height)
  const viewportWidth = Math.max(window.innerWidth, 360)
  const viewportHeight = Math.max(window.innerHeight, 320)
  const panelHorizontalChrome = 28
  const panelVerticalChrome = 118
  const availableWidth = Math.max(260, viewportWidth * 0.995 - panelHorizontalChrome)
  const availableHeight = Math.max(220, viewportHeight - panelVerticalChrome)
  const scaleByWidth = availableWidth / sourceWidth
  const scaleByHeight = availableHeight / sourceHeight
  const maxScaleWithoutScroll = Math.min(scaleByWidth, scaleByHeight)
  const preferredScale = 1.95
  const targetScale = Math.min(preferredScale, maxScaleWithoutScroll)
  const safeScale = Math.max(0.35, targetScale)
  const targetWidth = Math.floor(sourceWidth * safeScale)
  const targetHeight = Math.floor(sourceHeight * safeScale)
  clonedSvg.style.maxWidth = 'none'
  clonedSvg.style.width = `${targetWidth}px`
  clonedSvg.style.height = `${targetHeight}px`

  if (panel) {
    const panelWidth = Math.min(
      Math.floor(viewportWidth * 0.995),
      targetWidth + panelHorizontalChrome
    )
    panel.style.width = `${panelWidth}px`
  }

  content.innerHTML = ''
  content.appendChild(clonedSvg)
  content.scrollTop = 0
  content.scrollLeft = 0

  modal.classList.add('mermaid-zoom-modal--open')
  modal.setAttribute('aria-hidden', 'false')
  document.body.classList.add('mermaid-zoom-open')
}

const MERMAID_ZOOM_HOST_SELECTOR =
  '.lesson-content .mermaid-theme-stack .mermaid.mermaid--light, .lesson-content .mermaid-theme-stack .mermaid.mermaid--dark'

function enhanceMermaidBlocks() {
  // Do not use `> .mermaid`: after the first run each diagram lives inside
  // `.mermaid-zoom-anchor`, so a direct-child selector would miss hosts and
  // theme toggles would never refresh zoom button visibility (overlapping UI).
  const mermaidHosts = document.querySelectorAll(MERMAID_ZOOM_HOST_SELECTOR)
  mermaidHosts.forEach((hostNode) => {
    if (!(hostNode instanceof HTMLElement)) {
      return
    }

    const hostId =
      hostNode.getAttribute('data-mermaid-zoom-id') ??
      `mermaid-zoom-host-${String(++mermaidZoomHostCounter)}`
    syncMermaidZoomHost(hostNode, hostId)
  })
}

function setupMermaidObservers() {
  const observeTarget = document.body
  if (!observeTarget) {
    return
  }

  const shouldResetObserver = !mermaidObserver || mermaidObserverRoot !== observeTarget
  if (shouldResetObserver) {
    if (mermaidObserver) {
      mermaidObserver.disconnect()
    }
    mermaidObserver = new MutationObserver(() => {
      enhanceMermaidBlocks()
    })
    mermaidObserver.observe(observeTarget, {
      childList: true,
      subtree: true
    })
    mermaidObserverRoot = observeTarget
  }

  if (!mermaidThemeObserver) {
    mermaidThemeObserver = new MutationObserver(() => {
      enhanceMermaidBlocks()
    })
    mermaidThemeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    })
  }
}

function bindMermaidZoomEvents() {
  if (mermaidZoomBound) {
    return
  }
  mermaidZoomBound = true

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) {
      return
    }

    const closeTrigger = event.target.closest('[data-mermaid-zoom-close]')
    if (closeTrigger) {
      closeMermaidZoomModal()
      return
    }

    const zoomButton = event.target.closest('[data-mermaid-zoom-btn]')
    if (!zoomButton) {
      return
    }

    const sourceId = zoomButton.getAttribute('data-mermaid-zoom-source')
    const sourceSelector = sourceId
      ? `[data-mermaid-zoom-id="${sourceId}"]`
      : '[data-mermaid-zoom-host]'
    const sourceContainer = document.querySelector(sourceSelector)
    if (!sourceContainer) {
      return
    }

    openMermaidZoomModal(sourceContainer)
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMermaidZoomModal()
    }
  })
}

export function setupMermaidZoom() {
  enhanceMermaidBlocks()
  requestAnimationFrame(() => {
    enhanceMermaidBlocks()
  })

  setupMermaidObservers()
  bindMermaidZoomEvents()
}
