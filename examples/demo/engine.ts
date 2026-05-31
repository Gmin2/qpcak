import initWasm, { QPack } from "../../engine/pkg/qpack_engine.js";
import { embedOne as embedQuery } from "../../src/core/embed";

/** Browser demo running entirely on the wasm TurboQuant engine. */

interface Manifest {
  model: string;
  dim: number;
  bits: number;
  distance: string;
  count: number;
  files: { vectors: string; payloads: string };
}

interface Doc {
  title?: string;
  text: string;
  source?: string;
}

const PACK_DIR = "/packs/engine";

const statusEl = document.querySelector<HTMLDivElement>("#status")!;
const resultsEl = document.querySelector<HTMLDivElement>("#results")!;
const metaEl = document.querySelector<HTMLDivElement>("#meta")!;
const input = document.querySelector<HTMLInputElement>("#q")!;
const goBtn = document.querySelector<HTMLButtonElement>("#go")!;

let qp: QPack;
let docs: Doc[];

const setStatus = (t: string) => (statusEl.textContent = t);
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);

async function runSearch() {
  const query = input.value.trim();
  if (!query || !qp) return;
  goBtn.disabled = true;
  setStatus("embedding locally…");
  try {
    const qvec = await embedQuery(query);
    const t0 = performance.now();
    const res = qp.search(qvec, 5);
    const ms = (performance.now() - t0).toFixed(1);
    const hits = Array.from(res.indices).map((i, k) => ({ doc: docs[i], score: res.scores[k] }));
    resultsEl.innerHTML = hits
      .map(
        (h) => `<div class="hit">
          <div class="hit-top"><span class="title">${esc(h.doc.title ?? "")}</span><span class="score">${h.score.toFixed(3)}</span></div>
          <div class="snippet">${esc(h.doc.text.slice(0, 220))}…</div>
          <div class="src">${esc(h.doc.source ?? "")}</div>
        </div>`,
      )
      .join("");
    setStatus(`searched ${qp.size} vectors in wasm in ${ms} ms · 0 backend calls`);
  } catch (e) {
    setStatus("error: " + (e as Error).message);
  } finally {
    goBtn.disabled = false;
  }
}

async function init() {
  setStatus("loading wasm engine…");
  await initWasm();
  const manifest = (await (await fetch(`${PACK_DIR}/manifest.json`)).json()) as Manifest;
  const packBytes = new Uint8Array(await (await fetch(`${PACK_DIR}/${manifest.files.vectors}`)).arrayBuffer());
  docs = (await (await fetch(`${PACK_DIR}/${manifest.files.payloads}`)).json()) as Doc[];

  qp = QPack.fromPack(packBytes);
  metaEl.textContent = `${qp.size} vectors · ${manifest.bits}-bit TurboQuant · ${qp.stride}B/vec · wasm`;
  setStatus("warming embedding model…");
  await embedQuery("warmup");
  setStatus("ready — TurboQuant search runs in WebAssembly, no backend");
  goBtn.disabled = false;
}

goBtn.addEventListener("click", runSearch);
input.addEventListener("keydown", (e) => e.key === "Enter" && runSearch());
init().catch((e) => setStatus("init failed: " + (e as Error).message));
