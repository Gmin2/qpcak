import { readFile } from "node:fs/promises";
import { embed } from "../src/core/embed";
import { topK } from "../src/core/search";
import { initWasm, putF32, type QPackWasmExports } from "../src/core/wasm";
import { loadPackDisk } from "./_loadDisk";

/** Step 7b: validate the wasm f32 kernel matches the JS f32 store exactly. */
const dir = process.env.PACK ?? "examples/demo/public/packs/site-f32";
const { manifest, store, docs } = loadPackDisk(dir);
if (manifest.vectorFormat !== "f32") throw new Error("use the f32 pack for 7b");

const wasmBytes = await readFile("wasm/target/wasm32-unknown-unknown/release/qpack_wasm.wasm");
const w = await initWasm(wasmBytes);

// Load all vectors into wasm memory once.
const flat = (store as unknown as { raw: Float32Array }).raw;
const vPtr = putF32(w, flat);

function wasmTopK(w: QPackWasmExports, q: Float32Array, limit: number) {
  const qPtr = putF32(w, q);
  const outPtr = w.alloc(manifest.count * 4);
  w.score_f32_batch(vPtr, qPtr, manifest.dim, manifest.count, outPtr);
  const scores = new Float32Array(w.memory.buffer, outPtr, manifest.count);
  const idx = Array.from(scores.keys()).sort((a, b) => scores[b] - scores[a]).slice(0, limit);
  return idx.map((i) => docs[i].id);
}

const queries = [
  "how does binary quantization work",
  "combine dense and sparse vectors in hybrid search",
  "multitenancy with payload filtering",
  "late interaction ColBERT reranking",
];
const qvecs = await embed(queries, manifest.model);

let mismatches = 0;
qvecs.forEach((qv, i) => {
  const js = topK(store, docs, qv, { limit: 5 }).map((h) => h.doc.id);
  const wasm = wasmTopK(w, qv, 5);
  const same = js.length === wasm.length && js.every((id, k) => id === wasm[k]);
  if (!same) mismatches++;
  console.log(`Q: ${queries[i]}`);
  console.log(`   js  : ${js.join(", ")}`);
  console.log(`   wasm: ${wasm.join(", ")}  ${same ? "OK" : "MISMATCH"}\n`);
});

console.log(mismatches === 0 ? "7b OK — wasm matches js" : `7b FAILED — ${mismatches} mismatches`);
if (mismatches > 0) process.exit(1);
