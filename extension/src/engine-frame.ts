/**
 * Runs inside the extension's own iframe (extension origin → our CSP and wasm
 * work). Loads the TurboQuant engine + a local embedder, and answers questions
 * by retrieval only: it returns the most relevant passage as a concise answer
 * plus clickable sources. No LLM — accurate, instant, fully offline.
 */
import { pipeline, env } from "@huggingface/transformers";
import initWasm, { QPack } from "../../engine/pkg/qpack_engine.js";

env.allowLocalModels = false;
// MV3 forbids loading remote scripts, so point onnxruntime-web at the wasm
// bundled inside the extension instead of its default jsDelivr CDN. Single
// thread + no proxy avoids the cross-origin-isolation requirement.
const ortWasm = env.backends.onnx.wasm!;
ortWasm.wasmPaths = chrome.runtime.getURL("ort/");
ortWasm.numThreads = 1;
ortWasm.proxy = false;

const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";
const PACK_DIR = chrome.runtime.getURL("packs/qdrant");

interface Doc {
  title?: string;
  text: string;
  source?: string;
  url?: string;
}

type Embedder = (t: string, o: object) => Promise<{ data: Float32Array }>;

let qp: QPack;
let docs: Doc[];
let embedder: Embedder | null = null;

const post = (msg: object) => parent.postMessage({ __qpack: true, ...msg }, "*");

async function embed(text: string): Promise<Float32Array> {
  if (!embedder) {
    // Pin dtype fp32 so browser query vectors match the fp32 doc vectors the
    // pack was built with — otherwise quantization differs and recall breaks.
    embedder = (await pipeline("feature-extraction", EMBED_MODEL, {
      dtype: "fp32",
    })) as unknown as Embedder;
  }
  const out = await embedder(text, { pooling: "mean", normalize: true });
  return new Float32Array(out.data);
}

async function init() {
  await initWasm(chrome.runtime.getURL("assets/qpack_engine_bg.wasm"));
  const packBytes = new Uint8Array(await (await fetch(`${PACK_DIR}/vectors.qpack`)).arrayBuffer());
  docs = await (await fetch(`${PACK_DIR}/payloads.json`)).json();
  qp = QPack.fromPack(packBytes);
  post({ type: "ready", count: qp.size });
}

/** Split text into clean sentences. */
function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);
}

/** Lowercase content words (length > 3) for lexical overlap scoring. */
function terms(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 3);
}

/**
 * Compose a concise extractive answer: from the top hits, pick the 1–2
 * sentences that best overlap the question. Deterministic, accurate, offline.
 */
function composeAnswer(question: string, hits: Doc[]): string {
  const qTerms = new Set(terms(question));
  const scored: { score: number; order: number; text: string }[] = [];
  hits.slice(0, 3).forEach((hit, hi) => {
    sentences(hit.text).forEach((sentence, si) => {
      let overlap = 0;
      for (const t of terms(sentence)) if (qTerms.has(t)) overlap++;
      scored.push({ score: overlap + (3 - hi) * 0.01, order: hi * 100 + si, text: sentence });
    });
  });
  const picked = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .sort((a, b) => a.order - b.order)
    .map((s) => s.text);
  if (picked.length) return picked.join(" ");
  // Fallback: lead sentences of the closest hit.
  return sentences(hits[0]?.text ?? "").slice(0, 2).join(" ") || "No relevant passage found.";
}

async function answer(id: number, question: string) {
  // 1. Retrieve with the wasm TurboQuant engine.
  const qvec = await embed(question);
  const res = qp.search(qvec, 5);
  const hits = Array.from(res.indices).map((i) => docs[i]);

  // Dedupe sources by title (or source file), carrying the clickable URL.
  const seen = new Set<string>();
  const sources: { label: string; url?: string }[] = [];
  for (const d of hits) {
    const label = d.title || d.source || "source";
    if (seen.has(label)) continue;
    seen.add(label);
    sources.push({ label, url: d.url });
  }

  // Extractive one-liner answer from the closest passages (no LLM).
  post({ type: "token", id, text: composeAnswer(question, hits) });
  post({ type: "done", id, sources });
}

window.addEventListener("message", (e) => {
  const m = e.data;
  if (m?.type === "ask") answer(m.id, m.question).catch((err) => post({ type: "error", id: m.id, text: String(err?.message ?? err) }));
});

init().catch((err) => post({ type: "error", id: -1, text: String(err?.message ?? err) }));
