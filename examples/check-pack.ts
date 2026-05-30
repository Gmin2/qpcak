import { embedOne } from "../src/core/embed";
import { topK } from "../src/core/search";
import { loadPackDisk } from "./_loadDisk";

/** Load a pack from disk and run search for a few queries. */
const dir = process.argv[2] ?? "examples/demo/public/packs/site";
const { manifest, store, docs } = loadPackDisk(dir);

console.log(`pack: ${manifest.count} x ${manifest.dim} (${manifest.vectorFormat}) · model ${manifest.model}`);
console.log("loaded OK\n");

const queries = [
  "how do I reset my forgotten password",
  "set up SAML single sign-on with Okta",
  "what is your refund policy",
  "create an api key",
];

for (const q of queries) {
  const qv = await embedOne(q, manifest.model);
  const [best] = topK(store, docs, qv, { limit: 1 });
  console.log(`Q: ${q}`);
  console.log(`   → ${best.score.toFixed(3)}  ${best.doc.title}  (${best.doc.source})\n`);
}
