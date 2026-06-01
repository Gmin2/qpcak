import orbCss from "../ui/orb.css?raw";
import panelCss from "../ui/panel.css?raw";
import { WIDGET_HTML } from "./markup";
import { initWidget, type WidgetCopy } from "./widget";

const COPY: WidgetCopy = {
  triggerLabel: "Ask AI",
  statusLabel: "Running locally · no backend",
  grounding: "Grounded in your docs · TurboQuant",
  placeholder: "Ask about the docs…",
  idleHint: "Private & offline · Cmd+J to toggle",
  greeting:
    "Hi! Ask me anything about the docs — I answer right here in your browser, nothing leaves your device.",
};

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

  // Step A: mock answerer to validate injection. Step B swaps in engine + LLM.
  initWidget(
    shadow,
    async (question, { onToken, addSources }) => {
      const reply = `Thanks for asking about "${question}". This is the injected widget working — next step wires the in-browser engine + LLM.`;
      for (const word of reply.split(" ")) {
        await new Promise((r) => setTimeout(r, 25));
        onToken(word + " ");
      }
      addSources(["docs/example.md"]);
    },
    COPY,
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
