import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14213d",
        brand: "#2e63b8",
        canvas: "#f4f7fb",
        line: "#dfe7f0",
        muted: "#72829a",
      },
      boxShadow: {
        card: "0 10px 30px rgba(31, 62, 109, 0.05)",
        hover: "0 16px 35px rgba(31, 62, 109, 0.11)",
      },
    },
  },
  plugins: [],
};
export default config;
