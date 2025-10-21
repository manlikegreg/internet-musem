/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        grave: '#1f2937',
        confess: '#0f172a',
        void: '#111827',
        oracle: '#1e293b',
        capsule: '#0b132b',
        apology: '#2d132c',
        compliment: '#0f766e',
        dream: '#1b254b',
        mirror: '#2a1b4b'
      }
    },
  },
  plugins: [],
}
