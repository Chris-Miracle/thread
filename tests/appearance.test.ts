import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  APPEARANCE_STORAGE_KEY, parseAppearance, readAppearance, resolveTheme, themeBootstrapScript, writeAppearance,
} from '../app/utils/appearance'

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
    values,
  }
}

function mockSystemScheme(dark: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: query === '(prefers-color-scheme: dark)' ? dark : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

describe('appearance preference', () => {
  afterEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
    document.documentElement.style.colorScheme = ''
  })

  it('defaults to following the system when nothing valid is stored', () => {
    expect(parseAppearance(null)).toBe('system')
    expect(parseAppearance('sepia')).toBe('system')
    expect(readAppearance(memoryStorage())).toBe('system')
    expect(readAppearance({ getItem: () => { throw new Error('blocked') } })).toBe('system')
  })

  it('resolves auto from the system and explicit choices regardless of it', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('stores explicit choices and clears the key for auto', () => {
    const storage = memoryStorage()
    writeAppearance(storage, 'dark')
    expect(storage.values.get(APPEARANCE_STORAGE_KEY)).toBe('dark')
    writeAppearance(storage, 'system')
    expect(storage.values.has(APPEARANCE_STORAGE_KEY)).toBe(false)
  })

  it.each([
    { stored: null, systemDark: true, expected: 'dark' },
    { stored: null, systemDark: false, expected: 'light' },
    { stored: 'light', systemDark: true, expected: 'light' },
    { stored: 'dark', systemDark: false, expected: 'dark' },
  ] as const)('bootstrap paints $expected for stored=$stored, system dark=$systemDark', ({ stored, systemDark, expected }) => {
    mockSystemScheme(systemDark)
    if (stored) localStorage.setItem(APPEARANCE_STORAGE_KEY, stored)

    new Function(themeBootstrapScript())()

    expect(document.documentElement.dataset.theme).toBe(expected)
    expect(document.documentElement.style.colorScheme).toBe(expected)
  })
})
