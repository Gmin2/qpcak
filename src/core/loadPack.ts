import { makeStore, type VectorStore } from "./store";
import type { QPackDoc, QPackManifest } from "./types";

/** A pack loaded into memory, ready for local search. */
export interface LoadedPack {
  manifest: QPackManifest;
  store: VectorStore;
  docs: QPackDoc[];
}

/** Fetch a pack (the directory containing manifest.json) over HTTP. */
export async function loadPack(packUrl: string): Promise<LoadedPack> {
  const base = packUrl.replace(/\/$/, "");
  const manifest = (await (await fetch(`${base}/manifest.json`)).json()) as QPackManifest;

  // Load every binary file referenced by the manifest (except payloads JSON).
  const buffers: Record<string, ArrayBuffer> = {};
  for (const [key, filename] of Object.entries(manifest.files)) {
    if (key === "payloads") continue;
    buffers[filename] = await (await fetch(`${base}/${filename}`)).arrayBuffer();
  }

  const docs = (await (await fetch(`${base}/${manifest.files.payloads}`)).json()) as QPackDoc[];
  if (docs.length !== manifest.count) {
    throw new Error(`qpack: payloads ${docs.length} != count ${manifest.count}`);
  }

  return { manifest, store: makeStore(manifest, buffers), docs };
}
