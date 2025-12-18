/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    // Dashboard gradient colors
    'from-red-600',
    'to-red-800',
    'from-orange-600',
    'to-orange-800',
    'from-yellow-600',
    'to-yellow-800',
    'from-green-600',
    'to-green-800',
    'from-blue-600',
    'to-blue-800',
    'from-blue-700',
    'to-blue-900',
    'from-purple-600',
    'to-purple-800',
    'from-cyan-600',
    'to-cyan-800',
    'from-emerald-600',
    'to-emerald-800',
    'from-indigo-600',
    'to-indigo-800',
    'from-red-700',
    'to-red-900',
    'from-orange-700',
    'to-orange-900',
    'from-amber-600',
    'to-amber-700',
    'from-amber-700',
    'to-amber-800',
    'from-emerald-700',
    'to-emerald-900',
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
};
