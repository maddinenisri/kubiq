import { CopyButton } from "../common";

interface EventsTabProps {
  events: string;
}

export function EventsTab({ events }: EventsTabProps) {
  return (
    <div className="flex-1 overflow-auto p-3.5 relative">
      <div className="absolute top-4 right-4">
        <CopyButton text={events || ""} />
      </div>
      <pre className="bg-bg2 border border-border rounded p-3.5 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
        {events || "(no events)"}
      </pre>
    </div>
  );
}
