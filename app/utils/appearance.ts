export const APPEARANCE_PREFERENCES = ['system', 'light', 'dark'] as const
export type AppearancePreference = typeof APPEARANCE_PREFERENCES[number]
export type ResolvedTheme = 'light' | 'dark'

export const APPEARANCE_STORAGE_KEY = 'rove.appearance'
/** Browser chrome colours; they match `--rove-canvas` for each theme in main.css. */
export const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#f2eee7', dark: '#0d1016' }
export const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)'

export function parseAppearance(value: unknown): AppearancePreference {
  return APPEARANCE_PREFERENCES.includes(value as AppearancePreference) ? value as AppearancePreference : 'system'
}

export function resolveTheme(preference: AppearancePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

/** Unset means "follow the system", so a person who never touches the setting keeps tracking it. */
export function readAppearance(storage: Pick<Storage, 'getItem'> | undefined): AppearancePreference {
  try {
    return parseAppearance(storage?.getItem(APPEARANCE_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

export function writeAppearance(storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined, preference: AppearancePreference): void {
  try {
    if (preference === 'system') storage?.removeItem(APPEARANCE_STORAGE_KEY)
    else storage?.setItem(APPEARANCE_STORAGE_KEY, preference)
  } catch {
    // Private windows can refuse storage; the choice still applies for this visit.
  }
}

function commitTheme(root: HTMLElement, theme: ResolvedTheme): void {
  root.dataset.theme = theme
  root.style.colorScheme = theme
}

/** The theme-color meta belongs to Nuxt's head manager; the appearance plugin keeps it in step. */
export function applyTheme(theme: ResolvedTheme, { animate = false } = {}): void {
  const root = document.documentElement
  if (root.dataset.theme === theme) return
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  root.classList.add('rove-theme-switching')
  const release = () => requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('rove-theme-switching')))
  if (animate && !reduceMotion && typeof document.startViewTransition === 'function') {
    document.startViewTransition(() => commitTheme(root, theme)).finished.finally(release)
  } else {
    commitTheme(root, theme)
    release()
  }
}

/**
 * Runs inline in <head> before the app bundle so the first paint already has the right theme.
 * Built from the constants above so the storage key and query cannot drift from the runtime.
 */
export function themeBootstrapScript(): string {
  return `(function(){var d=document.documentElement,p=null;try{p=localStorage.getItem(${JSON.stringify(APPEARANCE_STORAGE_KEY)})}catch(e){}`
    + `var t=p==='dark'||p==='light'?p:(window.matchMedia&&matchMedia(${JSON.stringify(DARK_SCHEME_QUERY)}).matches?'dark':'light');`
    + `d.dataset.theme=t;d.style.colorScheme=t})()`
}
