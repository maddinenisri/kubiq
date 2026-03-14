const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

// Copy skill markdown files to out/ai/skills/
const skillsSrc = path.join("src", "ai", "skills");
const skillsDst = path.join("out", "ai", "skills");
if (fs.existsSync(skillsSrc)) {
  fs.mkdirSync(skillsDst, { recursive: true });
  for (const file of fs.readdirSync(skillsSrc).filter((f) => f.endsWith(".md"))) {
    fs.copyFileSync(path.join(skillsSrc, file), path.join(skillsDst, file));
  }
}

esbuild
  .build({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    outfile: "out/extension.js",
    external: ["vscode"], // vscode is provided by VS Code itself, never bundle it
    format: "cjs",
    platform: "node",
    target: "node18",
    sourcemap: true,
    minify: false,
  })
  .catch(() => process.exit(1));
