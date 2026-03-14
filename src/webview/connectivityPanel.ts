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
