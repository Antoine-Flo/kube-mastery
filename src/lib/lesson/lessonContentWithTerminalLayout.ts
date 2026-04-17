import { setupMermaidZoom } from '../../components/lesson/setupMermaidZoom.client'
import { setupBeforeUnloadCleanup, initLessonEmulation, reloadLessonEmulation } from './contentWithTerminalLayout/environment'
import { setupPanelResize } from './contentWithTerminalLayout/panelResize'
import {
  setupSidebarScrollPersistence,
  setupSidebarToggle
} from './contentWithTerminalLayout/sidebar'
import { setupTerminalLayoutUi } from './contentWithTerminalLayout/terminalUi'

let pageLoadBound = false

function runLayoutSetup() {
  setupSidebarToggle()
  setupSidebarScrollPersistence()
  setupTerminalLayoutUi(reloadLessonEmulation)
  setupPanelResize()
  setupMermaidZoom()
  requestAnimationFrame(() => {
    void initLessonEmulation()
  })
}

export function initializeContentWithTerminalLayout() {
  runLayoutSetup()
  setupBeforeUnloadCleanup()

  if (pageLoadBound) {
    return
  }
  pageLoadBound = true

  document.addEventListener('astro:page-load', () => {
    runLayoutSetup()
  })
}
