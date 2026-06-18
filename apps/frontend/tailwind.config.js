/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#0B1F3A",
          "navy-mid": "#0F4C81",
          "navy-light": "#1a5a8f",
          gold: "#C9A962",
          "gold-light": "#E2C98A",
          teal: "#0D9488",
          "teal-hover": "#0F766E",
          muted: "#F4F6F8",
          shell: "#F5F7FA",
          // aliases
          primary: "#0F4C81",
          "primary-hover": "#0B3A63",
          accent: "#C9A962",
          "accent-hover": "#B89248"
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "system-ui", "sans-serif"],
        display: ['"Plus Jakarta Sans"', "Inter", "system-ui", "sans-serif"]
      },
      boxShadow: {
        vr: "0 24px 48px -12px rgba(11, 31, 58, 0.35)"
      }
    }
  },
  plugins: []
};
