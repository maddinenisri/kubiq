import * as vscode from "vscode";
import { getSidebarHtml } from "./sidebarHtml";
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
      localResourceRoots: [this.extUri],
    };
    view.webview.html = getSidebarHtml(view.webview);

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
