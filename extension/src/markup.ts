/** The widget DOM as a string, injected into the host page by the content script. */
export const WIDGET_HTML = `
<div class="qpack-root" id="qpack">
  <button class="qpack-trigger" id="qpack-trigger" type="button">
    <svg class="spark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"/></svg>
    <span class="label" id="qpack-trigger-label">Ask AI</span>
  </button>

  <div class="qpack-card" id="qpack-card">
    <div class="qpack-head">
      <div class="status">
        <span class="dot"></span>
        <span class="status-label" id="qpack-status-label">Running locally · no backend</span>
      </div>
      <div class="actions">
        <button class="qpack-icon-btn" id="qpack-clear" title="Clear conversation" style="display:none">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
        <button class="qpack-icon-btn" id="qpack-close" title="Minimize (Esc)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>

    <div class="qpack-msgs" id="qpack-msgs"></div>

    <form class="qpack-form" id="qpack-form">
      <div class="qpack-inputwrap">
        <div class="qpack-inputhead">
          <div class="grounding">
            <svg class="spark" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"/></svg>
            <span id="qpack-grounding-label">Grounded in your docs · TurboQuant</span>
          </div>
          <div class="qpack-kbds">
            <kbd class="qpack-kbd">cmd</kbd>
            <kbd class="qpack-kbd">enter</kbd>
          </div>
        </div>
        <textarea class="qpack-input" id="qpack-input" rows="4" placeholder="Ask about the docs…"></textarea>
      </div>
      <div class="qpack-formfoot">
        <div class="qpack-hint" id="qpack-hint">Private &amp; offline · Cmd+J to toggle</div>
        <div class="qpack-btns">
          <button type="button" class="qpack-close-btn" id="qpack-close2">Close</button>
          <button type="submit" class="qpack-send" id="qpack-send" disabled>
            <span>Send Query</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </div>
      </div>
    </form>
  </div>
</div>
`;
