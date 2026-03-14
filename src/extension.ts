import * as vscode from "vscode";
import * as k8s from "vscode-kubernetes-tools-api";
import { contextManager } from "./clusters/contextManager";
import { podDiagnostics } from "./pods/podDiagnostics";
import { crashAnalyzer } from "./pods/crashAnalyzer";
import { PodPanel } from "./webview/podPanel";
import { ClaudeSession } from "./claude/claudeSession";
import { SessionStore } from "./claude/sessionStore";
import type { PodSnapshot } from "./pods/podDiagnostics";

const activeSessions = new Map<string, ClaudeSession>();
let sessionStore: SessionStore;
let clusterExplorer: k8s.ClusterExplorerV1 | undefined;

export async function activate(context: vscode.ExtensionContext) {
  sessionStore = new SessionStore(context.globalState);

  const diagnoseCmd = vscode.commands.registerCommand(
    "kubiq.diagnosePod",
    async (node: unknown) => {
      const podInfo = extractPodFromNode(node);
      if (!podInfo) {
        const name = await vscode.window.showInputBox({ prompt: "Pod name" });
        const ns   = await vscode.window.showInputBox({ prompt: "Namespace", value: "default" }) ?? "default";
        if (!name) return;
        const ctxs = contextManager.listEksContexts();
        const ctx  = ctxs.length === 1 ? ctxs[0]
          : await vscode.window.showQuickPick(ctxs, { placeHolder: "Select cluster context" });
        if (!ctx) return;
        await runDiagnosis(context, name, ns, ctx);
        return;
      }
      await runDiagnosis(context, podInfo.name, podInfo.namespace, podInfo.kubectlContext);
    }
  );

  const refreshCmd = vscode.commands.registerCommand("kubiq.refreshClusters", () => {
    contextManager.invalidate();
    vscode.window.showInformationMessage("Kubiq: cluster context cache refreshed");
  });

  try {
    const k8sApi = await k8s.extension.kubectl.v1;
    if (k8sApi.available) console.log("Kubiq: connected to vscode-kubernetes-tools API");
    const explorerApi = await k8s.extension.clusterExplorer.v1;
    if (explorerApi.available) {
      clusterExplorer = explorerApi.api;
      console.log("Kubiq: clusterExplorer API ready");
    }
  } catch { console.warn("Kubiq: vscode-kubernetes-tools API not available"); }

  context.subscriptions.push(diagnoseCmd, refreshCmd);
}

async function runDiagnosis(
  extContext: vscode.ExtensionContext,
  podName: string, namespace: string, clusterContext: string
) {
  const podKey = SessionStore.key(clusterContext, namespace, podName);
  const panel  = PodPanel.open(extContext, podName, namespace, clusterContext);

  panel.onReady(async () => {
    const stored = sessionStore.get(podKey);

    if (stored) {
      // Restore history and resume the existing Claude session
      panel.sendChatHistory(stored.messages);
      const session = createSession(podKey, stored.sessionId);
      wireSessionToPanel(session, panel, podKey);
      return;
    }

    // Fresh start: fetch pod data, then open session
    let snapshot: PodSnapshot;
    try {
      panel.sendThinking();
      snapshot = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Kubiq: Fetching ${podName}…` },
        () => podDiagnostics.gather(podName, namespace, clusterContext)
      );
    } catch (e) {
      panel.sendError(`Failed to fetch pod data:\n\n${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    const quickHit = crashAnalyzer.quickScan(snapshot);
    if (quickHit) {
      vscode.window.showWarningMessage(`Kubiq: ${podName} — likely: ${quickHit.label}`);
    }

    panel.renderSnapshot(snapshot);

    const session = createSession(podKey);
    wireSessionToPanel(session, panel, podKey);
    session.send(crashAnalyzer.buildInitialPrompt(snapshot));
  });

  panel.onUserMessage((text) => {
    const session = activeSessions.get(podKey);
    if (!session) {
      panel.sendError("No active session. Close and reopen the panel.");
      return;
    }
    sessionStore.addMessage(podKey, { role: "user", content: text, timestamp: Date.now() });
    panel.sendThinking();
    session.send(text);
  });
}

function createSession(podKey: string, resumeId?: string): ClaudeSession {
  activeSessions.get(podKey)?.dispose();
  const session = new ClaudeSession();
  session.start(resumeId);
  activeSessions.set(podKey, session);
  return session;
}

function wireSessionToPanel(session: ClaudeSession, panel: PodPanel, podKey: string) {
  session.on("session_init", (sessionId) => {
    const stored = sessionStore.get(podKey);
    if (stored) sessionStore.updateSessionId(podKey, sessionId);
    else        sessionStore.save(podKey, sessionId, []);
  });

  session.on("text_delta",    (text)     => panel.sendTextDelta(text));
  session.on("turn_complete", (fullText) => {
    panel.sendTurnComplete(fullText);
    sessionStore.addMessage(podKey, { role: "assistant", content: fullText, timestamp: Date.now() });
  });
  session.on("error", (msg) => panel.sendError(msg));
}

interface PodNodeInfo { name: string; namespace: string; kubectlContext: string; }

function extractPodFromNode(node: unknown): PodNodeInfo | null {
  if (!node || typeof node !== "object") return null;

  // Use resolveCommandTarget() — the proper API way to get typed node data
  if (clusterExplorer) {
    const resolved = clusterExplorer.resolveCommandTarget(node);
    console.log("Kubiq resolved node:", JSON.stringify(resolved));
    if (resolved && resolved.nodeType === "resource") {
      const res = resolved as { nodeType: string; name: string; namespace: string | null; resourceKind?: { manifestKind: string } };
      const kubectlContext = (node as Record<string,unknown>)["kubectlContext"] as string
        ?? (node as Record<string,unknown>)["context"] as string
        ?? "";
      return {
        name: res.name,
        namespace: res.namespace ?? "default",
        kubectlContext,
      };
    }
  }

  // Fallback: read raw node properties
  const n = node as Record<string, unknown>;
  console.log("Kubiq raw node:", JSON.stringify(n).slice(0, 600));
  const name    = (n["name"] as string) ?? (n["podName"] as string);
  const ns      = (n["namespace"] as string) ?? "";
  const context = (n["kubectlContext"] as string) ?? (n["context"] as string);
  const meta    = n["metadata"] as Record<string, unknown> | undefined;

  if (name && context) return { name, namespace: ns || "default", kubectlContext: context };
  if (meta?.["name"] && context) {
    return { name: meta["name"] as string, namespace: (meta["namespace"] as string) ?? (ns || "default"), kubectlContext: context };
  }
  return null;
}

export function deactivate() {
  for (const session of activeSessions.values()) session.dispose();
  activeSessions.clear();
}
