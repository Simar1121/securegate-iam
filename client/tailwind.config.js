/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#060a12',
          900: '#0b1120',
          850: '#0f172a',
          800: '#151f36',
          700: '#1e293b',
          600: '#334155',
        },
        charcoal: {
          950: '#090d15',
          900: '#111726',
          850: '#172033',
          800: '#1e283d',
          700: '#2d3b55',
        },
        violet: {
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
        },
        burgundy: {
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
        },
      },
    },
  },
  plugins: [],
};
