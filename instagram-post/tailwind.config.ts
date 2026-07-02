import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FAF7F2",
        card: "#FFFFFF",
        accent: "#B5502A",
        success: "#2F855A",
        warning: "#B7791F",
        danger: "#C53030",
      },
      fontFamily: {
        sans: [
          "Noto Sans JP",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
