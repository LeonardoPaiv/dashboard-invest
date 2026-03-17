/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0b",
        card: "#18181b",
        primary: "#10b981",
        secondary: "#6366f1",
      }
    },
  },
  plugins: [],
}
