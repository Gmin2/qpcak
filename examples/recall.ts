import { statSync } from "node:fs";
import { join } from "node:path";
import { embed } from "../src/core/embed";
import { topK } from "../src/core/search";
import type { VectorFormat } from "../src/core/types";
import { loadPackDisk } from "./_loadDisk";

/**
 * Measure recall@k of each compressed format against the f32 pack (ground truth).
 * recall@k = fraction of the f32 top-k that the compressed format also returns.
 */
const K = Number(process.env.K ?? 10);
const base = "examples/demo/public/packs";
const formats: VectorFormat[] = ["f32", "int8", "tq4", "tq2", "tq1"];

// On-topic queries for the Qdrant docs/articles corpus (the meaningful test set).
const queries = [
  "how does binary quantization work",
  "what is scalar quantization",
  "combine dense and sparse vectors in hybrid search",
  "HNSW index parameters and tuning",
  "multitenancy with payload filtering",
  "reduce memory usage at scale",
  "late interaction ColBERT reranking",
  "recommendation api positive and negative examples",
  "how to create a snapshot and restore",
  "filtering by geo location",
];

function dirBytes(dir: string, manifest: { files: Record<string, string> }): number {
  let total = 0;
  for (const [key, fn] of Object.entries(manifest.files)) {
    if (key === "payloads") continue;
    total += statSync(join(dir, fn)).size;
  }
  return total;
}

const f32Dir = join(base, "site-f32");
const f32 = loadPackDisk(f32Dir);
const k = Math.min(K, f32.manifest.count);

const qvecs = await embed(queries, f32.manifest.model);
const truth = qvecs.map((qv) => topK(f32.store, f32.docs, qv, { limit: k }).map((h) => h.doc.id));

console.log(`recall@${k} vs f32 ground truth · ${f32.manifest.count} vectors\n`);
console.log("format  vec bytes   ratio   recall");
for (const format of formats) {
  const dir = join(base, `site-${format}`);
  const pack = loadPackDisk(dir);
  const vbytes = dirBytes(dir, pack.manifest);
  const f32bytes = dirBytes(f32Dir, f32.manifest);

  let hit = 0;
  let total = 0;
  qvecs.forEach((qv, i) => {
    const got = new Set(topK(pack.store, pack.docs, qv, { limit: k }).map((h) => h.doc.id));
    for (const id of truth[i]) if (got.has(id)) hit++;
    total += truth[i].length;
  });

  const ratio = (f32bytes / vbytes).toFixed(1);
  const recall = ((hit / total) * 100).toFixed(1);
  console.log(`${format.padEnd(7)} ${String(vbytes).padStart(8)}  ${ratio.padStart(5)}x  ${recall.padStart(5)}%`);
}
