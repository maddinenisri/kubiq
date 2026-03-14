import { useState } from "react";
import { ResourceBar } from "./ResourceBar";
import type { TopologyNode } from "@shared/types";

function formatMem(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)}Gi`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)}Mi`;
  return `${Math.round(bytes / 1024)}Ki`;
}

function formatCpu(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}` : `${m}m`;
}

function nodeColor(node: TopologyNode): string {
  if (node.status !== "Ready") return "#f05a5a";
  if (node.memoryPressure || node.diskPressure) return "#f0a84a";
  return "#4af0c8";
}

function podDotColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "running" || s === "completed") return "#4af0c8";
  if (s.includes("pending") || s.includes("init")) return "#f0a84a";
  return "#f05a5a";
}

export function NodeCard({ node }: { node: TopologyNode }) {
  const [expanded, setExpanded] = useState(false);
  const color = nodeColor(node);

  return (
    <div
      style={{
        background: "#13161d",
        border: `1px solid #252a38`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        padding: 12,
        minWidth: 300,
        flex: "1 1 300px",
        maxWidth: 450,
        cursor: "pointer",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
          <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "#e8ecf8" }}>
            {node.name.length > 25 ? node.name.slice(0, 25) + "…" : node.name}
          </span>
        </div>
        <span style={{ fontSize: 10, color, fontWeight: 600 }}>{node.status}</span>
      </div>

      {/* Meta */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        {node.instanceType && (
          <span style={{ fontSize: 9, color: "#5a6380", padding: "1px 5px", border: "1px solid #2e3448", borderRadius: 3 }}>
            {node.instanceType}
          </span>
        )}
        {node.zone && (
          <span style={{ fontSize: 9, color: "#3a7bd5", padding: "1px 5px", border: "1px solid rgba(58,123,213,0.3)", borderRadius: 3 }}>
            {node.zone}
          </span>
        )}
        {node.roles && (
          <span style={{ fontSize: 9, color: "#5a6380", padding: "1px 5px", border: "1px solid #2e3448", borderRadius: 3 }}>
            {node.roles}
          </span>
        )}
      </div>

      {/* Resource bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
        <ResourceBar label="CPU" used={node.cpuActual ?? node.cpuAllocated} capacity={node.cpuCapacity} format={formatCpu} />
        <ResourceBar label="MEM" used={node.memActual ?? node.memAllocated} capacity={node.memCapacity} format={formatMem} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#5a6380" }}>
          <span style={{ width: 28, fontWeight: 600 }}>PODS</span>
          <span style={{ fontFamily: "monospace" }}>{node.podCount}/{node.podCapacity}</span>
        </div>
      </div>

      {/* Taints */}
      {node.taints.length > 0 && (
        <div style={{ fontSize: 9, color: "#f0a84a", marginBottom: expanded ? 8 : 0 }}>
          Taints: {node.taints.map((t) => `${t.key}=${t.value ?? ""}:${t.effect}`).join(", ")}
        </div>
      )}

      {/* Expanded: Pod list */}
      {expanded && (
        <div style={{ borderTop: "1px solid #252a38", marginTop: 8, paddingTop: 8 }}>
          {node.pods.length === 0 ? (
            <div style={{ fontSize: 10, color: "#5a6380", fontStyle: "italic" }}>No pods</div>
          ) : (
            node.pods.map((pod) => (
              <div
                key={`${pod.namespace}/${pod.name}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "3px 0",
                  fontSize: 10,
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: podDotColor(pod.status), flexShrink: 0 }} />
                  <span style={{ fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#c8cfe0" }}>
                    {pod.name}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0, marginLeft: 8 }}>
                  <span style={{ color: podDotColor(pod.status), fontSize: 9 }}>{pod.status}</span>
                  <span style={{ color: "#5a6380", fontFamily: "monospace" }}>{pod.ready}</span>
                  {pod.restarts > 0 && (
                    <span style={{ color: pod.restarts > 5 ? "#f05a5a" : "#f0a84a", fontFamily: "monospace" }}>
                      ↺{pod.restarts}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
