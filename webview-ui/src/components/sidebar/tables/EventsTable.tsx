import { DataTable, type Column } from "../../common";
import type { EventRow } from "@shared/types";

const columns: Column<EventRow>[] = [
  { key: "lastSeen", label: "Age", className: "text-dim", render: (r) => <>{r.lastSeen}</> },
  {
    key: "type",
    label: "Type",
    render: (r) => (
      <span className={r.type === "Warning" ? "text-warn" : "text-dim"}>{r.type}</span>
    ),
  },
  { key: "reason", label: "Reason", className: "font-mono", render: (r) => <>{r.reason}</> },
  {
    key: "object",
    label: "Object",
    className: "font-mono text-dim text-[10px]",
    render: (r) => <>{r.object}</>,
  },
  {
    key: "namespace",
    label: "Namespace",
    className: "font-mono text-dim",
    render: (r) => <>{r.namespace}</>,
  },
  {
    key: "message",
    label: "Message",
    sortable: false,
    className: "text-dim text-[10px]",
    render: (r) => <span className="max-w-[200px] truncate inline-block">{r.message}</span>,
  },
];

export function EventsTable({ rows }: { rows: EventRow[] }) {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => `${r.object}-${r.reason}-${r.lastSeen}-${r.message.slice(0, 20)}`}
      emptyMessage="No events found"
    />
  );
}
