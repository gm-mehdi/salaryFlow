import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@hatch/space-sdk/client": path.join(root, "vendor/space-sdk/src/client.tsx"),
      "@hatch/space-sdk": path.join(root, "vendor/space-sdk/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/actions": {
        target: "http://localhost:5174",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
