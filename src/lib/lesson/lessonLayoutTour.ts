import { driver } from 'driver.js'
import type { Config, DriveStep, Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import '~/styles/components/lesson-layout-tour.css'

import en from '../../../messages/en.json'
import fr from '../../../messages/fr.json'

export type LessonTourLang = 'en' | 'fr'

type TourMessages = {
  lesson_tour_welcome_title: string
  lesson_tour_welcome_desc: string
  lesson_tour_sidebar_title: string
  lesson_tour_sidebar_desc: string
  lesson_tour_sidebar_toggle_title: string
  lesson_tour_sidebar_toggle_desc: string
  lesson_tour_terminal_title: string
  lesson_tour_terminal_desc: string
  lesson_tour_visualizer_title: string
  lesson_tour_visualizer_desc: string
  lesson_tour_reload_title: string
  lesson_tour_reload_desc: string
  lesson_tour_resizer_title: string
  lesson_tour_resizer_desc: string
  lesson_tour_feedback_title: string
  lesson_tour_feedback_desc: string
  lesson_tour_closing_title: string
  lesson_tour_closing_desc: string
  lesson_tour_progress: string
  lesson_tour_next: string
  lesson_tour_prev: string
  lesson_tour_done: string
}

function pickTourMessages(lang: LessonTourLang): TourMessages {
  const raw = lang === 'fr' ? fr : en
  return raw as TourMessages
}

const TOUR_SEEN_KEY = 'lesson-layout-tour-seen'

function hasTourBeenSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function markTourAsSeen(): void {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, '1')
  } catch {
    // Storage indisponible (private browsing strict, quota), on ignore.
  }
}

let activeTourDriver: Driver | null = null
let layoutTourKick = 0

export function destroyLessonLayoutTourIfActive(): void {
  if (!activeTourDriver) {
    return
  }
  if (activeTourDriver.isActive()) {
    activeTourDriver.destroy()
  }
  activeTourDriver = null
}

function isElementVisuallyPresent(el: Element): boolean {
  if (!(el instanceof HTMLElement)) {
    return false
  }
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 && rect.height <= 0) {
    return false
  }
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false
  }
  if (Number(style.opacity) === 0) {
    return false
  }
  return true
}

function firstVisibleMatch(selector: string): Element | null {
  const nodes = document.querySelectorAll(selector)
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i]
    if (isElementVisuallyPresent(el)) {
      return el
    }
  }
  return null
}

function queryTourTarget(selector: string): Element | null {
  return document.querySelector(selector)
}

function buildTourSteps(m: TourMessages): DriveStep[] {
  const steps: DriveStep[] = []

  steps.push({
    popover: {
      title: m.lesson_tour_welcome_title,
      description: m.lesson_tour_welcome_desc,
      popoverClass:
        'lesson-layout-tour-popover lesson-layout-tour-popover--welcome'
    }
  })

  const sidebar = queryTourTarget('[data-lesson-tour="sidebar"]')
  if (sidebar && isElementVisuallyPresent(sidebar)) {
    steps.push({
      element: sidebar,
      popover: {
        title: m.lesson_tour_sidebar_title,
        description: m.lesson_tour_sidebar_desc,
        side: 'right',
        align: 'start'
      }
    })
  }

  const sidebarToggle = queryTourTarget('[data-lesson-tour="sidebar-toggle"]')
  if (sidebarToggle && isElementVisuallyPresent(sidebarToggle)) {
    steps.push({
      element: sidebarToggle,
      popover: {
        title: m.lesson_tour_sidebar_toggle_title,
        description: m.lesson_tour_sidebar_toggle_desc,
        side: 'right',
        align: 'center'
      }
    })
  }

  const terminal = queryTourTarget('[data-lesson-tour="terminal"]')
  if (terminal) {
    steps.push({
      element: terminal,
      popover: {
        title: m.lesson_tour_terminal_title,
        description: m.lesson_tour_terminal_desc,
        side: 'left',
        align: 'start'
      }
    })
  }

  const vizBtn = firstVisibleMatch('[data-cluster-trigger]')
  if (vizBtn) {
    steps.push({
      element: vizBtn,
      popover: {
        title: m.lesson_tour_visualizer_title,
        description: m.lesson_tour_visualizer_desc,
        side: 'top',
        align: 'center'
      }
    })
  }

  const reloadBtn = firstVisibleMatch('[data-lesson-terminal-reload]')
  if (reloadBtn) {
    steps.push({
      element: reloadBtn,
      popover: {
        title: m.lesson_tour_reload_title,
        description: m.lesson_tour_reload_desc,
        side: 'top',
        align: 'center'
      }
    })
  }

  const feedbackBtn = firstVisibleMatch('[data-lesson-tour="feedback"]')
  if (feedbackBtn) {
    steps.push({
      element: feedbackBtn,
      popover: {
        title: m.lesson_tour_feedback_title,
        description: m.lesson_tour_feedback_desc,
        side: 'top',
        align: 'center'
      }
    })
  }

  const resizer = queryTourTarget('[data-lesson-tour="resizer"]')
  if (resizer && isElementVisuallyPresent(resizer)) {
    steps.push({
      element: resizer,
      popover: {
        title: m.lesson_tour_resizer_title,
        description: m.lesson_tour_resizer_desc,
        side: 'left',
        align: 'center'
      }
    })
  }

  steps.push({
    popover: {
      title: m.lesson_tour_closing_title,
      description: m.lesson_tour_closing_desc,
      popoverClass:
        'lesson-layout-tour-popover lesson-layout-tour-popover--welcome'
    }
  })

  return steps
}

function resolveUiLang(): LessonTourLang {
  const tag = document.documentElement.lang || 'en'
  if (tag.toLowerCase().startsWith('fr')) {
    return 'fr'
  }
  return 'en'
}

/**
 * Starts the lesson layout onboarding tour (Driver.js).
 * Steps are skipped when targets are missing or not visible (e.g. mobile sidebar).
 * Skipped entirely if the user has already completed or dismissed the tour.
 */
export function startLessonLayoutTour(lang?: LessonTourLang): void {
  if (hasTourBeenSeen()) {
    return
  }
  if (window.matchMedia('(max-width: 1024px)').matches) {
    return
  }
  destroyLessonLayoutTourIfActive()
  const uiLang = lang ?? resolveUiLang()
  const m = pickTourMessages(uiLang)
  const steps = buildTourSteps(m)
  if (steps.length === 0) {
    return
  }

  const config: Config = {
    showProgress: true,
    progressText: m.lesson_tour_progress,
    nextBtnText: m.lesson_tour_next,
    prevBtnText: m.lesson_tour_prev,
    doneBtnText: m.lesson_tour_done,
    popoverClass: 'lesson-layout-tour-popover',
    allowClose: true,
    smoothScroll: true,
    steps,
    onDestroyed: () => {
      markTourAsSeen()
      activeTourDriver = null
    }
  }

  const driverObj = driver(config)
  activeTourDriver = driverObj
  driverObj.drive()
}

/**
 * Collapses duplicate boots (e.g. immediate call plus `astro:page-load`).
 */
export function bootLessonLayoutTour(lang?: LessonTourLang): void {
  destroyLessonLayoutTourIfActive()
  const kickId = ++layoutTourKick
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (kickId !== layoutTourKick) {
        return
      }
      startLessonLayoutTour(lang)
    })
  })
}
