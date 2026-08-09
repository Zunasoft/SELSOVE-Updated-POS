/** @type {import('tailwindcss').Config} */
export default {
  // Theme is driven by the `dark` class App.jsx toggles on <html>.
  // Without this, every `dark:` utility falls back to prefers-color-scheme
  // and the light theme renders dark text styles on light surfaces.
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        dark: {
          950: '#070a11',
          900: '#0f172a',
          800: '#1e293b'
        }
      }
    },
  },
  plugins: [],
}
