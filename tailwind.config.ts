import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  content: [
    './app/components/**/*.{vue,js,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/app.vue',
  ],
  theme: {
    extend: {
      colors: {
        thread: {
          canvas: '#f5f1e9',
          surface: '#fbf9f4',
          ink: '#1d1c19',
          muted: '#6f6b62',
          line: '#d8d2c7',
          accent: '#7a674f',
          soft: '#e9e1d5',
          danger: '#9f342d',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        editorial: ['Instrument Serif', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 18px 50px rgba(43, 38, 31, 0.10)',
      },
    },
  },
}
