interface ResourceBarProps {
  label: string;
  used: number;
  capacity: number;
  format: (v: number) => string;
}

function barColor(pct: number): string {
  if (pct >= 80) return "#f05a5a";
  if (pct >= 60) return "#f0a84a";
  return "#4af0c8";
}

export function ResourceBar({ label, used, capacity, format }: ResourceBarProps) {
  const pct = capacity > 0 ? Math.round((used / capacity) * 100) : 0;
  const color = barColor(pct);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
      <span style={{ width: 28, color: "#5a6380", fontWeight: 600, fontSize: 10 }}>{label}</span>
      <div
        style={{
          flex: 1,
          height: 6,
          background: "#1a1e28",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min(pct, 100)}%`,
            height: "100%",
            background: color,
            borderRadius: 3,
            transition: "width 0.3s",
          }}
        />
      </div>
      <span style={{ color, fontFamily: "monospace", fontSize: 10, minWidth: 30, textAlign: "right" }}>
        {pct}%
      </span>
      <span style={{ color: "#5a6380", fontFamily: "monospace", fontSize: 9, minWidth: 90, textAlign: "right" }}>
        {format(used)}/{format(capacity)}
      </span>
    </div>
  );
}
