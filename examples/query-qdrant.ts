import { embedOne } from "../src/core/embed";
import { makeClient, searchQdrant } from "../src/core/qdrant";

/** Validate live Qdrant retrieval (the origin / fallback path). */
const url = process.env.QDRANT_URL ?? "http://localhost:6333";
const collection = "qpack_site";
const client = makeClient(url);

const info = await client.getCollection(collection);
console.log(`Qdrant "${collection}": ${info.points_count} points\n`);

const queries = [
  "how do I reset my forgotten password",
  "set up SAML single sign-on with Okta",
  "what is your refund policy",
];

for (const q of queries) {
  const qv = await embedOne(q);
  const hits = await searchQdrant(client, collection, qv, 1);
  console.log(`Q: ${q}`);
  console.log(`   → ${hits[0].score.toFixed(3)}  ${hits[0].doc.title}  (${hits[0].doc.source})\n`);
}
