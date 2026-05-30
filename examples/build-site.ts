import { buildPack } from "../src/build";

/** Build an f32 pack from the sample help-center content. */
/** Set QDRANT_URL to route through a Qdrant origin; otherwise builds directly. */
const result = await buildPack({
  source: "examples/content",
  out: "examples/demo/public/packs/site",
  name: "site",
  qdrantUrl: process.env.QDRANT_URL,
  collection: "qpack_site",
});

console.log("\nPACK BUILT");
console.log(`  ${result.count} chunks · dim ${result.dim} · ${result.vectorFormat}`);
console.log(`  ${(result.bytes / 1024).toFixed(1)} KB → ${result.out}`);
console.log(`  origin: ${process.env.QDRANT_URL ?? "(none — direct build)"}`);
