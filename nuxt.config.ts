export default defineNuxtConfig({
  compatibilityDate: '2026-07-15',
  ssr: false,
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  components: [{ path: '~/components', pathPrefix: false }],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'THREAD — Your wardrobe for the web',
      meta: [
        { name: 'description', content: 'An agent-native fashion shopping workspace built with WebMCP.' },
        { name: 'theme-color', content: '#f5f1e9' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap' },
      ],
    },
  },
  nitro: { preset: 'static' },
  typescript: { strict: true, typeCheck: true },
  tailwindcss: { cssPath: '~/assets/css/main.css' },
})
