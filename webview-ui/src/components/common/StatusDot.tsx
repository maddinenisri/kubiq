interface StatusDotProps {
  status: string;
  className?: string;
}

function getDotColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "running" || s === "completed" || s === "ready") return "bg-ok";
  if (s.includes("pending") || s.includes("init") || s.includes("terminating")) return "bg-warn";
  if (s === "unknown" || s === "—") return "bg-dim";
  return "bg-err";
}

export function StatusDot({ status, className = "" }: StatusDotProps) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${getDotColor(status)} ${className}`}
    />
  );
}
