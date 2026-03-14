import * as vscode from "vscode";
import { getWebviewHtml } from "../utils/html";
import { runner } from "../services/KubectlService";

let activePanel: vscode.WebviewPanel | undefined;

export function openTopologyPanel(context: vscode.ExtensionContext, kubectlContext: string) {
  if (activePanel) {
    activePanel.reveal();
    activePanel.webview.postMessage({ type: "fetchTopology" });
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "kubiqTopology",
    "⬡ Node Topology",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "out")],
    },
  );

  panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri, "topology", {
    context: kubectlContext,
  });

  activePanel = panel;

  panel.onDidDispose(() => {
    activePanel = undefined;
  });

  panel.webview.onDidReceiveMessage(async (msg: Record<string, unknown>) => {
    if (msg.type === "fetchTopology") {
      const ctx = (msg.context as string) || kubectlContext;
      try {
        panel.webview.postMessage({ type: "topologyLoading" });
        const data = await runner.getNodeTopology(ctx);
        panel.webview.postMessage({ type: "topologyData", data });
      } catch (e) {
        panel.webview.postMessage({
          type: "topologyError",
          message: (e as Error).message,
        });
      }
    }
  });
}
