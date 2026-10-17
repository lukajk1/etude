import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 4820, strictPort: true },
  build: { chunkSizeWarningLimit: 1200 }, // Tone.js alone is ~400 kB; fine for a local app
});
