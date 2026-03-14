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

export type ResourceType = "pods" | "deployments" | "services" | "configmaps" | "nodes" | "events";

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
