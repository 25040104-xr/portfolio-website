import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true, // if 5180 is busy, stop instead of quietly using another port
    proxy: { "/api": "http://localhost:3002" },
  },
});