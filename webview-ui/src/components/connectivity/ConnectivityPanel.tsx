import { useState, useEffect, useCallback } from "react";
import { postMessage } from "../../lib/vscode";

interface Check {
  name: string;
  status: "pass" | "fail" | "warn" | "running" | "pending";
  message: string;
  details?: string;
}

interface ConnectivityPanelProps {
  sourcePod: string;
  sourceNamespace: string;
  targetService: string;
  targetNamespace: string;
}

const statusConfig: Record<string, { color: string; icon: string; bg: string }> = {
  pass: { color: "#4af0c8", icon: "✅", bg: "rgba(74,240,200,0.06)" },
  fail: { color: "#f05a5a", icon: "❌", bg: "rgba(240,90,90,0.06)" },
  warn: { color: "#f0a84a", icon: "⚠", bg: "rgba(240,168,74,0.06)" },
  running: { color: "#3a7bd5", icon: "⏳", bg: "rgba(58,123,213,0.06)" },
  pending: { color: "#5a6380", icon: "○", bg: "transparent" },
};

const selectStyle: React.CSSProperties = {
  background: "#1a1e28",
  border: "1px solid #2e3448",
  color: "#c8cfe0",
  padding: "5px 8px",
  borderRadius: 4,
  fontSize: 12,
  fontFamily: "'JetBrains Mono', monospace",
  outline: "none",
  width: "100%",
  cursor: "pointer",
};

export function ConnectivityPanel(_props: ConnectivityPanelProps) {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [srcNs, setSrcNs] = useState("default");
  const [tgtNs, setTgtNs] = useState("default");
  const [pods, setPods] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [srcPod, setSrcPod] = useState("");
  const [tgtSvc, setTgtSvc] = useState("");
  const [checks, setChecks] = useState<Check[]>([]);
  const [summary, setSummary] = useState("");
  const [testing, setTesting] = useState(false);

  // Fetch namespaces on mount
  useEffect(() => {
    postMessage({ type: "getNamespaces" } as never);
  }, []);

  // Listen for data
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const msg = event.data;
      if (msg.type === "namespaces") setNamespaces(msg.namespaces);
      if (msg.type === "pods") setPods(msg.pods);
      if (msg.type === "services") setServices(msg.services);
      if (msg.type === "progress") setChecks(msg.checks);
      if (msg.type === "result") {
        setChecks(msg.result.checks);
        setSummary(msg.result.summary);
        setTesting(false);
      }
      if (msg.type === "error") {
        setSummary(`Error: ${msg.message}`);
        setTesting(false);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Fetch pods when source namespace changes
  useEffect(() => {
    if (srcNs) {
      setPods([]);
      setSrcPod("");
      postMessage({ type: "getPods", namespace: srcNs } as never);
    }
  }, [srcNs]);

  // Fetch services when target namespace changes
  useEffect(() => {
    if (tgtNs) {
      setServices([]);
      setTgtSvc("");
      postMessage({ type: "getServices", namespace: tgtNs } as never);
    }
  }, [tgtNs]);

  const handleRun = useCallback(() => {
    if (!srcPod || !tgtSvc) return;
    setTesting(true);
    setSummary("");
    setChecks([]);
    postMessage({
      type: "runTest",
      sourcePod: srcPod,
      sourceNamespace: srcNs,
      targetService: tgtSvc,
      targetNamespace: tgtNs,
    } as never);
  }, [srcPod, srcNs, tgtSvc, tgtNs]);

  const failCount = checks.filter((c) => c.status === "fail").length;
  const canRun = srcPod && tgtSvc && !testing;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", color: "#c8cfe0" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "#13161d", borderBottom: "1px solid #252a38" }}>
        <span style={{ color: "#4af0c8", fontSize: 16 }}>⬡</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#e8ecf8" }}>Connectivity Test</span>
      </header>

      {/* Selection form */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 12, padding: 16, background: "#0d0f14", borderBottom: "1px solid #252a38", alignItems: "end" }}>
        {/* Source */}
        <div>
          <div style={{ fontSize: 10, color: "#5a6380", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, fontWeight: 600 }}>Source Pod</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div>
              <label style={{ fontSize: 10, color: "#5a6380", marginBottom: 2, display: "block" }}>Namespace</label>
              <select value={srcNs} onChange={(e) => setSrcNs(e.target.value)} style={selectStyle}>
                {namespaces.map((ns) => <option key={ns} value={ns}>{ns}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#5a6380", marginBottom: 2, display: "block" }}>Pod</label>
              <select value={srcPod} onChange={(e) => setSrcPod(e.target.value)} style={selectStyle} disabled={pods.length === 0}>
                <option value="">Select pod…</option>
                {pods.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#4af0c8", paddingBottom: 8 }}>→</div>

        {/* Target */}
        <div>
          <div style={{ fontSize: 10, color: "#5a6380", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, fontWeight: 600 }}>Target Service</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div>
              <label style={{ fontSize: 10, color: "#5a6380", marginBottom: 2, display: "block" }}>Namespace</label>
              <select value={tgtNs} onChange={(e) => setTgtNs(e.target.value)} style={selectStyle}>
                {namespaces.map((ns) => <option key={ns} value={ns}>{ns}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#5a6380", marginBottom: 2, display: "block" }}>Service</label>
              <select value={tgtSvc} onChange={(e) => setTgtSvc(e.target.value)} style={selectStyle} disabled={services.length === 0}>
                <option value="">Select service…</option>
                {services.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Run button */}
      <div style={{ padding: "10px 16px", background: "#0d0f14", borderBottom: "1px solid #252a38", display: "flex", justifyContent: "center" }}>
        <button
          onClick={handleRun}
          disabled={!canRun}
          style={{
            padding: "8px 24px",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            border: "none",
            background: canRun ? "linear-gradient(135deg, #4af0c8 0%, #3a9fab 100%)" : "#2e3448",
            color: canRun ? "#0d0f14" : "#5a6380",
            cursor: canRun ? "pointer" : "not-allowed",
          }}
        >
          {testing ? "⏳ Testing…" : "▶ Test Connectivity"}
        </button>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {checks.length === 0 && !testing && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 150, gap: 10, color: "#5a6380" }}>
            <div style={{ fontSize: 24, opacity: 0.3 }}>🔌</div>
            <span style={{ fontSize: 12 }}>Select a source pod and target service, then click Test</span>
          </div>
        )}

        {checks.map((check, i) => {
          const cfg = statusConfig[check.status];
          return (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 12,
                padding: "12px 14px",
                marginBottom: 8,
                background: cfg.bg,
                borderRadius: 6,
                borderLeft: `3px solid ${cfg.color}`,
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{cfg.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: cfg.color, marginBottom: 2 }}>{check.name}</div>
                {check.message && <div style={{ fontSize: 11, color: "#c8cfe0" }}>{check.message}</div>}
                {check.details && <div style={{ fontSize: 10, color: "#5a6380", marginTop: 2 }}>{check.details}</div>}
              </div>
            </div>
          );
        })}

        {summary && (
          <div style={{
            marginTop: 16, padding: "10px 14px", borderRadius: 6,
            background: failCount > 0 ? "rgba(240,90,90,0.08)" : "rgba(74,240,200,0.08)",
            border: `1px solid ${failCount > 0 ? "rgba(240,90,90,0.2)" : "rgba(74,240,200,0.2)"}`,
            fontSize: 12, color: failCount > 0 ? "#f05a5a" : "#4af0c8", fontWeight: 600,
          }}>
            {summary}
          </div>
        )}
      </div>
    </div>
  );
}
