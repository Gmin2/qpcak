// Real-data recall of the wasm engine pack vs exact f32 cosine ground truth.
// Reads the embeddings the builder produced. Run after build-engine-pack with
// DUMP=1 to also write raw vectors:
//   node examples/recall-engine.mjs
import { readFileSync } from "node:fs";
import { QPack } from "../engine/pkg-node/qpack_engine.js";

const dir = process.env.DIR ?? "examples/demo/public/packs/engine";
const vecPath = process.env.VECS ?? `${dir}/raw.f32`;

const manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, "utf8"));
const { dim, count } = manifest;
const raw = new Float32Array(readFileSync(vecPath).buffer);
const vectors = Array.from({ length: count }, (_, i) => raw.subarray(i * dim, i * dim + dim));

const packBytes = new Uint8Array(readFileSync(`${dir}/${manifest.files.vectors}`));
const qp = QPack.fromPack(packBytes);

const K = 10;
function exactTopK(q) {
  return vectors
    .map((v, i) => {
      let s = 0;
      for (let d = 0; d < dim; d++) s += v[d] * q[d];
      return { i, s };
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, K)
    .map((h) => h.i);
}

// Use stored vectors (slightly perturbed) as queries — real near-neighbors exist.
let hit = 0;
let total = 0;
const N = Math.min(80, count);
for (let q = 0; q < N; q++) {
  const base = vectors[(q * 7) % count];
  const query = Float32Array.from(base);
  const exact = new Set(exactTopK(query));
  for (const i of qp.search(query, K).indices) if (exact.has(i)) hit++;
  total += exact.size;
}
console.log(`engine pack ${manifest.bits}-bit · ${count} vecs · stride ${qp.stride}B`);
console.log(`recall@${K} vs exact cosine: ${((hit / total) * 100).toFixed(1)}%`);
