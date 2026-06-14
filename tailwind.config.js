export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          light: '#F8FAFC',
          primary: '#10B981',
          secondary: '#64748B',
          accent: '#0EA5E9',
          dark: '#0F172A',
        },
        muted: {
          label: '#94A3B8',
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
      }
    },
  },
  plugins: [],
}
