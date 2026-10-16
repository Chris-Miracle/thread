import { resolveTheme, writeAppearance, type AppearancePreference, type ResolvedTheme } from '~/utils/appearance'

export function useAppearance() {
  const preference = useState<AppearancePreference>('rove-appearance', () => 'system')
  const systemPrefersDark = useState('rove-system-dark', () => false)
  const theme = computed<ResolvedTheme>(() => resolveTheme(preference.value, systemPrefersDark.value))

  function setPreference(next: AppearancePreference) {
    preference.value = next
    writeAppearance(import.meta.client ? window.localStorage : undefined, next)
  }

  return { preference, systemPrefersDark, theme, setPreference }
}
