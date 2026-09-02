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
          canvas: '#f3edf0',
          surface: '#fbf8fa',
          ink: '#251920',
          muted: '#6b5d65',
          line: '#d9cbd2',
          accent: '#7c3f5b',
          soft: '#eadfe5',
          danger: '#a3384a',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        editorial: ['Instrument Serif', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 20px 58px rgba(58, 35, 47, 0.12)',
        glass: '0 24px 70px rgba(58, 35, 47, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.78)',
      },
    },
  },
}
