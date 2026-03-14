import * as vscode from "vscode";

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

export function getSidebarHtml(webview: vscode.Webview): string {
  const nonce = getNonce();
  const cspSource = webview.cspSource;
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${cspSource} https:;"/>
<title>Kubiq</title>
<style>
:root {
  --bg:      #0d0f14;
  --bg2:     #13161d;
  --bg3:     #1a1e28;
  --bg4:     #1e2333;
  --border:  #252a38;
  --border2: #2e3448;
  --text:    #c8cfe0;
  --dim:     #5a6380;
  --dim2:    #3a4060;
  --accent:  #4af0c8;
  --accent2: #3a7bd5;
  --warn:    #f0a84a;
  --err:     #f05a5a;
  --ok:      #4af0c8;
  --font-mono: 'JetBrains Mono','Fira Code','Cascadia Code',monospace;
  --font-ui:   'IBM Plex Sans','Segoe UI',system-ui,sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:var(--font-ui);font-size:12px;
     height:100vh;display:flex;flex-direction:column;overflow:hidden;}

/* ── FILTER BAR ─────────────────────────────────────── */
.filter-bar{
  display:flex;flex-direction:column;gap:4px;
  padding:8px;background:var(--bg2);border-bottom:1px solid var(--border);
  flex-shrink:0;
}
.filter-row{display:flex;gap:4px;align-items:center;}
.filter-label{font-size:10px;color:var(--dim);text-transform:uppercase;
               letter-spacing:.06em;width:58px;flex-shrink:0;}
select{
  flex:1;background:var(--bg3);border:1px solid var(--border2);
  color:var(--text);padding:4px 6px;border-radius:4px;font-size:11px;
  font-family:var(--font-mono);cursor:pointer;outline:none;
  -webkit-appearance:none;appearance:none;
}
select:focus{border-color:var(--accent);}
select:disabled{opacity:.4;cursor:not-allowed;}
.refresh-btn{
  background:var(--bg3);border:1px solid var(--border2);color:var(--accent);
  padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px;
  display:flex;align-items:center;gap:4px;white-space:nowrap;
  transition:background .15s;flex-shrink:0;
}
.refresh-btn:hover{background:var(--bg4);}
.refresh-btn.spinning svg{animation:spin .7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}

/* ── STATUS BAR ─────────────────────────────────────── */
.status-bar{
  display:flex;align-items:center;justify-content:space-between;
  padding:3px 8px;background:var(--bg3);border-bottom:1px solid var(--border);
  font-size:10px;color:var(--dim);flex-shrink:0;
}
.status-dot{width:6px;height:6px;border-radius:50%;background:var(--dim);
             display:inline-block;margin-right:4px;}
.status-dot.ok{background:var(--ok);}
.status-dot.err{background:var(--err);}
.status-dot.warn{background:var(--warn);}
.metrics-badge{
  font-size:9px;padding:1px 6px;border-radius:10px;border:1px solid;
}
.metrics-on{color:var(--ok);border-color:#1a4435;background:#0d2e22;}
.metrics-off{color:var(--dim);border-color:var(--border2);background:var(--bg3);}

/* ── RESOURCE TABS ──────────────────────────────────── */
.resource-tabs{
  display:flex;gap:0;background:var(--bg2);
  border-bottom:1px solid var(--border);flex-shrink:0;overflow-x:auto;
}
.resource-tabs::-webkit-scrollbar{height:2px;}
.resource-tabs::-webkit-scrollbar-thumb{background:var(--border2);}
.rtab{
  background:transparent;border:none;cursor:pointer;color:var(--dim);
  padding:7px 10px;font-family:var(--font-ui);font-size:11px;font-weight:500;
  border-bottom:2px solid transparent;white-space:nowrap;
  transition:color .15s,border-color .15s;flex-shrink:0;
}
.rtab:hover{color:var(--text);}
.rtab.active{color:var(--accent);border-bottom-color:var(--accent);}
.rtab .badge{
  display:inline-block;background:var(--bg3);border:1px solid var(--border2);
  color:var(--dim);border-radius:8px;font-size:9px;padding:0 5px;margin-left:4px;
}
.rtab.active .badge{border-color:var(--accent);color:var(--accent);}

/* ── TABLE AREA ─────────────────────────────────────── */
.table-area{flex:1;overflow:auto;position:relative;}
.table-area::-webkit-scrollbar{width:5px;height:5px;}
.table-area::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px;}

table{width:100%;border-collapse:collapse;font-size:11px;}
thead th{
  position:sticky;top:0;z-index:2;
  background:var(--bg3);border-bottom:1px solid var(--border2);
  padding:6px 8px;text-align:left;font-size:9px;font-weight:600;
  text-transform:uppercase;letter-spacing:.08em;color:var(--dim);
  white-space:nowrap;cursor:pointer;user-select:none;
}
thead th:hover{color:var(--text);}
thead th.sort-asc::after{content:" ↑";}
thead th.sort-desc::after{content:" ↓";}
tbody td{
  padding:6px 8px;border-bottom:1px solid var(--border);
  vertical-align:middle;white-space:nowrap;
}
tbody tr{cursor:pointer;transition:background .1s;}
tbody tr:hover td{background:var(--bg3);}
tbody tr:hover .row-actions{opacity:1;}
.mono{font-family:var(--font-mono);}
.dim-text{color:var(--dim);}
.warn-text{color:var(--warn);}
.err-text{color:var(--err);}

/* ── STATUS CHIPS ───────────────────────────────────── */
.chip{
  display:inline-flex;align-items:center;gap:3px;
  padding:2px 7px;border-radius:3px;font-size:10px;font-family:var(--font-mono);
  border:1px solid;font-weight:600;
}
.chip-ok    {background:#0d2e22;color:var(--ok);  border-color:#1a4435;}
.chip-warn  {background:#2e2210;color:var(--warn);border-color:#4a3520;}
.chip-err   {background:#2e1010;color:var(--err); border-color:#4a2020;}
.chip-dim   {background:var(--bg3);color:var(--dim);border-color:var(--border2);}

/* dot indicator */
.dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0;}
.dot-ok  {background:var(--ok);}
.dot-warn{background:var(--warn);}
.dot-err {background:var(--err);}
.dot-dim {background:var(--dim);}

/* ── ROW ACTIONS ────────────────────────────────────── */
.row-actions{opacity:0;display:flex;gap:4px;align-items:center;}
.action-btn{
  background:var(--bg4);border:1px solid var(--border2);color:var(--dim);
  padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;
  transition:all .1s;
}
.action-btn:hover{color:var(--accent);border-color:var(--accent);}
.action-btn.diagnose{color:var(--accent2);border-color:var(--accent2);}
.action-btn.diagnose:hover{background:#1a2a45;}

/* ── EMPTY / LOADING / ERROR STATES ──────────────────  */
.state-overlay{
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  height:200px;gap:10px;color:var(--dim);
}
.spinner{width:20px;height:20px;border-radius:50%;
          border:2px solid var(--border2);border-top-color:var(--accent);
          animation:spin .7s linear infinite;}
.empty-icon{font-size:24px;opacity:.3;}
.error-state{
  margin:12px;background:#1e0e0e;border:1px solid var(--err);
  border-radius:4px;padding:10px 12px;color:var(--err);font-size:11px;
  line-height:1.6;
}

/* ── EVENTS ─────────────────────────────────────────── */
.event-type-warning{color:var(--warn);}
.event-type-normal{color:var(--dim);}
.event-msg{
  max-width:200px;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;color:var(--dim);font-size:10px;
}

/* ── WELCOME ─────────────────────────────────────────── */
.welcome{
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  flex:1;gap:12px;padding:20px;text-align:center;color:var(--dim);
}
.welcome-hex{font-size:32px;color:var(--accent);opacity:.6;}
.welcome-title{font-size:13px;font-weight:600;color:var(--text);}
.welcome-sub{font-size:11px;line-height:1.6;}
</style>
</head>
<body>

<!-- FILTER BAR -->
<div class="filter-bar">
  <div class="filter-row">
    <span class="filter-label">Profile</span>
    <select id="selProfile" disabled>
      <option>Loading…</option>
    </select>
  </div>
  <div class="filter-row">
    <span class="filter-label">Cluster</span>
    <select id="selCluster" disabled>
      <option>—</option>
    </select>
  </div>
  <div class="filter-row">
    <span class="filter-label">Namespace</span>
    <select id="selNamespace" disabled>
      <option>—</option>
    </select>
    <button class="refresh-btn" id="refreshBtn" title="Refresh">
      <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
        <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
      </svg>
      Refresh
    </button>
  </div>
</div>

<!-- STATUS BAR -->
<div class="status-bar">
  <div style="display:flex;align-items:center;gap:6px;">
    <span class="status-dot" id="connDot"></span>
    <span id="connLabel">Not connected</span>
  </div>
  <span class="metrics-badge metrics-off" id="metricsBadge">metrics: —</span>
</div>

<!-- RESOURCE TABS -->
<div class="resource-tabs">
  <button class="rtab active" data-res="pods">Pods <span class="badge" id="badge-pods">—</span></button>
  <button class="rtab" data-res="deployments">Deploys <span class="badge" id="badge-deployments">—</span></button>
  <button class="rtab" data-res="services">Services <span class="badge" id="badge-services">—</span></button>
  <button class="rtab" data-res="configmaps">ConfigMaps <span class="badge" id="badge-configmaps">—</span></button>
  <button class="rtab" data-res="nodes">Nodes <span class="badge" id="badge-nodes">—</span></button>
  <button class="rtab" data-res="events">Events <span class="badge" id="badge-events">—</span></button>
</div>

<!-- TABLE AREA -->
<div class="table-area" id="tableArea">
  <div class="welcome">
    <div class="welcome-hex">⬡</div>
    <div class="welcome-title">Kubiq</div>
    <div class="welcome-sub">Select a profile and cluster<br>to start exploring</div>
  </div>
</div>

<script nonce="${nonce}">
(function(){
  const vscode = acquireVsCodeApi();
  let state = {
    profiles: [], clustersByProfile: {}, namespacesByCtx: {},
    currentCtx: '', currentNs: 'default', currentRes: 'pods',
    hasMetrics: false, data: {}, sortCol: {}, sortDir: {},
    loading: false
  };

  const $ = id => document.getElementById(id);
  const selProfile   = $('selProfile');
  const selCluster   = $('selCluster');
  const selNamespace = $('selNamespace');
  const refreshBtn   = $('refreshBtn');
  const tableArea    = $('tableArea');
  const connDot      = $('connDot');
  const connLabel    = $('connLabel');
  const metricsBadge = $('metricsBadge');

  // ── Resource tab switching ──────────────────────────────
  document.querySelectorAll('.rtab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rtab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentRes = btn.dataset.res;
      if (state.data[state.currentRes]) {
        renderTable(state.currentRes, state.data[state.currentRes]);
      } else if (state.currentCtx) {
        fetchResource(state.currentRes);
      }
    });
  });

  // ── Profile change ──────────────────────────────────────
  selProfile.addEventListener('change', () => {
    const profile = selProfile.value;
    const clusters = state.clustersByProfile[profile] || [];
    populateSelect(selCluster, clusters, 'Select cluster…');
    selCluster.disabled = clusters.length === 0;
    selNamespace.disabled = true;
    state.currentCtx = '';
    state.data = {};
    clearTable();
    updateStatus(false);
  });

  // ── Cluster change ──────────────────────────────────────
  selCluster.addEventListener('change', () => {
    state.currentCtx = selCluster.value;
    if (!state.currentCtx) return;
    state.data = {};
    clearTable();
    showLoading('Loading namespaces…');
    vscode.postMessage({ type: 'getNamespaces', context: state.currentCtx });
  });

  // ── Namespace change ────────────────────────────────────
  selNamespace.addEventListener('change', () => {
    state.currentNs = selNamespace.value;
    state.data = {};
    fetchResource(state.currentRes);
  });

  // ── Refresh ─────────────────────────────────────────────
  refreshBtn.addEventListener('click', () => {
    if (!state.currentCtx) return;
    state.data = {};
    fetchResource(state.currentRes);
  });

  function fetchResource(res) {
    if (!state.currentCtx) return;
    showLoading('Fetching ' + res + '…');
    refreshBtn.classList.add('spinning');
    vscode.postMessage({
      type: 'fetch', resource: res,
      context: state.currentCtx, namespace: state.currentNs
    });
  }

  // ── Message handler ─────────────────────────────────────
  window.addEventListener('message', e => {
    const msg = e.data;
    switch (msg.type) {
      case 'bootstrap':    onBootstrap(msg);    break;
      case 'namespaces':   onNamespaces(msg);   break;
      case 'data':         onData(msg);         break;
      case 'metrics':      onMetrics(msg);      break;
      case 'error':        onError(msg);        break;
    }
  });

  function onBootstrap(msg) {
    state.profiles          = msg.profiles;
    state.clustersByProfile = msg.clustersByProfile;
    populateSelect(selProfile, msg.profiles, 'Select profile…');
    selProfile.disabled = false;
    // Auto-select if only one profile
    if (msg.profiles.length === 1) {
      selProfile.value = msg.profiles[0];
      selProfile.dispatchEvent(new Event('change'));
    }
    if (msg.currentContext) {
      // Pre-select the active context's profile/cluster
      for (const [prof, clusters] of Object.entries(msg.clustersByProfile)) {
        if ((clusters).includes(msg.currentContext)) {
          selProfile.value = prof;
          populateSelect(selCluster, clusters, 'Select cluster…');
          selCluster.disabled = false;
          selCluster.value = msg.currentContext;
          selCluster.dispatchEvent(new Event('change'));
          break;
        }
      }
    }
  }

  function onNamespaces(msg) {
    state.namespacesByCtx[msg.context] = msg.namespaces;
    const ns = ['_all (all namespaces)', ...msg.namespaces];
    populateSelect(selNamespace, msg.namespaces, null);
    // Add all-namespaces option
    const allOpt = document.createElement('option');
    allOpt.value = '_all'; allOpt.textContent = '(all namespaces)';
    selNamespace.insertBefore(allOpt, selNamespace.firstChild);
    selNamespace.disabled = false;
    state.hasMetrics = msg.hasMetrics;
    updateMetricsBadge(msg.hasMetrics);
    updateStatus(true, msg.context);
    state.currentNs = selNamespace.value;
    fetchResource(state.currentRes);
  }

  function onData(msg) {
    refreshBtn.classList.remove('spinning');
    state.data[msg.resource] = msg.rows;
    const badge = $('badge-' + msg.resource);
    if (badge) badge.textContent = msg.rows.length;
    if (msg.resource === state.currentRes) {
      renderTable(msg.resource, msg.rows);
    }
  }

  function onMetrics(msg) {
    // Merge metrics into existing pod/node rows and re-render
    if (state.data[msg.resource]) {
      const map = new Map(msg.metrics.map(m => [m.name, m]));
      state.data[msg.resource] = state.data[msg.resource].map(row => ({
        ...row, ...( map.get(row.name) || {} )
      }));
      if (msg.resource === state.currentRes) {
        renderTable(msg.resource, state.data[msg.resource]);
      }
    }
  }

  function onError(msg) {
    refreshBtn.classList.remove('spinning');
    tableArea.innerHTML =
      '<div class="error-state"><strong>Error</strong><br>' + escHtml(msg.message) + '</div>';
  }

  // ── Table renderers ─────────────────────────────────────
  function renderTable(res, rows) {
    if (!rows || rows.length === 0) {
      tableArea.innerHTML = '<div class="state-overlay"><div class="empty-icon">∅</div><span>No ' + res + ' found</span></div>';
      return;
    }
    switch (res) {
      case 'pods':        tableArea.innerHTML = podsTable(rows);        break;
      case 'deployments': tableArea.innerHTML = deploysTable(rows);      break;
      case 'services':    tableArea.innerHTML = servicesTable(rows);     break;
      case 'configmaps':  tableArea.innerHTML = configmapsTable(rows);   break;
      case 'nodes':       tableArea.innerHTML = nodesTable(rows);        break;
      case 'events':      tableArea.innerHTML = eventsTable(rows);       break;
    }
    // Wire up row click and sort
    wireRows(res);
    wireSortHeaders();
  }

  function podsTable(rows) {
    const showMetrics = state.hasMetrics && rows.some(r => r.cpu);
    return '<table><thead><tr>' +
      th('', 'status', false) +
      th('Name', 'name') +
      th('Status', 'status') +
      th('Ready', 'ready', false) +
      th('↺', 'restarts') +
      th('Age', 'age') +
      th('Node', 'node') +
      (showMetrics ? th('CPU', 'cpu') + th('Mem', 'mem') : '') +
      '<th></th></tr></thead><tbody>' +
      rows.map(r => {
        const cls = podClass(r.status);
        return '<tr data-name="' + esc(r.name) + '" data-ns="' + esc(r.namespace) + '" data-res="pods">' +
          '<td><span class="dot dot-' + cls + '"></span></td>' +
          '<td class="mono">' + esc(truncate(r.name, 36)) + '<br><span class="dim-text" style="font-size:9px">' + esc(r.namespace) + '</span></td>' +
          '<td><span class="chip chip-' + cls + '">' + esc(r.status) + '</span></td>' +
          '<td class="mono dim-text">' + esc(r.ready) + '</td>' +
          '<td class="' + (r.restarts > 5 ? 'err-text' : r.restarts > 0 ? 'warn-text' : 'dim-text') + '">' + r.restarts + '</td>' +
          '<td class="dim-text">' + esc(r.age) + '</td>' +
          '<td class="mono dim-text" style="font-size:10px">' + esc(truncate(r.node, 20)) + '</td>' +
          (showMetrics ? '<td class="mono dim-text">' + (r.cpu || '—') + '</td><td class="mono dim-text">' + (r.mem || '—') + '</td>' : '') +
          '<td><div class="row-actions">' +
            '<button class="action-btn diagnose" data-action="diagnose" data-name="' + esc(r.name) + '" data-ns="' + esc(r.namespace) + '">⬡ AI</button>' +
            '<button class="action-btn" data-action="logs" data-name="' + esc(r.name) + '" data-ns="' + esc(r.namespace) + '">Logs</button>' +
          '</div></td>' +
          '</tr>';
      }).join('') + '</tbody></table>';
  }

  function deploysTable(rows) {
    return '<table><thead><tr>' +
      th('Name', 'name') + th('Namespace', 'namespace') +
      th('Ready', 'ready', false) + th('Up-to-date', 'upToDate') +
      th('Available', 'available') + th('Age', 'age') +
      '</tr></thead><tbody>' +
      rows.map(r => {
        const parts = r.ready.split('/');
        const ok = parts[0] === parts[1];
        return '<tr data-name="' + esc(r.name) + '" data-ns="' + esc(r.namespace) + '" data-res="deployments">' +
          '<td class="mono">' + esc(r.name) + '</td>' +
          '<td class="mono dim-text">' + esc(r.namespace) + '</td>' +
          '<td><span class="chip ' + (ok ? 'chip-ok' : 'chip-warn') + '">' + esc(r.ready) + '</span></td>' +
          '<td class="mono dim-text">' + r.upToDate + '</td>' +
          '<td class="mono dim-text">' + r.available + '</td>' +
          '<td class="dim-text">' + esc(r.age) + '</td>' +
          '</tr>';
      }).join('') + '</tbody></table>';
  }

  function servicesTable(rows) {
    return '<table><thead><tr>' +
      th('Name', 'name') + th('Namespace', 'namespace') +
      th('Type', 'type') + th('Cluster IP', 'clusterIp') +
      th('External IP', 'externalIp') + th('Ports', 'ports', false) +
      th('Age', 'age') +
      '</tr></thead><tbody>' +
      rows.map(r => '<tr data-name="' + esc(r.name) + '" data-ns="' + esc(r.namespace) + '" data-res="services">' +
        '<td class="mono">' + esc(r.name) + '</td>' +
        '<td class="mono dim-text">' + esc(r.namespace) + '</td>' +
        '<td><span class="chip chip-dim">' + esc(r.type) + '</span></td>' +
        '<td class="mono dim-text">' + esc(r.clusterIp) + '</td>' +
        '<td class="mono ' + (r.externalIp !== '—' ? '' : 'dim-text') + '">' + esc(r.externalIp) + '</td>' +
        '<td class="mono dim-text" style="font-size:10px">' + esc(r.ports) + '</td>' +
        '<td class="dim-text">' + esc(r.age) + '</td>' +
        '</tr>'
      ).join('') + '</tbody></table>';
  }

  function configmapsTable(rows) {
    return '<table><thead><tr>' +
      th('Name', 'name') + th('Namespace', 'namespace') +
      th('Keys', 'data') + th('Age', 'age') +
      '</tr></thead><tbody>' +
      rows.map(r => '<tr data-name="' + esc(r.name) + '" data-ns="' + esc(r.namespace) + '" data-res="configmaps">' +
        '<td class="mono">' + esc(r.name) + '</td>' +
        '<td class="mono dim-text">' + esc(r.namespace) + '</td>' +
        '<td class="mono dim-text">' + r.data + '</td>' +
        '<td class="dim-text">' + esc(r.age) + '</td>' +
        '</tr>'
      ).join('') + '</tbody></table>';
  }

  function nodesTable(rows) {
    const showMetrics = state.hasMetrics && rows.some(r => r.cpu);
    return '<table><thead><tr>' +
      th('', 'status', false) + th('Name', 'name') +
      th('Status', 'status') + th('Roles', 'roles') +
      th('Age', 'age') + th('Version', 'version') +
      (showMetrics ? th('CPU', 'cpu') + th('Mem', 'mem') : '') +
      '</tr></thead><tbody>' +
      rows.map(r => {
        const ok = r.status === 'Ready';
        return '<tr data-name="' + esc(r.name) + '" data-res="nodes">' +
          '<td><span class="dot dot-' + (ok ? 'ok' : 'err') + '"></span></td>' +
          '<td class="mono">' + esc(r.name) + '</td>' +
          '<td><span class="chip ' + (ok ? 'chip-ok' : 'chip-err') + '">' + esc(r.status) + '</span></td>' +
          '<td class="dim-text">' + esc(r.roles) + '</td>' +
          '<td class="dim-text">' + esc(r.age) + '</td>' +
          '<td class="mono dim-text">' + esc(r.version) + '</td>' +
          (showMetrics ? '<td class="mono dim-text">' + (r.cpu||'—') + '</td><td class="mono dim-text">' + (r.mem||'—') + '</td>' : '') +
          '</tr>';
      }).join('') + '</tbody></table>';
  }

  function eventsTable(rows) {
    return '<table><thead><tr>' +
      th('Age', 'lastSeen') + th('Type', 'type') +
      th('Reason', 'reason') + th('Object', 'object') +
      th('Namespace', 'namespace') + th('Message', 'message', false) +
      '</tr></thead><tbody>' +
      rows.map(r => '<tr>' +
        '<td class="dim-text">' + esc(r.lastSeen) + '</td>' +
        '<td class="event-type-' + r.type.toLowerCase() + '">' + esc(r.type) + '</td>' +
        '<td class="mono">' + esc(r.reason) + '</td>' +
        '<td class="mono dim-text" style="font-size:10px">' + esc(r.object) + '</td>' +
        '<td class="mono dim-text">' + esc(r.namespace) + '</td>' +
        '<td class="event-msg">' + esc(r.message) + '</td>' +
        '</tr>'
      ).join('') + '</tbody></table>';
  }

  function th(label, col, sortable=true) {
    const sc = state.sortCol[state.currentRes];
    const sd = state.sortDir[state.currentRes];
    const cls = sc === col ? ('sort-' + sd) : '';
    return '<th class="' + cls + '" ' + (sortable ? 'data-sort="' + col + '"' : '') + '>' + label + '</th>';
  }

  // ── Wire row click + action buttons ────────────────────
  function wireRows(res) {
    document.querySelectorAll('tbody tr[data-res]').forEach(tr => {
      tr.addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (btn) {
          e.stopPropagation();
          const action = btn.dataset.action;
          const name = btn.dataset.name;
          const ns   = btn.dataset.ns;
          if (action === 'diagnose') {
            vscode.postMessage({ type:'diagnose', pod:name, namespace:ns, context:state.currentCtx });
          } else if (action === 'logs') {
            vscode.postMessage({ type:'diagnose', pod:name, namespace:ns, context:state.currentCtx, tab:'logs' });
          }
          return;
        }
        const name = tr.dataset.name;
        const ns   = tr.dataset.ns;
        if (res === 'pods') {
          vscode.postMessage({ type:'diagnose', pod:name, namespace:ns, context:state.currentCtx });
        }
      });
    });
  }

  function wireSortHeaders() {
    document.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        const res = state.currentRes;
        const cur = state.sortCol[res];
        if (cur === col) {
          state.sortDir[res] = state.sortDir[res] === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortCol[res] = col;
          state.sortDir[res] = 'asc';
        }
        const rows = [...state.data[res]].sort((a,b) => {
          const av = a[col]; const bv = b[col];
          const cmp = String(av||'').localeCompare(String(bv||''), undefined, {numeric:true});
          return state.sortDir[res] === 'asc' ? cmp : -cmp;
        });
        renderTable(res, rows);
      });
    });
  }

  // ── Helpers ─────────────────────────────────────────────
  function podClass(status) {
    if (!status) return 'dim';
    const s = status.toLowerCase();
    if (s === 'running' || s === 'completed') return 'ok';
    if (s.includes('pending') || s.includes('init') || s.includes('terminating')) return 'warn';
    return 'err';
  }

  function populateSelect(sel, items, placeholder) {
    sel.innerHTML = '';
    if (placeholder) {
      const o = document.createElement('option');
      o.value = ''; o.textContent = placeholder; o.disabled = true; o.selected = true;
      sel.appendChild(o);
    }
    items.forEach(item => {
      const o = document.createElement('option');
      o.value = item; o.textContent = item;
      sel.appendChild(o);
    });
  }

  function updateStatus(connected, ctx) {
    if (connected) {
      connDot.className = 'status-dot ok';
      connLabel.textContent = ctx || 'Connected';
    } else {
      connDot.className = 'status-dot';
      connLabel.textContent = 'Not connected';
      metricsBadge.textContent = 'metrics: —';
      metricsBadge.className = 'metrics-badge metrics-off';
    }
  }

  function updateMetricsBadge(has) {
    metricsBadge.textContent = has ? 'metrics: on' : 'metrics: off';
    metricsBadge.className = 'metrics-badge ' + (has ? 'metrics-on' : 'metrics-off');
  }

  function showLoading(msg) {
    tableArea.innerHTML = '<div class="state-overlay"><div class="spinner"></div><span>' + escHtml(msg) + '</span></div>';
  }

  function clearTable() {
    tableArea.innerHTML = '<div class="welcome"><div class="welcome-hex">⬡</div><div class="welcome-title">Select a cluster</div></div>';
    document.querySelectorAll('.rtab .badge').forEach(b => b.textContent = '—');
  }

  function truncate(s, n) { return s && s.length > n ? s.slice(0,n-1)+'…' : (s||''); }
  function esc(s) {
    return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function escHtml(s) { return esc(s); }

  // Signal ready
  vscode.postMessage({ type: 'init' });
})();
</script>
</body>
</html>`;
}
