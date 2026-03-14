import * as vscode from "vscode";
import type { PodSnapshot } from "../kubectl/runner";
import { sanitize } from "../ai/sanitizer";
import { loadSkills, getSkillNames } from "../ai/skillsLoader";

// Known crash patterns for instant local pre-classification (no CLI involved)
const CRASH_PATTERNS: Array<{
  pattern: RegExp;
  label: string;
  severity: "critical" | "warning" | "info";
}> = [
  { pattern: /OOMKilled/i, label: "Out of Memory", severity: "critical" },
  { pattern: /CrashLoopBackOff/i, label: "Crash Loop", severity: "critical" },
  { pattern: /ImagePullBackOff|ErrImagePull/i, label: "Image Pull Failure", severity: "critical" },
  {
    pattern: /Error: failed to create containerd task/i,
    label: "Container Runtime Error",
    severity: "critical",
  },
  { pattern: /Liveness probe failed/i, label: "Liveness Probe Failure", severity: "warning" },
  { pattern: /Readiness probe failed/i, label: "Readiness Probe Failure", severity: "warning" },
  {
    pattern: /Back-off restarting failed container/i,
    label: "Restart Back-off",
    severity: "warning",
  },
  { pattern: /insufficient (cpu|memory)/i, label: "Insufficient Resources", severity: "critical" },
  { pattern: /FailedScheduling/i, label: "Scheduling Failure", severity: "warning" },
  { pattern: /MountVolume.SetUp failed/i, label: "Volume Mount Failure", severity: "critical" },
];

const PROMPT_PRESETS: Record<string, string> = {
  default:
    "You are an expert Kubernetes SRE acting as an interactive assistant inside a VS Code pod diagnostic panel.",
  "sre-oncall":
    "You are an SRE on-call responding to a production incident. Be concise and action-oriented. Prioritize immediate mitigation over root cause. Suggest rollback if the pod was recently deployed.",
  developer:
    "You are a senior developer helping debug an application running in Kubernetes. Focus on application-level issues: stack traces, configuration errors, dependency failures, and code-level fixes rather than infrastructure.",
  "security-audit":
    "You are a Kubernetes security engineer performing an audit. Focus on security misconfigurations: overly permissive RBAC, missing network policies, containers running as root, secrets exposure, and CVEs in container images.",
};

export class CrashAnalyzer {
  quickScan(
    snapshot: PodSnapshot,
  ): { label: string; severity: "critical" | "warning" | "info" } | null {
    const fullText = [
      snapshot.events,
      ...Object.values(snapshot.logs),
      ...snapshot.containers.map((c) => c.state + " " + (c.lastState ?? "")),
    ].join("\n");
    for (const { pattern, label, severity } of CRASH_PATTERNS) {
      if (pattern.test(fullText)) return { label, severity };
    }
    return null;
  }

  private extensionPath = "";

  setExtensionPath(p: string) {
    this.extensionPath = p;
  }

  /** Returns metadata about what's being sent to the LLM */
  getPromptContext(): {
    preset: string;
    skills: string[];
    sanitization: boolean;
    customInstructions: boolean;
  } {
    const config = vscode.workspace.getConfiguration("kubiq");
    const guardrails = vscode.workspace.getConfiguration("kubiq.guardrails");
    return {
      preset: config.get<string>("ai.promptPreset", "default"),
      skills: getSkillNames(this.extensionPath),
      sanitization: guardrails.get("sanitizeSecrets", true),
      customInstructions: !!config.get<string>("ai.customInstructions", "").trim(),
    };
  }

  buildInitialPrompt(snapshot: PodSnapshot): string {
    const config = vscode.workspace.getConfiguration("kubiq");
    const guardrails = vscode.workspace.getConfiguration("kubiq.guardrails");

    // Assemble raw pod data
    const rawData = this.buildRawPodData(snapshot);

    // Pre-hook: sanitize secrets
    const sanitizeResult = sanitize(rawData, {
      stripSecrets: guardrails.get("sanitizeSecrets", true),
      stripEnvVarValues: guardrails.get("sanitizeEnvVars", true),
      customPatterns: guardrails.get<string[]>("redactPatterns", []),
    });

    if (sanitizeResult.totalRedacted > 0) {
      console.log(
        `Kubiq: sanitized ${sanitizeResult.totalRedacted} sensitive items from pod data`,
        sanitizeResult.redactions,
      );
    }

    // Build system prompt from preset + custom instructions + workspace rules
    const systemPrompt = this.buildSystemPrompt(config);

    return `${systemPrompt}

${sanitizeResult.sanitized}

---

Instructions:
1. Give a concise 2-3 sentence summary of the pod's health and most likely issue.
2. If there is a clear problem, state the root cause and one immediate fix.
3. Keep this opening response SHORT — 4-6 sentences maximum.
4. End with: "What would you like to investigate further?"
5. You have the full pod context above for all follow-up questions in this session.`;
  }

  private buildSystemPrompt(config: vscode.WorkspaceConfiguration): string {
    // 1. Base preset
    const preset = config.get<string>("ai.promptPreset", "default");
    let prompt = PROMPT_PRESETS[preset] ?? PROMPT_PRESETS["default"];

    // 2. Custom instructions from settings
    const customInstructions = config.get<string>("ai.customInstructions", "");
    if (customInstructions.trim()) {
      prompt += `\n\nAdditional instructions:\n${customInstructions}`;
    }

    // 3. Built-in skills + workspace rules (loaded once, cached)
    const skills = loadSkills(this.extensionPath);
    if (skills) {
      prompt += `\n\nKnowledge base:\n${skills}`;
    }

    return prompt;
  }

  private buildRawPodData(snapshot: PodSnapshot): string {
    const truncate = (s: string, maxChars = 3000) =>
      s.length > maxChars ? `...[truncated]\n${s.slice(-maxChars)}` : s;

    const containerSummary = snapshot.containers
      .map(
        (c) =>
          `- ${c.name}: ${c.state}` +
          (c.lastState ? ` | last: ${c.lastState}` : "") +
          ` | restarts: ${c.restartCount} | image: ${c.image}`,
      )
      .join("\n");

    const logsSummary = Object.entries(snapshot.logs)
      .map(([name, log]) => `=== Container: ${name} ===\n${truncate(log)}`)
      .join("\n\n");

    const prevLogsSummary = Object.entries(snapshot.previousLogs)
      .map(([name, log]) => `=== Previous: ${name} ===\n${truncate(log, 2000)}`)
      .join("\n\n");

    return `## Pod Snapshot
Name: ${snapshot.name}  Namespace: ${snapshot.namespace}
Context: ${snapshot.context}  Phase: ${snapshot.phase}
Node: ${snapshot.nodeName}  Started: ${snapshot.startTime}

## Container Status
${containerSummary}

## Pod Conditions
${snapshot.conditions.map((c) => `${c.type}: ${c.status}${c.reason ? ` (${c.reason})` : ""}`).join("\n")}

## Kubernetes Events
${truncate(snapshot.events, 2000)}

## Current Logs
${logsSummary || "(no logs available)"}

${prevLogsSummary ? `## Previous Container Logs\n${prevLogsSummary}` : ""}`;
  }
}

export const crashAnalyzer = new CrashAnalyzer();
