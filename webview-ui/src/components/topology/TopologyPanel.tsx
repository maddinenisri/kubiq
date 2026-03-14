import { useState, useEffect, useCallback } from "react";
import { NodeCard } from "./NodeCard";
import { postMessage } from "../../lib/vscode";
import type { TopologyData, TopologyNode } from "@shared/types";

type GroupBy = "none" | "zone" | "nodeGroup";
type Filter = "all" | "problems";

export function TopologyPanel() {
  const [data, setData] = useState<TopologyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [filter, setFilter] = useState<Filter>("all");

  const root = document.getElementById("root")!;
  const context = root.dataset.context ?? "";

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const msg = event.data;
      if (msg.type === "topologyData") {
        setData(msg.data);
        setLoading(false);
        setError(null);
      }
      if (msg.type === "topologyLoading") setLoading(true);
      if (msg.type === "topologyError") {
        setError(msg.message);
        setLoading(false);
      }
    }
    window.addEventListener("message", onMessage);
    // Request data
    postMessage({ type: "fetchTopology", context } as never);
    return () => window.removeEventListener("message", onMessage);
  }, [context]);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    postMessage({ type: "fetchTopology", context } as never);
  }, [context]);

  // Filter
  const filteredNodes = data?.nodes.filter((n) => {
    if (filter === "all") return true;
    return (
      n.status !== "Ready" ||
      n.memoryPressure ||
      n.diskPressure ||
      n.pods.some((p) => {
        const s = p.status.toLowerCase();
        return s.includes("crash") || s.includes("error") || s.includes("failed") || s.includes("oom");
      })
    );
  }) ?? [];

  // Group
  const groups = new Map<string, TopologyNode[]>();
  if (groupBy === "none") {
    groups.set("All Nodes", filteredNodes);
  } else {
    for (const node of filteredNodes) {
      const key = groupBy === "zone" ? (node.zone || "Unknown Zone") : (node.nodeGroup || "Default");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(node);
    }
  }

  // Stats
  const totalNodes = data?.nodes.length ?? 0;
  const notReady = data?.nodes.filter((n) => n.status !== "Ready").length ?? 0;
  const totalPods = data?.nodes.reduce((sum, n) => sum + n.podCount, 0) ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", color: "#c8cfe0" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "#13161d", borderBottom: "1px solid #252a38" }}>
        <span style={{ color: "#4af0c8", fontSize: 16 }}>⬡</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#e8ecf8" }}>Node Topology</span>
        <span style={{ fontSize: 11, color: "#5a6380", marginLeft: "auto" }}>
          {totalNodes} node{totalNodes !== 1 ? "s" : ""}
          {notReady > 0 && <span style={{ color: "#f05a5a" }}> • {notReady} NotReady</span>}
          {" • "}{totalPods} pods
        </span>
      </header>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, padding: "8px 16px", background: "#13161d", borderBottom: "1px solid #252a38", alignItems: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, color: "#5a6380" }}>Group by:</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            style={{ background: "#1a1e28", border: "1px solid #2e3448", color: "#c8cfe0", padding: "3px 6px", borderRadius: 3, fontSize: 11, outline: "none" }}
          >
            <option value="none">None</option>
            <option value="zone">Availability Zone</option>
            <option value="nodeGroup">Node Group</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, color: "#5a6380" }}>Filter:</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            style={{ background: "#1a1e28", border: "1px solid #2e3448", color: "#c8cfe0", padding: "3px 6px", borderRadius: 3, fontSize: 11, outline: "none" }}
          >
            <option value="all">All Nodes</option>
            <option value="problems">Problem Nodes Only</option>
          </select>
        </div>

        <button
          onClick={handleRefresh}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "#1a1e28", border: "1px solid #2e3448", color: "#4af0c8",
            padding: "3px 10px", borderRadius: 3, fontSize: 11, cursor: "pointer",
          }}
        >
          ↺ Refresh
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 10, color: "#5a6380" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #2e3448", borderTopColor: "#4af0c8", animation: "spin 0.7s linear infinite" }} />
            <span style={{ fontSize: 12 }}>Fetching node topology…</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && (
          <div style={{ margin: 12, background: "rgba(240,90,90,0.1)", border: "1px solid #f05a5a", borderRadius: 4, padding: 12, color: "#f05a5a", fontSize: 12 }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {!loading && !error && filteredNodes.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 10, color: "#5a6380" }}>
            <div style={{ fontSize: 24, opacity: 0.3 }}>∅</div>
            <span style={{ fontSize: 12 }}>No nodes found{filter === "problems" ? " with problems" : ""}</span>
          </div>
        )}

        {!loading && !error && Array.from(groups.entries()).map(([groupName, nodes]) => (
          <div key={groupName} style={{ marginBottom: 16 }}>
            {groupBy !== "none" && (
              <div style={{ fontSize: 11, fontWeight: 600, color: "#5a6380", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {groupName} ({nodes.length})
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {nodes.map((node) => (
                <NodeCard key={node.name} node={node} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
