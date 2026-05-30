import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts", // browser: QPack.load / search / ask
    build: "src/build.ts", // node: buildPack (content -> Qdrant -> pack)
    widget: "src/widget.ts", // browser: mountChat drop-in UI
  },
  format: ["esm"],
  dts: true,
  clean: true,
  target: "es2022",
  splitting: false,
});
