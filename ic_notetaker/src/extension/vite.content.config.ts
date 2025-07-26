import { defineConfig } from "vite";
import * as path from "path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: {
        content: path.resolve(__dirname, "src/content/content.ts"),
        "auth-injector": path.resolve(__dirname, "src/auth-injector.js"),
      },
      output: {
        entryFileNames: "[name].js",
        format: "es",
        manualChunks: undefined,
      },
    },
    target: "esnext",
  },
  define: {
    global: "globalThis",
    // Environment variables from main config
    "process.env.NODE_ENV": JSON.stringify("development"),
    "import.meta.env.DEV": JSON.stringify(true),
    "import.meta.env.PROD": JSON.stringify(false),
    "import.meta.env.MODE": JSON.stringify("development"),
  },
});
