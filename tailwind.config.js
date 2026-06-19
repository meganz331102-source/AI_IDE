/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta v2.9.0 (teal → green + orange/amber).
        brand: {
          deep:  '#22577a',   // Deep teal — drugorzędne panele, ramki
          teal:  '#38a3a5',   // Mid teal — kolor akcentu (primary)
          green: '#57cc99',   // Mint green — hover / success
          mint:  '#80ed99',   // Light green — wyróżnienia
          glow:  '#c7f9cc',   // Pastel mint — bardzo jasne akcenty tekstu
        },
        warn: {
          dark:  '#f48c06',   // Dark orange
          base:  '#faa307',   // Orange
          amber: '#ffba08',   // Amber flame
        },
        // Tło – ciepłe nawiązanie do palety (lekko granatowo-teal zamiast czystej szarości)
        bg: {
          0: '#0a1216',
          1: '#0d1820',
          2: '#11202a',
        },
      },
    },
  },
  plugins: [],
};
