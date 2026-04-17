const SIDEBAR_COLLAPSED_STORAGE_KEY = 'lesson-sidebar-collapsed'
const SIDEBAR_SCROLL_STORAGE_PREFIX = 'lesson-sidebar-scroll:'

let sidebarBeforeSwapBound = false

function getSidebarElement(): HTMLElement | null {
  const sidebar = document.querySelector('[data-lesson-sidebar="true"]')
  if (!(sidebar instanceof HTMLElement)) {
    return null
  }
  return sidebar
}

function getSidebarScrollViewport(sidebar: HTMLElement): HTMLElement | null {
  const viewport = sidebar.querySelector('.scroll-area__viewport')
  if (!(viewport instanceof HTMLElement)) {
    return null
  }
  return viewport
}

function getSidebarScrollStorageKey(): string {
  const normalizedPath = window.location.pathname.replace(/\/+$/, '')
  const pathSegments = normalizedPath.split('/').filter(Boolean)
  if (pathSegments.length <= 1) {
    return `${SIDEBAR_SCROLL_STORAGE_PREFIX}${normalizedPath || '/'}`
  }
  const lessonScopePath = `/${pathSegments.slice(0, -1).join('/')}`
  return `${SIDEBAR_SCROLL_STORAGE_PREFIX}${lessonScopePath}`
}

function saveSidebarScrollPosition() {
  const sidebar = getSidebarElement()
  if (!sidebar) {
    return
  }
  const viewport = getSidebarScrollViewport(sidebar)
  if (!viewport) {
    return
  }
  const storageKey = getSidebarScrollStorageKey()
  sessionStorage.setItem(storageKey, String(viewport.scrollTop))
}

function restoreSidebarScrollPosition() {
  const sidebar = getSidebarElement()
  if (!sidebar) {
    return
  }
  const viewport = getSidebarScrollViewport(sidebar)
  if (!viewport) {
    return
  }
  const storageKey = getSidebarScrollStorageKey()
  const rawValue = sessionStorage.getItem(storageKey)
  if (!rawValue) {
    return
  }
  const scrollTop = Number.parseFloat(rawValue)
  if (!Number.isFinite(scrollTop) || scrollTop < 0) {
    return
  }
  viewport.scrollTop = scrollTop
  requestAnimationFrame(() => {
    viewport.scrollTop = scrollTop
  })
}

export function setupSidebarToggle() {
  const sidebar = getSidebarElement()
  const toggle = document.getElementById('lesson-sidebar-toggle')
  if (!sidebar || !toggle) {
    return
  }

  const updateUi = () => {
    const collapsed = sidebar.classList.contains(
      'lesson-layout__sidebar--collapsed'
    )
    toggle.setAttribute(
      'aria-label',
      collapsed ? 'Afficher le plan du cours' : 'Réduire le plan du cours'
    )
    toggle.setAttribute('aria-expanded', String(!collapsed))
  }

  const init = () => {
    const collapsed =
      localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
    sidebar.classList.toggle('lesson-layout__sidebar--collapsed', collapsed)
    updateUi()
  }

  init()
  toggle.onclick = () => {
    const collapsed = !sidebar.classList.contains(
      'lesson-layout__sidebar--collapsed'
    )
    sidebar.classList.toggle('lesson-layout__sidebar--collapsed', collapsed)
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed))
    updateUi()
  }
}

export function setupSidebarScrollPersistence() {
  const sidebar = getSidebarElement()
  if (!sidebar) {
    return
  }
  const viewport = getSidebarScrollViewport(sidebar)
  if (!viewport) {
    return
  }
  if (viewport.dataset.sidebarScrollBound !== 'true') {
    viewport.dataset.sidebarScrollBound = 'true'
    viewport.addEventListener(
      'scroll',
      () => {
        saveSidebarScrollPosition()
      },
      { passive: true }
    )
  }
  if (!sidebarBeforeSwapBound) {
    sidebarBeforeSwapBound = true
    document.addEventListener('astro:before-swap', () => {
      saveSidebarScrollPosition()
    })
  }
  restoreSidebarScrollPosition()
}
