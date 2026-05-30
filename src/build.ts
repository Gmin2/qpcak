import { basename } from "node:path";
import { DEFAULT_MODEL, DIM, embed } from "./core/embed";
import { writePack } from "./core/pack";
import { exportCollection, makeClient, upsertDocs } from "./core/qdrant";
import { loadSource } from "./core/source";
import { chunkText, cleanMarkdown, deriveTitle } from "./core/text";
import type { BuildOptions, BuildResult, QPackDoc } from "./core/types";

export type * from "./core/types";

const EMBED_BATCH = 64;

/** Options for indexing content (everything except how/where to write the pack). */
export type IndexOptions = Pick<BuildOptions, "source" | "model" | "qdrantUrl" | "collection" | "name">;

/** The indexed corpus: docs + vectors, sourced through Qdrant when configured. */
export interface Indexed {
  name: string;
  model: string;
  dim: number;
  docs: QPackDoc[];
  vectors: Float32Array[];
}

/** Chunk, embed, and (optionally) round-trip content through a Qdrant origin. */
export async function indexContent(opts: IndexOptions): Promise<Indexed> {
  const model = opts.model ?? DEFAULT_MODEL;
  const name = opts.name ?? "pack";

  const files = loadSource(opts.source);
  const docs: QPackDoc[] = [];
  for (const file of files) {
    const title = deriveTitle(file.text, file.rel);
    const body = cleanMarkdown(file.text);
    chunkText(body).forEach((text, i) => {
      docs.push({ id: `${file.rel}#${i}`, text, title, source: file.rel, chunk: i });
    });
  }
  if (docs.length === 0) throw new Error(`qpack: no content found in ${opts.source}`);

  const vectors: Float32Array[] = [];
  for (let i = 0; i < docs.length; i += EMBED_BATCH) {
    const batch = docs.slice(i, i + EMBED_BATCH).map((d) => d.text);
    vectors.push(...(await embed(batch, model)));
    console.log(`  embedded ${Math.min(i + EMBED_BATCH, docs.length)}/${docs.length}`);
  }

  if (opts.qdrantUrl) {
    const collection = opts.collection ?? name;
    const client = makeClient(opts.qdrantUrl, process.env.QDRANT_API_KEY);
    console.log(`  upserting ${docs.length} points → Qdrant "${collection}"`);
    await upsertDocs(client, collection, DIM, docs, vectors);
    const exported = await exportCollection(client, collection);
    console.log(`  exported ${exported.docs.length} points ← Qdrant`);
    return { name, model, dim: DIM, docs: exported.docs, vectors: exported.vectors };
  }

  return { name, model, dim: DIM, docs, vectors };
}

/** Index content into a static pack (manifest + payloads + vectors). */
export async function buildPack(opts: BuildOptions): Promise<BuildResult> {
  const name = opts.name ?? basename(opts.out);
  const ix = await indexContent({ ...opts, name });
  const format = opts.compress ?? "f32";
  const { bytes } = writePack(
    opts.out,
    { name, version: "v1", model: ix.model, dim: ix.dim },
    ix.docs,
    ix.vectors,
    format,
  );
  return { name, out: opts.out, count: ix.docs.length, dim: ix.dim, bytes, vectorFormat: format };
}
