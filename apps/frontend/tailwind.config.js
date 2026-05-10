/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#0F4C81",
          "primary-hover": "#0B3A63",
          accent: "#0D9488",
          "accent-hover": "#0F766E",
          muted: "#F4F6F8",
          shell: "#F5F7FA"
        }
      }
    }
  },
  plugins: []
};
