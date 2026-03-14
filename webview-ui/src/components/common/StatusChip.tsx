interface StatusChipProps {
  status: string;
  className?: string;
}

function getChipStyle(status: string): string {
  const s = status.toLowerCase();
  if (s === "running" || s === "completed" || s === "ready") {
    return "bg-ok/10 text-ok border-ok/30";
  }
  if (s.includes("pending") || s.includes("init") || s.includes("terminating")) {
    return "bg-warn/10 text-warn border-warn/30";
  }
  return "bg-err/10 text-err border-err/30";
}

export function StatusChip({ status, className = "" }: StatusChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm font-mono font-semibold border ${getChipStyle(status)} ${className}`}
    >
      {status}
    </span>
  );
}
