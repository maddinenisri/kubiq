import { useMemo } from "react";

interface MarkdownProps {
  content: string;
  className?: string;
}

/**
 * Simple markdown renderer that outputs HTML via dangerouslySetInnerHTML.
 * Avoids react-markdown which causes re-render issues in VS Code webviews
 * (text disappears after turn_complete due to component lifecycle issues).
 */
export function Markdown({ content, className = "" }: MarkdownProps) {
  const html = useMemo(() => renderMarkdown(content), [content]);

  return (
    <div
      className={className}
      style={{ color: "#c8cfe0" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdown(text: string): string {
  let html = escapeHtml(text);

  // Code blocks (triple backtick)
  html = html.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_match, _lang, code) =>
      `<pre style="background:#0d1018;border:1px solid #252a38;border-radius:4px;padding:10px 12px;font-family:'JetBrains Mono','Fira Code',monospace;font-size:11.5px;overflow-x:auto;color:#a0d8c8;margin:6px 0;white-space:pre-wrap;word-break:break-word;">${code}</pre>`,
  );

  // Inline code (single backtick)
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

  // Ordered list items
  html = html.replace(
    /^(\d+)\. (.+)$/gm,
    '<div style="padding-left:1.25rem;margin-bottom:4px;"><span style="color:#5a6380;">$1.</span> $2</div>',
  );

  // Unordered list items
  html = html.replace(
    /^[-•] (.+)$/gm,
    '<div style="padding-left:1.25rem;margin-bottom:4px;">• $1</div>',
  );

  // Line breaks
  html = html.replace(/\n/g, "<br>");

  // Clean up excessive <br> after block elements
  html = html.replace(/<\/pre><br>/g, "</pre>");
  html = html.replace(/<\/h[123]><br>/g, (m) => m.replace("<br>", ""));
  html = html.replace(/<\/div><br>/g, "</div>");

  return html;
}
