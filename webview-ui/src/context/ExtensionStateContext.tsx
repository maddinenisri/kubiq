import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { ExtensionMessage } from "@shared/messages";
import type { ResourceType, ContextInfo, StoredMessage, FlaggedCommand } from "@shared/types";
import { useAllExtensionMessages } from "../hooks/useExtensionMessage";
import { postMessage } from "../lib/vscode";

// ── State shape ─────────────────────────────────────────────────────────────

export interface ExtensionState {
  // Sidebar
  profiles: string[];
  clustersByProfile: Record<string, string[]>;
  currentContext: string;
  currentNamespace: string;
  currentResource: ResourceType;
  namespaces: string[];
  hasMetrics: boolean;
  data: Partial<Record<ResourceType, unknown[]>>;
  connected: boolean;
  loading: boolean;
  error: string | null;

  // Pod panel
  snapshot: unknown | null;
  chatMessages: StoredMessage[];
  streaming: boolean;
  streamText: string;
  contextInfo: ContextInfo | null;
  flaggedCommands: FlaggedCommand[];
}

const initialState: ExtensionState = {
  profiles: [],
  clustersByProfile: {},
  currentContext: "",
  currentNamespace: "_all",
  currentResource: "pods",
  namespaces: [],
  hasMetrics: false,
  data: {},
  connected: false,
  loading: false,
  error: null,
  snapshot: null,
  chatMessages: [],
  streaming: false,
  streamText: "",
  contextInfo: null,
  flaggedCommands: [],
};

// ── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | { type: "SET_RESOURCE"; resource: ResourceType }
  | { type: "SET_NAMESPACE"; namespace: string }
  | { type: "SET_CONTEXT"; context: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "CLEAR_DATA" }
  | { type: "EXT_MESSAGE"; message: ExtensionMessage };

function reducer(state: ExtensionState, action: Action): ExtensionState {
  switch (action.type) {
    case "SET_RESOURCE":
      return { ...state, currentResource: action.resource };
    case "SET_NAMESPACE":
      return { ...state, currentNamespace: action.namespace, data: {} };
    case "SET_CONTEXT":
      // Don't reset if same context
      if (state.currentContext === action.context) return state;
      return {
        ...state,
        currentContext: action.context,
        data: {},
        namespaces: [],
        connected: false,
      };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_ERROR":
      return { ...state, error: action.error, loading: false };
    case "CLEAR_DATA":
      return { ...state, data: {} };

    case "EXT_MESSAGE": {
      const msg = action.message;
      switch (msg.type) {
        case "bootstrap": {
          // Idempotent: don't reset if already bootstrapped with same context
          if (state.profiles.length > 0 && state.currentContext === msg.currentContext) {
            return state;
          }
          return {
            ...state,
            profiles: msg.profiles,
            clustersByProfile: msg.clustersByProfile,
            currentContext: msg.currentContext,
            loading: !!msg.currentContext,
          };
        }
        case "namespaces":
          return {
            ...state,
            namespaces: msg.namespaces,
            hasMetrics: msg.hasMetrics,
            connected: true,
            loading: true, // Keep loading — we'll auto-fetch resources next
          };
        case "data":
          return {
            ...state,
            data: { ...state.data, [msg.resource]: msg.rows },
            loading: false,
          };
        case "snapshot":
          return { ...state, snapshot: msg.snapshot };
        case "thinking":
          return { ...state, streaming: true, streamText: "" };
        case "text_delta":
          return { ...state, streamText: state.streamText + msg.text };
        case "turn_complete": {
          // Ignore empty turn_complete (race condition with streaming deltas)
          if (!msg.fullText && !state.streamText) {
            return state;
          }
          const content = msg.fullText || state.streamText;
          if (!content) return state;
          return {
            ...state,
            streaming: false,
            streamText: "",
            chatMessages: [
              ...state.chatMessages,
              { role: "assistant", content, timestamp: Date.now() },
            ],
            flaggedCommands: msg.flaggedCommands ?? [],
          };
        }
        case "chat_history":
          return { ...state, chatMessages: msg.messages };
        case "context_info":
          return {
            ...state,
            contextInfo: {
              preset: msg.preset,
              skills: msg.skills,
              sanitization: msg.sanitization,
              customInstructions: msg.customInstructions,
            },
          };
        case "error":
          return { ...state, error: msg.message, loading: false, streaming: false };
        case "refresh":
          return { ...state, data: {}, loading: true };
        default:
          return state;
      }
    }
    default:
      return state;
  }
}

// ── Context ─────────────────────────────────────────────────────────────────

const ExtensionStateCtx = createContext<{
  state: ExtensionState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function ExtensionStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Global message listener — ALL messages from extension host flow through here
  const handleMessage = useCallback(
    (message: ExtensionMessage) => {
      console.log("[Kubiq] received:", message.type, message);
      dispatch({ type: "EXT_MESSAGE", message });
    },
    [dispatch],
  );
  useAllExtensionMessages(handleMessage);

  // ── Side effects — react to state changes ─────────────────────────────────

  // When context changes (from bootstrap or user selection), fetch namespaces
  useEffect(() => {
    if (state.currentContext && !state.connected && state.namespaces.length === 0) {
      postMessage({ type: "getNamespaces", context: state.currentContext });
    }
  }, [state.currentContext, state.connected, state.namespaces.length]);

  // When connected and current resource has no data, auto-fetch
  useEffect(() => {
    if (state.connected && state.currentContext && !state.data[state.currentResource]) {
      postMessage({
        type: "fetch",
        context: state.currentContext,
        namespace: state.currentNamespace,
        resource: state.currentResource,
      });
    }
  }, [
    state.connected,
    state.currentContext,
    state.currentNamespace,
    state.currentResource,
    state.data,
  ]);

  // When refresh is triggered (data cleared + loading), re-fetch current resource
  useEffect(() => {
    if (
      state.loading &&
      state.connected &&
      state.currentContext &&
      Object.keys(state.data).length === 0
    ) {
      postMessage({
        type: "fetch",
        context: state.currentContext,
        namespace: state.currentNamespace,
        resource: state.currentResource,
      });
    }
  }, [
    state.loading,
    state.connected,
    state.currentContext,
    state.currentNamespace,
    state.currentResource,
    state.data,
  ]);

  return (
    <ExtensionStateCtx.Provider value={{ state, dispatch }}>{children}</ExtensionStateCtx.Provider>
  );
}

export function useExtensionState() {
  const ctx = useContext(ExtensionStateCtx);
  if (!ctx) throw new Error("useExtensionState must be inside ExtensionStateProvider");
  return ctx;
}
