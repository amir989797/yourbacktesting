/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#0b0e14',
        darkCard: '#121824',
        darkBorder: '#1f293d',
        accentGold: '#f59e0b',
        tradeGreen: '#10b981',
        tradeRed: '#ef4444',
      },
    },
  },
  plugins: [],
}
