import orbCss from "../ui/orb.css?raw";
import panelCss from "../ui/panel.css?raw";
import { WIDGET_HTML } from "./markup";
import { initWidget, type Source, type WidgetCopy } from "./widget";

const COPY: WidgetCopy = {
  triggerLabel: "Ask AI",
  statusLabel: "Running locally · no backend",
  grounding: "Grounded in your docs · TurboQuant",
  placeholder: "Ask about the docs…",
  idleHint: "Private & offline · Cmd+J to toggle",
  greeting:
    "Hi! Ask me anything about the docs — I answer right here in your browser, nothing leaves your device.",
};

/**
 * A hidden iframe running on the extension origin hosts the heavy work
 * (engine + embedder + LLM). The content script talks to it via postMessage.
 */
function createEngineFrame(): {
  ask: (q: string, h: { onToken: (t: string) => void; addSources: (s: Source[]) => void }) => Promise<void>;
  onStatus: (cb: (text: string) => void) => void;
  ready: Promise<{ count: number; gpu: boolean }>;
} {
  const frame = document.createElement("iframe");
  frame.src = chrome.runtime.getURL("engine-frame.html");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;left:-9999px;";
  document.body.appendChild(frame);

  let nextId = 1;
  const pending = new Map<number, { onToken: (t: string) => void; addSources: (s: Source[]) => void; resolve: () => void; reject: (e: Error) => void }>();
  let statusCb: ((t: string) => void) | null = null;
  let resolveReady!: (v: { count: number; gpu: boolean }) => void;
  const ready = new Promise<{ count: number; gpu: boolean }>((r) => (resolveReady = r));

  window.addEventListener("message", (e) => {
    const m = e.data;
    if (!m?.__qpack) return;
    if (m.type === "ready") return resolveReady({ count: m.count, gpu: m.gpu });
    if (m.type === "status") return statusCb?.(m.text);
    const p = pending.get(m.id);
    if (!p) return;
    if (m.type === "token") p.onToken(m.text);
    else if (m.type === "done") { p.addSources(m.sources ?? []); p.resolve(); pending.delete(m.id); }
    else if (m.type === "error") { p.reject(new Error(m.text)); pending.delete(m.id); }
  });

  return {
    onStatus: (cb) => (statusCb = cb),
    ready,
    ask: (question, h) =>
      new Promise<void>((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { ...h, resolve, reject });
        frame.contentWindow?.postMessage({ type: "ask", id, question }, "*");
      }),
  };
}

/** Mount the widget in an isolated Shadow DOM so the host page's CSS can't touch it. */
function mount(): void {
  if (document.getElementById("qpack-host")) return;
  const host = document.createElement("div");
  host.id = "qpack-host";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = orbCss + "\n" + panelCss;
  shadow.appendChild(style);

  const container = document.createElement("div");
  container.innerHTML = WIDGET_HTML;
  shadow.appendChild(container);

  const engine = createEngineFrame();

  initWidget(
    shadow,
    async (question, { onToken, addSources, onStatus }) => {
      // Pipe model-download / loading progress into the bot bubble's status line.
      engine.onStatus(onStatus);
      onStatus("Preparing engine…");
      await engine.ready;
      await engine.ask(question, { onToken, addSources });
    },
    COPY,
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
