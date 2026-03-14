import { DataTable, type Column, StatusDot, StatusChip, ActionButton } from "../../common";
import { postMessage } from "../../../lib/vscode";
import type { PodRow } from "@shared/types";
import { useExtensionState } from "../../../context/ExtensionStateContext";

const columns: Column<PodRow>[] = [
  {
    key: "status",
    label: "",
    sortable: false,
    render: (r) => <StatusDot status={r.status} />,
  },
  {
    key: "name",
    label: "Name",
    className: "font-mono",
    render: (r) => (
      <div>
        <div className="truncate max-w-[220px]">{r.name}</div>
        <div className="text-[9px] text-dim">{r.namespace}</div>
      </div>
    ),
  },
  {
    key: "status_chip",
    label: "Status",
    sortable: false,
    render: (r) => <StatusChip status={r.status} />,
  },
  {
    key: "ready",
    label: "Ready",
    sortable: false,
    className: "font-mono text-dim",
    render: (r) => <>{r.ready}</>,
  },
  {
    key: "restarts",
    label: "↺",
    render: (r) => (
      <span className={r.restarts > 5 ? "text-err" : r.restarts > 0 ? "text-warn" : "text-dim"}>
        {r.restarts}
      </span>
    ),
  },
  { key: "age", label: "Age", className: "text-dim", render: (r) => <>{r.age}</> },
  {
    key: "node",
    label: "Node",
    className: "font-mono text-dim text-[10px]",
    render: (r) => <span className="truncate max-w-[120px] inline-block">{r.node}</span>,
  },
];

export function PodsTable({ rows }: { rows: PodRow[] }) {
  const { state } = useExtensionState();
  const hasMetrics = state.hasMetrics && rows.some((r) => r.cpu);

  const allColumns: Column<PodRow>[] = hasMetrics
    ? [
        ...columns,
        {
          key: "cpu",
          label: "CPU",
          className: "font-mono text-dim",
          render: (r) => <>{r.cpu ?? "—"}</>,
        },
        {
          key: "mem",
          label: "Mem",
          className: "font-mono text-dim",
          render: (r) => <>{r.mem ?? "—"}</>,
        },
      ]
    : columns;

  return (
    <DataTable
      columns={allColumns}
      rows={rows}
      rowKey={(r) => `${r.namespace}/${r.name}`}
      onRowClick={(r) =>
        postMessage({
          type: "diagnose",
          pod: r.name,
          namespace: r.namespace,
          context: state.currentContext,
        })
      }
      renderActions={(r) => (
        <>
          <ActionButton
            variant="accent"
            title="AI Diagnose"
            onClick={() =>
              postMessage({
                type: "diagnose",
                pod: r.name,
                namespace: r.namespace,
                context: state.currentContext,
              })
            }
          >
            ⬡ AI
          </ActionButton>
          <ActionButton
            title="View Logs"
            onClick={() =>
              postMessage({
                type: "diagnose",
                pod: r.name,
                namespace: r.namespace,
                context: state.currentContext,
                tab: "logs",
              })
            }
          >
            Logs
          </ActionButton>
          <ActionButton
            title="Edit YAML"
            onClick={() =>
              postMessage({
                type: "editYaml",
                resource: "pods",
                name: r.name,
                namespace: r.namespace,
                context: state.currentContext,
              })
            }
          >
            ✎
          </ActionButton>
          <ActionButton
            title="Restart Pod"
            onClick={() =>
              postMessage({
                type: "restartPod",
                pod: r.name,
                namespace: r.namespace,
                context: state.currentContext,
              })
            }
          >
            ↺
          </ActionButton>
          <ActionButton
            title="Port Forward"
            onClick={() => {
              const local = prompt("Local port(s) (e.g. 8080 or 8080,9090):");
              const remote = prompt("Container port(s):", local ?? "");
              if (local && remote)
                postMessage({
                  type: "portForward",
                  pod: r.name,
                  namespace: r.namespace,
                  context: state.currentContext,
                  localPort: local,
                  remotePort: remote,
                });
            }}
          >
            ⇄
          </ActionButton>
        </>
      )}
      emptyMessage="No pods found"
    />
  );
}
