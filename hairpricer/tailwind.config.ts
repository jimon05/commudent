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
        line: "#e7e5e4",
        blush: "#fff1f2",
        coral: "#fb7185",
        mint: "#d9f99d",
        teal: "#0f766e"
      },
      boxShadow: {
        soft: "0 16px 40px rgba(23, 23, 23, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
