import { fileURLToPath, URL } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import copy from "rollup-plugin-copy";
import path from "path";

export default defineConfig(({ mode }) => {
  // Get the current file's directory
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  
  // Go up two levels to reach the project root (where dfx.json is located)
  const projectRoot = path.resolve(__dirname, "../../");
  
  // Load env file from the project root
  const env = loadEnv(mode, projectRoot, "");
  
  // Determine the actual mode based on DFX_NETWORK (like dfx.json does)
  const dfxNetwork = env.DFX_NETWORK || "ic";
  const actualMode = dfxNetwork === "local" ? "development" : "production";
  const isExtension = mode === 'extension';

  console.log("=== IC NOTETAKER EXTENSION ENV DEBUG ===");
  console.log("Project root:", projectRoot);
  console.log("Vite mode:", mode);
  console.log("DFX_NETWORK:", dfxNetwork);
  console.log("Actual mode (based on DFX_NETWORK):", actualMode);
  console.log("Is extension build:", isExtension);
  console.log("Environment variables loaded:", {
    DFX_NETWORK: env.DFX_NETWORK,
    CANISTER_ID_INTERNET_IDENTITY: env.CANISTER_ID_INTERNET_IDENTITY,
    CANISTER_ID_IC_NOTETAKER_BACKEND: env.CANISTER_ID_IC_NOTETAKER_BACKEND,
  });
  console.log("=== END DEBUG INFO ===");

  return {
    plugins: [
      react(),
      // Copy manifest.json and update paths for extension build
      ...(isExtension ? [copy({
        targets: [
          {
            src: path.resolve(__dirname, 'src/manifest.json'),
            dest: path.resolve(__dirname, 'dist'),
            transform: (contents) => {
              const manifest = JSON.parse(contents.toString());
              // Update paths to match build output
              manifest.background.service_worker = 'background.js';
              manifest.content_scripts[0].js = ['content.js'];
              manifest.action.default_popup = 'index.html';
              
              // Remove icon references since we don't have icon files yet
              delete manifest.icons;
              delete manifest.action.default_icon;
              
              return JSON.stringify(manifest, null, 2);
            }
          }
        ],
        hook: 'writeBundle'
      })] : [])
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'declarations': fileURLToPath(
          new URL("../../.dfx/local/canisters", import.meta.url)
        ),
      },
      dedupe: ['@dfinity/agent'],
    },
    define: {
      global: 'globalThis',
      
      // Use the actual mode based on DFX_NETWORK
      "process.env.NODE_ENV": JSON.stringify(actualMode),
      "import.meta.env.DEV": JSON.stringify(actualMode === "development"),
      "import.meta.env.PROD": JSON.stringify(actualMode === "production"),
      "import.meta.env.MODE": JSON.stringify(actualMode),

      // Expose DFX-related variables
      "process.env.DFX_NETWORK": JSON.stringify(env.DFX_NETWORK),
      "import.meta.env.DFX_NETWORK": JSON.stringify(env.DFX_NETWORK),

      // Expose canister IDs
      "process.env.CANISTER_ID_INTERNET_IDENTITY": JSON.stringify(
        env.CANISTER_ID_INTERNET_IDENTITY
      ),
      "process.env.CANISTER_ID_IC_NOTETAKER_BACKEND": JSON.stringify(
        env.CANISTER_ID_IC_NOTETAKER_BACKEND
      ),

      // Also expose them on import.meta.env for consistency
      "import.meta.env.CANISTER_ID_INTERNET_IDENTITY": JSON.stringify(
        env.CANISTER_ID_INTERNET_IDENTITY
      ),
      "import.meta.env.CANISTER_ID_IC_NOTETAKER_BACKEND": JSON.stringify(
        env.CANISTER_ID_IC_NOTETAKER_BACKEND
      ),

      // IC Host based on network
      "process.env.IC_HOST": JSON.stringify(
        dfxNetwork === "local" ? "http://127.0.0.1:4943" : "https://icp-api.io"
      ),
      "import.meta.env.IC_HOST": JSON.stringify(
        dfxNetwork === "local" ? "http://127.0.0.1:4943" : "https://icp-api.io"
      ),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: isExtension ? {
        // Extension build: Multiple entry points but separate popup/background from content
        input: {
          popup: path.resolve(__dirname, 'index.html'),
          background: path.resolve(__dirname, 'src/background/background.ts'),
        },
        output: {
          entryFileNames: (chunk) => {
            if (chunk.name === 'background') return 'background.js'
            return 'popup.js'
          },
          chunkFileNames: 'chunks/[name].[hash].js',
          assetFileNames: 'assets/[name].[ext]',
          format: 'es' // Use ES modules for popup and background
        }
      } : {
        // Regular web build: Single SPA
        input: path.resolve(__dirname, 'index.html')
      },
      target: 'esnext',
      minify: isExtension ? 'esbuild' : false,
      // Copy additional files for extension
      copyPublicDir: false, // Disable default public dir copying
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
    },
    server: {
      port: 3000,
      open: true,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:4943",
          changeOrigin: true,
        },
      },
    }
  }
})