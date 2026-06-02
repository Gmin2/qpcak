import { copyFileSync } from "node:fs";
import { defineConfig } from "vite";

/**
 * Build the extension:
 *  - content.ts  → dist/content.js   (injected into the page)
 *  - engine-frame.html → dist/        (the extension-origin iframe: engine+LLM)
 *  - public/* (manifest, packs) copied to dist/
 *  - the engine wasm copied into dist/assets/
 */
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: {
        content: "src/content.ts",
        "engine-frame": "engine-frame.html",
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  plugins: [
    {
      name: "copy-engine-wasm",
      closeBundle() {
        copyFileSync(
          "../engine/pkg/qpack_engine_bg.wasm",
          "dist/assets/qpack_engine_bg.wasm",
        );
      },
    },
  ],
});
