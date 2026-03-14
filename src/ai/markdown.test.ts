/**
 * Tests for the hand-rolled markdown renderer used in ChatTab.
 * The renderer lives in webview-ui but we test the logic here
 * since the webview bundle can't be tested with vitest directly.
 */
import { describe, it, expect } from "vitest";

// Replicate the renderer logic for testing
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdown(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_match, _lang, code) =>
      `<pre style="background:#0d1018;border:1px solid #252a38;border-radius:4px;padding:10px 12px;font-family:'JetBrains Mono','Fira Code',monospace;font-size:11.5px;overflow-x:auto;color:#a0d8c8;margin:6px 0;white-space:pre-wrap;word-break:break-word;">${code}</pre>`,
  );
  html = html.replace(
    /`([^`]+)`/g,
    `<code style="font-family:'JetBrains Mono','Fira Code',monospace;background:#0d1018;padding:1px 5px;border-radius:3px;font-size:11.5px;color:#a0d8c8;">$1</code>`,
  );
  html = html.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong style="color:#e8ecf8;font-weight:600;">$1</strong>',
  );
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
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
  html = html.replace(
    /^(\d+)\. (.+)$/gm,
    '<div style="padding-left:1.25rem;margin-bottom:4px;"><span style="color:#5a6380;">$1.</span> $2</div>',
  );
  html = html.replace(
    /^[-•] (.+)$/gm,
    '<div style="padding-left:1.25rem;margin-bottom:4px;">• $1</div>',
  );
  html = html.replace(/\n/g, "<br>");
  html = html.replace(/<\/pre><br>/g, "</pre>");
  html = html.replace(/<\/h[123]><br>/g, (m) => m.replace("<br>", ""));
  html = html.replace(/<\/div><br>/g, "</div>");
  return html;
}

describe("Markdown renderer", () => {
  it("renders bold text", () => {
    const result = renderMarkdown("This is **bold** text");
    expect(result).toContain("<strong");
    expect(result).toContain("bold");
  });

  it("renders inline code", () => {
    const result = renderMarkdown("Run `kubectl get pods`");
    expect(result).toContain("<code");
    expect(result).toContain("kubectl get pods");
  });

  it("renders code blocks", () => {
    const result = renderMarkdown("```yaml\napiVersion: v1\nkind: Pod\n```");
    expect(result).toContain("<pre");
    expect(result).toContain("apiVersion: v1");
  });

  it("renders ordered lists", () => {
    const result = renderMarkdown("1. First item\n2. Second item");
    expect(result).toContain("1.");
    expect(result).toContain("First item");
    expect(result).toContain("Second item");
  });

  it("renders unordered lists", () => {
    const result = renderMarkdown("- Item A\n- Item B");
    expect(result).toContain("•");
    expect(result).toContain("Item A");
  });

  it("renders headers", () => {
    const result = renderMarkdown("# Title\n## Subtitle\n### Section");
    expect(result).toContain("<h1");
    expect(result).toContain("<h2");
    expect(result).toContain("<h3");
  });

  it("escapes HTML", () => {
    const result = renderMarkdown("Use <script>alert('xss')</script>");
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("renders italic text", () => {
    const result = renderMarkdown("This is *italic* text");
    expect(result).toContain("<em>");
    expect(result).toContain("italic");
  });

  it("handles empty string", () => {
    const result = renderMarkdown("");
    expect(result).toBe("");
  });

  it("handles plain text without markdown", () => {
    const result = renderMarkdown("Just plain text");
    expect(result).toBe("Just plain text");
  });
});
