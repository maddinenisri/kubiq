import { useCallback } from "react";
import { useExtensionState } from "../../context/ExtensionStateContext";
import { postMessage } from "../../lib/vscode";
import type { ResourceType } from "@shared/types";

const TABS: Array<{ key: ResourceType; label: string }> = [
  { key: "pods", label: "Pods" },
  { key: "deployments", label: "Deploys" },
  { key: "services", label: "Services" },
  { key: "configmaps", label: "ConfigMaps" },
  { key: "nodes", label: "Nodes" },
  { key: "events", label: "Events" },
];

export function ResourceTabs() {
  const { state, dispatch } = useExtensionState();

  const handleTabClick = useCallback(
    (resource: ResourceType) => {
      dispatch({ type: "SET_RESOURCE", resource });
      if (!state.data[resource] && state.currentContext) {
        dispatch({ type: "SET_LOADING", loading: true });
        postMessage({
          type: "fetch",
          context: state.currentContext,
          namespace: state.currentNamespace,
          resource,
        });
      }
    },
    [dispatch, state.data, state.currentContext, state.currentNamespace],
  );

  return (
    <div className="flex bg-bg2 border-b border-border shrink-0 overflow-x-auto">
      {TABS.map((tab) => {
        const isActive = state.currentResource === tab.key;
        const count = state.data[tab.key]?.length;
        return (
          <button
            key={tab.key}
            onClick={() => handleTabClick(tab.key)}
            className={`px-2.5 py-1.5 text-sm font-medium whitespace-nowrap border-b-2 shrink-0 cursor-pointer transition-colors
              ${isActive
                ? "text-accent border-accent"
                : "text-dim border-transparent hover:text-text"
              }`}
          >
            {tab.label}
            {count !== undefined && (
              <span
                className={`ml-1 text-[9px] px-1.5 rounded-full border inline-block
                  ${isActive
                    ? "border-accent/30 text-accent"
                    : "border-border2 text-dim bg-bg3"
                  }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
