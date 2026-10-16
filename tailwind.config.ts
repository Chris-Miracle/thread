import type { Config } from 'tailwindcss'

const systemSans = ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif']
const systemDisplay = ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif']

/** Channel tokens from main.css, so opacity modifiers such as `bg-thread-surface/90` keep working in both schemes. */
const channel = (name: string) => `rgb(var(--rove-${name}) / <alpha-value>)`

export default <Partial<Config>>{
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './app/components/**/*.{vue,js,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/app.vue',
  ],
  theme: {
    extend: {
      colors: {
        // Starlight (light) and Midnight (dark), with one orange signal for live state and the brand dot.
        // Values live in app/assets/css/main.css and flip with data-theme on <html>.
        thread: {
          canvas: channel('canvas'),
          surface: channel('surface'),
          elevated: channel('elevated'),
          well: channel('well'),
          ink: channel('ink'),
          'ink-strong': channel('ink-strong'),
          'on-ink': channel('on-ink'),
          muted: channel('muted'),
          faint: channel('faint'),
          line: channel('line'),
          accent: channel('accent'),
          'accent-ink': channel('accent-ink'),
          success: channel('success'),
          danger: channel('danger'),
          hud: channel('hud'),
          fill: 'var(--rove-fill)',
          'fill-strong': 'var(--rove-fill-strong)',
          scrim: 'var(--rove-scrim)',
        },
      },
      fontFamily: {
        sans: systemSans,
        display: systemDisplay,
      },
      boxShadow: {
        hairline: '0 0 0 1px var(--rove-hairline)',
        'hairline-strong': '0 0 0 1px var(--rove-hairline-strong)',
        'inset-hairline': 'inset 0 0 0 1px var(--rove-hairline)',
        control: 'inset 0 0 0 1px var(--rove-control-ring)',
        'control-hover': 'inset 0 0 0 1px var(--rove-control-ring-hover)',
        selected: 'inset 0 0 0 2px rgb(var(--rove-ink))',
        focus: 'inset 0 0 0 1.5px rgb(var(--rove-ink))',
        raised: 'var(--rove-shadow-raised)',
        sheet: 'var(--rove-shadow-sheet)',
      },
      transitionTimingFunction: {
        sheet: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
}
