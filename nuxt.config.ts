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
        { name: 'theme-color', content: '#f3edf0' },
        { property: 'og:title', content: 'Rove — Style, found well' },
        { property: 'og:description', content: 'People and browser agents research real retailers together, refine considered edits, and preserve every useful find.' },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'https://mythread.netlify.app/' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/rove-mark.svg' },
        { rel: 'canonical', href: 'https://mythread.netlify.app/' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap' },
      ],
    },
  },
  typescript: { strict: true, typeCheck: true },
  tailwindcss: { cssPath: '~/assets/css/main.css' },
})
