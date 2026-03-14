import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

/** Generate a random nonce for Content Security Policy */
export function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

/** HTML-escape a string */
export function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Generate the HTML shell that loads a Vite-built React bundle.
 *
 * Scans the Vite output directory for the entry JS, all chunk JS files,
 * and CSS files. Dynamically generates script/link tags with proper nonces
 * and webview URIs. This scales to any number of code-split chunks.
 */
export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  entryPoint: "sidebar" | "panel" | "resource",
): string {
  const nonce = getNonce();
  const assetsDir = path.join(extensionUri.fsPath, "out", "webview", "assets");
  const assetsUri = vscode.Uri.joinPath(extensionUri, "out", "webview", "assets");

  // Scan the assets directory for all built files
  let files: string[] = [];
  try {
    files = fs.readdirSync(assetsDir);
  } catch {
    console.error("Kubiq: could not read webview assets directory");
  }

  // Find the entry point JS (e.g., sidebar.js)
  const entryFile = files.find((f) => f === `${entryPoint}.js`) ?? `${entryPoint}.js`;
  const entryUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsUri, entryFile));

  // Find all CSS files
  const cssFiles = files.filter((f) => f.endsWith(".css"));
  const cssTags = cssFiles
    .map((f) => {
      const uri = webview.asWebviewUri(vscode.Uri.joinPath(assetsUri, f));
      return `  <link rel="stylesheet" href="${uri}"/>`;
    })
    .join("\n");

  // Find all chunk JS files (anything .js that isn't the entry points)
  const entryNames = ["sidebar.js", "panel.js", "resource.js"];
  const chunkFiles = files.filter((f) => f.endsWith(".js") && !entryNames.includes(f));
  const chunkTags = chunkFiles
    .map((f) => {
      const uri = webview.asWebviewUri(vscode.Uri.joinPath(assetsUri, f));
      return `  <link rel="modulepreload" nonce="${nonce}" href="${uri}"/>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
      style-src ${webview.cspSource} 'unsafe-inline';
      script-src 'nonce-${nonce}' ${webview.cspSource};
      font-src ${webview.cspSource};
      img-src ${webview.cspSource} https:;"/>
${cssTags}
${chunkTags}
  <title>Kubiq</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${entryUri}"></script>
</body>
</html>`;
}
