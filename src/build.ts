import { basename } from "node:path";
import { DEFAULT_MODEL, DIM, embed } from "./core/embed";
import { writePack } from "./core/pack";
import { exportCollection, makeClient, upsertDocs } from "./core/qdrant";
import { loadSource } from "./core/source";
import { chunkText, cleanMarkdown, deriveTitle } from "./core/text";
import type { BuildOptions, BuildResult, QPackDoc } from "./core/types";

export type * from "./core/types";

const EMBED_BATCH = 64;

/** Index content into a static pack (manifest + payloads + vectors). */
export async function buildPack(opts: BuildOptions): Promise<BuildResult> {
  const model = opts.model ?? DEFAULT_MODEL;
  const name = opts.name ?? basename(opts.out);

  const files = loadSource(opts.source);
  const docs: QPackDoc[] = [];
  for (const file of files) {
    const title = deriveTitle(file.text, file.rel);
    const body = cleanMarkdown(file.text);
    chunkText(body).forEach((text, i) => {
      docs.push({ id: `${file.rel}#${i}`, text, title, source: file.rel, chunk: i });
    });
  }
  if (docs.length === 0) throw new Error(`qpack/build: no content found in ${opts.source}`);

  const vectors: Float32Array[] = [];
  for (let i = 0; i < docs.length; i += EMBED_BATCH) {
    const batch = docs.slice(i, i + EMBED_BATCH).map((d) => d.text);
    vectors.push(...(await embed(batch, model)));
    console.log(`  embedded ${Math.min(i + EMBED_BATCH, docs.length)}/${docs.length}`);
  }

  // Qdrant is the source of truth: upsert, then export the pack back out of it.
  let packDocs = docs;
  let packVectors = vectors;
  if (opts.qdrantUrl) {
    const collection = opts.collection ?? name;
    const client = makeClient(opts.qdrantUrl, process.env.QDRANT_API_KEY);
    console.log(`  upserting ${docs.length} points → Qdrant "${collection}"`);
    await upsertDocs(client, collection, DIM, docs, vectors);
    const exported = await exportCollection(client, collection);
    packDocs = exported.docs;
    packVectors = exported.vectors;
    console.log(`  exported ${packDocs.length} points ← Qdrant`);
  }

  const format = opts.compress ?? "f32";
  const { bytes } = writePack(
    opts.out,
    { name, version: "v1", model, dim: DIM },
    packDocs,
    packVectors,
    format,
  );
  return { name, out: opts.out, count: packDocs.length, dim: DIM, bytes, vectorFormat: format };
}
