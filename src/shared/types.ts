/**
 * Shared types between extension host and webview.
 * These types define the data shapes that cross the postMessage boundary.
 */

// ── Resource row types (sidebar tables) ─────────────────────────────────────

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

export type ResourceType =
  | "pods"
  | "deployments"
  | "services"
  | "configmaps"
  | "nodes"
  | "events"
  | "rbac";

// ── RBAC types ──────────────────────────────────────────────────────────────

export interface RbacWarning {
  severity: "danger" | "warning";
  message: string;
}

export interface ServiceAccountRow {
  name: string;
  namespace: string;
  secrets: number;
  age: string;
  boundRoles: string[];
  warnings: RbacWarning[];
}

export interface RoleRow {
  name: string;
  namespace: string;
  kind: "Role" | "ClusterRole";
  ruleCount: number;
  age: string;
  warnings: RbacWarning[];
}

export interface BindingRow {
  name: string;
  namespace: string;
  kind: "RoleBinding" | "ClusterRoleBinding";
  roleRef: string;
  subjects: string[];
  age: string;
}

export interface RbacPolicyRule {
  apiGroups: string[];
  resources: string[];
  verbs: string[];
}

export interface RbacPermissionChain {
  subject: { kind: string; name: string; namespace: string };
  bindings: Array<{
    bindingName: string;
    bindingKind: string;
    roleName: string;
    roleKind: string;
    rules: RbacPolicyRule[];
  }>;
  warnings: RbacWarning[];
}

export interface CanIResult {
  verb: string;
  resource: string;
  allowed: boolean;
}

// ── Node Topology types ─────────────────────────────────────────────────────

export interface TopologyContainer {
  name: string;
  ready: boolean;
  restartCount: number;
  state: string;
  image: string;
}

export interface TopologyPod {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  restarts: number;
  cpuRequest: number; // millicores
  memRequest: number; // bytes
}

export interface TopologyNode {
  name: string;
  status: string;
  roles: string;
  version: string;
  age: string;
  instanceType: string;
  zone: string;
  nodeGroup: string;
  taints: Array<{ key: string; value?: string; effect: string }>;
  memoryPressure: boolean;
  diskPressure: boolean;
  cpuCapacity: number; // millicores
  memCapacity: number; // bytes
  podCapacity: number;
  cpuAllocated: number; // millicores
  memAllocated: number; // bytes
  podCount: number;
  cpuActual?: number;
  memActual?: number;
  pods: TopologyPod[];
}

export interface TopologyData {
  nodes: TopologyNode[];
  hasMetrics: boolean;
  fetchedAt: number;
}

// ── Pod snapshot (diagnosis panel) ──────────────────────────────────────────

export interface ContainerStatus {
  name: string;
  ready: boolean;
  restartCount: number;
  state: string;
  lastState?: string;
  image: string;
}

export interface PodCondition {
  type: string;
  status: string;
  reason?: string;
}

export interface PodSnapshot {
  name: string;
  namespace: string;
  context: string;
  phase: string;
  nodeName: string;
  startTime: string;
  conditions: PodCondition[];
  containers: ContainerStatus[];
  logs: Record<string, string>;
  previousLogs: Record<string, string>;
  events: string;
  describe: string;
  yaml: string;
}

/** Subset of PodSnapshot sent to the webview (no raw JSON) */
export interface PodSnapshotTransfer {
  phase: string;
  nodeName: string;
  startTime: string;
  conditions: PodCondition[];
  containers: ContainerStatus[];
  logs: Record<string, string>;
  previousLogs: Record<string, string>;
  events: string;
  describe: string;
  yaml: string;
}

// ── Chat / session types ────────────────────────────────────────────────────

export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface StoredSession {
  sessionId: string;
  messages: StoredMessage[];
  podKey: string;
  savedAt: number;
}

// ── AI guardrails ───────────────────────────────────────────────────────────

export interface FlaggedCommand {
  command: string;
  severity: "danger" | "warning";
  reason: string;
}

export interface ContextInfo {
  preset: string;
  skills: string[];
  sanitization: boolean;
  customInstructions: boolean;
}

// ── Cluster profile ─────────────────────────────────────────────────────────

export interface ClusterProfile {
  contextName: string;
  clusterName: string;
  profile: string;
  region: string;
  source: "auto-detected" | "manual-override";
}
