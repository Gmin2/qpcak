/**
 * Ask AI widget controller. Wires the panel markup to behavior and delegates
 * answering to an injected `onAsk(question, { onToken, addSources })` handler,
 * so the same UI drives the preview (mock) and the extension (engine + LLM).
 */
const SPARK_AVATAR = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/></svg>`;

export function initWidget(onAsk) {
  const root = document.getElementById("qpack");
  const trigger = document.getElementById("qpack-trigger");
  const msgs = document.getElementById("qpack-msgs");
  const form = document.getElementById("qpack-form");
  const input = document.getElementById("qpack-input");
  const send = document.getElementById("qpack-send");
  const hint = document.getElementById("qpack-hint");
  const clearBtn = document.getElementById("qpack-clear");

  const copy = window.QPACK_COPY ?? {};
  const idleHint = copy.idleHint ?? "Or open/close with Cmd+J";
  const apply = (id, text) => {
    const el = document.getElementById(id);
    if (el && text) el.textContent = text;
  };
  apply("qpack-trigger-label", copy.triggerLabel);
  apply("qpack-status-label", copy.statusLabel);
  apply("qpack-grounding-label", copy.grounding);
  apply("qpack-hint", idleHint);
  if (copy.placeholder) input.placeholder = copy.placeholder;
  if (copy.greeting) {
    msgs.classList.add("has-msgs");
    const row = document.createElement("div");
    row.className = "qpack-row bot";
    row.innerHTML = `<div class="qpack-avatar">${SPARK_AVATAR}</div><div class="qpack-bubble"></div>`;
    row.querySelector(".qpack-bubble").textContent = copy.greeting;
    msgs.appendChild(row);
  }

  let busy = false;

  const open = () => {
    root.classList.add("open");
    setTimeout(() => input.focus(), 150);
  };
  const close = () => root.classList.remove("open");

  trigger.addEventListener("click", open);
  document.getElementById("qpack-close").addEventListener("click", close);
  document.getElementById("qpack-close2").addEventListener("click", close);

  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
      e.preventDefault();
      root.classList.contains("open") ? close() : open();
    }
    if (e.key === "Escape" && root.classList.contains("open")) close();
  });

  const refreshSendState = () => (send.disabled = busy || !input.value.trim());
  input.addEventListener("input", refreshSendState);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  clearBtn?.addEventListener("click", () => {
    msgs.innerHTML = "";
    msgs.classList.remove("has-msgs");
    clearBtn.style.display = "none";
    hint.textContent = idleHint;
  });

  function addRow(role) {
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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question || busy) return;
    input.value = "";
    busy = true;
    refreshSendState();

    addRow("user").textContent = question;
    const bot = addRow("bot");
    bot.innerHTML = `<span class="qpack-typing"><i></i><i></i><i></i></span>`;
    if (clearBtn) clearBtn.style.display = "inline-flex";

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
      bot.textContent = "Error: " + (err?.message ?? err);
    } finally {
      busy = false;
      refreshSendState();
      const n = msgs.querySelectorAll(".qpack-row").length;
      hint.textContent = `Active context: ${n} lines`;
    }
  });
}

// Preview-only mock so panel.html works standalone. The extension passes its
// own onAsk (retrieve + LLM) instead of importing this default.
if (!window.__QPACK_NO_MOCK__) {
  initWidget(async (question, { onToken, addSources }) => {
    const reply = `Thanks for your question about "${question}". This is a design-only preview — the real answer streams from the in-browser engine + LLM.`;
    for (const word of reply.split(" ")) {
      await new Promise((r) => setTimeout(r, 30));
      onToken(word + " ");
    }
    addSources(["docs/example.md", "docs/another.md"]);
  });
}
