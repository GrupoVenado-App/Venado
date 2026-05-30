/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        field: "#f5f7fb",
        venado: "#b91c1c",
        leaf: "#15803d",
        skyroute: "#2563eb",
        amberline: "#f97316"
      },
      boxShadow: {
        soft: "0 12px 40px rgba(15, 23, 42, 0.08)"
      }
    },
  },
  plugins: [],
};
