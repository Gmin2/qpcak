import { QdrantClient } from "@qdrant/js-client-rest";
import type { QPackDoc, QPackHit } from "./types";

/** Create a Qdrant client for the given origin URL. */
export function makeClient(url: string, apiKey?: string): QdrantClient {
  return new QdrantClient({ url, apiKey });
}

/** Recreate the collection and upsert docs + vectors. Point id = array index. */
export async function upsertDocs(
  client: QdrantClient,
  collection: string,
  dim: number,
  docs: QPackDoc[],
  vectors: Float32Array[],
): Promise<void> {
  const { collections } = await client.getCollections();
  if (collections.some((c) => c.name === collection)) {
    await client.deleteCollection(collection);
  }
  await client.createCollection(collection, {
    vectors: { size: dim, distance: "Cosine" },
  });

  const BATCH = 256;
  for (let i = 0; i < docs.length; i += BATCH) {
    const points = [];
    for (let j = i; j < Math.min(i + BATCH, docs.length); j++) {
      points.push({ id: j, vector: Array.from(vectors[j]), payload: docs[j] });
    }
    await client.upsert(collection, { wait: true, points });
  }
}

/** Scroll the whole collection back out, ordered by id (the source of truth for the pack). */
export async function exportCollection(
  client: QdrantClient,
  collection: string,
): Promise<{ docs: QPackDoc[]; vectors: Float32Array[] }> {
  const rows: { id: number; payload: QPackDoc; vector: number[] }[] = [];
  let offset: string | number | undefined | null;
  for (;;) {
    const res = await client.scroll(collection, {
      limit: 256,
      offset: offset ?? undefined,
      with_payload: true,
      with_vector: true,
    });
    for (const p of res.points) {
      rows.push({
        id: Number(p.id),
        payload: p.payload as QPackDoc,
        vector: p.vector as number[],
      });
    }
    if (!res.next_page_offset) break;
    offset = res.next_page_offset as string | number;
  }
  rows.sort((a, b) => a.id - b.id);
  return {
    docs: rows.map((r) => r.payload),
    vectors: rows.map((r) => Float32Array.from(r.vector)),
  };
}

/** Live semantic search against Qdrant (origin / fallback retrieval). */
export async function searchQdrant(
  client: QdrantClient,
  collection: string,
  queryVec: Float32Array,
  limit = 5,
): Promise<QPackHit[]> {
  const res = await client.query(collection, {
    query: Array.from(queryVec),
    limit,
    with_payload: true,
  });
  return res.points.map((p) => ({ score: p.score, doc: p.payload as QPackDoc }));
}
