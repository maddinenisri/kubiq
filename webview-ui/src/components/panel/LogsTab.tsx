import { useState } from "react";
import type { PodSnapshotTransfer } from "@shared/types";

interface LogsTabProps {
  snapshot: PodSnapshotTransfer | null;
}

export function LogsTab({ snapshot }: LogsTabProps) {
  const containers = snapshot ? Object.keys(snapshot.logs) : [];
  const hasPrev = snapshot ? Object.keys(snapshot.previousLogs).length > 0 : false;
  const [active, setActive] = useState(containers[0] ?? "");

  if (!snapshot) return <div className="p-4 text-dim text-sm">Loading…</div>;

  return (
    <div className="flex flex-col flex-1 overflow-hidden p-2.5 gap-2">
      {/* Container tabs */}
      <div className="flex gap-1 shrink-0 flex-wrap">
        {containers.map((name) => (
          <button
            key={name}
            onClick={() => setActive(name)}
            className={`px-3 py-1 rounded text-xs font-mono cursor-pointer border transition-colors
              ${
                active === name
                  ? "bg-ok/10 border-ok/30 text-ok"
                  : "bg-bg3 border-border2 text-dim hover:border-accent hover:text-text"
              }`}
          >
            {name}
          </button>
        ))}
        {hasPrev && (
          <button
            onClick={() => setActive("__prev")}
            className={`px-3 py-1 rounded text-xs font-mono cursor-pointer border transition-colors
              ${
                active === "__prev"
                  ? "bg-warn/10 border-warn/30 text-warn"
                  : "bg-bg3 border-border2 text-warn/60 hover:border-warn"
              }`}
          >
            previous run
          </button>
        )}
      </div>

      {/* Log content */}
      <div className="flex-1 overflow-auto">
        {active === "__prev" ? (
          <div>
            {Object.entries(snapshot.previousLogs).map(([name, log]) => (
              <div key={name}>
                <div className="text-xs text-warn my-2">
                  Previous: <strong>{name}</strong>
                </div>
                <pre className="bg-bg2/80 border border-warn/20 rounded p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all min-h-[100px]">
                  {log || "(no output)"}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <pre className="bg-bg2 border border-border rounded p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all min-h-[100px]">
            {snapshot.logs[active]?.trim() || "(no output)"}
          </pre>
        )}
      </div>
    </div>
  );
}
