import { CopyButton } from "../common";

interface DescribeTabProps {
  describe: string;
}

export function DescribeTab({ describe }: DescribeTabProps) {
  return (
    <div className="flex-1 overflow-auto p-3.5 relative">
      <div className="absolute top-4 right-4">
        <CopyButton text={describe || ""} />
      </div>
      <pre className="bg-bg2 border border-border rounded p-3.5 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
        {describe || "(no output)"}
      </pre>
    </div>
  );
}
