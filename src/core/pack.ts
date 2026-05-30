import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { encode, flatten } from "./quantize";
import type { QPackDoc, QPackManifest, VectorFormat } from "./types";

/** Metadata needed to stamp a pack manifest. */
export interface PackMeta {
  name: string;
  version: string;
  model: string;
  dim: number;
}

/** Result of writing a pack. */
export interface WriteResult {
  /** total bytes (vectors + payloads) */
  bytes: number;
  /** vector bytes only */
  vectorBytes: number;
}

/** Write a pack in the given format: manifest.json, payloads.json, vector blobs. */
export function writePack(
  outDir: string,
  meta: PackMeta,
  docs: QPackDoc[],
  vectors: Float32Array[],
  format: VectorFormat,
): WriteResult {
  mkdirSync(outDir, { recursive: true });

  const flat = flatten(vectors, meta.dim);
  const enc = encode(format, flat, docs.length, meta.dim);
  for (const [filename, bytes] of Object.entries(enc.blobs)) {
    writeFileSync(join(outDir, filename), bytes);
  }

  const payloads = JSON.stringify(docs);
  writeFileSync(join(outDir, "payloads.json"), payloads);

  const manifest: QPackManifest = {
    name: meta.name,
    version: meta.version,
    model: meta.model,
    dim: meta.dim,
    count: docs.length,
    metric: "cosine",
    vectorFormat: format,
    files: { ...enc.files, payloads: "payloads.json" },
    params: enc.params,
  };
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  return { bytes: enc.bytes + Buffer.byteLength(payloads), vectorBytes: enc.bytes };
}
