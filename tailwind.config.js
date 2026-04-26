/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './engine/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './*.{ts,tsx}',
  ],
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
    },
  },
  plugins: [],
};
