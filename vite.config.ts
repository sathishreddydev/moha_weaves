import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

// Fix dirname for Vite ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
  ],

  root: path.resolve(__dirname, "client"),

  // IMPORTANT: Makes frontend work on backend hosting
  base: "/",

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },

  build: {
    // Backend expects frontend here
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },

  server: {
    fs: {
      strict: false, // IMPORTANT: allow importing outside /client
    },
  },
});
