import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // GitHub Pages serves the site from /etude/; the Pages workflow sets BASE_PATH.
  base: process.env.BASE_PATH ?? "/",
  plugins: [react()],
  server: { port: 4820, strictPort: true },
  build: {
    chunkSizeWarningLimit: 1200, // Tone.js alone is ~400 kB; fine for a local app
    // Two apps from one codebase: Studio at /, the Practice Room at /practice/.
    rollupOptions: {
      input: { studio: page("./index.html"), practice: page("./practice/index.html") },
    },
  },
});
