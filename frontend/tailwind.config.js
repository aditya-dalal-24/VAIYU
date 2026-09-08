/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: {
          deepest: '#0B1B2B',
          page: '#132C42',
          card: '#1E3E58',
          hover: '#2C5872',
          muted: '#5A8AA3',
        },
        neutral: {
          primary: '#F5F8FA',
          secondary: '#C7D4DD',
          muted: '#7C93A0',
          dark: '#3A4E5A',
        },
        cat: {
          1: '#4FA9E0',
          2: '#4FC0B0',
          3: '#E8C24A',
          4: '#E0894A',
          5: '#D6484A',
        },
        accent: {
          cyan: '#3FC7EA',
          alert: '#FF6B57',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace']
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 12s linear infinite',
      }
    },
  },
  plugins: [],
}
