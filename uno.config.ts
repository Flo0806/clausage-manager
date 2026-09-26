import { defineConfig, presetIcons, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [presetWind3({ dark: 'class' }), presetIcons()],
  theme: {
    fontFamily: {
      sans: "'Geist Variable', ui-sans-serif, system-ui, sans-serif",
      mono: "'Geist Mono Variable', ui-monospace, SFMono-Regular, Menlo, monospace",
    },
    // Values are RGB channels so opacity modifiers like `bg-primary/85` work.
    colors: {
      bg: 'rgb(var(--c-bg))',
      surface: 'rgb(var(--c-surface))',
      fg: 'rgb(var(--c-fg))',
      muted: 'rgb(var(--c-muted))',
      border: 'rgb(var(--c-border))',
      primary: 'rgb(var(--c-primary))',
      'on-primary': 'rgb(var(--c-on-primary))',
      danger: 'rgb(var(--c-danger))',
    },
  },
  preflights: [
    {
      getCSS: ({ theme }) => `
        :root {
          color-scheme: light;
          --c-bg: 250 250 250;
          --c-surface: 239 239 241;
          --c-fg: 24 24 27;
          --c-muted: 90 90 99;
          --c-border: 220 220 224;
          /* darker than the brand orange to keep WCAG AA contrast on light backgrounds */
          --c-primary: 168 78 43;
          --c-on-primary: 255 255 255;
          --c-danger: 185 28 28;
        }
        :root.dark {
          color-scheme: dark;
          --c-bg: 14 14 16;
          --c-surface: 24 24 27;
          --c-fg: 236 236 238;
          --c-muted: 161 161 170;
          --c-border: 46 46 51;
          --c-primary: 217 119 87;
          --c-on-primary: 14 14 16;
          --c-danger: 248 113 113;
        }
        body {
          font-family: ${theme.fontFamily.sans};
          background-color: rgb(var(--c-bg));
          color: rgb(var(--c-fg));
          margin: 0;
        }
      `,
    },
  ],
  shortcuts: {
    btn: 'inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full font-medium transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed',
    'btn-primary': 'btn bg-primary text-on-primary enabled:hover:bg-primary/85',
    'btn-secondary': 'btn bg-fg/10 text-fg enabled:hover:bg-fg/15',
    'btn-ghost': 'btn text-fg enabled:hover:bg-fg/10',
    input:
      'box-border w-full px-3 py-2 rounded-md bg-bg text-fg border border-border placeholder:text-muted transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/30',
    list: 'list-disc list-inside',
  },
})
