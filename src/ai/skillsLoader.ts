import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

/**
 * Loads knowledge base skills from two sources:
 * 1. Built-in skills shipped with the extension (src/ai/skills/*.md)
 * 2. Workspace-level skills from .kubiq/rules/*.md
 *
 * Skills are loaded once per session and injected as system context.
 * Workspace rules override built-in skills with the same filename.
 */

let cachedSkills: string | null = null;

export function loadSkills(extensionPath: string): string {
  if (cachedSkills !== null) return cachedSkills;

  const skills = new Map<string, string>();

  // 1. Built-in skills from extension
  const builtinDir = path.join(extensionPath, "out", "ai", "skills");
  const builtinDirAlt = path.join(extensionPath, "src", "ai", "skills");
  const skillDir = fs.existsSync(builtinDir) ? builtinDir : builtinDirAlt;

  if (fs.existsSync(skillDir)) {
    for (const file of fs.readdirSync(skillDir).filter((f) => f.endsWith(".md"))) {
      const name = file.replace(".md", "");
      skills.set(name, fs.readFileSync(path.join(skillDir, file), "utf8").trim());
    }
  }

  // 2. Workspace rules override built-in (same filename wins)
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    const rulesDir = path.join(workspaceFolders[0].uri.fsPath, ".kubiq", "rules");
    if (fs.existsSync(rulesDir)) {
      for (const file of fs.readdirSync(rulesDir).filter((f: string) => f.endsWith(".md"))) {
        const name = file.replace(".md", "");
        skills.set(name, fs.readFileSync(path.join(rulesDir, file), "utf8").trim());
      }
    }
  }

  if (skills.size === 0) {
    cachedSkills = "";
    return "";
  }

  cachedSkills = Array.from(skills.entries())
    .map(([name, content]) => `### ${name}\n${content}`)
    .join("\n\n");

  console.log(`Kubiq: loaded ${skills.size} knowledge base skills`);
  return cachedSkills;
}

export function invalidateSkillsCache(): void {
  cachedSkills = null;
}
