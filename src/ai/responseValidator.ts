/**
 * Post-hook: validate AI responses for destructive commands.
 * Flags dangerous kubectl commands with warnings before the user can act on them.
 */

const DESTRUCTIVE_COMMANDS = [
  "kubectl delete",
  "kubectl drain",
  "kubectl cordon",
  "kubectl taint",
  "kubectl replace --force",
  "kubectl scale --replicas=0",
  "kubectl patch",
  "kubectl edit",
  "kubectl rollout undo",
];

const READ_ONLY_COMMANDS = [
  "kubectl get",
  "kubectl describe",
  "kubectl logs",
  "kubectl top",
  "kubectl explain",
  "kubectl auth can-i",
  "kubectl config",
  "kubectl version",
  "kubectl cluster-info",
  "kubectl api-resources",
];

export interface FlaggedCommand {
  command: string;
  severity: "danger" | "warning";
  reason: string;
}

export interface ValidationResult {
  flaggedCommands: FlaggedCommand[];
  warnings: string[];
}

export function validateResponse(response: string, flagDestructive: boolean): ValidationResult {
  if (!flagDestructive) return { flaggedCommands: [], warnings: [] };

  const flaggedCommands: FlaggedCommand[] = [];
  const warnings: string[] = [];

  // Extract kubectl commands from code blocks and inline code
  const cmdRegex = /`{0,3}(?:bash|sh|shell|yaml)?\n?(kubectl\s+[^\n`]+)`{0,3}/g;
  let match: RegExpExecArray | null;

  while ((match = cmdRegex.exec(response)) !== null) {
    const cmd = match[1].trim();

    // Check destructive commands
    const destructive = DESTRUCTIVE_COMMANDS.find((d) => cmd.startsWith(d));
    if (destructive) {
      flaggedCommands.push({
        command: cmd,
        severity: "danger",
        reason: `Destructive command: ${destructive}`,
      });
      continue;
    }

    // Check if it's a known safe command
    const safe = READ_ONLY_COMMANDS.some((r) => cmd.startsWith(r));
    if (!safe && cmd.startsWith("kubectl")) {
      // kubectl apply, kubectl exec, etc. — warn but don't block
      flaggedCommands.push({
        command: cmd,
        severity: "warning",
        reason: "Mutating command — review before running",
      });
    }
  }

  // Check for deprecated/hallucinated flags
  if (/kubectl\s+\w+\s+.*--show-all\b/.test(response)) {
    warnings.push("Response contains deprecated flag --show-all (removed in K8s 1.21)");
  }
  if (/kubectl\s+\w+\s+.*--export\b/.test(response)) {
    warnings.push("Response contains deprecated flag --export (removed in K8s 1.18)");
  }

  return { flaggedCommands, warnings };
}

/**
 * Annotate response HTML with warning banners on flagged commands.
 */
export function annotateResponse(html: string, flagged: FlaggedCommand[]): string {
  let result = html;
  for (const f of flagged) {
    const escaped = f.command.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const icon = f.severity === "danger" ? "⚠" : "ℹ";
    const cls = f.severity === "danger" ? "cmd-danger" : "cmd-warning";
    const label = f.severity === "danger" ? "DESTRUCTIVE" : "REVIEW";
    result = result.replace(
      escaped,
      `<span class="${cls}">${icon} <strong>${label}:</strong> ${escaped}</span>`,
    );
  }
  return result;
}
