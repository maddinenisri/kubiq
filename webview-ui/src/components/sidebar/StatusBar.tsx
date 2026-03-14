import { useExtensionState } from "../../context/ExtensionStateContext";

export function StatusBar() {
  const { state } = useExtensionState();

  return (
    <div className="flex items-center justify-between px-2 py-0.5 bg-bg3 border-b border-border text-xs text-dim shrink-0">
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${state.connected ? "bg-ok" : "bg-dim"}`}
        />
        <span>{state.connected ? state.currentContext || "Connected" : "Not connected"}</span>
      </div>
      <span
        className={`text-[9px] px-1.5 rounded-full border ${
          state.hasMetrics
            ? "text-ok border-ok/30 bg-ok/10"
            : "text-dim border-border2 bg-bg3"
        }`}
      >
        metrics: {state.hasMetrics ? "on" : "off"}
      </span>
    </div>
  );
}
