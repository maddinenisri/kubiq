interface ValidationBadgeProps {
  errors: number;
  warnings: number;
  infos?: number;
}

export function ValidationBadge({ errors, warnings, infos = 0 }: ValidationBadgeProps) {
  if (errors === 0 && warnings === 0 && infos === 0) {
    return <span style={{ color: "#4af0c8", fontSize: 11 }}>✅ valid</span>;
  }

  return (
    <span style={{ display: "inline-flex", gap: 6, fontSize: 11 }}>
      {errors > 0 && (
        <span style={{ color: "#f05a5a" }}>
          ❌ {errors} error{errors > 1 ? "s" : ""}
        </span>
      )}
      {warnings > 0 && (
        <span style={{ color: "#f0a84a" }}>
          ⚠ {warnings} warning{warnings > 1 ? "s" : ""}
        </span>
      )}
      {infos > 0 && <span style={{ color: "#5a6380" }}>ℹ {infos}</span>}
    </span>
  );
}
