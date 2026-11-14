import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#3d2d4c",
        brand: "#8951a8",
        canvas: "#ffffff",
        line: "#eadcec",
        muted: "#8e749b",
      },
      boxShadow: {
        card: "0 10px 30px rgba(109, 64, 137, 0.05)",
        hover: "0 16px 35px rgba(109, 64, 137, 0.11)",
      },
    },
  },
  plugins: [],
};
export default config;
