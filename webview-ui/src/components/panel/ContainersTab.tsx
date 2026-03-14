import { StatusChip } from "../common";
import type { PodSnapshotTransfer } from "@shared/types";

interface ContainersTabProps {
  snapshot: PodSnapshotTransfer | null;
}

export function ContainersTab({ snapshot }: ContainersTabProps) {
  if (!snapshot) return <div className="p-4 text-dim text-sm">Loading…</div>;

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="text-xs font-semibold uppercase tracking-widest text-dim mb-2.5">
        Container Status
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {["Name", "State", "Restarts", "Image", "Last State"].map((h) => (
                <th
                  key={h}
                  className="text-left px-3 py-1.5 bg-bg3 border-b border-border2 text-[10px] font-semibold uppercase tracking-wider text-dim"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {snapshot.containers.map((c) => (
              <tr key={c.name} className="border-b border-border hover:bg-bg3">
                <td className="px-3 py-2 font-mono">{c.name}</td>
                <td className="px-3 py-2">
                  <StatusChip status={c.state.split(":")[0] ?? c.state} />
                </td>
                <td className={`px-3 py-2 ${c.restartCount > 3 ? "text-warn font-semibold" : ""}`}>
                  {c.restartCount}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-dim">{c.image}</td>
                <td className="px-3 py-2 text-xs text-dim">{c.lastState ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs font-semibold uppercase tracking-widest text-dim mt-5 mb-2.5">
        Pod Conditions
      </div>
      <div className="flex flex-wrap gap-2">
        {snapshot.conditions.map((c) => (
          <div
            key={c.type}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs border ${
              c.status === "True"
                ? "bg-ok/10 border-ok/30"
                : "bg-err/10 border-err/30"
            }`}
          >
            <span className="font-semibold">{c.type}</span>
            <span className="font-mono">{c.status}</span>
            {c.reason && <span className="text-dim">{c.reason}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
