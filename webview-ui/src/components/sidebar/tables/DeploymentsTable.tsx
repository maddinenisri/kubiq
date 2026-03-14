import { DataTable, type Column, StatusChip, ActionButton } from "../../common";
import { postMessage } from "../../../lib/vscode";
import type { DeployRow } from "@shared/types";
import { useExtensionState } from "../../../context/ExtensionStateContext";

const columns: Column<DeployRow>[] = [
  { key: "name", label: "Name", className: "font-mono", render: (r) => <>{r.name}</> },
  { key: "namespace", label: "Namespace", className: "font-mono text-dim", render: (r) => <>{r.namespace}</> },
  {
    key: "ready",
    label: "Ready",
    sortable: false,
    render: (r) => {
      const [cur, total] = r.ready.split("/");
      return <StatusChip status={cur === total ? "Running" : "Pending"} className="!text-xs">{r.ready}</StatusChip>;
    },
  },
  { key: "upToDate", label: "Up-to-date", className: "font-mono text-dim", render: (r) => <>{r.upToDate}</> },
  { key: "available", label: "Available", className: "font-mono text-dim", render: (r) => <>{r.available}</> },
  { key: "age", label: "Age", className: "text-dim", render: (r) => <>{r.age}</> },
];

export function DeploymentsTable({ rows }: { rows: DeployRow[] }) {
  const { state } = useExtensionState();

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => `${r.namespace}/${r.name}`}
      onRowClick={(r) =>
        postMessage({ type: "describeResource", resource: "deployments", name: r.name, namespace: r.namespace, context: state.currentContext })
      }
      renderActions={(r) => (
        <ActionButton
          title="Edit YAML"
          onClick={() => postMessage({ type: "editYaml", resource: "deployments", name: r.name, namespace: r.namespace, context: state.currentContext })}
        >
          ✎
        </ActionButton>
      )}
      emptyMessage="No deployments found"
    />
  );
}
