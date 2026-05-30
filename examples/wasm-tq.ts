import { readFile } from "node:fs/promises";
import { embed } from "../src/core/embed";
import type { TQInternals } from "../src/core/store";
import { initWasm, putF32, putU8, type QPackWasmExports } from "../src/core/wasm";
import { loadPackDisk } from "./_loadDisk";

/** Step 7c: validate the wasm TurboQuant kernel matches JS, then benchmark. */
const dir = process.env.PACK ?? "examples/demo/public/packs/site-tq4";
const { manifest, store, docs } = loadPackDisk(dir);
if (!manifest.vectorFormat.startsWith("tq")) throw new Error("use a tq pack for 7c");

const tq = (store as unknown as { internals: TQInternals }).internals;
const w = (await initWasm(
  await readFile("wasm/target/wasm32-unknown-unknown/release/qpack_wasm.wasm"),
)) as QPackWasmExports;
const count = manifest.count;

// Load pack buffers into wasm memory once; reuse query/out buffers across calls.
const packedPtr = putU8(w, tq.packed);
const codebookPtr = putF32(w, tq.codebook);
const alphaPtr = putF32(w, tq.alpha);
const rotqPtr = w.alloc(tq.pdim * 4);
const outPtr = w.alloc(count * 4);

/** top-k indices from a scores array (same selection for js and wasm). */
function topkIdx(scores: Float32Array, limit: number): number[] {
  return Array.from(scores.keys()).sort((a, b) => scores[b] - scores[a]).slice(0, limit);
}

/** JS scoring into a scores array. */
function jsScores(rotq: Float32Array): Float32Array {
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = store.score(rotq, i);
  return out;
}

/** wasm scoring into a scores array (one batch call). */
function wasmScores(rotq: Float32Array): Float32Array {
  new Float32Array(w.memory.buffer, rotqPtr, tq.pdim).set(rotq);
  w.score_tq_batch(packedPtr, rotqPtr, codebookPtr, alphaPtr, tq.bits, tq.pdim, count, outPtr);
  return new Float32Array(w.memory.buffer, outPtr, count).slice();
}

const queries = [
  "how does binary quantization work",
  "combine dense and sparse vectors in hybrid search",
  "multitenancy with payload filtering",
  "late interaction ColBERT reranking",
  "reduce memory usage at scale",
];
const rotqs = (await embed(queries, manifest.model)).map((qv) => store.prepareQuery!(qv));

console.log(`pack ${manifest.vectorFormat} · ${count} vecs · ${tq.bits}-bit · pdim ${tq.pdim}\n`);

let mismatches = 0;
rotqs.forEach((rotq, i) => {
  const js = topkIdx(jsScores(rotq), 5).map((k) => docs[k].id);
  const wasm = topkIdx(wasmScores(rotq), 5).map((k) => docs[k].id);
  const same = js.every((id, k) => id === wasm[k]);
  if (!same) {
    mismatches++;
    console.log(`Q: ${queries[i]}  MISMATCH`);
    console.log(`   js  : ${js.join(", ")}`);
    console.log(`   wasm: ${wasm.join(", ")}`);
  } else {
    console.log(`Q: ${queries[i]}  OK`);
  }
});
console.log(mismatches === 0 ? "\nparity OK — wasm matches js" : `\nFAILED — ${mismatches} mismatches`);

// Benchmark just the scoring kernel (no top-k selection).
const REPS = 300;
let t0 = performance.now();
for (let r = 0; r < REPS; r++) for (const rotq of rotqs) jsScores(rotq);
const jsMs = performance.now() - t0;

t0 = performance.now();
for (let r = 0; r < REPS; r++) for (const rotq of rotqs) wasmScores(rotq);
const wasmMs = performance.now() - t0;

const n = REPS * rotqs.length;
console.log(`\nscoring benchmark (${n} scans over ${count} vecs):`);
console.log(`  js   ${jsMs.toFixed(0)} ms  (${((jsMs / n) * 1000).toFixed(1)} µs/scan)`);
console.log(`  wasm ${wasmMs.toFixed(0)} ms  (${((wasmMs / n) * 1000).toFixed(1)} µs/scan)`);
console.log(`  speedup ${(jsMs / wasmMs).toFixed(2)}x`);
if (mismatches > 0) process.exit(1);
