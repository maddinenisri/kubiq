import * as vscode from "vscode";
import type { PodSnapshot } from "../kubectl/runner";
import type { StoredMessage } from "../claude/sessionStore";

type UserMessageHandler = (text: string) => void;
type ReadyHandler = () => void;

export class PodPanel {
  private static panels = new Map<string, PodPanel>();

  private readonly panel: vscode.WebviewPanel;
  private disposed = false;
  private userMessageHandler?: UserMessageHandler;
  private readyHandler?: ReadyHandler;
  private snapshotData?: PodSnapshot;
  private _ready = false;

  static open(
    context: vscode.ExtensionContext,
    podName: string,
    namespace: string,
    clusterContext: string,
  ): PodPanel {
    const key = `${clusterContext}/${namespace}/${podName}`;
    if (PodPanel.panels.has(key)) {
      const existing = PodPanel.panels.get(key)!;
      existing.panel.reveal();
      return existing;
    }

    const panel = vscode.window.createWebviewPanel(
      "kubiqPodDiagnosis",
      `⬡ ${podName}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [context.extensionUri],
      },
    );

    const instance = new PodPanel(panel);
    PodPanel.panels.set(key, instance);

    panel.onDidDispose(() => {
      instance.disposed = true;
      PodPanel.panels.delete(key);
    });

    panel.webview.html = buildShellHtml(podName, namespace, clusterContext);

    // Forward webview messages to registered handlers
    panel.webview.onDidReceiveMessage((msg: { type: string; text?: string }) => {
      if (msg.type === "ready") {
        instance._ready = true;
        instance.readyHandler?.();
      }
      if (msg.type === "user_message") instance.userMessageHandler?.(msg.text ?? "");
    });

    return instance;
  }

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;
  }

  // ── Register handlers ────────────────────────────────────────────────────────
  onReady(fn: ReadyHandler) {
    this.readyHandler = fn;
    if (this._ready) {
      fn();
    } // webview beat us — fire immediately
  }
  onUserMessage(fn: UserMessageHandler) {
    this.userMessageHandler = fn;
  }

  // ── Post messages to webview ─────────────────────────────────────────────────
  sendChatHistory(messages: StoredMessage[]) {
    this.post({ type: "chat_history", messages });
  }

  sendThinking() {
    this.post({ type: "thinking" });
  }

  sendTextDelta(text: string) {
    this.post({ type: "text_delta", text });
  }

  sendTurnComplete(fullText: string) {
    this.post({ type: "turn_complete", fullText });
  }

  sendError(message: string) {
    this.post({ type: "error", message });
  }

  /** Sends pod snapshot data to populate Containers / Logs / Events / Describe tabs */
  renderSnapshot(snapshot: PodSnapshot) {
    this.snapshotData = snapshot;
    this.post({ type: "snapshot", snapshot: snapshotForTransfer(snapshot) });
  }

  private post(msg: Record<string, unknown>) {
    if (!this.disposed) this.panel.webview.postMessage(msg);
  }
}

// ─── Snapshot serialisation (keep only what the webview needs) ────────────────

function snapshotForTransfer(s: PodSnapshot) {
  return {
    phase: s.phase,
    nodeName: s.nodeName,
    startTime: s.startTime,
    conditions: s.conditions,
    containers: s.containers,
    logs: s.logs,
    previousLogs: s.previousLogs,
    events: s.events,
    describe: s.describe,
  };
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function buildShellHtml(podName: string, namespace: string, clusterCtx: string): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(podName)}</title>
${styles()}
</head>
<body>

<!-- TOP BAR -->
<header class="topbar">
  <div class="topbar-left">
    <span class="hex">⬡</span>
    <span class="pod-name" id="podName">${esc(podName)}</span>
    <span class="ns-tag">${esc(namespace)}</span>
    <span class="cluster-tag">${esc(clusterCtx)}</span>
  </div>
  <div class="topbar-right">
    <span class="phase-badge" id="phaseBadge">…</span>
    <span class="node-label dim small" id="nodeLabel"></span>
  </div>
</header>

<!-- MAIN TABS -->
<nav class="main-tabs">
  <button class="main-tab active" data-tab="chat">Chat</button>
  <button class="main-tab" data-tab="containers">Containers</button>
  <button class="main-tab" data-tab="logs">Logs</button>
  <button class="main-tab" data-tab="events">Events</button>
  <button class="main-tab" data-tab="describe">Describe</button>
</nav>

<!-- ── CHAT TAB ─────────────────────────────────────────────────────────── -->
<section id="tab-chat" class="tab-panel active">
  <div class="chat-messages" id="chatMessages">
    <!-- history + streaming messages rendered here -->
  </div>
  <div class="chat-input-footer">
    <div class="chat-input-row">
      <textarea
        id="chatInput"
        class="chat-input"
        placeholder="Ask about this pod…"
        rows="1"
        disabled
      ></textarea>
      <button id="sendBtn" class="send-btn" disabled title="Send">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.5 1l13 7-13 7V9.5l9-1.5-9-1.5V1z"/>
        </svg>
        <span class="send-spinner"></span>
      </button>
    </div>
    <div class="chat-hint">
      <span><kbd>Enter</kbd> send</span>
      <span><kbd>Shift+Enter</kbd> newline</span>
    </div>
  </div>
</section>

<!-- ── CONTAINERS TAB ───────────────────────────────────────────────────── -->
<section id="tab-containers" class="tab-panel">
  <div class="section-header">Container Status</div>
  <div class="table-wrap">
    <table class="data-table">
      <thead><tr><th>Name</th><th>State</th><th>Restarts</th><th>Image</th><th>Last State</th></tr></thead>
      <tbody id="containersBody"><tr><td colspan="5" class="dim">Loading…</td></tr></tbody>
    </table>
  </div>
  <div class="section-header mt">Pod Conditions</div>
  <div class="conditions-grid" id="conditionsGrid"><span class="dim small">Loading…</span></div>
</section>

<!-- ── LOGS TAB ─────────────────────────────────────────────────────────── -->
<section id="tab-logs" class="tab-panel">
  <div class="log-tab-bar" id="logTabBar"></div>
  <div class="log-area" id="logArea"><div class="dim">Loading…</div></div>
</section>

<!-- ── EVENTS TAB ───────────────────────────────────────────────────────── -->
<section id="tab-events" class="tab-panel">
  <pre class="code-block" id="eventsBlock">Loading…</pre>
</section>

<!-- ── DESCRIBE TAB ─────────────────────────────────────────────────────── -->
<section id="tab-describe" class="tab-panel">
  <pre class="code-block" id="describeBlock">Loading…</pre>
</section>

<script>
(function() {
  const vscode = acquireVsCodeApi();

  // ── Tab switching ────────────────────────────────────────────────────────
  document.querySelectorAll('.main-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.main-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  // ── Chat state ───────────────────────────────────────────────────────────
  const chatMessages = document.getElementById('chatMessages');
  const chatInput    = document.getElementById('chatInput');
  const sendBtn      = document.getElementById('sendBtn');
  let   streaming    = false;
  let   streamingEl  = null;

  function enableInput() {
    chatInput.disabled = false;
    sendBtn.disabled   = false;
    sendBtn.classList.remove('loading');
    chatInput.focus();
    autoResize();
    streaming = false;
    streamingEl = null;
  }

  function disableInput() {
    chatInput.disabled = true;
    sendBtn.disabled   = true;
    sendBtn.classList.add('loading');
    streaming = true;
  }

  function autoResize() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  }
  chatInput.addEventListener('input', autoResize);

  function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || streaming) return;
    appendUserMessage(text);
    chatInput.value = '';
    autoResize();
    disableInput();
    vscode.postMessage({ type: 'user_message', text });
  }

  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // ── Chat rendering ───────────────────────────────────────────────────────

  function appendUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'msg msg-user';
    div.innerHTML = '<div class="msg-bubble">' + escHtml(text) + '</div>';
    chatMessages.appendChild(div);
    scrollToBottom();
  }

  function appendThinkingBubble() {
    removeThinking();
    const div = document.createElement('div');
    div.className = 'msg msg-ai thinking-row';
    div.id = 'thinking';
    div.innerHTML = '<div class="msg-bubble ai-bubble"><span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span></div>';
    chatMessages.appendChild(div);
    scrollToBottom();
    return div;
  }

  function removeThinking() {
    const el = document.getElementById('thinking');
    if (el) el.remove();
  }

  function startStreamingBubble() {
    removeThinking();
    const div = document.createElement('div');
    div.className = 'msg msg-ai';
    div.innerHTML = '<div class="msg-bubble ai-bubble" id="streamBubble"><span class="cursor">▌</span></div>';
    chatMessages.appendChild(div);
    streamingEl = document.getElementById('streamBubble');
    scrollToBottom();
    return streamingEl;
  }

  function appendTextDelta(text) {
    if (!streamingEl) startStreamingBubble();
    // Insert before the cursor span
    const cursor = streamingEl.querySelector('.cursor');
    const textNode = document.createTextNode(text);
    if (cursor) streamingEl.insertBefore(textNode, cursor);
    else        streamingEl.appendChild(textNode);
    scrollToBottom();
  }

  function finaliseStreamingBubble(fullText) {
    if (streamingEl) {
      streamingEl.innerHTML = renderMarkdown(fullText);
      streamingEl.id = '';
      streamingEl = null;
    }
    enableInput();
    scrollToBottom();
  }

  function appendHistoryMessages(messages) {
    for (const msg of messages) {
      const div = document.createElement('div');
      div.className = 'msg ' + (msg.role === 'user' ? 'msg-user' : 'msg-ai');
      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble' + (msg.role === 'assistant' ? ' ai-bubble' : '');
      bubble.innerHTML = msg.role === 'assistant' ? renderMarkdown(msg.content) : escHtml(msg.content);
      div.appendChild(bubble);
      chatMessages.appendChild(div);
    }
    scrollToBottom();
    enableInput();
  }

  function appendError(message) {
    removeThinking();
    const div = document.createElement('div');
    div.className = 'msg msg-error';
    div.innerHTML = '<div class="msg-bubble error-bubble"><strong>Error</strong><br>' + escHtml(message) + '</div>';
    chatMessages.appendChild(div);
    enableInput();
    scrollToBottom();
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Markdown renderer — RegExp() constructors only, no inline regex literals.
  // Bold uses [*][*] to prevent browser treating /** as a JS block comment.
  function renderMarkdown(text) {
    var t = escHtml(text);
    t = t.replace(new RegExp('\\\\x60\\\\x60\\\\x60[\\\\w]*\\\\n?([\\\\s\\\\S]*?)\\\\x60\\\\x60\\\\x60', 'g'), '<pre class="inline-code">$1</pre>');
    t = t.replace(new RegExp('\\\\x60([^\\\\x60]+)\\\\x60', 'g'), '<code>$1</code>');
    t = t.replace(new RegExp('[*][*]([^*]+)[*][*]', 'g'), '<strong>$1</strong>');
    t = t.replace(new RegExp('\\n', 'g'), '<br>');
    return t;
  }

    // ── Snapshot rendering ───────────────────────────────────────────────────

  function renderSnapshot(s) {
    // Topbar
    const phaseClass = s.phase === 'Running' ? 'phase-running'
                     : s.phase === 'Pending'  ? 'phase-pending' : 'phase-failed';
    const badge = document.getElementById('phaseBadge');
    badge.textContent = s.phase;
    badge.className = 'phase-badge ' + phaseClass;
    if (s.nodeName) document.getElementById('nodeLabel').textContent = 'node: ' + s.nodeName;

    // Containers
    const tbody = document.getElementById('containersBody');
    tbody.innerHTML = s.containers.map(c => {
      const sc = c.state.startsWith('Running') ? 'state-ok'
               : (c.state.startsWith('Terminated') || c.state.includes('Error')) ? 'state-err' : 'state-warn';
      return '<tr>'
        + '<td class="mono">' + escHtml(c.name) + '</td>'
        + '<td><span class="badge ' + sc + '">' + escHtml(c.state) + '</span></td>'
        + '<td class="' + (c.restartCount > 3 ? 'warn-text' : '') + '">' + c.restartCount + '</td>'
        + '<td class="mono small">' + escHtml(c.image) + '</td>'
        + '<td class="small dim">' + (c.lastState ? escHtml(c.lastState) : '—') + '</td>'
        + '</tr>';
    }).join('');

    // Conditions
    document.getElementById('conditionsGrid').innerHTML = s.conditions.map(c =>
      '<div class="condition-chip ' + (c.status === 'True' ? 'cond-ok' : 'cond-bad') + '">'
      + '<span class="cond-type">' + escHtml(c.type) + '</span>'
      + '<span class="cond-status">' + escHtml(c.status) + '</span>'
      + (c.reason ? '<span class="cond-reason dim">' + escHtml(c.reason) + '</span>' : '')
      + '</div>'
    ).join('');

    // Logs
    const logTabBar = document.getElementById('logTabBar');
    const logArea   = document.getElementById('logArea');
    const containers = Object.keys(s.logs);
    const hasPrev = Object.keys(s.previousLogs).length > 0;

    logTabBar.innerHTML = containers.map((name, i) =>
      '<button class="log-tab' + (i === 0 ? ' active' : '') + '" data-container="' + escHtml(name) + '">' + escHtml(name) + '</button>'
    ).join('') + (hasPrev ? '<button class="log-tab prev-btn" data-container="__prev">previous run</button>' : '');

    logArea.innerHTML = containers.map((name, i) =>
      '<div class="log-pane" id="logpane-' + escHtml(name) + '" style="' + (i > 0 ? 'display:none' : '') + '">'
      + (s.logs[name].trim() ? escHtml(s.logs[name]) : '<span class="dim">(no output)</span>')
      + '</div>'
    ).join('') + (hasPrev
      ? '<div id="logpane-__prev" class="log-pane prev" style="display:none">'
        + Object.entries(s.previousLogs).map(([n, log]) =>
            '<div class="prev-log-note">Previous: <strong>' + escHtml(n) + '</strong></div>'
            + '<div class="log-pane prev">' + escHtml(log) + '</div>'
          ).join('')
        + '</div>'
      : '');

    logTabBar.querySelectorAll('.log-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        logTabBar.querySelectorAll('.log-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        logArea.querySelectorAll('.log-pane').forEach(p => p.style.display = 'none');
        const target = document.getElementById('logpane-' + btn.dataset.container);
        if (target) target.style.display = '';
      });
    });

    // Events + Describe
    document.getElementById('eventsBlock').textContent  = s.events  || '(no events)';
    document.getElementById('describeBlock').textContent = s.describe || '(no output)';
  }

  // ── Message bus ──────────────────────────────────────────────────────────

  window.addEventListener('message', event => {
    const msg = event.data;
    readyAcked = true; // extension is alive — stop retrying
    switch (msg.type) {
      case 'thinking':      appendThinkingBubble();             break;
      case 'text_delta':    appendTextDelta(msg.text);          break;
      case 'turn_complete': finaliseStreamingBubble(msg.fullText); break;
      case 'error':         appendError(msg.message);           break;
      case 'chat_history':  appendHistoryMessages(msg.messages); break;
      case 'snapshot':      renderSnapshot(msg.snapshot);       break;
    }
  });

  // Signal ready — retry every 500ms until extension acknowledges (handles race condition)
  var readyAcked = false;
  function signalReady() {
    if (!readyAcked) {
      vscode.postMessage({ type: 'ready' });
      setTimeout(signalReady, 500);
    }
  }
  signalReady();

  function escHtml(s) {
    return String(s ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
})();
</script>
</body>
</html>`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function styles(): string {
  return /* html */ `<style>
    :root {
      --bg:        #0d0f14;
      --bg2:       #13161d;
      --bg3:       #1a1e28;
      --border:    #252a38;
      --border2:   #2e3448;
      --text:      #c8cfe0;
      --dim:       #5a6380;
      --accent:    #4af0c8;
      --accent2:   #3a7bd5;
      --warn:      #f0a84a;
      --err:       #f05a5a;
      --ok:        #4af0c8;
      --font-mono: 'JetBrains Mono','Fira Code','Cascadia Code',monospace;
      --font-ui:   'IBM Plex Sans','Segoe UI',system-ui,sans-serif;
    }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { background:var(--bg); color:var(--text); font-family:var(--font-ui);
           font-size:13px; height:100vh; display:flex; flex-direction:column; overflow:hidden; }

    /* TOPBAR */
    .topbar { display:flex; align-items:center; justify-content:space-between;
               padding:10px 16px; background:var(--bg2); border-bottom:1px solid var(--border); flex-shrink:0; }
    .topbar-left  { display:flex; align-items:center; gap:8px; }
    .topbar-right { display:flex; align-items:center; gap:12px; }
    .hex      { color:var(--accent); font-size:16px; }
    .pod-name { font-size:15px; font-weight:600; color:#e8ecf8; }
    .ns-tag      { background:#1e2235; border:1px solid var(--border2); color:#7a85b0;
                   padding:2px 8px; border-radius:3px; font-size:11px; font-family:var(--font-mono); }
    .cluster-tag { background:#1a2235; border:1px solid #2a3a5a; color:var(--accent2);
                   padding:2px 8px; border-radius:3px; font-size:11px; font-family:var(--font-mono); }
    .node-label { font-size:12px; }
    .phase-badge { padding:3px 10px; border-radius:3px; font-size:11px; font-weight:700;
                   letter-spacing:.06em; text-transform:uppercase; }
    .phase-running { background:#0d2e22; color:var(--ok);  border:1px solid #1a4435; }
    .phase-pending { background:#2e2210; color:var(--warn); border:1px solid #4a3520; }
    .phase-failed  { background:#2e1010; color:var(--err);  border:1px solid #4a2020; }

    /* MAIN TABS */
    .main-tabs { display:flex; background:var(--bg2); border-bottom:1px solid var(--border); flex-shrink:0; }
    .main-tab  { background:transparent; border:none; cursor:pointer; color:var(--dim);
                  padding:9px 18px; font-family:var(--font-ui); font-size:12px; font-weight:500;
                  letter-spacing:.04em; border-bottom:2px solid transparent; transition:color .15s,border-color .15s; }
    .main-tab:hover  { color:var(--text); }
    .main-tab.active { color:var(--accent); border-bottom-color:var(--accent); }

    /* TAB PANELS */
    .tab-panel { display:none; flex:1; overflow:hidden; }
    .tab-panel.active { display:flex; flex-direction:column; }

    /* ── CHAT ──────────────────────────────────────────────────────────────── */
    .chat-messages { flex:1; overflow-y:auto; padding:16px; display:flex;
                     flex-direction:column; gap:12px; }

    .msg { display:flex; }
    .msg-user { justify-content:flex-end; }
    .msg-ai   { justify-content:flex-start; }
    .msg-error { justify-content:flex-start; }

    .msg-bubble { max-width:82%; padding:10px 14px; border-radius:8px;
                   line-height:1.65; font-size:13px; white-space:pre-wrap; word-break:break-word; }
    .msg-user .msg-bubble { background:#1a2a45; border:1px solid #2a3a60; color:#d0d8f0; border-radius:8px 8px 2px 8px; }
    .ai-bubble  { background:var(--bg3); border:1px solid var(--border2); border-radius:2px 8px 8px 8px; }
    .error-bubble { background:#1e0e0e; border:1px solid var(--err); color:var(--err); border-radius:4px; }

    .ai-bubble code { font-family:var(--font-mono); background:#0d1018; padding:1px 5px;
                       border-radius:3px; font-size:11.5px; color:#a0d8c8; }
    .ai-bubble pre.inline-code { font-family:var(--font-mono); background:#0d1018; padding:10px 12px;
                                   border-radius:4px; font-size:11.5px; overflow-x:auto;
                                   color:#a0d8c8; margin:6px 0; border:1px solid var(--border); }
    .ai-bubble strong { color:#e8ecf8; }

    .cursor { color:var(--accent); animation:blink .8s step-end infinite; font-weight:300; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

    .thinking-dots span { animation:bounce .9s infinite; display:inline-block; color:var(--accent); font-size:18px; }
    .thinking-dots span:nth-child(2) { animation-delay:.15s; }
    .thinking-dots span:nth-child(3) { animation-delay:.30s; }
    @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }

    /* CHAT INPUT */
    .chat-input-footer { background:var(--bg2); border-top:1px solid rgba(74,240,200,0.1); flex-shrink:0; }
    .chat-input-row { display:flex; gap:8px; padding:12px 14px; align-items:flex-end; }
    .chat-input { flex:1; background:var(--bg3); border:1px solid var(--border2); color:var(--text);
                   border-radius:8px; padding:10px 12px; font-family:var(--font-ui); font-size:13px;
                   resize:none; outline:none; line-height:1.5; max-height:120px;
                   transition:border-color .2s, box-shadow .2s; }
    .chat-input:focus { border-color:var(--accent); box-shadow:0 0 0 2px rgba(74,240,200,0.1); }
    .chat-input:disabled { opacity:.4; cursor:not-allowed; }
    .send-btn { background:linear-gradient(135deg, #4af0c8 0%, #3a9fab 100%); border:none;
                 color:#0d0f14; width:36px; height:36px; border-radius:8px; cursor:pointer;
                 display:flex; align-items:center; justify-content:center; flex-shrink:0;
                 transition:all .2s; align-self:flex-end; }
    .send-btn:hover:not(:disabled) { background:linear-gradient(135deg, #5fffd4 0%, #4aafbc 100%);
                                       box-shadow:0 4px 12px rgba(74,240,200,0.25); }
    .send-btn:active:not(:disabled) { transform:scale(0.95); }
    .send-btn:disabled { opacity:.3; cursor:not-allowed; }
    .send-btn.loading { background:rgba(74,240,200,0.15); pointer-events:none; }
    .send-btn.loading svg { display:none; }
    .send-spinner { display:none; width:16px; height:16px; border:2px solid rgba(74,240,200,0.3);
                     border-top-color:var(--accent); border-radius:50%; animation:spin .8s linear infinite; }
    .send-btn.loading .send-spinner { display:inline-block; }
    @keyframes spin { to{transform:rotate(360deg);} }
    .chat-hint { display:flex; justify-content:flex-end; padding:0 14px 6px; gap:6px;
                  font-size:10px; color:rgba(200,207,224,0.25); }
    .chat-hint kbd { background:rgba(74,240,200,0.06); border:1px solid rgba(74,240,200,0.12);
                      border-radius:3px; padding:1px 4px; font-family:var(--font-mono); font-size:9px;
                      color:rgba(74,240,200,0.4); }

    /* ── CONTAINERS ────────────────────────────────────────────────────────── */
    #tab-containers { overflow-y:auto; padding:16px; }
    .section-header { font-size:11px; font-weight:600; text-transform:uppercase;
                       letter-spacing:.1em; color:var(--dim); margin-bottom:10px; }
    .section-header.mt { margin-top:20px; }
    .table-wrap { overflow-x:auto; }
    .data-table { width:100%; border-collapse:collapse; font-size:12px; }
    .data-table th { text-align:left; padding:7px 12px; background:var(--bg3);
                      border-bottom:1px solid var(--border2); font-size:10px; font-weight:600;
                      text-transform:uppercase; letter-spacing:.08em; color:var(--dim); }
    .data-table td { padding:8px 12px; border-bottom:1px solid var(--border); vertical-align:middle; }
    .data-table tr:hover td { background:var(--bg3); }
    .mono  { font-family:var(--font-mono); }
    .small { font-size:11px; }
    .dim   { color:var(--dim); }
    .warn-text { color:var(--warn); font-weight:600; }
    .badge { padding:2px 8px; border-radius:2px; font-size:11px; font-family:var(--font-mono); }
    .state-ok   { background:#0d2e22; color:var(--ok);  border:1px solid #1a4435; }
    .state-err  { background:#2e1010; color:var(--err); border:1px solid #4a2020; }
    .state-warn { background:#2e2210; color:var(--warn); border:1px solid #4a3520; }
    .conditions-grid { display:flex; flex-wrap:wrap; gap:8px; }
    .condition-chip { display:flex; align-items:center; gap:6px; padding:5px 10px;
                       border-radius:4px; font-size:11px; border:1px solid; }
    .cond-ok  { background:#0d2e22; border-color:#1a4435; }
    .cond-bad { background:#2e1010; border-color:#4a2020; }
    .cond-type { font-weight:600; }
    .cond-status { font-family:var(--font-mono); }

    /* ── LOGS ───────────────────────────────────────────────────────────────── */
    #tab-logs { display:none; flex-direction:column; padding:10px 14px; gap:8px; overflow:hidden; }
    #tab-logs.active { display:flex; }
    .log-tab-bar { display:flex; gap:4px; flex-shrink:0; flex-wrap:wrap; }
    .log-tab { background:var(--bg3); border:1px solid var(--border2); color:var(--dim);
                padding:4px 12px; border-radius:3px; cursor:pointer;
                font-family:var(--font-mono); font-size:11px; transition:all .1s; }
    .log-tab:hover  { border-color:var(--accent); color:var(--text); }
    .log-tab.active { background:#0d2e22; border-color:var(--ok); color:var(--ok); }
    .log-tab.prev-btn { color:var(--warn); border-color:#3a2e10; }
    .log-area { flex:1; overflow:auto; }
    .log-pane { background:var(--bg2); border:1px solid var(--border); border-radius:4px;
                 padding:12px; font-family:var(--font-mono); font-size:11.5px; line-height:1.7;
                 white-space:pre-wrap; word-break:break-all; min-height:100px; }
    .log-pane.prev { background:#1a1510; border-color:#3a2e10; }
    .prev-log-note { font-size:11px; color:var(--warn); margin:12px 0 6px; }

    /* ── EVENTS / DESCRIBE ──────────────────────────────────────────────────── */
    #tab-events, #tab-describe { padding:14px; overflow:auto; }
    .code-block { background:var(--bg2); border:1px solid var(--border); border-radius:4px;
                   padding:14px; font-family:var(--font-mono); font-size:11.5px; line-height:1.7;
                   white-space:pre-wrap; word-break:break-word; }
  </style>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
