import type { QPackDoc, QPackManifest } from "./types";

/** A pack loaded into memory, ready for local search. */
export interface LoadedPack {
  manifest: QPackManifest;
  vectors: Float32Array;
  docs: QPackDoc[];
}

/** Fetch a pack (the directory containing manifest.json) over HTTP. */
export async function loadPack(packUrl: string): Promise<LoadedPack> {
  const base = packUrl.replace(/\/$/, "");

  const manifest = (await (await fetch(`${base}/manifest.json`)).json()) as QPackManifest;
  if (manifest.vectorFormat !== "f32") {
    throw new Error(`qpack: unsupported vectorFormat "${manifest.vectorFormat}"`);
  }

  const vecBuf = await (await fetch(`${base}/${manifest.files.vectors}`)).arrayBuffer();
  const vectors = new Float32Array(vecBuf);
  if (vectors.length !== manifest.count * manifest.dim) {
    throw new Error(
      `qpack: vectors length ${vectors.length} != count*dim ${manifest.count * manifest.dim}`,
    );
  }

  const docs = (await (await fetch(`${base}/${manifest.files.payloads}`)).json()) as QPackDoc[];
  return { manifest, vectors, docs };
}
