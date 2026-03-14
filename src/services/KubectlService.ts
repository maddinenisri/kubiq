import { execFile } from "child_process";
import { promisify } from "util";
import * as vscode from "vscode";
import { contextManager } from "./ContextService";

const exec = promisify(execFile);
const MAX_BUF = 20 * 1024 * 1024;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PodRow {
  name: string;
  namespace: string;
  status: string;
  phase: string;
  ready: string;
  restarts: number;
  age: string;
  node: string;
  cpu?: string;
  mem?: string;
}

export interface DeployRow {
  name: string;
  namespace: string;
  ready: string;
  upToDate: number;
  available: number;
  age: string;
}

export interface ServiceRow {
  name: string;
  namespace: string;
  type: string;
  clusterIp: string;
  externalIp: string;
  ports: string;
  age: string;
}

export interface ConfigMapRow {
  name: string;
  namespace: string;
  data: number;
  age: string;
}

export interface NodeRow {
  name: string;
  status: string;
  roles: string;
  age: string;
  version: string;
  cpu?: string;
  mem?: string;
}

export interface EventRow {
  lastSeen: string;
  type: string;
  reason: string;
  object: string;
  namespace: string;
  message: string;
}

export interface PodSnapshot {
  name: string;
  namespace: string;
  context: string;
  phase: string;
  nodeName: string;
  startTime: string;
  conditions: Array<{ type: string; status: string; reason?: string }>;
  containers: Array<{
    name: string;
    ready: boolean;
    restartCount: number;
    state: string;
    lastState?: string;
    image: string;
  }>;
  logs: Record<string, string>;
  previousLogs: Record<string, string>;
  events: string;
  describe: string;
  yaml: string;
}

// ── Core runner ────────────────────────────────────────────────────────────────

export class KubectlRunner {
  private env(context: string): NodeJS.ProcessEnv {
    const p = contextManager.resolve(context);
    return { ...process.env, AWS_PROFILE: p.profile, AWS_DEFAULT_REGION: p.region };
  }

  private async run(args: string[], context: string): Promise<string> {
    try {
      const { stdout } = await exec("kubectl", args, {
        env: this.env(context),
        maxBuffer: MAX_BUF,
      });
      return stdout;
    } catch (e: unknown) {
      const err = e as { stderr?: string; message?: string };
      throw new Error(err.stderr?.trim() || err.message || String(e), { cause: e });
    }
  }

  private async runSafe(args: string[], context: string): Promise<string> {
    try {
      return await this.run(args, context);
    } catch {
      return "";
    }
  }

  // ── Cluster bootstrap data ─────────────────────────────────────────────────

  async getNamespaces(context: string): Promise<string[]> {
    const out = await this.runSafe(
      ["get", "namespaces", "-o", "jsonpath={.items[*].metadata.name}", `--context=${context}`],
      context,
    );
    return out.trim() ? out.trim().split(/\s+/).sort() : ["default"];
  }

  async hasMetricsServer(context: string): Promise<boolean> {
    const out = await this.runSafe(
      [
        "get",
        "apiservices",
        "v1beta1.metrics.k8s.io",
        "--ignore-not-found",
        "-o",
        'jsonpath={.status.conditions[?(@.type=="Available")].status}',
        `--context=${context}`,
      ],
      context,
    );
    return out.trim() === "True";
  }

  // ── Resources ──────────────────────────────────────────────────────────────

  async getPods(context: string, namespace: string): Promise<PodRow[]> {
    const nsFlag = namespace === "_all" ? "--all-namespaces" : `--namespace=${namespace}`;
    const [raw, topRaw] = await Promise.all([
      this.run(["get", "pods", "-o", "json", nsFlag, `--context=${context}`], context),
      this.runSafe(["top", "pods", nsFlag, "--no-headers", `--context=${context}`], context),
    ]);

    const topMap = new Map<string, { cpu: string; mem: string }>();
    for (const line of topRaw.split("\n").filter(Boolean)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3) topMap.set(parts[0], { cpu: parts[1], mem: parts[2] });
    }

    const obj = JSON.parse(raw);
    return (obj.items as unknown[]).map((item: unknown) => {
      const i = item as Record<string, unknown>;
      const meta = i.metadata as Record<string, unknown>;
      const spec = i.spec as Record<string, unknown>;
      const status = i.status as Record<string, unknown>;
      const cs = (status.containerStatuses as unknown[] | undefined) ?? [];
      const totalRestarts = (cs as Array<Record<string, unknown>>).reduce(
        (sum, c) => sum + ((c.restartCount as number) ?? 0),
        0,
      );
      const readyCount = (cs as Array<Record<string, unknown>>).filter((c) => c.ready).length;
      const top = topMap.get(meta.name as string);
      return {
        name: meta.name as string,
        namespace: meta.namespace as string,
        status: this.podStatus(i),
        phase: (status.phase as string) ?? "Unknown",
        ready: `${readyCount}/${cs.length}`,
        restarts: totalRestarts,
        age: this.age(meta.creationTimestamp as string),
        node: (spec.nodeName as string) ?? "—",
        cpu: top?.cpu,
        mem: top?.mem,
      };
    });
  }

  async getDeployments(context: string, namespace: string): Promise<DeployRow[]> {
    const nsFlag = namespace === "_all" ? "--all-namespaces" : `--namespace=${namespace}`;
    const raw = await this.run(
      ["get", "deployments", "-o", "json", nsFlag, `--context=${context}`],
      context,
    );
    const obj = JSON.parse(raw);
    return (obj.items as unknown[]).map((item: unknown) => {
      const i = item as Record<string, unknown>;
      const meta = i.metadata as Record<string, unknown>;
      const status = i.status as Record<string, unknown>;
      return {
        name: meta.name as string,
        namespace: meta.namespace as string,
        ready: `${(status.readyReplicas as number) ?? 0}/${(status.replicas as number) ?? 0}`,
        upToDate: (status.updatedReplicas as number) ?? 0,
        available: (status.availableReplicas as number) ?? 0,
        age: this.age(meta.creationTimestamp as string),
      };
    });
  }

  async getServices(context: string, namespace: string): Promise<ServiceRow[]> {
    const nsFlag = namespace === "_all" ? "--all-namespaces" : `--namespace=${namespace}`;
    const raw = await this.run(
      ["get", "services", "-o", "json", nsFlag, `--context=${context}`],
      context,
    );
    const obj = JSON.parse(raw);
    return (obj.items as unknown[]).map((item: unknown) => {
      const i = item as Record<string, unknown>;
      const meta = i.metadata as Record<string, unknown>;
      const spec = i.spec as Record<string, unknown>;
      const status = i.status as Record<string, unknown>;
      const lbIngress =
        ((status.loadBalancer as Record<string, unknown>)?.ingress as unknown[] | undefined) ?? [];
      const extIp =
        lbIngress.length > 0
          ? (((lbIngress[0] as Record<string, unknown>).ip as string) ??
            ((lbIngress[0] as Record<string, unknown>).hostname as string) ??
            "pending")
          : spec.type === "NodePort"
            ? "node-port"
            : "—";
      const ports = ((spec.ports as unknown[]) ?? [])
        .map((p: unknown) => {
          const pp = p as Record<string, unknown>;
          return `${pp.port}${pp.nodePort ? `:${pp.nodePort}` : ""}/${pp.protocol}`;
        })
        .join(", ");
      return {
        name: meta.name as string,
        namespace: meta.namespace as string,
        type: spec.type as string,
        clusterIp: spec.clusterIP as string,
        externalIp: extIp,
        ports,
        age: this.age(meta.creationTimestamp as string),
      };
    });
  }

  async getConfigMaps(context: string, namespace: string): Promise<ConfigMapRow[]> {
    const nsFlag = namespace === "_all" ? "--all-namespaces" : `--namespace=${namespace}`;
    const raw = await this.run(
      ["get", "configmaps", "-o", "json", nsFlag, `--context=${context}`],
      context,
    );
    const obj = JSON.parse(raw);
    return (obj.items as unknown[]).map((item: unknown) => {
      const i = item as Record<string, unknown>;
      const meta = i.metadata as Record<string, unknown>;
      const data = i.data as Record<string, unknown> | undefined;
      return {
        name: meta.name as string,
        namespace: meta.namespace as string,
        data: data ? Object.keys(data).length : 0,
        age: this.age(meta.creationTimestamp as string),
      };
    });
  }

  async getNodes(context: string): Promise<NodeRow[]> {
    const [raw, topRaw] = await Promise.all([
      this.run(["get", "nodes", "-o", "json", `--context=${context}`], context),
      this.runSafe(["top", "nodes", "--no-headers", `--context=${context}`], context),
    ]);
    const topMap = new Map<string, { cpu: string; mem: string }>();
    for (const line of topRaw.split("\n").filter(Boolean)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3) topMap.set(parts[0], { cpu: parts[1], mem: parts[2] });
    }
    const obj = JSON.parse(raw);
    return (obj.items as unknown[]).map((item: unknown) => {
      const i = item as Record<string, unknown>;
      const meta = i.metadata as Record<string, unknown>;
      const status = i.status as Record<string, unknown>;
      const conds = (status.conditions as Array<Record<string, unknown>>) ?? [];
      const ready = conds.find((c) => c.type === "Ready")?.status === "True" ? "Ready" : "NotReady";
      const labels = (meta.labels as Record<string, string>) ?? {};
      const roles =
        Object.keys(labels)
          .filter((k) => k.startsWith("node-role.kubernetes.io/"))
          .map((k) => k.replace("node-role.kubernetes.io/", ""))
          .join(",") || "worker";
      const nodeInfo = (status.nodeInfo as Record<string, string>) ?? {};
      const top = topMap.get(meta.name as string);
      return {
        name: meta.name as string,
        status: ready,
        roles,
        age: this.age(meta.creationTimestamp as string),
        version: nodeInfo.kubeletVersion ?? "—",
        cpu: top?.cpu,
        mem: top?.mem,
      };
    });
  }

  async getEvents(context: string, namespace: string): Promise<EventRow[]> {
    const nsFlag = namespace === "_all" ? "--all-namespaces" : `--namespace=${namespace}`;
    const raw = await this.run(
      ["get", "events", "--sort-by=.lastTimestamp", "-o", "json", nsFlag, `--context=${context}`],
      context,
    );
    const obj = JSON.parse(raw);
    return ((obj.items as unknown[]) ?? [])
      .map((item: unknown) => {
        const i = item as Record<string, unknown>;
        const meta = i.metadata as Record<string, unknown>;
        const inv = i.involvedObject as Record<string, unknown>;
        return {
          lastSeen: this.age((i.lastTimestamp ?? i.eventTime) as string),
          type: i.type as string,
          reason: i.reason as string,
          object: `${inv.kind}/${inv.name}`,
          namespace: meta.namespace as string,
          message: ((i.message as string) ?? "").slice(0, 120),
        };
      })
      .reverse(); // newest first
  }

  // ── Node Topology ────────────────────────────────────────────────────

  async getNodeTopology(context: string): Promise<import("../shared/types").TopologyData> {
    const { parseCpu, parseMemory } = await import("../utils/resources");

    const [nodesRaw, podsRaw, topNodesRaw] = await Promise.all([
      this.run(["get", "nodes", "-o", "json", `--context=${context}`], context),
      this.run(["get", "pods", "-o", "json", "--all-namespaces", `--context=${context}`], context),
      this.runSafe(["top", "nodes", "--no-headers", `--context=${context}`], context),
    ]);

    // Parse top nodes
    const topMap = new Map<string, { cpu: number; mem: number }>();
    for (const line of topNodesRaw.split("\n").filter(Boolean)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        topMap.set(parts[0], {
          cpu: parseCpu(parts[1]),
          mem: parseMemory(parts[3]),
        });
      }
    }

    // Parse pods and group by node
    const podsByNode = new Map<string, Array<Record<string, unknown>>>();
    const podsObj = JSON.parse(podsRaw);
    for (const item of (podsObj.items as unknown[]) ?? []) {
      const pod = item as Record<string, unknown>;
      const spec = pod.spec as Record<string, unknown>;
      const nodeName = spec?.nodeName as string;
      if (!nodeName) continue;
      if (!podsByNode.has(nodeName)) podsByNode.set(nodeName, []);
      podsByNode.get(nodeName)!.push(pod);
    }

    // Parse nodes
    const nodesObj = JSON.parse(nodesRaw);
    const nodes: import("../shared/types").TopologyNode[] = (
      (nodesObj.items as unknown[]) ?? []
    ).map((item: unknown) => {
      const i = item as Record<string, unknown>;
      const meta = i.metadata as Record<string, unknown>;
      const spec = i.spec as Record<string, unknown>;
      const status = i.status as Record<string, unknown>;
      const labels = (meta.labels as Record<string, string>) ?? {};
      const conditions = (status.conditions as Array<Record<string, unknown>>) ?? [];
      const allocatable = (status.allocatable as Record<string, string>) ?? {};
      const nodeInfo = (status.nodeInfo as Record<string, string>) ?? {};
      const taints = ((spec.taints as Array<Record<string, unknown>>) ?? []).map((t) => ({
        key: t.key as string,
        value: t.value as string | undefined,
        effect: t.effect as string,
      }));

      const nodeName = meta.name as string;
      const cpuCap = parseCpu(allocatable.cpu ?? "0");
      const memCap = parseMemory(allocatable.memory ?? "0");
      const podCap = parseInt(allocatable.pods ?? "110", 10);

      // Calculate allocated from pods
      const nodePods = podsByNode.get(nodeName) ?? [];
      let cpuAlloc = 0;
      let memAlloc = 0;

      const topologyPods: import("../shared/types").TopologyPod[] = nodePods.map((pod) => {
        const podMeta = pod.metadata as Record<string, unknown>;
        const podStatus = pod.status as Record<string, unknown>;
        const podSpec = pod.spec as Record<string, unknown>;
        const cs = (podStatus.containerStatuses as Array<Record<string, unknown>>) ?? [];
        const containers = (podSpec.containers as Array<Record<string, unknown>>) ?? [];

        let podCpuReq = 0;
        let podMemReq = 0;
        for (const c of containers) {
          const res = c.resources as Record<string, unknown> | undefined;
          const requests = res?.requests as Record<string, string> | undefined;
          if (requests?.cpu) podCpuReq += parseCpu(requests.cpu);
          if (requests?.memory) podMemReq += parseMemory(requests.memory);
        }
        cpuAlloc += podCpuReq;
        memAlloc += podMemReq;

        const totalRestarts = cs.reduce((sum, c) => sum + ((c.restartCount as number) ?? 0), 0);
        const readyCount = cs.filter((c) => c.ready).length;

        return {
          name: podMeta.name as string,
          namespace: podMeta.namespace as string,
          status: this.podStatus(pod),
          ready: `${readyCount}/${cs.length}`,
          restarts: totalRestarts,
          cpuRequest: podCpuReq,
          memRequest: podMemReq,
        };
      });

      const ready =
        conditions.find((c) => c.type === "Ready")?.status === "True" ? "Ready" : "NotReady";
      const roles =
        Object.keys(labels)
          .filter((k) => k.startsWith("node-role.kubernetes.io/"))
          .map((k) => k.replace("node-role.kubernetes.io/", ""))
          .join(",") || "worker";

      const top = topMap.get(nodeName);

      return {
        name: nodeName,
        status: ready,
        roles,
        version: nodeInfo.kubeletVersion ?? "",
        age: this.age(meta.creationTimestamp as string),
        instanceType:
          labels["node.kubernetes.io/instance-type"] ??
          labels["beta.kubernetes.io/instance-type"] ??
          "",
        zone:
          labels["topology.kubernetes.io/zone"] ??
          labels["failure-domain.beta.kubernetes.io/zone"] ??
          "",
        nodeGroup:
          labels["eks.amazonaws.com/nodegroup"] ??
          labels["kops.k8s.io/instancegroup"] ??
          labels["cloud.google.com/gke-nodepool"] ??
          "",
        taints,
        memoryPressure: conditions.some((c) => c.type === "MemoryPressure" && c.status === "True"),
        diskPressure: conditions.some((c) => c.type === "DiskPressure" && c.status === "True"),
        cpuCapacity: cpuCap,
        memCapacity: memCap,
        podCapacity: podCap,
        cpuAllocated: cpuAlloc,
        memAllocated: memAlloc,
        podCount: topologyPods.length,
        cpuActual: top?.cpu,
        memActual: top?.mem,
        pods: topologyPods,
      };
    });

    return { nodes, hasMetrics: topMap.size > 0, fetchedAt: Date.now() };
  }

  // ── RBAC ─────────────────────────────────────────────────────────────

  async getServiceAccounts(
    context: string,
    namespace: string,
  ): Promise<Array<{ name: string; namespace: string; secrets: number; age: string }>> {
    const nsFlag = namespace === "_all" ? "--all-namespaces" : `--namespace=${namespace}`;
    const raw = await this.run(
      ["get", "serviceaccounts", "-o", "json", nsFlag, `--context=${context}`],
      context,
    );
    const obj = JSON.parse(raw);
    return ((obj.items as unknown[]) ?? []).map((item: unknown) => {
      const i = item as Record<string, unknown>;
      const meta = i.metadata as Record<string, unknown>;
      const secrets = (i.secrets as unknown[]) ?? [];
      return {
        name: meta.name as string,
        namespace: meta.namespace as string,
        secrets: secrets.length,
        age: this.age(meta.creationTimestamp as string),
      };
    });
  }

  async getRolesAndClusterRoles(
    context: string,
    namespace: string,
  ): Promise<
    Array<{
      name: string;
      namespace: string;
      kind: string;
      ruleCount: number;
      age: string;
      rules: Array<{ apiGroups: string[]; resources: string[]; verbs: string[] }>;
    }>
  > {
    const nsFlag = namespace === "_all" ? "--all-namespaces" : `--namespace=${namespace}`;
    const [rolesRaw, clusterRolesRaw] = await Promise.all([
      this.runSafe(["get", "roles", "-o", "json", nsFlag, `--context=${context}`], context),
      this.runSafe(["get", "clusterroles", "-o", "json", `--context=${context}`], context),
    ]);

    const parseRoles = (raw: string, kind: string) => {
      if (!raw) return [];
      const obj = JSON.parse(raw);
      return ((obj.items as unknown[]) ?? []).map((item: unknown) => {
        const i = item as Record<string, unknown>;
        const meta = i.metadata as Record<string, unknown>;
        const rules = ((i.rules as unknown[]) ?? []).map((r: unknown) => {
          const rule = r as Record<string, unknown>;
          return {
            apiGroups: (rule.apiGroups as string[]) ?? [""],
            resources: (rule.resources as string[]) ?? [],
            verbs: (rule.verbs as string[]) ?? [],
          };
        });
        return {
          name: meta.name as string,
          namespace: (meta.namespace as string) ?? "",
          kind,
          ruleCount: rules.length,
          age: this.age(meta.creationTimestamp as string),
          rules,
        };
      });
    };

    return [...parseRoles(rolesRaw, "Role"), ...parseRoles(clusterRolesRaw, "ClusterRole")];
  }

  async getBindings(
    context: string,
    namespace: string,
  ): Promise<
    Array<{
      name: string;
      namespace: string;
      kind: string;
      roleRef: string;
      subjects: string[];
      age: string;
    }>
  > {
    const nsFlag = namespace === "_all" ? "--all-namespaces" : `--namespace=${namespace}`;
    const [rbRaw, crbRaw] = await Promise.all([
      this.runSafe(["get", "rolebindings", "-o", "json", nsFlag, `--context=${context}`], context),
      this.runSafe(["get", "clusterrolebindings", "-o", "json", `--context=${context}`], context),
    ]);

    const parseBindings = (raw: string, kind: string) => {
      if (!raw) return [];
      const obj = JSON.parse(raw);
      return ((obj.items as unknown[]) ?? []).map((item: unknown) => {
        const i = item as Record<string, unknown>;
        const meta = i.metadata as Record<string, unknown>;
        const roleRef = i.roleRef as Record<string, unknown>;
        const subjects = ((i.subjects as unknown[]) ?? []).map((s: unknown) => {
          const sub = s as Record<string, unknown>;
          return `${sub.kind}/${sub.namespace ?? ""}/${sub.name}`;
        });
        return {
          name: meta.name as string,
          namespace: (meta.namespace as string) ?? "",
          kind,
          roleRef: `${roleRef.kind}/${roleRef.name}`,
          subjects,
          age: this.age(meta.creationTimestamp as string),
        };
      });
    };

    return [...parseBindings(rbRaw, "RoleBinding"), ...parseBindings(crbRaw, "ClusterRoleBinding")];
  }

  async authCanI(
    context: string,
    verb: string,
    resource: string,
    asSubject: string,
    namespace?: string,
  ): Promise<boolean> {
    const args = ["auth", "can-i", verb, resource, `--as=${asSubject}`, `--context=${context}`];
    if (namespace) args.push(`--namespace=${namespace}`);
    const out = await this.runSafe(args, context);
    return out.trim().toLowerCase() === "yes";
  }

  // ── Get/Apply YAML ────────────────────────────────────────────────────

  async getYaml(context: string, kind: string, name: string, namespace: string): Promise<string> {
    const args = ["get", kind, name, "-o", "yaml", `--context=${context}`];
    if (kind !== "node") args.push(`--namespace=${namespace}`);
    return this.run(args, context);
  }

  async applyYaml(context: string, yaml: string): Promise<string> {
    const { execFile } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(execFile);
    const { stdout } = await execAsync("kubectl", ["apply", "-f", "-", `--context=${context}`], {
      env: this.env(context),
      maxBuffer: MAX_BUF,
      input: yaml,
    });
    return stdout;
  }

  // ── Describe any resource ──────────────────────────────────────────────

  async describe(context: string, kind: string, name: string, namespace: string): Promise<string> {
    const args = ["describe", kind, name, `--context=${context}`];
    if (kind !== "node") args.push(`--namespace=${namespace}`);
    return this.run(args, context);
  }

  // ── Pod actions ──────────────────────────────────────────────────────────

  async deletePod(context: string, namespace: string, name: string): Promise<void> {
    await this.run(
      [
        "delete",
        "pod",
        name,
        `--namespace=${namespace}`,
        `--context=${context}`,
        "--grace-period=30",
      ],
      context,
    );
  }

  async scaleDeployment(
    context: string,
    namespace: string,
    name: string,
    replicas: number,
  ): Promise<void> {
    await this.run(
      [
        "scale",
        `deployment/${name}`,
        `--replicas=${replicas}`,
        `--namespace=${namespace}`,
        `--context=${context}`,
      ],
      context,
    );
  }

  // ── Pod deep fetch (for diagnosis panel) ──────────────────────────────────

  async getPodSnapshot(name: string, namespace: string, context: string): Promise<PodSnapshot> {
    const tailLines = vscode.workspace.getConfiguration("kubiq").get<number>("logTailLines", 500);
    const base = [`--context=${context}`, `--namespace=${namespace}`];
    const [podJson, eventsRaw, describeRaw, yamlRaw] = await Promise.all([
      this.run(["get", "pod", name, "-o", "json", ...base], context),
      this.runSafe(
        [
          "get",
          "events",
          "--field-selector",
          `involvedObject.name=${name}`,
          "--sort-by=.metadata.creationTimestamp",
          ...base,
        ],
        context,
      ),
      this.runSafe(["describe", "pod", name, ...base], context),
      this.runSafe(["get", "pod", name, "-o", "yaml", ...base], context),
    ]);

    const pod = JSON.parse(podJson) as Record<string, unknown>;
    const spec = pod.spec as Record<string, unknown>;
    const status = pod.status as Record<string, unknown>;
    const cs = ((status.containerStatuses as unknown[]) ?? []) as Array<Record<string, unknown>>;

    const containers = cs.map((c) => {
      const state = c.state as Record<string, unknown>;
      const last = c.lastState as Record<string, unknown>;
      return {
        name: c.name as string,
        ready: c.ready as boolean,
        restartCount: c.restartCount as number,
        state: this.stateStr(state),
        lastState: Object.keys(last ?? {}).length ? this.stateStr(last) : undefined,
        image: c.image as string,
      };
    });

    const containerSpecs = (spec.containers as Array<{ name: string }>) ?? [];
    const logResults = await Promise.all(
      containerSpecs.map(async ({ name: cn }) => ({
        name: cn,
        current: await this.runSafe(
          ["logs", name, "-c", cn, `--tail=${tailLines}`, ...base],
          context,
        ),
        previous: await this.runSafe(
          ["logs", name, "-c", cn, `--tail=${tailLines}`, "--previous", ...base],
          context,
        ),
      })),
    );

    const logs: Record<string, string> = {};
    const previousLogs: Record<string, string> = {};
    for (const { name: cn, current, previous } of logResults) {
      logs[cn] = current;
      if (previous) previousLogs[cn] = previous;
    }

    return {
      name,
      namespace,
      context,
      phase: (status.phase as string) ?? "Unknown",
      nodeName: (spec.nodeName as string) ?? "",
      startTime: (status.startTime as string) ?? "",
      conditions: ((status.conditions as unknown[]) ?? []).map((c: unknown) => {
        const cc = c as Record<string, unknown>;
        return {
          type: cc.type as string,
          status: cc.status as string,
          reason: cc.reason as string,
        };
      }),
      containers,
      logs,
      previousLogs,
      events: eventsRaw,
      describe: describeRaw,
      yaml: yamlRaw,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private podStatus(item: Record<string, unknown>): string {
    const status = item.status as Record<string, unknown>;
    const cs = (status.containerStatuses as Array<Record<string, unknown>>) ?? [];
    for (const c of cs) {
      const state = c.state as Record<string, unknown>;
      if (state?.waiting)
        return ((state.waiting as Record<string, unknown>).reason as string) ?? "Waiting";
      if (state?.terminated) {
        const r = (state.terminated as Record<string, unknown>).reason as string;
        if (r && r !== "Completed") return r;
      }
    }
    return (status.phase as string) ?? "Unknown";
  }

  private stateStr(state: Record<string, unknown>): string {
    const key = Object.keys(state ?? {})[0];
    if (!key) return "unknown";
    const d = state[key] as Record<string, unknown>;
    if (key === "waiting") return `Waiting: ${d?.reason ?? ""}`;
    if (key === "terminated") return `Terminated: ${d?.reason ?? ""} (exit ${d?.exitCode ?? "?"})`;
    if (key === "running") return `Running since ${d?.startedAt ?? ""}`;
    return key;
  }

  private age(ts: string): string {
    if (!ts) return "—";
    try {
      const diff = Date.now() - new Date(ts).getTime();
      const s = Math.floor(diff / 1000);
      if (s < 60) return `${s}s`;
      if (s < 3600) return `${Math.floor(s / 60)}m`;
      if (s < 86400) return `${Math.floor(s / 3600)}h`;
      return `${Math.floor(s / 86400)}d`;
    } catch {
      return "—";
    }
  }
}

export const runner = new KubectlRunner();
