interface ValidationIssue {
  line: number;
  severity: "error" | "warning" | "info";
  rule: string;
  message: string;
  fix?: string;
}

interface ValidationResultsProps {
  issues: ValidationIssue[];
  onFix?: (rule: string) => void;
}

const severityStyles: Record<string, { color: string; icon: string; bg: string }> = {
  error: { color: "#f05a5a", icon: "❌", bg: "rgba(240,90,90,0.08)" },
  warning: { color: "#f0a84a", icon: "⚠", bg: "rgba(240,168,74,0.08)" },
  info: { color: "#5a6380", icon: "ℹ", bg: "rgba(90,99,128,0.08)" },
};

export function ValidationResults({ issues, onFix }: ValidationResultsProps) {
  if (issues.length === 0) return null;

  return (
    <div style={{ margin: "8px 0", display: "flex", flexDirection: "column", gap: 4 }}>
      {issues.map((issue, i) => {
        const s = severityStyles[issue.severity];
        return (
          <div
            key={`${issue.rule}-${i}`}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "6px 10px",
              background: s.bg,
              borderRadius: 4,
              borderLeft: `3px solid ${s.color}`,
              fontSize: 11,
            }}
          >
            <span style={{ flexShrink: 0 }}>{s.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: s.color }}>
                <strong>Line {issue.line}:</strong> {issue.message}
              </div>
              {issue.fix && (
                <div style={{ color: "#5a6380", marginTop: 2, fontSize: 10 }}>
                  → {issue.fix}
                  {onFix && (
                    <button
                      onClick={() => onFix(issue.rule)}
                      style={{
                        marginLeft: 8,
                        padding: "1px 8px",
                        borderRadius: 3,
                        fontSize: 10,
                        border: "1px solid #4af0c8",
                        color: "#4af0c8",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                    >
                      Fix
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
