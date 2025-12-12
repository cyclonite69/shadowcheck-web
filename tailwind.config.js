/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme slate palette
        slate: {
          950: '#0f172a',
        },
      },
    },
  },
  plugins: [],
  darkMode: 'class', // Enable dark mode via class
}
