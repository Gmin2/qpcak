import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { QPack } from "../engine/pkg-node/qpack_engine.js";
import { indexContent } from "../src/build";

/**
 * Build an engine-format pack: embed content (through Qdrant when configured),
 * encode every vector with the wasm TurboQuant engine, and emit
 *   vectors.qpack   the self-describing TurboQuant container
 *   payloads.json   the document chunks, aligned to vector order
 *   manifest.json   model + dim + bits + distance
 */
const source = process.env.CONTENT ?? "examples/content";
const bits = Number(process.env.BITS ?? 4);
const outDir = process.env.OUT ?? "examples/demo/public/packs/engine";

const ix = await indexContent({
  source,
  name: "engine",
  sitemap: process.env.SITEMAP,
  qdrantUrl: process.env.QDRANT_URL,
  collection: "qpack_site",
});

const qp = new QPack(ix.dim, bits, "cosine");
for (const v of ix.vectors) qp.add(v);
const packBytes = qp.toPack();

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "vectors.qpack"), packBytes);
writeFileSync(join(outDir, "payloads.json"), JSON.stringify(ix.docs));

// Optional: dump raw f32 vectors for offline recall measurement.
if (process.env.DUMP) {
  const flat = new Float32Array(ix.vectors.length * ix.dim);
  ix.vectors.forEach((v, i) => flat.set(v, i * ix.dim));
  writeFileSync(join(outDir, "raw.f32"), Buffer.from(flat.buffer));
}
writeFileSync(
  join(outDir, "manifest.json"),
  JSON.stringify(
    {
      name: "engine",
      model: "Xenova/all-MiniLM-L6-v2",
      dim: ix.dim,
      bits,
      distance: "cosine",
      count: ix.docs.length,
      files: { vectors: "vectors.qpack", payloads: "payloads.json" },
    },
    null,
    2,
  ),
);

const rawBytes = ix.vectors.length * ix.dim * 4;
console.log(`\nENGINE PACK BUILT (${bits}-bit)`);
console.log(`  ${qp.size} vectors · stride ${qp.stride}B`);
console.log(`  vectors.qpack ${(packBytes.length / 1024).toFixed(1)} KB`);
console.log(`  raw f32 would be ${(rawBytes / 1024).toFixed(1)} KB → ${(rawBytes / packBytes.length).toFixed(1)}x smaller`);
console.log(`  → ${outDir}`);
