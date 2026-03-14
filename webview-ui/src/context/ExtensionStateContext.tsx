import { createContext, useContext, useReducer, useCallback, type ReactNode } from "react";
import type { ExtensionMessage } from "@shared/messages";
import type { ResourceType, ContextInfo, StoredMessage, FlaggedCommand } from "@shared/types";
import { useAllExtensionMessages } from "../hooks/useExtensionMessage";

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
  currentNamespace: "default",
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

// ── Reducer ─────────────────────────────────────────────────────────────────

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
      return { ...state, currentContext: action.context, data: {}, namespaces: [] };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_ERROR":
      return { ...state, error: action.error, loading: false };
    case "CLEAR_DATA":
      return { ...state, data: {} };

    case "EXT_MESSAGE": {
      const msg = action.message;
      switch (msg.type) {
        case "bootstrap":
          return {
            ...state,
            profiles: msg.profiles,
            clustersByProfile: msg.clustersByProfile,
            currentContext: msg.currentContext,
          };
        case "namespaces":
          return {
            ...state,
            namespaces: msg.namespaces,
            hasMetrics: msg.hasMetrics,
            connected: true,
            loading: false,
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
        case "turn_complete":
          return {
            ...state,
            streaming: false,
            streamText: "",
            chatMessages: [
              ...state.chatMessages,
              { role: "assistant", content: msg.fullText, timestamp: Date.now() },
            ],
            flaggedCommands: msg.flaggedCommands ?? [],
          };
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

  const handleMessage = useCallback(
    (message: ExtensionMessage) => {
      dispatch({ type: "EXT_MESSAGE", message });
    },
    [dispatch],
  );

  useAllExtensionMessages(handleMessage);

  return (
    <ExtensionStateCtx.Provider value={{ state, dispatch }}>
      {children}
    </ExtensionStateCtx.Provider>
  );
}

export function useExtensionState() {
  const ctx = useContext(ExtensionStateCtx);
  if (!ctx) throw new Error("useExtensionState must be inside ExtensionStateProvider");
  return ctx;
}
