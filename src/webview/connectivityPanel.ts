import * as vscode from "vscode";
import { getWebviewHtml } from "../utils/html";
import { testConnectivity } from "../services/ConnectivityService";
import { runner } from "../services/KubectlService";

export async function openConnectivityPanel(
  context: vscode.ExtensionContext,
  kubectlContext: string,
) {
  const panel = vscode.window.createWebviewPanel(
    "kubiqConnectivity",
    "⬡ Connectivity Test",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "out")],
    },
  );

  panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri, "connectivity", {
    context: kubectlContext,
  });

  panel.webview.onDidReceiveMessage(async (msg: Record<string, unknown>) => {
    if (msg.type === "getNamespaces") {
      try {
        const namespaces = await runner.getNamespaces(kubectlContext);
        panel.webview.postMessage({ type: "namespaces", namespaces });
      } catch {
        panel.webview.postMessage({ type: "namespaces", namespaces: ["default"] });
      }
    }

    if (msg.type === "getPods") {
      try {
        const ns = msg.namespace as string;
        const raw = await runner.run(
          [
            "get",
            "pods",
            "-o",
            "jsonpath={.items[*].metadata.name}",
            `--namespace=${ns}`,
            `--context=${kubectlContext}`,
          ],
          kubectlContext,
        );
        panel.webview.postMessage({ type: "pods", pods: raw.trim().split(/\s+/).filter(Boolean) });
      } catch {
        panel.webview.postMessage({ type: "pods", pods: [] });
      }
    }

    if (msg.type === "getServices") {
      try {
        const ns = msg.namespace as string;
        const raw = await runner.run(
          [
            "get",
            "services",
            "-o",
            "jsonpath={.items[*].metadata.name}",
            `--namespace=${ns}`,
            `--context=${kubectlContext}`,
          ],
          kubectlContext,
        );
        panel.webview.postMessage({
          type: "services",
          services: raw.trim().split(/\s+/).filter(Boolean),
        });
      } catch {
        panel.webview.postMessage({ type: "services", services: [] });
      }
    }

    if (msg.type === "aiDeepDive") {
      // Open a pod diagnosis panel with connectivity context pre-loaded
      const { PodPanel } = await import("./podPanel");
      const { ClaudeSession } = await import("../services/ClaudeService");
      const { SessionStore } = await import("../services/SessionStoreService");

      const sourcePod = msg.sourcePod as string;
      const sourceNs = msg.sourceNamespace as string;
      const tgtSvc = msg.targetService as string;
      const tgtNs = msg.targetNamespace as string;
      const checkResults = msg.checkResults as string;

      const diagPanel = PodPanel.open(context, sourcePod, sourceNs, kubectlContext);

      diagPanel.onReady(async () => {
        // Send the connectivity context as an AI prompt
        const prompt = `You are investigating a connectivity issue between pod "${sourcePod}" (namespace: ${sourceNs}) and service "${tgtSvc}" (namespace: ${tgtNs}).

## Automated Check Results
${checkResults}

## Your Task
1. Analyze the check results above and identify the root cause.
2. Generate specific kubectl commands to investigate further. Present each command with an explanation.
3. If you need more data, suggest what to run next.
4. When you find the issue, provide a concrete fix with the exact kubectl or YAML change needed.

IMPORTANT CAPABILITIES:
- When you suggest kubectl commands in code blocks, the user can click a "Run" button next to each command.
- The command output will be automatically sent back to you for analysis.
- You DO NOT need to ask the user to copy/paste output — it happens automatically.
- Generate commands one or two at a time, wait for the output, then decide the next step.
- Use the actual pod name "${sourcePod}", namespace "${sourceNs}", service "${tgtSvc}", and target namespace "${tgtNs}" in all commands.
- Start with the most likely cause based on the check results above.`;

        const session = new ClaudeSession();
        session.start();

        diagPanel.sendThinking();

        session.on("text_delta", (text) => diagPanel.sendTextDelta(text));
        session.on("turn_complete", (full) => {
          diagPanel.sendTurnComplete(full);
        });
        session.on("error", (err) => diagPanel.sendError(err));
        session.on("session_init", () => {});

        // Wire follow-up messages
        diagPanel.onUserMessage((text) => {
          diagPanel.sendThinking();
          session.send(text);
        });

        session.send(prompt);
      });

      return;
    }

    if (msg.type === "runTest") {
      try {
        const result = await testConnectivity(
          kubectlContext,
          msg.sourcePod as string,
          msg.sourceNamespace as string,
          msg.targetService as string,
          msg.targetNamespace as string,
          (checks) => {
            panel.webview.postMessage({ type: "progress", checks });
          },
        );
        panel.webview.postMessage({ type: "result", result });
      } catch (e) {
        panel.webview.postMessage({ type: "error", message: (e as Error).message });
      }
    }
  });
}
