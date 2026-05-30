import { buildPack } from "../src/build";
import type { VectorFormat } from "../src/core/types";

/** Build the same content into multiple pack formats for the recall comparison. */
const source = process.env.CONTENT ?? "examples/content";
const formats: VectorFormat[] = ["f32", "int8"];

for (const format of formats) {
  const out = `examples/demo/public/packs/site-${format}`;
  const result = await buildPack({
    source,
    out,
    name: `site-${format}`,
    compress: format,
    qdrantUrl: process.env.QDRANT_URL,
    collection: "qpack_site",
  });
  console.log(`${format.padEnd(5)} ${String(result.count).padStart(5)} vecs  ${(result.bytes / 1024).toFixed(1)} KB → ${out}`);
}
