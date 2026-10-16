import { APPEARANCE_STORAGE_KEY, DARK_SCHEME_QUERY, THEME_COLORS, applyTheme, readAppearance } from '~/utils/appearance'

export default defineNuxtPlugin({
  name: 'appearance',
  enforce: 'pre',
  setup() {
    const { preference, systemPrefersDark, theme } = useAppearance()
    const media = window.matchMedia(DARK_SCHEME_QUERY)

    preference.value = readAppearance(window.localStorage)
    systemPrefersDark.value = media.matches
    media.addEventListener('change', (event) => { systemPrefersDark.value = event.matches })
    // Another tab changing the setting should carry over here too.
    window.addEventListener('storage', (event) => {
      if (event.storageArea === window.localStorage && (event.key === null || event.key === APPEARANCE_STORAGE_KEY)) preference.value = readAppearance(window.localStorage)
    })

    // The bootstrap script already painted the first theme; later changes cross-fade.
    watch(theme, (next, previous) => applyTheme(next, { animate: previous !== undefined }), { immediate: true })
    useHead({ meta: [{ name: 'theme-color', content: () => THEME_COLORS[theme.value] }] })
  },
})
