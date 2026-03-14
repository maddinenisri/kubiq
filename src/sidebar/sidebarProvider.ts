import * as vscode from "vscode";
import { getWebviewHtml } from "../utils/html";
import { runner } from "../services/KubectlService";
import { contextManager } from "../services/ContextService";
import { analyzeRoleWarnings, analyzeBindingWarnings } from "../rbac/rbacAnalyzer";

type DiagnoseHandler = (pod: string, namespace: string, context: string) => void;

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "kubiq.dashboard";
  private view?: vscode.WebviewView;
  private diagnoseHandler?: DiagnoseHandler;
  private initialized = false;

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
          if (!this.initialized) {
            this.initialized = true;
            await this.handleInit(view);
          }
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
        case "rbac": {
          const [sas, roles, bindings] = await Promise.all([
            runner.getServiceAccounts(context, namespace),
            runner.getRolesAndClusterRoles(context, namespace),
            runner.getBindings(context, namespace),
          ]);

          // Cross-reference: find bound roles for each SA
          const saRows = sas.map((sa) => {
            const boundRoles = bindings
              .filter((b) =>
                b.subjects.some((s) => s.includes(`ServiceAccount`) && s.includes(sa.name)),
              )
              .map((b) => b.roleRef);
            const warnings = boundRoles.flatMap((ref) =>
              analyzeBindingWarnings([`ServiceAccount/${sa.namespace}/${sa.name}`], ref),
            );
            return { ...sa, boundRoles, warnings };
          });

          const roleRows = roles.map((r) => ({
            name: r.name,
            namespace: r.namespace,
            kind: r.kind as "Role" | "ClusterRole",
            ruleCount: r.ruleCount,
            age: r.age,
            warnings: analyzeRoleWarnings(r.name, r.kind, r.rules),
          }));

          const bindingRows = bindings.map((b) => ({
            ...b,
            kind: b.kind as "RoleBinding" | "ClusterRoleBinding",
          }));

          rows = {
            serviceAccounts: saRows,
            roles: roleRows,
            bindings: bindingRows,
          } as unknown as unknown[];
          break;
        }
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
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.joinPath(this.extUri, "out")],
        },
      );
      panel.webview.html = getWebviewHtml(panel.webview, this.extUri, "resource", {
        kind,
        name,
        namespace: ns,
        context: ctx,
      });
      // Send resource data to the React panel
      panel.webview.postMessage({ type: "resourceData", describe: describeOut, yaml: yamlOut });

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
