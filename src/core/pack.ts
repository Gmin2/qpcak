import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { QPackDoc, QPackManifest } from "./types";

/** Metadata needed to stamp a pack manifest. */
export interface PackMeta {
  name: string;
  version: string;
  model: string;
  dim: number;
}

/** Write an f32 pack: manifest.json, payloads.json, vectors.bin. Returns total bytes. */
export function writeF32Pack(
  outDir: string,
  meta: PackMeta,
  docs: QPackDoc[],
  vectors: Float32Array[],
): number {
  mkdirSync(outDir, { recursive: true });

  const flat = new Float32Array(docs.length * meta.dim);
  for (let i = 0; i < vectors.length; i++) flat.set(vectors[i], i * meta.dim);
  const vecBuf = Buffer.from(flat.buffer);
  writeFileSync(join(outDir, "vectors.bin"), vecBuf);

  const payloads = JSON.stringify(docs);
  writeFileSync(join(outDir, "payloads.json"), payloads);

  const manifest: QPackManifest = {
    name: meta.name,
    version: meta.version,
    model: meta.model,
    dim: meta.dim,
    count: docs.length,
    metric: "cosine",
    vectorFormat: "f32",
    files: { vectors: "vectors.bin", payloads: "payloads.json" },
  };
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  return vecBuf.length + Buffer.byteLength(payloads);
}
