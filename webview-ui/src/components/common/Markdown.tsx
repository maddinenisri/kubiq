import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";

interface MarkdownProps {
  content: string;
  className?: string;
}

export function Markdown({ content, className = "" }: MarkdownProps) {
  return (
    <div className={`prose-kubiq ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const code = String(children).replace(/\n$/, "");

            // Inline code vs block
            if (!match && !code.includes("\n")) {
              return (
                <code
                  className="font-mono bg-bg2 px-1 py-0.5 rounded text-sm text-accent/80"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return <CodeBlock code={code} language={match?.[1]} />;
          },
          pre({ children }) {
            // react-markdown wraps code blocks in <pre>, but our CodeBlock handles it
            return <>{children}</>;
          },
          strong({ children }) {
            return <strong className="text-text font-semibold">{children}</strong>;
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-sm">{children}</li>;
          },
          h1({ children }) {
            return <h1 className="text-base font-bold mb-2 text-text">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-sm font-bold mb-1.5 text-text">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-sm font-semibold mb-1 text-text">{children}</h3>;
          },
          a({ href, children }) {
            return (
              <a href={href} className="text-link hover:underline">
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <table className="w-full border-collapse text-sm mb-2 border border-border">
                {children}
              </table>
            );
          },
          th({ children }) {
            return (
              <th className="bg-bg3 border border-border px-2 py-1 text-left text-xs font-semibold text-dim">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border border-border px-2 py-1 text-sm">{children}</td>
            );
          },
        }}
      />
    </div>
  );
}
