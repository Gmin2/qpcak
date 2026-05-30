import { readFileSync } from "node:fs";
import { join } from "node:path";
import { embedOne } from "../src/core/embed";
import type { QPackDoc, QPackManifest } from "../src/core/types";

/** Step 1 validation: load the pack and run cosine search for a few queries. */
const dir = process.argv[2] ?? "packs/site";

const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as QPackManifest;
const docs = JSON.parse(readFileSync(join(dir, "payloads.json"), "utf8")) as QPackDoc[];
const buf = readFileSync(join(dir, "vectors.bin"));
const vectors = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);

console.log(`pack: ${manifest.count} x ${manifest.dim} (${manifest.vectorFormat}) · model ${manifest.model}`);
if (docs.length !== manifest.count) throw new Error(`payloads ${docs.length} != count ${manifest.count}`);
if (vectors.length !== manifest.count * manifest.dim) throw new Error("vectors length mismatch");
console.log("integrity OK\n");

const queries = [
  "how do I reset my forgotten password",
  "set up SAML single sign-on with Okta",
  "what is your refund policy",
  "create an api key",
];

for (const q of queries) {
  const qv = await embedOne(q, manifest.model);
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < manifest.count; i++) {
    let s = 0;
    const off = i * manifest.dim;
    for (let d = 0; d < manifest.dim; d++) s += vectors[off + d] * qv[d];
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  }
  console.log(`Q: ${q}`);
  console.log(`   → ${bestScore.toFixed(3)}  ${docs[best].title}  (${docs[best].source})\n`);
}
