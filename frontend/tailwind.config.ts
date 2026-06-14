import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        snack: {
          orange: "#F97316",
          green: "#16A34A",
          navy: "#0F172A",
          mist: "#F8FAFC"
        }
      },
      boxShadow: {
        panel: "0 1px 2px rgba(15, 23, 42, 0.08)",
        premium: "0 18px 45px rgba(15, 23, 42, 0.10), 0 1px 0 rgba(255, 255, 255, 0.75) inset",
        lift: "0 10px 30px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
