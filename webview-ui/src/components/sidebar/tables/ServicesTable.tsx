import { DataTable, type Column, ActionButton } from "../../common";
import { postMessage } from "../../../lib/vscode";
import type { ServiceRow } from "@shared/types";
import { useExtensionState } from "../../../context/ExtensionStateContext";

const columns: Column<ServiceRow>[] = [
  { key: "name", label: "Name", className: "font-mono", render: (r) => <>{r.name}</> },
  { key: "namespace", label: "Namespace", className: "font-mono text-dim", render: (r) => <>{r.namespace}</> },
  {
    key: "type",
    label: "Type",
    render: (r) => (
      <span className="px-1.5 py-0.5 rounded text-xs font-mono border border-border2 text-dim bg-bg3">
        {r.type}
      </span>
    ),
  },
  { key: "clusterIp", label: "Cluster IP", className: "font-mono text-dim", render: (r) => <>{r.clusterIp}</> },
  {
    key: "externalIp",
    label: "External IP",
    className: "font-mono",
    render: (r) => <span className={r.externalIp === "—" ? "text-dim" : ""}>{r.externalIp}</span>,
  },
  { key: "ports", label: "Ports", sortable: false, className: "font-mono text-dim text-[10px]", render: (r) => <>{r.ports}</> },
  { key: "age", label: "Age", className: "text-dim", render: (r) => <>{r.age}</> },
];

export function ServicesTable({ rows }: { rows: ServiceRow[] }) {
  const { state } = useExtensionState();

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => `${r.namespace}/${r.name}`}
      onRowClick={(r) =>
        postMessage({ type: "describeResource", resource: "services", name: r.name, namespace: r.namespace, context: state.currentContext })
      }
      renderActions={(r) => (
        <ActionButton
          title="Edit YAML"
          onClick={() => postMessage({ type: "editYaml", resource: "services", name: r.name, namespace: r.namespace, context: state.currentContext })}
        >
          ✎
        </ActionButton>
      )}
      emptyMessage="No services found"
    />
  );
}
