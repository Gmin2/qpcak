// Compare scalar vs SIMD wasm builds: identical results + speedup.
// Build both first:
//   cd engine
//   wasm-pack build --target nodejs --out-dir pkg-node --features wasm
//   RUSTFLAGS="-C target-feature=+simd128" wasm-pack build --target nodejs --out-dir pkg-node-simd --features wasm
//   cd .. && node examples/bench-simd.mjs
import { readFileSync } from "node:fs";
import { QPack as Scalar } from "../engine/pkg-node/qpack_engine.js";
import { QPack as Simd } from "../engine/pkg-node-simd/qpack_engine.js";

const dir = "examples/demo/public/packs/engine";
const manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, "utf8"));
const { dim, count } = manifest;
const packBytes = new Uint8Array(readFileSync(`${dir}/${manifest.files.vectors}`));
const raw = new Float32Array(readFileSync(`${dir}/raw.f32`).buffer);

const scalar = Scalar.fromPack(packBytes);
const simd = Simd.fromPack(packBytes);

// Queries = stored vectors (real near-neighbors).
const queries = Array.from({ length: 100 }, (_, i) => raw.subarray(((i * 7) % count) * dim, ((i * 7) % count) * dim + dim));

// Correctness: SIMD top-10 must match scalar top-10.
let mismatches = 0;
for (const q of queries) {
  const a = scalar.search(q, 10).indices;
  const b = simd.search(q, 10).indices;
  if (!a.every((x, i) => x === b[i])) mismatches++;
}
console.log(mismatches === 0 ? "results identical (scalar == simd)" : `WARN: ${mismatches} top-10 differ`);

const bench = (qp, reps) => {
  const t0 = performance.now();
  for (let r = 0; r < reps; r++) for (const q of queries) qp.search(q, 10);
  return performance.now() - t0;
};

const REPS = 20;
scalar.search(queries[0], 10); // warm
simd.search(queries[0], 10);
const sMs = bench(scalar, REPS);
const dMs = bench(simd, REPS);
const n = REPS * queries.length;
console.log(`searches: ${n} over ${count} vecs (${dim}-dim, ${scalar.stride}B/vec)`);
console.log(`  scalar  ${sMs.toFixed(0)} ms  (${(sMs / n).toFixed(3)} ms/search)`);
console.log(`  simd128 ${dMs.toFixed(0)} ms  (${(dMs / n).toFixed(3)} ms/search)`);
console.log(`  speedup ${(sMs / dMs).toFixed(2)}x`);
