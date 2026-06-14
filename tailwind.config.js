export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          light: '#EEFABD',
          primary: '#9BCF83',
          secondary: '#6B85A8',
          accent: '#14B8A6',
          dark: '#2D3250',
        },
        muted: {
          label: '#98A2B3',
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
