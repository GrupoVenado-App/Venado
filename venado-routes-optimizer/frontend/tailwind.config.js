/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        field: "#f3f6ff",
        venado: "#c8102e",
        leaf: "#1d4ed8",
        skyroute: "#174ea6",
        amberline: "#dc2626"
      },
      boxShadow: {
        soft: "0 12px 40px rgba(15, 23, 42, 0.08)"
      }
    },
  },
  plugins: [],
};
