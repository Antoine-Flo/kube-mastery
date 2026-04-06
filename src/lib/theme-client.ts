/**
 * Client-side theme: stored value in localStorage, data-theme on document.
 * Values: 'dark' | 'light'.
 */
const THEME_KEY = 'kube-simulator-theme'

export type Theme = 'dark' | 'light'

function applyEffectiveTheme(effective: Theme) {
  document.documentElement.setAttribute('data-theme', effective)
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'dark'
  }
  const v = localStorage.getItem(THEME_KEY) as Theme | null
  if (v === 'dark' || v === 'light') {
    return v
  }
  return 'dark'
}

export function getEffectiveTheme(): Theme {
  return getStoredTheme()
}

export function applyTheme(value: Theme) {
  localStorage.setItem(THEME_KEY, value)
  applyEffectiveTheme(value)
}

export function toggleTheme(): Theme {
  const current = getEffectiveTheme()
  const next: Theme = current === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}
