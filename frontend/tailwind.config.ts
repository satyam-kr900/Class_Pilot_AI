import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B3D62",
        mint: "#20B879",
        coral: "#F04F38",
      },
    },
  },
  plugins: [],
};

export default config;
