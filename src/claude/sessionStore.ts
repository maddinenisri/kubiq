import * as vscode from "vscode";

const MAX_MESSAGES = 50;
const STORE_PREFIX  = "kubiq.session.";

export interface StoredMessage {
  role:      "user" | "assistant";
  content:   string;
  timestamp: number;
}

export interface StoredSession {
  sessionId: string;
  messages:  StoredMessage[];
  podKey:    string;
  savedAt:   number;
}

/**
 * Persists Claude session IDs and message history per pod in VS Code's globalState.
 * This survives panel close/reopen and VS Code restarts.
 *
 * Key format: "kubiq.session.<context>/<namespace>/<podName>"
 */
export class SessionStore {
  constructor(private readonly state: vscode.Memento) {}

  /** Stable key for a pod */
  static key(context: string, namespace: string, podName: string): string {
    // Replace characters that could cause issues in storage keys
    return `${STORE_PREFIX}${context}/${namespace}/${podName}`
      .replace(/\s/g, "_");
  }

  get(podKey: string): StoredSession | undefined {
    return this.state.get<StoredSession>(podKey);
  }

  save(podKey: string, sessionId: string, messages: StoredMessage[]): void {
    const trimmed = messages.slice(-MAX_MESSAGES);
    const stored: StoredSession = {
      sessionId,
      messages: trimmed,
      podKey,
      savedAt: Date.now(),
    };
    this.state.update(podKey, stored);
  }

  addMessage(podKey: string, msg: StoredMessage): void {
    const existing = this.get(podKey);
    if (!existing) return;
    const messages = [...existing.messages, msg].slice(-MAX_MESSAGES);
    this.state.update(podKey, { ...existing, messages, savedAt: Date.now() });
  }

  /** Update just the session ID (e.g. after resume spawns a new process) */
  updateSessionId(podKey: string, sessionId: string): void {
    const existing = this.get(podKey);
    if (!existing) return;
    this.state.update(podKey, { ...existing, sessionId, savedAt: Date.now() });
  }

  clear(podKey: string): void {
    this.state.update(podKey, undefined);
  }
}
