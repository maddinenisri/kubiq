import type { PodSnapshot } from "../kubectl/runner";

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

  buildInitialPrompt(snapshot: PodSnapshot): string {
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

    return `You are an expert Kubernetes SRE acting as an interactive assistant inside a VS Code pod diagnostic panel.

## Pod Snapshot
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

${prevLogsSummary ? `## Previous Container Logs\n${prevLogsSummary}` : ""}

---

Instructions:
1. Give a concise 2-3 sentence summary of the pod's health and most likely issue.
2. If there is a clear problem, state the root cause and one immediate fix.
3. Keep this opening response SHORT — 4-6 sentences maximum.
4. End with: "What would you like to investigate further?"
5. You have the full pod context above for all follow-up questions in this session.`;
  }
}

export const crashAnalyzer = new CrashAnalyzer();
