/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        secondary: {
          500: '#6366f1',
          600: '#5b21b6',
        },
        accent: {
          500: '#10b981',
        },
        neutral: {
          500: '#475569',
          600: '#475569',
        },
        surface: '#f8fafc',
        border: '#e2e8f0',
        muted: '#f1f5f9',
      },
      fontFamily: {
        'display': ['Space Grotesk', 'sans-serif'],
        'sans': ['IBM Plex Sans', 'system-ui', 'sans-serif'],
      },
      animation: {
        'spin': 'spin 1s linear infinite',
        'pulse': 'pulse 2s infinite',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}