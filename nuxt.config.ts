import { THEME_COLORS, themeBootstrapScript } from './app/utils/appearance'

export default defineNuxtConfig({
  compatibilityDate: '2026-07-15',
  ssr: false,
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  components: [{ path: '~/components', pathPrefix: false }],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Rove — Style, found well',
      meta: [
        { name: 'application-name', content: 'Rove' },
        { name: 'description', content: 'A shared fashion research workspace where people and browser agents build considered edits from real retailer links.' },
        { name: 'theme-color', content: THEME_COLORS.light },
        { property: 'og:title', content: 'Rove — Style, found well' },
        { property: 'og:description', content: 'People and browser agents research real retailers together, refine considered edits, and preserve every useful find.' },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'https://myrove.netlify.app/' },
        { property: 'og:image', content: 'https://rove.chrisforyou.chatgpt.site/screenshot.jpeg' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'Rove — Your wardrobe for the web.' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:image', content: 'https://rove.chrisforyou.chatgpt.site/screenshot.jpeg' },
      ],
      link: [
        { rel: 'alternate', type: 'text/markdown', href: '/skill.md', title: 'Rove agent guide' },
        { rel: 'alternate', type: 'text/markdown', href: '/shop.md', title: 'Rove Shop integration guide' },
        { rel: 'icon', type: 'image/svg+xml', href: '/rove-mark.svg' },
        { rel: 'canonical', href: 'https://myrove.netlify.app/' },
        { rel: 'alternate', href: 'https://rove.chrisforyou.chatgpt.site/', title: 'Rove on Sites' },
      ],
      // Sets data-theme before first paint so a dark-mode visitor never sees a light flash.
      script: [{ innerHTML: themeBootstrapScript(), tagPosition: 'head' }],
    },
  },
  typescript: { strict: true, typeCheck: true },
  tailwindcss: { cssPath: '~/assets/css/main.css' },
})
