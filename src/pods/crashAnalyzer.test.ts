import { describe, it, expect } from "vitest";
import { CrashAnalyzer } from "./crashAnalyzer";
import type { PodSnapshot } from "../services/KubectlService";

const analyzer = new CrashAnalyzer();

function makeSnapshot(overrides: Partial<PodSnapshot> = {}): PodSnapshot {
  return {
    name: "test-pod",
    namespace: "default",
    context: "test-ctx",
    phase: "Running",
    nodeName: "node-1",
    startTime: "2024-01-01T00:00:00Z",
    conditions: [{ type: "Ready", status: "True" }],
    containers: [
      {
        name: "app",
        ready: true,
        restartCount: 0,
        state: "Running since 2024-01-01T00:00:00Z",
        image: "app:latest",
      },
    ],
    logs: { app: "INFO: healthy" },
    previousLogs: {},
    events: "",
    describe: "",
    ...overrides,
  };
}

describe("CrashAnalyzer.quickScan", () => {
  it("detects OOMKilled", () => {
    const snap = makeSnapshot({
      containers: [
        {
          name: "app",
          ready: false,
          restartCount: 5,
          state: "Terminated: OOMKilled (exit 137)",
          image: "app:latest",
        },
      ],
    });
    const result = analyzer.quickScan(snap);
    expect(result).not.toBeNull();
    expect(result!.label).toBe("Out of Memory");
    expect(result!.severity).toBe("critical");
  });

  it("detects CrashLoopBackOff", () => {
    const snap = makeSnapshot({
      events: "Warning  BackOff  pod/test  Back-off restarting failed container\nCrashLoopBackOff",
    });
    const result = analyzer.quickScan(snap);
    expect(result).not.toBeNull();
    expect(result!.label).toBe("Crash Loop");
  });

  it("detects ImagePullBackOff", () => {
    const snap = makeSnapshot({ events: "Warning ImagePullBackOff" });
    const result = analyzer.quickScan(snap);
    expect(result).not.toBeNull();
    expect(result!.label).toBe("Image Pull Failure");
  });

  it("detects liveness probe failure", () => {
    const snap = makeSnapshot({
      events: "Warning Unhealthy Liveness probe failed: connection refused",
    });
    const result = analyzer.quickScan(snap);
    expect(result).not.toBeNull();
    expect(result!.label).toBe("Liveness Probe Failure");
    expect(result!.severity).toBe("warning");
  });

  it("detects volume mount failure", () => {
    const snap = makeSnapshot({
      events: "Warning FailedMount MountVolume.SetUp failed for volume",
    });
    const result = analyzer.quickScan(snap);
    expect(result).not.toBeNull();
    expect(result!.label).toBe("Volume Mount Failure");
  });

  it("returns null for healthy pod", () => {
    const snap = makeSnapshot();
    expect(analyzer.quickScan(snap)).toBeNull();
  });
});

describe("CrashAnalyzer.buildInitialPrompt", () => {
  it("includes pod name and namespace", () => {
    const snap = makeSnapshot({ name: "my-pod", namespace: "prod" });
    const prompt = analyzer.buildInitialPrompt(snap);
    expect(prompt).toContain("my-pod");
    expect(prompt).toContain("prod");
  });

  it("includes container info", () => {
    const snap = makeSnapshot();
    const prompt = analyzer.buildInitialPrompt(snap);
    expect(prompt).toContain("app");
    expect(prompt).toContain("app:latest");
  });

  it("truncates long logs", () => {
    const longLog = "x".repeat(5000);
    const snap = makeSnapshot({ logs: { app: longLog } });
    const prompt = analyzer.buildInitialPrompt(snap);
    expect(prompt).toContain("[truncated]");
    // The full 5000-char log should not appear verbatim (truncated to ~3000)
    expect(prompt).not.toContain(longLog);
  });
});
