import * as vscode from "vscode";
import { SidebarProvider } from "./sidebar/sidebarProvider";
import { PodPanel } from "./webview/podPanel";
import { ClaudeSession } from "./services/ClaudeService";
import { SessionStore } from "./services/SessionStoreService";
import { runner } from "./services/KubectlService";
import { crashAnalyzer } from "./pods/crashAnalyzer";
import { validateResponse } from "./ai/responseValidator";
import { invalidateSkillsCache } from "./ai/skillsLoader";
import { getWebviewHtml } from "./utils/html";

const activeSessions = new Map<string, ClaudeSession>();
let sessionStore: SessionStore;

export async function activate(context: vscode.ExtensionContext) {
  sessionStore = new SessionStore(context.globalState);
  crashAnalyzer.setExtensionPath(context.extensionPath);

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
    vscode.commands.registerCommand("kubiq.refresh", () => {
      sidebar.refresh();
      invalidateSkillsCache(); // reload workspace rules on refresh
    }),

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
          await import("./services/ContextService")
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

  // ── Settings panel ──────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("kubiq.openSettings", () => {
      openSettingsPanel(context);
    }),
  );

  // ── Node Topology ───────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("kubiq.openTopology", async () => {
      const { openTopologyPanel } = await import("./webview/topologyPanel");
      const { execSync } = require("child_process");
      let currentCtx = "";
      try {
        currentCtx = execSync("kubectl config current-context", { encoding: "utf8" }).trim();
      } catch {
        /* ignore */
      }
      openTopologyPanel(context, currentCtx);
    }),
  );

  // ── Connectivity Debugger ─────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("kubiq.testConnectivity", async () => {
      const { openConnectivityPanel } = await import("./webview/connectivityPanel");
      const { execSync } = require("child_process");
      let currentCtx = "";
      try {
        currentCtx = execSync("kubectl config current-context", { encoding: "utf8" }).trim();
      } catch {
        /* ignore */
      }
      openConnectivityPanel(context, currentCtx);
    }),
  );

  console.log("Kubiq: activated (standalone)");
}

function openSettingsPanel(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    "kubiqSettings",
    "⬡ Kubiq Settings",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "out")],
    },
  );

  panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri, "settings");

  panel.webview.onDidReceiveMessage(async (msg: Record<string, unknown>) => {
    if (msg.type === "getSettings") {
      const config = vscode.workspace.getConfiguration("kubiq");
      const skills = (await import("./ai/skillsLoader")).getSkillNames(context.extensionPath);

      // Check for workspace rules
      let workspaceRules: string[] = [];
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders) {
        const fs = require("fs");
        const path = require("path");
        const rulesDir = path.join(workspaceFolders[0].uri.fsPath, ".kubiq", "rules");
        try {
          if (fs.existsSync(rulesDir)) {
            workspaceRules = fs
              .readdirSync(rulesDir)
              .filter((f: string) => f.endsWith(".md"))
              .map((f: string) => f.replace(".md", ""));
          }
        } catch {
          /* ignore */
        }
      }

      panel.webview.postMessage({
        type: "settingsData",
        settings: {
          aiEnabled: config.get("ai.enabled", true),
          promptPreset: config.get("ai.promptPreset", "default"),
          customInstructions: config.get("ai.customInstructions", ""),
          sanitizeSecrets: config.get("guardrails.sanitizeSecrets", true),
          sanitizeEnvVars: config.get("guardrails.sanitizeEnvVars", true),
          redactPatterns: config.get("guardrails.redactPatterns", []),
          flagDestructiveCommands: config.get("guardrails.flagDestructiveCommands", true),
          logTailLines: config.get("logTailLines", 500),
          clusterProfiles: config.get("clusterProfiles", {}),
          loadedSkills: skills,
          workspaceRules,
        },
      });
    }

    if (msg.type === "updateSetting") {
      const key = msg.key as string;
      const value = msg.value;
      const config = vscode.workspace.getConfiguration();
      await config.update(key, value, vscode.ConfigurationTarget.Global);
    }
  });
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
    // Always fetch snapshot for Containers/Logs/Events/Describe tabs
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
    const ctx = aiEnabled
      ? crashAnalyzer.getPromptContext()
      : { preset: "disabled", skills: [], sanitization: false, customInstructions: false };
    panel.sendContextInfo(ctx);

    if (!aiEnabled) return;

    // Restore chat history if session exists
    const stored = sessionStore.get(podKey);
    if (stored && stored.messages.length > 0) {
      panel.sendChatHistory(stored.messages);
      const session = createSession(podKey, stored.sessionId);
      wireSession(session, panel, podKey);
      return;
    }

    // Fresh start: begin AI diagnosis
    panel.sendThinking();
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
    runDiagnosis(extCtx, podName, namespace, clusterContext);
  });

  panel.onApplyYaml(async (yaml) => {
    const confirm = await vscode.window.showWarningMessage(
      `Apply YAML changes to pod ${podName}?`,
      { modal: true },
      "Apply",
    );
    if (confirm !== "Apply") return;
    try {
      const result = await runner.applyYaml(clusterContext, yaml);
      vscode.window.showInformationMessage(`Kubiq: ${result.trim()}`);
    } catch (e) {
      vscode.window.showErrorMessage(
        `Kubiq: apply failed — ${e instanceof Error ? e.message : String(e)}`,
      );
    }
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
