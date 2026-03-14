import { CopyButton } from "./CopyButton";

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ code, className = "" }: CodeBlockProps) {
  return (
    <div className={`relative group my-1.5 ${className}`}>
      <pre className="bg-bg2 border border-border rounded p-3 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words text-text overflow-x-auto">
        {code}
      </pre>
      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={code} />
      </div>
    </div>
  );
}
