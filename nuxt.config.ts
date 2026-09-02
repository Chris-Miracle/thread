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
        { name: 'description', content: 'A personal fashion workspace for building considered edits from real retailer links.' },
        { name: 'theme-color', content: '#f3edf0' },
        { property: 'og:title', content: 'Rove — Style, found well' },
        { property: 'og:description', content: 'Build considered edits across real retailers, refine them together, and keep every useful find close.' },
        { property: 'og:type', content: 'website' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/rove-mark.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap' },
      ],
    },
  },
  typescript: { strict: true, typeCheck: true },
  tailwindcss: { cssPath: '~/assets/css/main.css' },
})
