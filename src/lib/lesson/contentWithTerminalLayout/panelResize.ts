const PANEL_RESIZE_STORAGE_KEY = 'lesson-terminal-width'
const DESKTOP_BREAKPOINT = '(min-width: 1025px)'
const MIN_TERMINAL_WIDTH = 320
const MIN_CONTENT_WIDTH = 420

let panelResizeBound = false

let panelResizeState: {
  body: HTMLElement
  content: HTMLElement
  terminalWrap: HTMLElement
  resizer: HTMLElement
} | null = null

function getPanelElements() {
  const body = document.querySelector('.lesson-layout__body')
  const content = document.querySelector('.lesson-layout__content')
  const terminalWrap = document.querySelector(
    '[data-lesson-term-wrap]'
  ) as HTMLElement | null
  const resizer = document.querySelector(
    '[data-lesson-resizer]'
  ) as HTMLElement | null

  if (
    !(body instanceof HTMLElement) ||
    !(content instanceof HTMLElement) ||
    !(terminalWrap instanceof HTMLElement) ||
    !(resizer instanceof HTMLElement)
  ) {
    return null
  }

  return {
    body,
    content,
    terminalWrap,
    resizer
  }
}

function clampTerminalWidth(layoutWidth: number, desiredWidth: number) {
  const maxTerminalWidth = Math.max(
    MIN_TERMINAL_WIDTH,
    layoutWidth - MIN_CONTENT_WIDTH
  )
  return Math.min(
    Math.max(desiredWidth, MIN_TERMINAL_WIDTH),
    maxTerminalWidth
  )
}

function applyTerminalWidth(desiredWidth: number) {
  const desktopQuery = window.matchMedia(DESKTOP_BREAKPOINT)
  const panelElements = getPanelElements()
  if (!panelElements) {
    return
  }

  const { body, content, terminalWrap } = panelElements

  if (!desktopQuery.matches) {
    terminalWrap.style.removeProperty('flex')
    content.style.removeProperty('flex')
    return
  }

  const clampedWidth = clampTerminalWidth(body.clientWidth, desiredWidth)
  terminalWrap.style.flex = `0 0 ${clampedWidth}px`
  content.style.flex = '1 1 auto'
}

export function setupPanelResize() {
  const desktopQuery = window.matchMedia(DESKTOP_BREAKPOINT)
  const panelElements = getPanelElements()
  if (!panelElements) {
    return
  }

  const { body } = panelElements

  const storedWidth = Number(localStorage.getItem(PANEL_RESIZE_STORAGE_KEY))
  if (Number.isFinite(storedWidth) && storedWidth > 0) {
    applyTerminalWidth(storedWidth)
  } else {
    applyTerminalWidth(Math.round(body.clientWidth * 0.5))
  }

  if (panelResizeBound) {
    return
  }
  panelResizeBound = true

  const stopResize = () => {
    if (!panelResizeState) {
      return
    }
    panelResizeState.resizer.classList.remove(
      'lesson-layout__resizer--dragging'
    )
    document.body.classList.remove('lesson-layout--resizing')
    panelResizeState = null
  }

  document.addEventListener('pointerdown', (event) => {
    if (!(event.target instanceof Element)) {
      return
    }
    const resizer = event.target.closest('[data-lesson-resizer]')
    if (!(resizer instanceof HTMLElement)) {
      return
    }
    if (!desktopQuery.matches) {
      return
    }

    const currentPanelElements = getPanelElements()
    if (!currentPanelElements) {
      return
    }

    event.preventDefault()
    panelResizeState = {
      body: currentPanelElements.body,
      content: currentPanelElements.content,
      terminalWrap: currentPanelElements.terminalWrap,
      resizer
    }
    panelResizeState.resizer.classList.add('lesson-layout__resizer--dragging')
    document.body.classList.add('lesson-layout--resizing')
  })

  document.addEventListener('pointermove', (event) => {
    if (!panelResizeState) {
      return
    }

    const { body, terminalWrap, content } = panelResizeState
    const bodyRect = body.getBoundingClientRect()
    const rawTerminalWidth = bodyRect.right - event.clientX
    const nextTerminalWidth = clampTerminalWidth(
      bodyRect.width,
      rawTerminalWidth
    )

    terminalWrap.style.flex = `0 0 ${nextTerminalWidth}px`
    content.style.flex = '1 1 auto'
    localStorage.setItem(
      PANEL_RESIZE_STORAGE_KEY,
      String(Math.round(nextTerminalWidth))
    )
  })

  document.addEventListener('pointerup', () => {
    stopResize()
  })

  document.addEventListener('pointercancel', () => {
    stopResize()
  })

  window.addEventListener('resize', () => {
    const currentPanelElements = getPanelElements()
    if (!currentPanelElements) {
      return
    }
    const currentWidth = Number.parseFloat(
      currentPanelElements.terminalWrap.style.flexBasis
    )
    if (Number.isFinite(currentWidth) && currentWidth > 0) {
      applyTerminalWidth(currentWidth)
    }
  })
}
