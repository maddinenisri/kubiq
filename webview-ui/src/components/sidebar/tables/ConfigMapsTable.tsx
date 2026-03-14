import { DataTable, type Column, ActionButton } from "../../common";
import { postMessage } from "../../../lib/vscode";
import type { ConfigMapRow } from "@shared/types";
import { useExtensionState } from "../../../context/ExtensionStateContext";

const columns: Column<ConfigMapRow>[] = [
  { key: "name", label: "Name", className: "font-mono", render: (r) => <>{r.name}</> },
  {
    key: "namespace",
    label: "Namespace",
    className: "font-mono text-dim",
    render: (r) => <>{r.namespace}</>,
  },
  { key: "data", label: "Keys", className: "font-mono text-dim", render: (r) => <>{r.data}</> },
  { key: "age", label: "Age", className: "text-dim", render: (r) => <>{r.age}</> },
];

export function ConfigMapsTable({ rows }: { rows: ConfigMapRow[] }) {
  const { state } = useExtensionState();

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => `${r.namespace}/${r.name}`}
      onRowClick={(r) =>
        postMessage({
          type: "describeResource",
          resource: "configmaps",
          name: r.name,
          namespace: r.namespace,
          context: state.currentContext,
        })
      }
      renderActions={(r) => (
        <ActionButton
          title="Edit YAML"
          onClick={() =>
            postMessage({
              type: "editYaml",
              resource: "configmaps",
              name: r.name,
              namespace: r.namespace,
              context: state.currentContext,
            })
          }
        >
          ✎
        </ActionButton>
      )}
      emptyMessage="No configmaps found"
    />
  );
}
