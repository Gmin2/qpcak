import { QPack } from "../../src/index";

const PACK_URL = "/packs/site";
const EXAMPLES = [
  "how do I reset my password",
  "set up SSO with Okta",
  "what is your return policy",
  "create an api key",
  "do you ship internationally",
];

const statusEl = document.querySelector<HTMLDivElement>("#status")!;
const resultsEl = document.querySelector<HTMLDivElement>("#results")!;
const metaEl = document.querySelector<HTMLDivElement>("#meta")!;
const input = document.querySelector<HTMLInputElement>("#q")!;
const goBtn = document.querySelector<HTMLButtonElement>("#go")!;
const examplesEl = document.querySelector<HTMLDivElement>("#examples")!;

let pack: QPack;

function setStatus(text: string): void {
  statusEl.textContent = text;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}

async function runAsk(): Promise<void> {
  const query = input.value.trim();
  if (!query || !pack) return;
  goBtn.disabled = true;
  setStatus("thinking locally…");
  try {
    const t0 = performance.now();
    const { answer, sources } = await pack.ask(query);
    const ms = (performance.now() - t0).toFixed(0);
    const sourcesHtml = sources
      .map(
        (h) => `<div class="hit">
          <div class="hit-top"><span class="title">${escapeHtml(h.doc.title ?? "")}</span><span class="score">cos ${h.score.toFixed(3)}</span></div>
          <div class="src">${escapeHtml(h.doc.source ?? "")}</div>
        </div>`,
      )
      .join("");
    resultsEl.innerHTML = `<div class="answer">${escapeHtml(answer)}</div>
      <div class="sources-label">Sources</div>${sourcesHtml}`;
    setStatus(`answered locally in ${ms} ms · 0 backend calls`);
  } catch (err) {
    setStatus(`error: ${(err as Error).message}`);
  } finally {
    goBtn.disabled = false;
  }
}

function renderExamples(): void {
  examplesEl.innerHTML = EXAMPLES.map((e) => `<span class="chip">${e}</span>`).join("");
  examplesEl.querySelectorAll<HTMLSpanElement>(".chip").forEach((chip) =>
    chip.addEventListener("click", () => {
      input.value = chip.textContent ?? "";
      runAsk();
    }),
  );
}

async function init(): Promise<void> {
  setStatus("loading pack…");
  pack = await QPack.load(PACK_URL);
  metaEl.textContent = `${pack.manifest.count} docs · model ${pack.manifest.model}`;
  setStatus("loading embedding model (first time downloads ~25MB)…");
  await pack.search("warmup");
  setStatus("ready — answers run entirely in your browser");
  goBtn.disabled = false;
  renderExamples();
}

goBtn.addEventListener("click", runAsk);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runAsk();
});
init().catch((e) => setStatus(`init failed: ${(e as Error).message}`));
