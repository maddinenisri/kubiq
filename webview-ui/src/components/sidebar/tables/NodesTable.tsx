import { DataTable, type Column, StatusDot, StatusChip } from "../../common";
import { postMessage } from "../../../lib/vscode";
import type { NodeRow } from "@shared/types";
import { useExtensionState } from "../../../context/ExtensionStateContext";

const baseColumns: Column<NodeRow>[] = [
  { key: "dot", label: "", sortable: false, render: (r) => <StatusDot status={r.status} /> },
  { key: "name", label: "Name", className: "font-mono", render: (r) => <>{r.name}</> },
  { key: "status", label: "Status", render: (r) => <StatusChip status={r.status} /> },
  { key: "roles", label: "Roles", className: "text-dim", render: (r) => <>{r.roles}</> },
  { key: "age", label: "Age", className: "text-dim", render: (r) => <>{r.age}</> },
  { key: "version", label: "Version", className: "font-mono text-dim", render: (r) => <>{r.version}</> },
];

export function NodesTable({ rows }: { rows: NodeRow[] }) {
  const { state } = useExtensionState();
  const hasMetrics = state.hasMetrics && rows.some((r) => r.cpu);

  const columns: Column<NodeRow>[] = hasMetrics
    ? [
        ...baseColumns,
        { key: "cpu", label: "CPU", className: "font-mono text-dim", render: (r) => <>{r.cpu ?? "—"}</> },
        { key: "mem", label: "Mem", className: "font-mono text-dim", render: (r) => <>{r.mem ?? "—"}</> },
      ]
    : baseColumns;

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.name}
      onRowClick={(r) =>
        postMessage({ type: "describeResource", resource: "nodes", name: r.name, namespace: "", context: state.currentContext })
      }
      emptyMessage="No nodes found"
    />
  );
}
