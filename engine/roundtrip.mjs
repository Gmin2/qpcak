// Validate pack serialize/deserialize: build an index, toPack(), fromPack(),
// and confirm identical search results. Rebuild pkg-node first:
//   wasm-pack build --target nodejs --out-dir pkg-node --features wasm
//   node roundtrip.mjs
import { QPack } from "./pkg-node/qpack_engine.js";

const DIM = 384;
const COUNT = 300;

let s = 7n;
const M = (1n << 64n) - 1n;
const rnd = () => {
  s = (s * 6364136223846793005n + 1442695040888963407n) & M;
  return Number(s >> 33n) / 2 ** 31 - 1;
};
const unit = (dim) => {
  const v = Array.from({ length: dim }, rnd);
  const n = Math.hypot(...v);
  return Float32Array.from(v, (x) => x / n);
};

const vectors = Array.from({ length: COUNT }, () => unit(DIM));

const a = new QPack(DIM, 4, "cosine");
for (const v of vectors) a.add(v);

const packBytes = a.toPack();
console.log(`pack: ${packBytes.length} bytes for ${a.size} vectors (stride ${a.stride}B)`);

const b = QPack.fromPack(packBytes);
console.log(`reloaded: size=${b.size} stride=${b.stride}`);

// Identical search results from original vs reloaded.
let mismatches = 0;
for (let q = 0; q < 50; q++) {
  const query = unit(DIM);
  const ra = a.search(query, 10).indices;
  const rb = b.search(query, 10).indices;
  if (ra.length !== rb.length || !ra.every((x, i) => x === rb[i])) mismatches++;
}
console.log(mismatches === 0 ? "roundtrip OK — identical results" : `FAIL: ${mismatches} mismatches`);
if (mismatches > 0) process.exit(1);
