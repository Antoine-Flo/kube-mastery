let terminalToggleBound = false
let outlineToggleBound = false
let terminalTabsBound = false

function setActiveTerminalTab(tabName: 'shell' | 'docs') {
  const triggers = document.querySelectorAll<HTMLElement>(
    '[data-terminal-tab-trigger]'
  )
  const panels = document.querySelectorAll<HTMLElement>('[data-terminal-tab-panel]')
  const root = document.querySelector('.lesson-layout-root')

  triggers.forEach((trigger) => {
    const isActive = trigger.dataset.terminalTabTrigger === tabName
    trigger.setAttribute('aria-selected', isActive ? 'true' : 'false')
    trigger.classList.toggle('lesson-layout__terminal-tab--active', isActive)
  })

  panels.forEach((panel) => {
    const isActive = panel.dataset.terminalTabPanel === tabName
    panel.hidden = !isActive
  })

  if (root instanceof HTMLElement && tabName === 'docs') {
    root.setAttribute('data-terminal-open', 'true')
    document.dispatchEvent(new CustomEvent('lesson-terminal-state-changed'))
  }
}

function setupTerminalTabs() {
  const hasTabs = document.querySelector('[data-terminal-tab-trigger="docs"]')
  if (!hasTabs) {
    return
  }

  if (terminalTabsBound) {
    return
  }
  terminalTabsBound = true
  setActiveTerminalTab('shell')

  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }
    const trigger = target.closest<HTMLElement>('[data-terminal-tab-trigger]')
    if (!trigger) {
      return
    }
    const tabName = trigger.dataset.terminalTabTrigger
    if (tabName !== 'shell' && tabName !== 'docs') {
      return
    }
    event.preventDefault()
    setActiveTerminalTab(tabName)
  })
}

function updateMobileOutlineUi(isOpen: boolean) {
  const root = document.querySelector('.lesson-layout-root')
  if (!(root instanceof HTMLElement)) {
    return
  }
  root.setAttribute('data-outline-open', isOpen ? 'true' : 'false')
  const backdrop = document.querySelector(
    '[data-lesson-outline-backdrop]'
  ) as HTMLElement | null
  if (backdrop) {
    backdrop.setAttribute('aria-hidden', isOpen ? 'false' : 'true')
  }
  const outlineToggles = document.querySelectorAll('[data-lesson-outline-toggle]')
  outlineToggles.forEach((toggleEl) => {
    if (toggleEl instanceof HTMLElement) {
      toggleEl.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
    }
  })
}

function setupOutlineToggle() {
  updateMobileOutlineUi(false)
  if (outlineToggleBound) {
    return
  }
  outlineToggleBound = true

  document.addEventListener('lesson-outline-toggle', () => {
    if (!window.matchMedia('(max-width: 1024px)').matches) {
      return
    }
    const root = document.querySelector('.lesson-layout-root')
    const sidebar = document.querySelector('[data-lesson-sidebar="true"]')
    if (!(root instanceof HTMLElement) || !(sidebar instanceof HTMLElement)) {
      return
    }
    const isOpen = root.getAttribute('data-outline-open') === 'true'
    updateMobileOutlineUi(!isOpen)
  })

  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }
    if (!target.closest('[data-lesson-outline-backdrop]')) {
      return
    }
    updateMobileOutlineUi(false)
  })

  window.addEventListener('resize', () => {
    if (window.matchMedia('(min-width: 1025px)').matches) {
      updateMobileOutlineUi(false)
    }
  })
}

function setupTerminalToggle(onReload: () => void) {
  const root = document.querySelector('.lesson-layout-root')
  if (root && window.matchMedia('(min-width: 1025px)').matches) {
    root.setAttribute('data-terminal-open', 'true')
  }
  if (terminalToggleBound) {
    document.dispatchEvent(new CustomEvent('lesson-terminal-state-changed'))
    return
  }
  terminalToggleBound = true

  document.addEventListener('lesson-terminal-toggle', () => {
    const rootEl = document.querySelector('.lesson-layout-root')
    if (!rootEl) {
      return
    }
    const open = rootEl.getAttribute('data-terminal-open') !== 'false'
    const nextOpen = !open
    rootEl.setAttribute('data-terminal-open', nextOpen ? 'true' : 'false')
    document.dispatchEvent(new CustomEvent('lesson-terminal-state-changed'))
    if (nextOpen) {
      document.dispatchEvent(new CustomEvent('lesson-terminal-open'))
    }
  })

  document.addEventListener('lesson-terminal-reload', () => {
    onReload()
  })

  document.dispatchEvent(new CustomEvent('lesson-terminal-state-changed'))
}

export function setupTerminalLayoutUi(onReload: () => void) {
  setupTerminalToggle(onReload)
  setupTerminalTabs()
  setupOutlineToggle()
}
