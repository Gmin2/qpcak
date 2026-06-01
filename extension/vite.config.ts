import { defineConfig } from "vite";

/**
 * Build the extension. `content.ts` bundles to dist/content.js; everything in
 * public/ (manifest.json, assets, packs) is copied to dist/ automatically.
 */
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: { content: "src/content.ts" },
      output: {
        entryFileNames: "[name].js",
        format: "es",
      },
    },
  },
});
