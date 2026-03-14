import { useState, useCallback } from "react";
import { CopyButton } from "./CopyButton";
import { postMessage } from "../../lib/vscode";

interface CommandCardProps {
  command: string;
  explanation?: string;
  risk: "safe" | "review" | "dangerous";
  issues?: string[];
}

const riskConfig = {
  safe: { color: "#4af0c8", label: "safe", icon: "🟢", border: "rgba(74,240,200,0.3)" },
  review: { color: "#f0a84a", label: "review", icon: "🟡", border: "rgba(240,168,74,0.3)" },
  dangerous: { color: "#f05a5a", label: "danger", icon: "🔴", border: "rgba(240,90,90,0.3)" },
};

export function CommandCard({ command, explanation, risk, issues }: CommandCardProps) {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const r = riskConfig[risk];

  // Listen for command output
  const handleRun = useCallback(() => {
    setRunning(true);
    setOutput(null);
    setError(null);
    postMessage({ type: "runCommand", command } as never);

    // Listen for response
    const handler = (event: MessageEvent) => {
      if (event.data.type === "commandOutput" && event.data.command === command) {
        setRunning(false);
        if (event.data.error) setError(event.data.error);
        else setOutput(event.data.output);
        window.removeEventListener("message", handler);
      }
    };
    window.addEventListener("message", handler);
    // Timeout
    setTimeout(() => {
      setRunning(false);
      window.removeEventListener("message", handler);
    }, 30000);
  }, [command]);

  return (
    <div
      style={{
        border: `1px solid ${r.border}`,
        borderRadius: 6,
        marginBottom: 8,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "4px 10px",
          background: "rgba(0,0,0,0.2)",
          fontSize: 10,
        }}
      >
        <span style={{ fontWeight: 600 }}>Command</span>
        <span style={{ color: r.color }}>
          {r.icon} {r.label}
        </span>
      </div>

      {/* Command */}
      <div
        style={{
          padding: "8px 12px",
          fontFamily: "'JetBrains Mono','Fira Code',monospace",
          fontSize: 11.5,
          color: "#a0d8c8",
          background: "#0d1018",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        $ {command}
      </div>

      {/* Explanation + Issues */}
      {(explanation || (issues && issues.length > 0)) && (
        <div
          style={{
            padding: "6px 12px",
            fontSize: 11,
            color: "#5a6380",
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {explanation && <div>{explanation}</div>}
          {issues?.map((issue, i) => (
            <div key={i} style={{ color: "#f0a84a", marginTop: 2 }}>
              ⚠ {issue}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "6px 12px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {risk !== "dangerous" && (
          <button
            onClick={handleRun}
            disabled={running}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 10px",
              borderRadius: 3,
              fontSize: 10,
              border: `1px solid ${r.color}`,
              color: r.color,
              background: "transparent",
              cursor: running ? "wait" : "pointer",
              opacity: running ? 0.5 : 1,
            }}
          >
            {running ? "⏳ Running…" : "▶ Run"}
          </button>
        )}
        <CopyButton text={command} label="Copy" />
        {risk !== "safe" && risk !== "dangerous" && (
          <button
            onClick={() => {
              const dryCmd = command.includes("--dry-run")
                ? command
                : `${command} --dry-run=client`;
              postMessage({ type: "runCommand", command: dryCmd } as never);
            }}
            style={{
              padding: "3px 10px",
              borderRadius: 3,
              fontSize: 10,
              border: "1px solid #2e3448",
              color: "#5a6380",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            🔍 Dry Run
          </button>
        )}
        {risk === "dangerous" && (
          <span style={{ fontSize: 10, color: "#f05a5a", alignSelf: "center" }}>
            Run disabled — destructive command
          </span>
        )}
      </div>

      {/* Output */}
      {output && (
        <div
          style={{
            padding: "8px 12px",
            fontFamily: "monospace",
            fontSize: 11,
            color: "#c8cfe0",
            background: "#0d1018",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            whiteSpace: "pre-wrap",
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          <div style={{ color: "#4af0c8", fontSize: 10, marginBottom: 4 }}>✓ Output:</div>
          {output}
        </div>
      )}
      {error && (
        <div
          style={{
            padding: "8px 12px",
            fontFamily: "monospace",
            fontSize: 11,
            color: "#f05a5a",
            background: "rgba(240,90,90,0.05)",
            borderTop: "1px solid rgba(240,90,90,0.2)",
            whiteSpace: "pre-wrap",
          }}
        >
          <div style={{ fontSize: 10, marginBottom: 4 }}>✗ Error:</div>
          {error}
        </div>
      )}
    </div>
  );
}
