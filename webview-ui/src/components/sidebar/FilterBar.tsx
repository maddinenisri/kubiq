import { useCallback } from "react";
import { useExtensionState } from "../../context/ExtensionStateContext";
import { postMessage } from "../../lib/vscode";

export function FilterBar() {
  const { state, dispatch } = useExtensionState();

  // User changes profile → clear cluster selection
  const handleProfileChange = useCallback(
    (_profile: string) => {
      dispatch({ type: "SET_CONTEXT", context: "" });
    },
    [dispatch],
  );

  // User selects a cluster → set context (side effect in provider auto-fetches namespaces)
  const handleClusterChange = useCallback(
    (context: string) => {
      if (!context) return;
      dispatch({ type: "SET_CONTEXT", context });
    },
    [dispatch],
  );

  // User changes namespace → clear data and refetch (side effect in provider handles it)
  const handleNamespaceChange = useCallback(
    (namespace: string) => {
      dispatch({ type: "SET_NAMESPACE", namespace });
    },
    [dispatch],
  );

  // Manual refresh
  const handleRefresh = useCallback(() => {
    if (!state.currentContext) return;
    dispatch({ type: "CLEAR_DATA" });
    dispatch({ type: "SET_LOADING", loading: true });
    postMessage({
      type: "fetch",
      context: state.currentContext,
      namespace: state.currentNamespace,
      resource: state.currentResource,
    });
  }, [dispatch, state.currentContext, state.currentNamespace, state.currentResource]);

  // Find which profile contains the current context
  const selectedProfile = Object.keys(state.clustersByProfile).find((p) =>
    state.clustersByProfile[p]?.includes(state.currentContext),
  );

  return (
    <div className="flex flex-col gap-1 p-2 bg-bg2 border-b border-border shrink-0">
      {/* Profile */}
      <div className="flex gap-1 items-center">
        <span className="text-xs text-dim uppercase tracking-wide w-[58px] shrink-0">Profile</span>
        <select
          className="flex-1 bg-bg3 border border-border2 text-text px-1.5 py-1 rounded text-sm font-mono outline-none focus:border-accent appearance-none cursor-pointer disabled:opacity-40"
          disabled={state.profiles.length === 0}
          value={selectedProfile ?? ""}
          onChange={(e) => handleProfileChange(e.target.value)}
        >
          {state.profiles.length === 0 ? (
            <option>Loading…</option>
          ) : (
            <>
              <option value="" disabled>
                Select profile…
              </option>
              {state.profiles.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      {/* Cluster */}
      <div className="flex gap-1 items-center">
        <span className="text-xs text-dim uppercase tracking-wide w-[58px] shrink-0">Cluster</span>
        <select
          className="flex-1 bg-bg3 border border-border2 text-text px-1.5 py-1 rounded text-sm font-mono outline-none focus:border-accent appearance-none cursor-pointer disabled:opacity-40"
          disabled={!selectedProfile}
          value={state.currentContext}
          onChange={(e) => handleClusterChange(e.target.value)}
        >
          <option value="" disabled>
            Select cluster…
          </option>
          {selectedProfile &&
            state.clustersByProfile[selectedProfile]?.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
        </select>
      </div>

      {/* Namespace + Refresh */}
      <div className="flex gap-1 items-center">
        <span className="text-xs text-dim uppercase tracking-wide w-[58px] shrink-0">Namespace</span>
        <select
          className="flex-1 bg-bg3 border border-border2 text-text px-1.5 py-1 rounded text-sm font-mono outline-none focus:border-accent appearance-none cursor-pointer disabled:opacity-40"
          disabled={state.namespaces.length === 0}
          value={state.currentNamespace}
          onChange={(e) => handleNamespaceChange(e.target.value)}
        >
          <option value="_all">(all namespaces)</option>
          {state.namespaces.map((ns) => (
            <option key={ns} value={ns}>
              {ns}
            </option>
          ))}
        </select>
        <button
          onClick={handleRefresh}
          disabled={!state.currentContext}
          className="flex items-center gap-1 bg-bg3 border border-border2 text-accent px-2 py-1 rounded text-sm cursor-pointer shrink-0 hover:bg-surface disabled:opacity-40 transition-colors"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 16 16"
            fill="currentColor"
            className={state.loading ? "animate-spin" : ""}
          >
            <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
          </svg>
          Refresh
        </button>
      </div>
    </div>
  );
}
