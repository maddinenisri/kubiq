import { StatusChip } from "../common";

interface TopBarProps {
  podName: string;
  namespace: string;
  context: string;
  phase?: string;
  nodeName?: string;
}

export function TopBar({ podName, namespace, context, phase, nodeName }: TopBarProps) {
  return (
    <header className="flex items-center justify-between px-4 py-2.5 bg-bg2 border-b border-border shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-accent text-base">⬡</span>
        <span className="text-[15px] font-semibold text-white">{podName}</span>
        <span className="px-2 py-0.5 rounded text-xs font-mono bg-bg3 border border-border2 text-dim">
          {namespace}
        </span>
        <span className="px-2 py-0.5 rounded text-xs font-mono bg-bg3 border border-link/30 text-link">
          {context}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {phase && <StatusChip status={phase} />}
        {nodeName && <span className="text-xs text-dim">node: {nodeName}</span>}
      </div>
    </header>
  );
}
