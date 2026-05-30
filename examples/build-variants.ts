import { indexContent } from "../src/build";
import { DIM } from "../src/core/embed";
import { writePack } from "../src/core/pack";
import type { VectorFormat } from "../src/core/types";

/** Embed the content once, then write it out in every pack format for comparison. */
const source = process.env.CONTENT ?? "examples/content";
const formats: VectorFormat[] = ["f32", "int8", "tq4", "tq2", "tq1"];

const ix = await indexContent({
  source,
  name: "site",
  qdrantUrl: process.env.QDRANT_URL,
  collection: "qpack_site",
});

console.log(`\nindexed ${ix.docs.length} chunks · dim ${ix.dim}\n`);
console.log("format  total KB → dir");
for (const format of formats) {
  const out = `examples/demo/public/packs/site-${format}`;
  const { bytes } = writePack(
    out,
    { name: `site-${format}`, version: "v1", model: ix.model, dim: DIM },
    ix.docs,
    ix.vectors,
    format,
  );
  console.log(`${format.padEnd(7)} ${(bytes / 1024).toFixed(1).padStart(8)} → ${out}`);
}
