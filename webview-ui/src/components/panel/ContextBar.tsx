import type { ContextInfo } from "@shared/types";

interface ContextBarProps {
  info: ContextInfo | null;
}

export function ContextBar({ info }: ContextBarProps) {
  if (!info) return null;

  if (info.preset === "disabled") {
    return (
      <div className="flex flex-wrap gap-1 px-2.5 py-1 bg-bg border-b border-border shrink-0 text-[9px] items-center">
        <span className="text-dim mr-0.5">AI:</span>
        <span className="px-1.5 rounded-full border border-border2 text-dim">disabled</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1 px-2.5 py-1 bg-bg border-b border-border shrink-0 text-[9px] items-center">
      <span className="text-dim mr-0.5">AI:</span>
      <span className="px-1.5 rounded-full border border-accent/20 text-accent/60">{info.preset}</span>
      {info.sanitization && (
        <span className="px-1.5 rounded-full border border-accent/20 text-accent/60">🛡 sanitized</span>
      )}
      {info.customInstructions && (
        <span className="px-1.5 rounded-full border border-warn/30 text-warn/60">custom prompt</span>
      )}
      {info.skills.length > 0 && (
        <>
          <span className="text-dim ml-1">skills:</span>
          {info.skills.map((s) => (
            <span key={s} className="px-1.5 rounded-full border border-accent/20 text-accent/60">
              {s}
            </span>
          ))}
        </>
      )}
    </div>
  );
}
