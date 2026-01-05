import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { visualizer } from 'rollup-plugin-visualizer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
 plugins: [react(), visualizer({ filename: 'dist/stats.html' })],


  root: path.resolve(__dirname, "client"),

  base: "/",

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },

  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React ecosystem
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
            return 'vendor-react';
          }
          // Radix UI components
          if (id.includes('@radix-ui')) {
            return 'vendor-radix';
          }
          // Form handling
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
            return 'vendor-forms';
          }
          // Data fetching
          if (id.includes('@tanstack/react-query')) {
            return 'vendor-query';
          }
                    // Animation
          if (id.includes('framer-motion')) {
            return 'vendor-motion';
          }
          // Icons
          if (id.includes('lucide-react') || id.includes('react-icons')) {
            return 'vendor-icons';
          }
          // Utils
          if (id.includes('date-fns') || id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) {
            return 'vendor-utils';
          }
          // File handling
          if (id.includes('file-saver') || id.includes('jspdf') || id.includes('pdfkit')) {
            return 'vendor-files';
          }
          // Payment
          if (id.includes('razorpay')) {
            return 'vendor-payment';
          }
          // Large vendor packages
          if (id.includes('@uppy') || id.includes('@google-cloud')) {
            return 'vendor-large';
          }
        },
      },
    },
    chunkSizeWarningLimit: 300,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },

  server: {
    fs: {
      strict: false,
    },
    allowedHosts: true,
  },
});
