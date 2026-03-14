import * as vscode from "vscode";
import { getWebviewHtml } from "../utils/html";
import { runner } from "../kubectl/runner";
import { contextManager } from "../clusters/contextManager";

type DiagnoseHandler = (pod: string, namespace: string, context: string) => void;

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "kubiq.dashboard";
  private view?: vscode.WebviewView;
  private diagnoseHandler?: DiagnoseHandler;

  constructor(private readonly extUri: vscode.Uri) {}

  onDiagnose(fn: DiagnoseHandler) {
    this.diagnoseHandler = fn;
  }

  refresh() {
    this.view?.webview.postMessage({ type: "refresh" });
  }

  resolveWebviewView(
    view: vscode.WebviewView,
    _ctx: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extUri, "out"),
        vscode.Uri.joinPath(this.extUri, "media"),
      ],
    };
    view.webview.html = getWebviewHtml(view.webview, this.extUri, "sidebar");

    view.webview.onDidReceiveMessage(async (msg: Record<string, unknown>) => {
      switch (msg.type as string) {
        case "init":
          await this.handleInit(view);
          break;

        case "getNamespaces": {
          const ctx = msg.context as string;
          await this.handleGetNamespaces(view, ctx);
          break;
        }

        case "fetch": {
          const ctx = msg.context as string;
          const ns = msg.namespace as string;
          const res = msg.resource as string;
          await this.handleFetch(view, ctx, ns, res);
          break;
        }

        case "diagnose": {
          const pod = msg.pod as string;
          const ns = msg.namespace as string;
          const ctx = msg.context as string;
          this.diagnoseHandler?.(pod, ns, ctx);
          break;
        }

        case "editYaml": {
          const resType = msg.resource as string;
          const name = msg.name as string;
          const ns = msg.namespace as string;
          const ctx = msg.context as string;
          await this.handleEditYaml(view, resType, name, ns, ctx);
          break;
        }

        case "describeResource": {
          const resType = msg.resource as string;
          const name = msg.name as string;
          const ns = msg.namespace as string;
          const ctx = msg.context as string;
          await this.handleDescribeResource(resType, name, ns, ctx);
          break;
        }

        case "restartPod": {
          const pod = msg.pod as string;
          const ns = msg.namespace as string;
          const ctx = msg.context as string;
          await this.handleRestartPod(view, pod, ns, ctx);
          break;
        }

        case "portForward": {
          const pod = msg.pod as string;
          const ns = msg.namespace as string;
          const ctx = msg.context as string;
          const localPort = msg.localPort as string;
          const remotePort = msg.remotePort as string;
          this.handlePortForward(pod, ns, ctx, localPort, remotePort);
          break;
        }

        case "scaleDeployment": {
          const name = msg.name as string;
          const ns = msg.namespace as string;
          const ctx = msg.context as string;
          const replicas = msg.replicas as number;
          await this.handleScaleDeployment(view, name, ns, ctx, replicas);
          break;
        }
      }
    });
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  private async handleInit(view: vscode.WebviewView) {
    try {
      const contexts = contextManager.listEksContexts();
      const currentCtx = this.currentKubectlContext();

      // Group contexts by AWS profile
      const clustersByProfile: Record<string, string[]> = {};
      const profiles: string[] = [];

      for (const ctx of contexts) {
        const p = contextManager.resolve(ctx);
        const profileKey = `${p.profile} (${p.region})`;
        if (!clustersByProfile[profileKey]) {
          clustersByProfile[profileKey] = [];
          profiles.push(profileKey);
        }
        clustersByProfile[profileKey].push(ctx);
      }

      // Also include ALL contexts (not just EKS) in case detection is imperfect
      const allContexts = contextManager.listAllContexts();
      for (const ctx of allContexts) {
        if (!contexts.includes(ctx)) {
          const p = contextManager.resolve(ctx);
          const profileKey = `${p.profile} (${p.region})`;
          if (!clustersByProfile[profileKey]) {
            clustersByProfile[profileKey] = [];
            profiles.push(profileKey);
          }
          if (!clustersByProfile[profileKey].includes(ctx)) {
            clustersByProfile[profileKey].push(ctx);
          }
        }
      }

      view.webview.postMessage({
        type: "bootstrap",
        profiles,
        clustersByProfile,
        currentContext: currentCtx,
      });
    } catch (e) {
      this.sendError(view, `Failed to read kubeconfig: ${(e as Error).message}`);
    }
  }

  private async handleGetNamespaces(view: vscode.WebviewView, context: string) {
    try {
      const [namespaces, hasMetrics] = await Promise.all([
        runner.getNamespaces(context),
        runner.hasMetricsServer(context),
      ]);
      view.webview.postMessage({
        type: "namespaces",
        context,
        namespaces,
        hasMetrics,
      });
    } catch (e) {
      this.sendError(view, `Failed to get namespaces: ${(e as Error).message}`);
    }
  }

  private async handleFetch(
    view: vscode.WebviewView,
    context: string,
    namespace: string,
    resource: string,
  ) {
    try {
      let rows: unknown[] = [];
      switch (resource) {
        case "pods":
          rows = await runner.getPods(context, namespace);
          break;
        case "deployments":
          rows = await runner.getDeployments(context, namespace);
          break;
        case "services":
          rows = await runner.getServices(context, namespace);
          break;
        case "configmaps":
          rows = await runner.getConfigMaps(context, namespace);
          break;
        case "nodes":
          rows = await runner.getNodes(context);
          break;
        case "events":
          rows = await runner.getEvents(context, namespace);
          break;
      }
      view.webview.postMessage({ type: "data", resource, rows });
    } catch (e) {
      this.sendError(view, `Failed to fetch ${resource}: ${(e as Error).message}`);
    }
  }

  private async handleEditYaml(
    view: vscode.WebviewView,
    resType: string,
    name: string,
    ns: string,
    ctx: string,
  ) {
    // Open in themed resource panel with editable YAML tab
    await this.handleDescribeResource(resType, name, ns, ctx);
  }

  private async handleDescribeResource(resType: string, name: string, ns: string, ctx: string) {
    const kindMap: Record<string, string> = {
      deployments: "deployment",
      services: "service",
      configmaps: "configmap",
      nodes: "node",
      events: "event",
    };
    const kind = kindMap[resType] ?? resType;

    try {
      const [describeOut, yamlOut] = await Promise.all([
        runner.describe(ctx, kind, name, ns),
        runner.getYaml(ctx, kind, name, ns).catch(() => ""),
      ]);

      const panel = vscode.window.createWebviewPanel(
        "kubiqResource",
        `⬡ ${name}`,
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true },
      );
      panel.webview.html = buildResourceHtml(kind, name, ns, ctx, describeOut, yamlOut);

      // Handle apply from the editable YAML tab
      panel.webview.onDidReceiveMessage(async (msg: Record<string, unknown>) => {
        if (msg.type === "applyYaml") {
          const confirm = await vscode.window.showWarningMessage(
            `Apply changes to ${kind}/${name}?`,
            { modal: true },
            "Apply",
          );
          if (confirm !== "Apply") return;
          try {
            const result = await runner.applyYaml(ctx, msg.yaml as string);
            vscode.window.showInformationMessage(`Kubiq: ${result.trim()}`);
            panel.webview.postMessage({ type: "applySuccess" });
          } catch (e) {
            vscode.window.showErrorMessage(`Kubiq: apply failed — ${(e as Error).message}`);
          }
        }
      });
    } catch (e) {
      vscode.window.showErrorMessage(
        `Kubiq: failed to load ${kind}/${name}: ${(e as Error).message}`,
      );
    }
  }

  private async handleRestartPod(view: vscode.WebviewView, pod: string, ns: string, ctx: string) {
    const confirm = await vscode.window.showWarningMessage(
      `Restart pod ${pod}? This will delete and let the deployment recreate it.`,
      { modal: true },
      "Restart",
    );
    if (confirm !== "Restart") return;

    try {
      await runner.deletePod(ctx, ns, pod);
      vscode.window.showInformationMessage(`Kubiq: pod ${pod} restarting`);
      // Refresh after a short delay to show new pod
      setTimeout(() => view.webview.postMessage({ type: "refresh" }), 2000);
    } catch (e) {
      this.sendError(view, `Failed to restart pod: ${(e as Error).message}`);
    }
  }

  private async handleScaleDeployment(
    view: vscode.WebviewView,
    name: string,
    ns: string,
    ctx: string,
    replicas: number,
  ) {
    const confirm = await vscode.window.showWarningMessage(
      `Scale deployment ${name} to ${replicas} replicas?`,
      { modal: true },
      "Scale",
    );
    if (confirm !== "Scale") return;

    try {
      await runner.scaleDeployment(ctx, ns, name, replicas);
      vscode.window.showInformationMessage(`Kubiq: ${name} scaled to ${replicas} replicas`);
      setTimeout(() => view.webview.postMessage({ type: "refresh" }), 2000);
    } catch (e) {
      this.sendError(view, `Failed to scale: ${(e as Error).message}`);
    }
  }

  private activeForwards = new Map<string, vscode.Terminal>();

  private handlePortForward(
    pod: string,
    ns: string,
    ctx: string,
    localPort: string,
    remotePort: string,
  ) {
    // Support multi-port: "8080,9090" → "8080:8080 9090:9090"
    const localPorts = localPort.split(",").map((p) => p.trim());
    const remotePorts = remotePort.split(",").map((p) => p.trim());
    const portMappings = localPorts.map((lp, i) => `${lp}:${remotePorts[i] ?? lp}`);

    const key = `${pod}/${ns}/${portMappings.join("+")}`;

    // Kill existing forward to same pod/ports
    if (this.activeForwards.has(key)) {
      this.activeForwards.get(key)!.dispose();
      this.activeForwards.delete(key);
    }

    const label = portMappings.join(", ");
    const terminal = vscode.window.createTerminal({
      name: `⇄ ${pod.slice(0, 20)} ${label}`,
      shellPath: "kubectl",
      shellArgs: ["port-forward", pod, ...portMappings, `--namespace=${ns}`, `--context=${ctx}`],
    });
    terminal.show();
    this.activeForwards.set(key, terminal);

    // Clean up when terminal is closed
    vscode.window.onDidCloseTerminal((t) => {
      if (t === terminal) this.activeForwards.delete(key);
    });

    vscode.window.showInformationMessage(`Kubiq: port-forwarding ${pod} → ${label}`);
  }

  private sendError(view: vscode.WebviewView, message: string) {
    view.webview.postMessage({ type: "error", message });
  }

  private currentKubectlContext(): string {
    try {
      const { execSync } = require("child_process");
      return execSync("kubectl config current-context", { encoding: "utf8" }).trim();
    } catch {
      return "";
    }
  }
}

// ── Themed resource detail panel HTML ──────────────────────────────────────────

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildResourceHtml(
  kind: string,
  name: string,
  ns: string,
  ctx: string,
  describe: string,
  yaml: string,
): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
:root {
  --bg:#0d0f14;--bg2:#13161d;--bg3:#1a1e28;--border:#252a38;--border2:#2e3448;
  --text:#c8cfe0;--dim:#5a6380;--accent:#4af0c8;--accent2:#3a7bd5;
  --font-mono:'JetBrains Mono','Fira Code','Cascadia Code',monospace;
  --font-ui:'IBM Plex Sans','Segoe UI',system-ui,sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:var(--font-ui);
     font-size:13px;height:100vh;display:flex;flex-direction:column;overflow:hidden;}
.topbar{display:flex;align-items:center;gap:8px;padding:10px 16px;
        background:var(--bg2);border-bottom:1px solid var(--border);flex-shrink:0;}
.hex{color:var(--accent);font-size:16px;}
.res-name{font-size:15px;font-weight:600;color:#e8ecf8;}
.tag{padding:2px 8px;border-radius:3px;font-size:11px;font-family:var(--font-mono);}
.kind-tag{background:#1a2235;border:1px solid #2a3a5a;color:var(--accent2);}
.ns-tag{background:#1e2235;border:1px solid var(--border2);color:#7a85b0;}
.ctx-tag{background:#1e2235;border:1px solid var(--border2);color:var(--dim);}
.tabs{display:flex;background:var(--bg2);border-bottom:1px solid var(--border);flex-shrink:0;}
.tab{background:transparent;border:none;cursor:pointer;color:var(--dim);
     padding:9px 18px;font-family:var(--font-ui);font-size:12px;font-weight:500;
     letter-spacing:.04em;border-bottom:2px solid transparent;
     transition:color .15s,border-color .15s;}
.tab:hover{color:var(--text);}
.tab.active{color:var(--accent);border-bottom-color:var(--accent);}
.panel{display:none;flex:1;overflow:auto;padding:14px;position:relative;flex-direction:column;}
.panel.active{display:flex;}
pre{background:var(--bg2);border:1px solid var(--border);border-radius:4px;
    padding:14px;font-family:var(--font-mono);font-size:11.5px;line-height:1.7;
    white-space:pre-wrap;word-break:break-word;color:var(--text);}
.yaml-toolbar{display:flex;gap:6px;margin-bottom:8px;justify-content:flex-end;}
.yaml-action-btn{background:var(--bg3);border:1px solid var(--border2);color:var(--dim);
    border-radius:4px;padding:5px 12px;cursor:pointer;font-size:11px;font-family:var(--font-ui);
    transition:color .15s,border-color .15s;}
.yaml-action-btn:hover{color:var(--accent);border-color:var(--accent);}
.apply-btn{color:var(--accent);border-color:var(--accent);}
.apply-btn:hover{background:#0d2e22;}
.cancel-btn:hover{color:var(--err);border-color:var(--err);}
.yaml-view{white-space:pre-wrap;}
.yaml-editor{width:100%;flex:1;background:var(--bg2);border:1px solid var(--accent);
    border-radius:4px;padding:14px;font-family:var(--font-mono);font-size:11.5px;
    line-height:1.7;color:var(--text);resize:none;outline:none;
    white-space:pre;overflow:auto;tab-size:2;}
pre{flex:1;}
.copy-yaml-btn{background:var(--bg3);
    border:1px solid var(--border2);color:var(--dim);border-radius:4px;
    padding:5px 10px;cursor:pointer;font-size:11px;font-family:var(--font-ui);
    display:flex;align-items:center;gap:4px;transition:color .15s,border-color .15s;z-index:5;}
.copy-yaml-btn:hover{color:var(--accent);border-color:var(--accent);}
.copy-yaml-btn.copied{color:#4af0c8;border-color:#4af0c8;}
</style>
</head><body>
<div class="topbar">
  <span class="hex">⬡</span>
  <span class="res-name">${esc(name)}</span>
  <span class="tag kind-tag">${esc(kind)}</span>
  <span class="tag ns-tag">${esc(ns)}</span>
  <span class="tag ctx-tag">${esc(ctx)}</span>
</div>
<div class="tabs">
  <button class="tab active" data-tab="describe">Describe</button>
  ${yaml ? '<button class="tab" data-tab="yaml">YAML</button>' : ""}
</div>
<div class="panel active" id="tab-describe">
  <button class="copy-yaml-btn" id="copyDescribe" title="Copy to clipboard">📋 Copy</button>
  <pre id="describeContent">${esc(describe)}</pre>
</div>
${
  yaml
    ? `<div class="panel" id="tab-yaml">
  <div class="yaml-toolbar" id="yamlToolbar">
    <button class="copy-yaml-btn" id="copyYaml" title="Copy YAML">📋 Copy</button>
    <button class="yaml-action-btn" id="editYamlBtn" title="Edit YAML">✎ Edit</button>
    <button class="yaml-action-btn apply-btn" id="applyYamlBtn" style="display:none" title="Apply changes">Apply</button>
    <button class="yaml-action-btn cancel-btn" id="cancelYamlBtn" style="display:none" title="Cancel editing">Cancel</button>
  </div>
  <pre id="yamlView" class="yaml-view">${esc(yaml)}</pre>
  <textarea id="yamlEditor" class="yaml-editor" style="display:none" spellcheck="false">${esc(yaml)}</textarea>
</div>`
    : ""
}
<script>
var vscode = acquireVsCodeApi();
document.querySelectorAll('.tab').forEach(function(btn){
  btn.addEventListener('click',function(){
    document.querySelectorAll('.tab').forEach(function(b){b.classList.remove('active');});
    document.querySelectorAll('.panel').forEach(function(p){p.classList.remove('active');});
    btn.classList.add('active');
    document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
  });
});

// Copy buttons
function copyText(btnId, sourceId) {
  var btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener('click', function() {
    var el = document.getElementById(sourceId);
    var text = el ? (el.value || el.textContent || '') : '';
    navigator.clipboard.writeText(text).then(function() {
      btn.textContent = '✓ Copied';
      btn.classList.add('copied');
      setTimeout(function() { btn.textContent = '📋 Copy'; btn.classList.remove('copied'); }, 1500);
    });
  });
}
copyText('copyDescribe', 'describeContent');
copyText('copyYaml', 'yamlView');

// YAML Edit / Apply / Cancel
var yamlView = document.getElementById('yamlView');
var yamlEditor = document.getElementById('yamlEditor');
var editBtn = document.getElementById('editYamlBtn');
var applyBtn = document.getElementById('applyYamlBtn');
var cancelBtn = document.getElementById('cancelYamlBtn');

if (editBtn) {
  editBtn.addEventListener('click', function() {
    yamlEditor.value = yamlView.textContent || '';
    yamlView.style.display = 'none';
    yamlEditor.style.display = 'block';
    editBtn.style.display = 'none';
    applyBtn.style.display = '';
    cancelBtn.style.display = '';
    yamlEditor.focus();
  });
}
if (cancelBtn) {
  cancelBtn.addEventListener('click', function() {
    yamlEditor.style.display = 'none';
    yamlView.style.display = 'block';
    editBtn.style.display = '';
    applyBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
  });
}
if (applyBtn) {
  applyBtn.addEventListener('click', function() {
    vscode.postMessage({ type: 'applyYaml', yaml: yamlEditor.value });
  });
}

// Handle apply result
window.addEventListener('message', function(e) {
  if (e.data.type === 'applySuccess') {
    yamlView.textContent = yamlEditor.value;
    cancelBtn.click();
  }
});
</script>
</body></html>`;
}
