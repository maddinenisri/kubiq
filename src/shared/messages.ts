/**
 * Typed message protocol between extension host and webview.
 * Discriminated unions ensure type safety across the postMessage boundary.
 */

import type {
  ResourceType,
  PodSnapshotTransfer,
  StoredMessage,
  FlaggedCommand,
  ContextInfo,
} from "./types";

// ── Messages FROM extension host TO webview ─────────────────────────────────

export type ExtensionMessage =
  // Sidebar bootstrap
  | {
      type: "bootstrap";
      profiles: string[];
      clustersByProfile: Record<string, string[]>;
      currentContext: string;
    }
  | { type: "namespaces"; context: string; namespaces: string[]; hasMetrics: boolean }
  | { type: "data"; resource: ResourceType; rows: unknown[] }
  | { type: "refresh" }
  | { type: "error"; message: string }
  // Pod panel
  | { type: "snapshot"; snapshot: PodSnapshotTransfer }
  | { type: "thinking" }
  | { type: "text_delta"; text: string }
  | {
      type: "turn_complete";
      fullText: string;
      flaggedCommands?: FlaggedCommand[];
    }
  | { type: "chat_history"; messages: StoredMessage[] }
  | ({ type: "context_info" } & ContextInfo)
  // Resource panel
  | { type: "applySuccess" };

// ── Messages FROM webview TO extension host ──────────────────────────────────

export type WebviewMessage =
  // Sidebar
  | { type: "init" }
  | { type: "getNamespaces"; context: string }
  | { type: "fetch"; context: string; namespace: string; resource: ResourceType }
  | { type: "diagnose"; pod: string; namespace: string; context: string; tab?: string }
  | {
      type: "describeResource";
      resource: string;
      name: string;
      namespace: string;
      context: string;
    }
  | {
      type: "editYaml";
      resource: string;
      name: string;
      namespace: string;
      context: string;
    }
  | { type: "restartPod"; pod: string; namespace: string; context: string }
  | {
      type: "portForward";
      pod: string;
      namespace: string;
      context: string;
      localPort: string;
      remotePort: string;
    }
  | {
      type: "scaleDeployment";
      name: string;
      namespace: string;
      context: string;
      replicas: number;
    }
  // Pod panel
  | { type: "ready" }
  | { type: "user_message"; text: string }
  | { type: "new_chat" }
  // Resource panel
  | { type: "applyYaml"; yaml: string };
