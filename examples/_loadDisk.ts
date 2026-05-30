import { readFileSync } from "node:fs";
import { join } from "node:path";
import { makeStore, type VectorStore } from "../src/core/store";
import type { QPackDoc, QPackManifest } from "../src/core/types";

/** Load a pack from a local directory (node-side equivalent of loadPack). */
export function loadPackDisk(dir: string): {
  manifest: QPackManifest;
  store: VectorStore;
  docs: QPackDoc[];
} {
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as QPackManifest;
  const buffers: Record<string, ArrayBuffer> = {};
  for (const [key, filename] of Object.entries(manifest.files)) {
    if (key === "payloads") continue;
    const b = readFileSync(join(dir, filename));
    buffers[filename] = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  }
  const docs = JSON.parse(readFileSync(join(dir, manifest.files.payloads), "utf8")) as QPackDoc[];
  return { manifest, store: makeStore(manifest, buffers), docs };
}
