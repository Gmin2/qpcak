import { composeAnswer } from "../src/core/answer";
import { embedOne } from "../src/core/embed";
import { topK } from "../src/core/search";
import { loadPackDisk } from "./_loadDisk";

/** Load a pack, retrieve, and compose a cited answer. */
const dir = process.argv[2] ?? "examples/demo/public/packs/site";
const { manifest, store, docs } = loadPackDisk(dir);

const queries = [
  "I forgot my password, how do I get back in?",
  "which identity providers do you support for SSO?",
  "can I get a refund and how long does it take?",
];

for (const q of queries) {
  const qv = await embedOne(q, manifest.model);
  const hits = topK(store, docs, qv, { limit: 4 });
  const { answer, sources } = composeAnswer(q, hits);
  console.log(`Q: ${q}`);
  console.log(`A: ${answer}`);
  console.log(`   sources: ${sources.map((h) => h.doc.source).join(", ")}\n`);
}
