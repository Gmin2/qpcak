/** Ask AI widget controller. Operates within a given root (Shadow DOM). */

const SPARK_AVATAR = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/></svg>`;

export interface AskHandlers {
  onToken: (t: string) => void;
  addSources: (s: string[]) => void;
}
export type OnAsk = (question: string, handlers: AskHandlers) => Promise<void>;

export interface WidgetCopy {
  triggerLabel?: string;
  statusLabel?: string;
  grounding?: string;
  placeholder?: string;
  idleHint?: string;
  greeting?: string;
}

export function initWidget(root: ParentNode, onAsk: OnAsk, copy: WidgetCopy = {}): void {
  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const rootEl = $("qpack");
  const trigger = $("qpack-trigger");
  const msgs = $("qpack-msgs");
  const form = $<HTMLFormElement>("qpack-form");
  const input = $<HTMLTextAreaElement>("qpack-input");
  const send = $<HTMLButtonElement>("qpack-send");
  const hint = $("qpack-hint");
  const clearBtn = $("qpack-clear");

  const idleHint = copy.idleHint ?? "Or open/close with Cmd+J";
  const set = (id: string, text?: string) => {
    if (text) $(id).textContent = text;
  };
  set("qpack-trigger-label", copy.triggerLabel);
  set("qpack-status-label", copy.statusLabel);
  set("qpack-grounding-label", copy.grounding);
  set("qpack-hint", idleHint);
  if (copy.placeholder) input.placeholder = copy.placeholder;

  let busy = false;
  const open = () => {
    rootEl.classList.add("open");
    setTimeout(() => input.focus(), 150);
  };
  const close = () => rootEl.classList.remove("open");

  trigger.addEventListener("click", open);
  $("qpack-close").addEventListener("click", close);
  $("qpack-close2").addEventListener("click", close);

  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
      e.preventDefault();
      rootEl.classList.contains("open") ? close() : open();
    }
    if (e.key === "Escape" && rootEl.classList.contains("open")) close();
  });

  const refresh = () => (send.disabled = busy || !input.value.trim());
  input.addEventListener("input", refresh);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  clearBtn.addEventListener("click", () => {
    msgs.innerHTML = "";
    msgs.classList.remove("has-msgs");
    clearBtn.style.display = "none";
    hint.textContent = idleHint;
  });

  function addRow(role: "user" | "bot"): HTMLDivElement {
    msgs.classList.add("has-msgs");
    const row = document.createElement("div");
    row.className = `qpack-row ${role}`;
    if (role === "bot") {
      const av = document.createElement("div");
      av.className = "qpack-avatar";
      av.innerHTML = SPARK_AVATAR;
      row.appendChild(av);
    }
    const bubble = document.createElement("div");
    bubble.className = "qpack-bubble";
    row.appendChild(bubble);
    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
    return bubble;
  }

  if (copy.greeting) addRow("bot").textContent = copy.greeting;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question || busy) return;
    input.value = "";
    busy = true;
    refresh();

    addRow("user").textContent = question;
    const bot = addRow("bot");
    bot.innerHTML = `<span class="qpack-typing"><i></i><i></i><i></i></span>`;
    clearBtn.style.display = "inline-flex";

    try {
      let text = "";
      let first = true;
      await onAsk(question, {
        onToken: (t) => {
          if (first) {
            bot.textContent = "";
            first = false;
          }
          text += t;
          bot.textContent = text;
          msgs.scrollTop = msgs.scrollHeight;
        },
        addSources: (sources) => {
          if (!sources?.length) return;
          const wrap = document.createElement("div");
          wrap.className = "qpack-sources";
          for (const s of sources) {
            const chip = document.createElement("span");
            chip.className = "qpack-src";
            chip.textContent = s;
            wrap.appendChild(chip);
          }
          bot.appendChild(wrap);
        },
      });
      if (first) bot.textContent = "(no answer)";
    } catch (err) {
      bot.textContent = "Error: " + ((err as Error)?.message ?? String(err));
    } finally {
      busy = false;
      refresh();
      hint.textContent = `Active context: ${msgs.querySelectorAll(".qpack-row").length} lines`;
    }
  });
}
