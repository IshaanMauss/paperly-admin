import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // The panel's pages were written with violet/purple utility classes. Re-pointing the
      // two scales here re-themes every page at once: "purple" becomes the indigo accent and
      // "violet" becomes cool neutral greys for borders, tints and hover states.
      colors: {
        purple: {
          50: "#f3f4ff", 100: "#e6e8ff", 200: "#cbd0fd", 300: "#a6aef9", 400: "#7f89f3",
          500: "#6168ec", 600: "#4f46e5", 700: "#4338ca", 800: "#3730a3", 900: "#2e2a80", 950: "#1d1b54",
        },
        violet: {
          50: "#f6f7fb", 100: "#eef0f6", 200: "#e0e3ee", 300: "#c9cee0", 400: "#9ea5c0",
          500: "#7079a0", 600: "#565e82", 700: "#444b69", 800: "#303650", 900: "#1f2336",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 23, 42, 0.05)",
        card: "0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
