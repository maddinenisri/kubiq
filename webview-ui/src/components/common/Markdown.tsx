import { useMemo } from "react";
import { CommandCard } from "./CommandCard";

interface MarkdownProps {
  content: string;
  className?: string;
  interactive?: boolean; // enable CommandCard rendering for kubectl commands
}

interface ContentSegment {
  type: "html" | "command";
  content: string;
  // Command-specific fields
  command?: string;
  explanation?: string;
  risk?: "safe" | "review" | "dangerous";
  issues?: string[];
}

/**
 * Markdown renderer that supports interactive kubectl command cards.
 * Splits content into text segments (rendered as HTML) and kubectl
 * commands (rendered as interactive CommandCard components).
 */
export function Markdown({ content, className = "", interactive = true }: MarkdownProps) {
  const segments = useMemo(() => parseContent(content, interactive), [content, interactive]);

  return (
    <div className={className} style={{ color: "#c8cfe0" }}>
      {segments.map((seg, i) =>
        seg.type === "command" && seg.command ? (
          <CommandCard
            key={i}
            command={seg.command}
            explanation={seg.explanation}
            risk={seg.risk ?? "review"}
            issues={seg.issues}
          />
        ) : (
          <div key={i} dangerouslySetInnerHTML={{ __html: seg.content }} />
        ),
      )}
    </div>
  );
}

// ── kubectl risk classification (simplified, matches server-side commandParser) ──

const SAFE_VERBS = new Set([
  "get",
  "describe",
  "logs",
  "top",
  "explain",
  "auth",
  "config",
  "version",
  "cluster-info",
]);
const DANGEROUS_VERBS = new Set(["delete", "drain", "cordon", "taint", "replace", "patch", "edit"]);

function classifyRisk(cmd: string): "safe" | "review" | "dangerous" {
  const verb =
    cmd
      .replace(/^kubectl\s+/, "")
      .split(/\s+/)[0]
      ?.toLowerCase() ?? "";
  if (SAFE_VERBS.has(verb)) return "safe";
  if (DANGEROUS_VERBS.has(verb)) return "dangerous";
  if (verb === "scale" && cmd.includes("--replicas=0")) return "dangerous";
  return "review";
}

function parseContent(text: string, interactive: boolean): ContentSegment[] {
  if (!interactive) {
    return [{ type: "html", content: renderMarkdown(text) }];
  }

  const segments: ContentSegment[] = [];
  // Split on code blocks, detect kubectl commands
  const parts = text.split(/(```(?:bash|sh|shell)?\n[\s\S]*?```)/g);

  for (const part of parts) {
    const codeBlockMatch = part.match(/```(?:bash|sh|shell)?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      const codeContent = codeBlockMatch[1].trim();
      const lines = codeContent.split("\n").map((l) => l.trim().replace(/^\$\s*/, ""));
      const kubectlLines = lines.filter((l) => l.startsWith("kubectl "));

      if (kubectlLines.length > 0) {
        // Render each kubectl command as a CommandCard
        for (const cmd of kubectlLines) {
          segments.push({
            type: "command",
            content: "",
            command: cmd,
            risk: classifyRisk(cmd),
          });
        }
        // Render non-kubectl lines as code
        const otherLines = lines.filter((l) => !l.startsWith("kubectl ") && l.trim());
        if (otherLines.length > 0) {
          segments.push({ type: "html", content: renderCodeBlock(otherLines.join("\n")) });
        }
      } else {
        // Regular code block
        segments.push({ type: "html", content: renderCodeBlock(codeContent) });
      }
    } else if (part.trim()) {
      // Check for inline kubectl commands
      const inlineResult = renderInlineKubectl(part, segments);
      if (!inlineResult) {
        segments.push({ type: "html", content: renderMarkdown(part) });
      }
    }
  }

  return segments;
}

function renderInlineKubectl(text: string, segments: ContentSegment[]): boolean {
  // Check for `kubectl ...` inline code patterns
  const pattern = /`(kubectl\s+[^`]+)`/g;
  let hasKubectl = false;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    hasKubectl = true;
    // Add text before the command
    if (match.index > lastIdx) {
      segments.push({
        type: "html",
        content: renderMarkdown(text.substring(lastIdx, match.index)),
      });
    }
    // Add the command card
    const cmd = match[1];
    segments.push({
      type: "command",
      content: "",
      command: cmd,
      risk: classifyRisk(cmd),
    });
    lastIdx = match.index + match[0].length;
  }

  // Add remaining text
  if (hasKubectl && lastIdx < text.length) {
    segments.push({ type: "html", content: renderMarkdown(text.substring(lastIdx)) });
  }

  return hasKubectl;
}

// ── Markdown to HTML renderer ──

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCodeBlock(code: string): string {
  return `<pre style="background:#0d1018;border:1px solid #252a38;border-radius:4px;padding:10px 12px;font-family:'JetBrains Mono','Fira Code',monospace;font-size:11.5px;overflow-x:auto;color:#a0d8c8;margin:6px 0;white-space:pre-wrap;word-break:break-word;">${escapeHtml(code)}</pre>`;
}

function renderMarkdown(text: string): string {
  let html = escapeHtml(text);

  // Code blocks (triple backtick) — non-bash blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => renderCodeBlock(code));

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    `<code style="font-family:'JetBrains Mono','Fira Code',monospace;background:#0d1018;padding:1px 5px;border-radius:3px;font-size:11.5px;color:#a0d8c8;">$1</code>`,
  );

  // Bold
  html = html.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong style="color:#e8ecf8;font-weight:600;">$1</strong>',
  );

  // Italic
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // Headers
  html = html.replace(
    /^### (.+)$/gm,
    '<h3 style="font-size:13px;font-weight:600;margin:8px 0 4px;color:#e8ecf8;">$1</h3>',
  );
  html = html.replace(
    /^## (.+)$/gm,
    '<h2 style="font-size:14px;font-weight:700;margin:8px 0 4px;color:#e8ecf8;">$1</h2>',
  );
  html = html.replace(
    /^# (.+)$/gm,
    '<h1 style="font-size:15px;font-weight:700;margin:8px 0 4px;color:#e8ecf8;">$1</h1>',
  );

  // Ordered lists
  html = html.replace(
    /^(\d+)\. (.+)$/gm,
    '<div style="padding-left:1.25rem;margin-bottom:4px;"><span style="color:#5a6380;">$1.</span> $2</div>',
  );

  // Unordered lists
  html = html.replace(
    /^[-•] (.+)$/gm,
    '<div style="padding-left:1.25rem;margin-bottom:4px;">• $1</div>',
  );

  // Line breaks
  html = html.replace(/\n/g, "<br>");
  html = html.replace(/<\/pre><br>/g, "</pre>");
  html = html.replace(/<\/h[123]><br>/g, (m) => m.replace("<br>", ""));
  html = html.replace(/<\/div><br>/g, "</div>");

  return html;
}
