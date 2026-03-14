import * as vscode from "vscode";
import type { PodSnapshot } from "../services/KubectlService";
import type { StoredMessage } from "../services/SessionStoreService";
import { getWebviewHtml } from "../utils/html";

type UserMessageHandler = (text: string) => void;
type ReadyHandler = () => void;

export class PodPanel {
  private static panels = new Map<string, PodPanel>();

  private readonly panel: vscode.WebviewPanel;
  private disposed = false;
  private userMessageHandler?: UserMessageHandler;
  private readyHandler?: ReadyHandler;
  private newChatHandler?: () => void;
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
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "out"),
          vscode.Uri.joinPath(context.extensionUri, "media"),
        ],
      },
    );

    const instance = new PodPanel(panel);
    PodPanel.panels.set(key, instance);

    panel.onDidDispose(() => {
      instance.disposed = true;
      PodPanel.panels.delete(key);
    });

    // Load React bundle with pod data as data attributes
    panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri, "panel", {
      "pod-name": podName,
      namespace: namespace,
      context: clusterContext,
    });

    // Forward webview messages to registered handlers
    panel.webview.onDidReceiveMessage(async (msg: Record<string, unknown>) => {
      if (msg.type === "ready" && !instance._ready) {
        instance._ready = true;
        instance.readyHandler?.();
      }
      if (msg.type === "user_message") instance.userMessageHandler?.((msg.text as string) ?? "");
      if (msg.type === "new_chat") instance.newChatHandler?.();
      if (msg.type === "applyYaml" && msg.yaml) {
        instance.applyYamlHandler?.(msg.yaml as string);
      }
      if (msg.type === "validateYaml" && msg.yaml) {
        const { validateYaml } = await import("../ai/yamlValidator");
        const result = validateYaml(msg.yaml as string);
        instance.post({ type: "validationResult", result });
      }
      if (msg.type === "runCommand" && msg.command) {
        const { execFile } = require("child_process");
        const cmd = msg.command as string;
        const args = cmd.replace(/^kubectl\s+/, "").split(/\s+/);
        const child = execFile(
          "kubectl",
          args,
          { maxBuffer: 10 * 1024 * 1024 },
          (err: unknown, stdout: string) => {
            instance.runningProcesses.delete(cmd);
            if (err) {
              const e = err as { killed?: boolean; stderr?: string; message?: string };
              if (e.killed) {
                instance.post({
                  type: "commandOutput",
                  command: cmd,
                  error: "Command cancelled",
                  cancelled: true,
                });
              } else {
                instance.post({
                  type: "commandOutput",
                  command: cmd,
                  error: e.stderr ?? e.message ?? String(err),
                });
              }
            } else {
              instance.post({ type: "commandOutput", command: cmd, output: stdout });
            }
          },
        );
        instance.runningProcesses.set(cmd, child);
      }
      if (msg.type === "cancelCommand" && msg.command) {
        const child = instance.runningProcesses.get(msg.command as string);
        if (child) {
          child.kill();
          instance.runningProcesses.delete(msg.command as string);
        }
      }
    });

    return instance;
  }

  private applyYamlHandler?: (yaml: string) => void;
  runningProcesses = new Map<string, { kill: () => void }>();

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;
  }

  // ── Register handlers ────────────────────────────────────────────────────────
  onReady(fn: ReadyHandler) {
    this.readyHandler = fn;
    if (this._ready) {
      fn();
    }
  }
  onUserMessage(fn: UserMessageHandler) {
    this.userMessageHandler = fn;
  }
  onNewChat(fn: () => void) {
    this.newChatHandler = fn;
  }
  onApplyYaml(fn: (yaml: string) => void) {
    this.applyYamlHandler = fn;
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

  sendTurnComplete(
    fullText: string,
    flaggedCommands?: Array<{ command: string; severity: string; reason: string }>,
  ) {
    this.post({ type: "turn_complete", fullText, flaggedCommands });
  }

  sendError(message: string) {
    this.post({ type: "error", message });
  }

  sendContextInfo(ctx: {
    preset: string;
    skills: string[];
    sanitization: boolean;
    customInstructions: boolean;
  }) {
    this.post({ type: "context_info", ...ctx });
  }

  renderSnapshot(snapshot: PodSnapshot) {
    this.post({
      type: "snapshot",
      snapshot: {
        phase: snapshot.phase,
        nodeName: snapshot.nodeName,
        startTime: snapshot.startTime,
        conditions: snapshot.conditions,
        containers: snapshot.containers,
        logs: snapshot.logs,
        previousLogs: snapshot.previousLogs,
        events: snapshot.events,
        describe: snapshot.describe,
        yaml: snapshot.yaml,
      },
    });
  }

  private post(msg: Record<string, unknown>) {
    if (!this.disposed) this.panel.webview.postMessage(msg);
  }
}
