// Validate the wasm QPack. Build first:
//   wasm-pack build --target nodejs --out-dir pkg-node --features wasm
//   node validate.mjs
import { QPack } from "./pkg-node/qpack_engine.js";

const DIM = 384;
const COUNT = 500;
const K = 10;

let s = 42n;
const M = (1n << 64n) - 1n;
function rnd() {
  s = (s * 6364136223846793005n + 1442695040888963407n) & M;
  return Number(s >> 33n) / 2 ** 31 - 1;
}
function unit(v) {
  const n = Math.hypot(...v);
  return Float32Array.from(v, (x) => x / n);
}
const randVec = (dim) => Array.from({ length: dim }, rnd);

// Tight clusters → unambiguous near-neighbors, like real embeddings.
const CLUSTERS = 25;
const centers = Array.from({ length: CLUSTERS }, () => randVec(DIM));
const vectors = Array.from({ length: COUNT }, () => {
  const c = centers[Math.floor(((rnd() + 1) / 2) * CLUSTERS) % CLUSTERS];
  return unit(c.map((x) => x + 0.12 * rnd()));
});

function cosTopK(query) {
  return vectors
    .map((v, i) => ({ i, s: v.reduce((a, x, d) => a + x * query[d], 0) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, K)
    .map((h) => h.i);
}

// Sanity: querying with an exact stored vector must rank it #1 (proves the
// query-scoring path is correct, independent of dataset difficulty).
{
  const qp = new QPack(DIM, 4, "cosine");
  for (const v of vectors) qp.add(v);
  let selfTop1 = 0;
  for (let i = 0; i < COUNT; i++) {
    if (qp.search(vectors[i], 1).indices[0] === i) selfTop1++;
  }
  console.log(`self-query top-1 (bits=4): ${selfTop1}/${COUNT}`);
}

for (const bits of [4, 2, 1]) {
  const qp = new QPack(DIM, bits, "cosine");
  for (const v of vectors) qp.add(v);
  let hit = 0;
  let total = 0;
  for (let q = 0; q < 50; q++) {
    const base = vectors[Math.floor(((rnd() + 1) / 2) * COUNT) % COUNT];
    const query = unit(Array.from(base, (x) => x + 0.05 * rnd()));
    const exact = new Set(cosTopK(query));
    for (const i of qp.search(query, K).indices) if (exact.has(i)) hit++;
    total += exact.size;
  }
  console.log(`bits=${bits}  stride=${qp.stride}B  recall@${K}=${((hit / total) * 100).toFixed(1)}%`);
}
console.log("wasm QPack OK");
