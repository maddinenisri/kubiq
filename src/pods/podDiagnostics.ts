import { execFile } from "child_process";
import { promisify } from "util";
import * as vscode from "vscode";
import { contextManager } from "../clusters/contextManager";

const exec = promisify(execFile);

export interface ContainerStatus {
  name: string;
  ready: boolean;
  restartCount: number;
  state: string;
  lastState?: string;
  image: string;
}

export interface PodSnapshot {
  name: string;
  namespace: string;
  context: string;
  phase: string;
  nodeName: string;
  startTime: string;
  conditions: Array<{ type: string; status: string; reason?: string }>;
  containers: ContainerStatus[];
  logs: Record<string, string>;      // containerName → log text
  previousLogs: Record<string, string>; // previous terminated container logs
  events: string;
  describe: string;
  rawJson: Record<string, unknown>;
}

export class PodDiagnostics {
  async gather(
    podName: string,
    namespace: string,
    context: string
  ): Promise<PodSnapshot> {
    const profile = contextManager.resolve(context);
    const tailLines = vscode.workspace
      .getConfiguration("kubiq")
      .get<number>("logTailLines", 500);

    const baseArgs = [
      `--context=${context}`,
      `--namespace=${namespace}`,
    ];

    const env = {
      ...process.env,
      AWS_PROFILE: profile.profile,
      AWS_DEFAULT_REGION: profile.region,
    };

    // Run all fetches in parallel for speed
    const [podJson, eventsRaw, describeRaw] = await Promise.all([
      this.kubectl(["get", "pod", podName, "-o", "json", ...baseArgs], env),
      this.kubectl(
        [
          "get",
          "events",
          "--field-selector",
          `involvedObject.name=${podName}`,
          "--sort-by=.metadata.creationTimestamp",
          ...baseArgs,
        ],
        env
      ),
      this.kubectl(["describe", "pod", podName, ...baseArgs], env),
    ]);

    const podObj = JSON.parse(podJson) as Record<string, unknown>;
    const spec = podObj.spec as Record<string, unknown>;
    const status = podObj.status as Record<string, unknown>;
    const containers = (
      (status.containerStatuses as unknown[]) ?? []
    ) as Array<Record<string, unknown>>;

    // Parse container statuses
    const containerStatuses: ContainerStatus[] = containers.map((c) => {
      const state = c.state as Record<string, unknown>;
      const lastState = c.lastState as Record<string, unknown>;
      const stateKey = Object.keys(state ?? {})[0] ?? "unknown";
      const lastStateKey = Object.keys(lastState ?? {})[0];
      return {
        name: c.name as string,
        ready: c.ready as boolean,
        restartCount: c.restartCount as number,
        state: this.describeState(state),
        lastState: lastStateKey ? this.describeState(lastState) : undefined,
        image: c.image as string,
      };
    });

    // Fetch logs for every container (current + previous if crashed)
    const containerSpecs = (spec.containers as Array<{ name: string }>) ?? [];
    const logEntries = await Promise.all(
      containerSpecs.map(async ({ name }) => {
        const current = await this.kubectl(
          [
            "logs",
            podName,
            "-c",
            name,
            `--tail=${tailLines}`,
            ...baseArgs,
          ],
          env
        ).catch((e: Error) => `[log fetch error] ${e.message}`);

        const previous = await this.kubectl(
          [
            "logs",
            podName,
            "-c",
            name,
            `--tail=${tailLines}`,
            "--previous",
            ...baseArgs,
          ],
          env
        ).catch(() => "");

        return { name, current, previous };
      })
    );

    const logs: Record<string, string> = {};
    const previousLogs: Record<string, string> = {};
    for (const { name, current, previous } of logEntries) {
      logs[name] = current;
      if (previous) previousLogs[name] = previous;
    }

    const meta = podObj.metadata as Record<string, unknown>;
    const statusTop = podObj.status as Record<string, unknown>;

    return {
      name: podName,
      namespace,
      context,
      phase: (statusTop.phase as string) ?? "Unknown",
      nodeName: (spec.nodeName as string) ?? "",
      startTime: (statusTop.startTime as string) ?? "",
      conditions: ((statusTop.conditions as unknown[]) ?? []).map(
        (c: unknown) => {
          const cc = c as Record<string, unknown>;
          return {
            type: cc.type as string,
            status: cc.status as string,
            reason: cc.reason as string | undefined,
          };
        }
      ),
      containers: containerStatuses,
      logs,
      previousLogs,
      events: eventsRaw,
      describe: describeRaw,
      rawJson: podObj,
    };
  }

  private describeState(state: Record<string, unknown>): string {
    const key = Object.keys(state ?? {})[0];
    if (!key) return "unknown";
    const detail = state[key] as Record<string, unknown>;
    if (key === "waiting") return `Waiting: ${detail?.reason ?? ""}`;
    if (key === "terminated")
      return `Terminated: ${detail?.reason ?? ""} (exit ${detail?.exitCode ?? "?"})`;
    if (key === "running") return `Running since ${detail?.startedAt ?? ""}`;
    return key;
  }

  private async kubectl(
    args: string[],
    env: NodeJS.ProcessEnv
  ): Promise<string> {
    const { stdout } = await exec("kubectl", args, { env, maxBuffer: 10 * 1024 * 1024 });
    return stdout;
  }
}

export const podDiagnostics = new PodDiagnostics();
