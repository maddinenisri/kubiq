import { useState } from "react";
import { DataTable, type Column } from "../../common";
import { useExtensionState } from "../../../context/ExtensionStateContext";
import { postMessage } from "../../../lib/vscode";
import type { ServiceAccountRow, RoleRow, BindingRow } from "@shared/types";

type RbacSubTab = "serviceaccounts" | "roles" | "bindings";

const SA_COLUMNS: Column<ServiceAccountRow>[] = [
  {
    key: "name",
    label: "Name",
    className: "font-mono",
    render: (r) => (
      <div>
        <div>{r.name}</div>
        {r.warnings.length > 0 && (
          <span style={{ color: "#f05a5a", fontSize: 9 }}>
            {r.warnings.length} warning{r.warnings.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
    ),
  },
  { key: "namespace", label: "Namespace", className: "font-mono text-dim", render: (r) => <>{r.namespace}</> },
  { key: "secrets", label: "Secrets", className: "text-dim", render: (r) => <>{r.secrets}</> },
  {
    key: "boundRoles",
    label: "Bound Roles",
    className: "text-dim text-[10px]",
    render: (r) => <>{r.boundRoles.join(", ") || "—"}</>,
  },
  { key: "age", label: "Age", className: "text-dim", render: (r) => <>{r.age}</> },
];

const ROLE_COLUMNS: Column<RoleRow>[] = [
  { key: "name", label: "Name", className: "font-mono", render: (r) => <>{r.name}</> },
  {
    key: "kind",
    label: "Kind",
    render: (r) => (
      <span
        style={{
          padding: "1px 6px",
          borderRadius: 3,
          fontSize: 10,
          fontFamily: "monospace",
          border: `1px solid ${r.kind === "ClusterRole" ? "rgba(58,123,213,0.3)" : "rgba(90,99,128,0.3)"}`,
          color: r.kind === "ClusterRole" ? "#3a7bd5" : "#5a6380",
        }}
      >
        {r.kind}
      </span>
    ),
  },
  { key: "ruleCount", label: "Rules", className: "text-dim", render: (r) => <>{r.ruleCount}</> },
  {
    key: "warnings",
    label: "",
    sortable: false,
    render: (r) =>
      r.warnings.length > 0 ? (
        <span style={{ color: "#f05a5a", fontSize: 10 }}>⚠ {r.warnings.length}</span>
      ) : null,
  },
  { key: "age", label: "Age", className: "text-dim", render: (r) => <>{r.age}</> },
];

const BINDING_COLUMNS: Column<BindingRow>[] = [
  { key: "name", label: "Name", className: "font-mono", render: (r) => <>{r.name}</> },
  {
    key: "kind",
    label: "Kind",
    render: (r) => (
      <span
        style={{
          padding: "1px 6px",
          borderRadius: 3,
          fontSize: 10,
          fontFamily: "monospace",
          border: "1px solid rgba(90,99,128,0.3)",
          color: "#5a6380",
        }}
      >
        {r.kind}
      </span>
    ),
  },
  { key: "roleRef", label: "Role", className: "font-mono text-dim text-[10px]", render: (r) => <>{r.roleRef}</> },
  {
    key: "subjects",
    label: "Subjects",
    className: "text-dim text-[10px]",
    render: (r) => <>{r.subjects.length} subject{r.subjects.length !== 1 ? "s" : ""}</>,
  },
  { key: "age", label: "Age", className: "text-dim", render: (r) => <>{r.age}</> },
];

interface RbacViewProps {
  data: {
    serviceAccounts: ServiceAccountRow[];
    roles: RoleRow[];
    bindings: BindingRow[];
  };
}

export function RbacView({ data }: RbacViewProps) {
  const [subTab, setSubTab] = useState<RbacSubTab>("serviceaccounts");
  const { state } = useExtensionState();

  const tabs: Array<{ key: RbacSubTab; label: string; count: number }> = [
    { key: "serviceaccounts", label: "Service Accounts", count: data.serviceAccounts.length },
    { key: "roles", label: "Roles", count: data.roles.length },
    { key: "bindings", label: "Bindings", count: data.bindings.length },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #252a38", flexShrink: 0 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            style={{
              padding: "6px 10px",
              fontSize: 10,
              fontWeight: 500,
              cursor: "pointer",
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${subTab === t.key ? "#4af0c8" : "transparent"}`,
              color: subTab === t.key ? "#4af0c8" : "#5a6380",
            }}
          >
            {t.label}
            <span
              style={{
                marginLeft: 4,
                fontSize: 9,
                padding: "0 4px",
                borderRadius: 8,
                border: `1px solid ${subTab === t.key ? "rgba(74,240,200,0.3)" : "#2e3448"}`,
                color: subTab === t.key ? "#4af0c8" : "#5a6380",
              }}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {subTab === "serviceaccounts" && (
        <DataTable
          columns={SA_COLUMNS}
          rows={data.serviceAccounts}
          rowKey={(r) => `${r.namespace}/${r.name}`}
          onRowClick={(r) =>
            postMessage({
              type: "describeResource",
              resource: "serviceaccounts",
              name: r.name,
              namespace: r.namespace,
              context: state.currentContext,
            } as never)
          }
          emptyMessage="No service accounts found"
        />
      )}
      {subTab === "roles" && (
        <DataTable
          columns={ROLE_COLUMNS}
          rows={data.roles}
          rowKey={(r) => `${r.kind}/${r.namespace}/${r.name}`}
          emptyMessage="No roles found"
        />
      )}
      {subTab === "bindings" && (
        <DataTable
          columns={BINDING_COLUMNS}
          rows={data.bindings}
          rowKey={(r) => `${r.kind}/${r.namespace}/${r.name}`}
          emptyMessage="No bindings found"
        />
      )}
    </div>
  );
}
