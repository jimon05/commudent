import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#171717",
        paper: "#f8fafc",
        line: "#e5e7eb",
        marine: "#0f766e",
        leaf: "#65a30d",
        ambered: "#b45309",
        berry: "#be123c"
      },
      boxShadow: {
        soft: "0 18px 48px rgba(15, 23, 42, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
