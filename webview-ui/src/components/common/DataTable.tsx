import { useState, useCallback, type ReactNode } from "react";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number; // custom sort value extractor
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  renderActions?: (row: T) => ReactNode;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  renderActions,
  emptyMessage = "No data",
}: DataTableProps<T>) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = useCallback(
    (col: string) => {
      if (sortCol === col) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortCol(col);
        setSortDir("asc");
      }
    },
    [sortCol],
  );

  const sortedRows = sortCol
    ? [...rows].sort((a, b) => {
        const col = columns.find((c) => c.key === sortCol);
        const av = col?.sortValue ? String(col.sortValue(a)) : String((a as Record<string, unknown>)[sortCol] ?? "");
        const bv = col?.sortValue ? String(col.sortValue(b)) : String((b as Record<string, unknown>)[sortCol] ?? "");
        const cmp = av.localeCompare(bv, undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      })
    : rows;

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2.5 text-dim">
        <div className="text-2xl opacity-30">∅</div>
        <span className="text-sm">{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
                className={`sticky top-0 z-10 bg-bg3 border-b border-border2 px-2 py-1.5
                  text-left text-xs font-semibold uppercase tracking-wider text-dim
                  whitespace-nowrap select-none
                  ${col.sortable !== false ? "cursor-pointer hover:text-text" : ""}
                  ${col.headerClassName ?? ""}`}
              >
                {col.label}
                {sortCol === col.key && (
                  <span className="ml-0.5">{sortDir === "asc" ? " ↑" : " ↓"}</span>
                )}
              </th>
            ))}
            {renderActions && (
              <th className="sticky top-0 z-10 bg-bg3 border-b border-border2 w-0" />
            )}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-border transition-colors group
                ${onRowClick ? "cursor-pointer hover:bg-bg3" : ""}`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-2 py-1.5 align-middle whitespace-nowrap ${col.className ?? ""}`}
                >
                  {col.render(row)}
                </td>
              ))}
              {renderActions && (
                <td className="px-2 py-1.5 align-middle">
                  <div className="flex gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {renderActions(row)}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
