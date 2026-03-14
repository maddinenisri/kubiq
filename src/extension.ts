import * as vscode from "vscode";
import { SidebarProvider } from "./sidebar/sidebarProvider";
import { PodPanel } from "./webview/podPanel";
import { ClaudeSession } from "./claude/claudeSession";
import { SessionStore } from "./claude/sessionStore";
import { runner } from "./kubectl/runner";
import { crashAnalyzer } from "./pods/crashAnalyzer";
import { validateResponse } from "./ai/responseValidator";

const activeSessions = new Map<string, ClaudeSession>();
let sessionStore: SessionStore;

export async function activate(context: vscode.ExtensionContext) {
  sessionStore = new SessionStore(context.globalState);

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const sidebar = new SidebarProvider(context.extensionUri);
  sidebar.onDiagnose((pod, namespace, ctx) => {
    runDiagnosis(context, pod, namespace, ctx);
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewId, sidebar, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  // ── Commands ───────────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("kubiq.refresh", () => sidebar.refresh()),

    vscode.commands.registerCommand(
      "kubiq.diagnosePod",
      async (pod?: string, namespace?: string, ctx?: string) => {
        if (pod && namespace && ctx) {
          await runDiagnosis(context, pod, namespace, ctx);
          return;
        }
        // Manual entry fallback
        const p = await vscode.window.showInputBox({ prompt: "Pod name" });
        if (!p) return;
        const ns =
          (await vscode.window.showInputBox({ prompt: "Namespace", value: "default" })) ??
          "default";
        const contexts = (
          await import("./clusters/contextManager")
        ).contextManager.listAllContexts();
        const c =
          contexts.length === 1
            ? contexts[0]
            : await vscode.window.showQuickPick(contexts, { placeHolder: "Select context" });
        if (!c) return;
        await runDiagnosis(context, p, ns, c);
      },
    ),
  );

  console.log("Kubiq: activated (standalone)");
}

// ── Diagnosis flow ───────────────────────────────────────────────────────────

async function runDiagnosis(
  extCtx: vscode.ExtensionContext,
  podName: string,
  namespace: string,
  clusterContext: string,
) {
  const podKey = SessionStore.key(clusterContext, namespace, podName);
  const panel = PodPanel.open(extCtx, podName, namespace, clusterContext);

  panel.onReady(async () => {
    const stored = sessionStore.get(podKey);
    if (stored) {
      panel.sendChatHistory(stored.messages);
      const session = createSession(podKey, stored.sessionId);
      wireSession(session, panel, podKey);
      return;
    }

    panel.sendThinking();
    let snapshot;
    try {
      snapshot = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Kubiq: Fetching ${podName}…` },
        () => runner.getPodSnapshot(podName, namespace, clusterContext),
      );
    } catch (e) {
      panel.sendError(`Failed to fetch pod data:\n\n${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    const quickHit = crashAnalyzer.quickScan(
      snapshot as Parameters<typeof crashAnalyzer.quickScan>[0],
    );
    if (quickHit) {
      vscode.window.showWarningMessage(`Kubiq: ${podName} — likely: ${quickHit.label}`);
    }

    panel.renderSnapshot(snapshot as Parameters<typeof panel.renderSnapshot>[0]);

    // Check if AI is enabled
    const aiEnabled = vscode.workspace.getConfiguration("kubiq.ai").get("enabled", true);
    if (!aiEnabled) return;

    const session = createSession(podKey);
    wireSession(session, panel, podKey);
    session.send(
      crashAnalyzer.buildInitialPrompt(
        snapshot as Parameters<typeof crashAnalyzer.buildInitialPrompt>[0],
      ),
    );
  });

  panel.onUserMessage((text) => {
    const session = activeSessions.get(podKey);
    if (!session) {
      panel.sendError("No active session. Reopen the panel.");
      return;
    }
    sessionStore.addMessage(podKey, { role: "user", content: text, timestamp: Date.now() });
    panel.sendThinking();
    session.send(text);
  });

  panel.onNewChat(() => {
    sessionStore.clear(podKey);
    activeSessions.get(podKey)?.dispose();
    activeSessions.delete(podKey);
    // Re-fetch snapshot and start fresh session
    runDiagnosis(extCtx, podName, namespace, clusterContext);
  });
}

function createSession(podKey: string, resumeId?: string): ClaudeSession {
  activeSessions.get(podKey)?.dispose();
  const s = new ClaudeSession();
  s.start(resumeId);
  activeSessions.set(podKey, s);
  return s;
}

function wireSession(session: ClaudeSession, panel: PodPanel, podKey: string) {
  session.on("session_init", (id) => {
    const stored = sessionStore.get(podKey);
    if (stored) sessionStore.updateSessionId(podKey, id);
    else sessionStore.save(podKey, id, []);
  });
  session.on("text_delta", (t) => panel.sendTextDelta(t));
  session.on("turn_complete", (full) => {
    // Post-hook: validate response for destructive commands
    const flagDestructive = vscode.workspace
      .getConfiguration("kubiq.guardrails")
      .get("flagDestructiveCommands", true);
    const validation = validateResponse(full, flagDestructive);
    if (validation.flaggedCommands.length > 0) {
      const dangerCount = validation.flaggedCommands.filter((f) => f.severity === "danger").length;
      if (dangerCount > 0) {
        vscode.window.showWarningMessage(
          `Kubiq: AI response contains ${dangerCount} destructive command(s) — flagged with warnings`,
        );
      }
    }
    panel.sendTurnComplete(full, validation.flaggedCommands);
    sessionStore.addMessage(podKey, { role: "assistant", content: full, timestamp: Date.now() });
  });
  session.on("error", (msg) => panel.sendError(msg));
}

export function deactivate() {
  for (const s of activeSessions.values()) s.dispose();
  activeSessions.clear();
}
