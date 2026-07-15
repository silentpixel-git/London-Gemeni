/** @type {import('tailwindcss').Config} */
export default {
  // Touch devices fire :hover on tap and leave it stuck — only emit hover
  // styles where hovering is actually supported.
  future: { hoverOnlyWhenSupported: true },
  content: [
    './index.html',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './engine/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './*.{ts,tsx}',
  ],
  // `dark:` targets the palettes where lb-primary is a light ink color
  // (manual dark + auto's night), driven by the data-theme attribute.
  darkMode: ['variant', ['[data-theme="dark"] &', '[data-theme="night"] &']],
  theme: {
    extend: {
      colors: {
        'lb-bg':      'rgb(var(--lb-bg)      / <alpha-value>)',
        'lb-paper':   'rgb(var(--lb-paper)   / <alpha-value>)',
        'lb-primary': 'rgb(var(--lb-primary) / <alpha-value>)',
        'lb-accent':  'rgb(var(--lb-accent)  / <alpha-value>)',
        'lb-muted':   'rgb(var(--lb-muted)   / <alpha-value>)',
        'lb-border':  'rgb(var(--lb-border)  / <alpha-value>)',
      },
      fontFamily: {
        sans:     ['"Open Sans"', 'sans-serif'],
        serif:    ['"Playfair Display"', 'serif'],
        playfair: ['"Playfair"', 'serif'],
      },
      // Motion vocabulary — see plans/002 for the full rationale.
      //   hover/controls: duration-150 ease-out
      //   dropdowns/toasts/chips: duration-200 ease-out
      //   panels/modals/sheets: duration-300 ease-out (slides may use ease-out-expo)
      //   dramatic/scene moments only: duration-500..700
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
