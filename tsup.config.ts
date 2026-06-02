import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts", // browser: QPack.load / search / ask
    build: "src/build.ts", // node: buildPack (content -> pack)
    cli: "src/cli.ts", // node CLI: `qpack build ./docs`
  },
  format: ["esm"],
  dts: { entry: { index: "src/index.ts", build: "src/build.ts" } },
  clean: true,
  target: "es2022",
  splitting: false,
  banner: { js: "" },
});
