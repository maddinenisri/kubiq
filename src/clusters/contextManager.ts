import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as yaml from "js-yaml";
import * as vscode from "vscode";

export interface ClusterProfile {
  contextName: string;
  clusterName: string;
  profile: string;
  region: string;
  source: "auto-detected" | "manual-override";
}

interface KubeConfig {
  contexts?: Array<{
    name: string;
    context: { cluster: string; user: string; namespace?: string };
  }>;
  users?: Array<{
    name: string;
    user: {
      exec?: {
        command: string;
        args?: string[];
        env?: Array<{ name: string; value: string }>;
      };
    };
  }>;
}

/**
 * Reads ~/.kube/config and extracts the AWS profile + region from the
 * `exec` authenticator block that EKS clusters use. Falls back to manual
 * overrides from settings when auto-detection is incomplete.
 */
export class ContextManager {
  private cache = new Map<string, ClusterProfile>();

  resolve(contextName: string): ClusterProfile {
    if (this.cache.has(contextName)) {
      return this.cache.get(contextName)!;
    }
    const profile = this.buildProfile(contextName);
    this.cache.set(contextName, profile);
    return profile;
  }

  invalidate() {
    this.cache.clear();
  }

  private buildProfile(contextName: string): ClusterProfile {
    const manualOverrides = vscode.workspace
      .getConfiguration("kubiq")
      .get<Record<string, { profile: string; region: string }>>(
        "clusterProfiles",
        {}
      );

    // Start with auto-detected values
    const detected = this.autoDetect(contextName);

    // Manual override wins on a per-field basis
    const override = manualOverrides[contextName];
    const profile: ClusterProfile = {
      contextName,
      clusterName: detected.clusterName,
      profile: override?.profile ?? detected.profile,
      region: override?.region ?? detected.region,
      source: override ? "manual-override" : "auto-detected",
    };

    return profile;
  }

  private autoDetect(contextName: string): {
    clusterName: string;
    profile: string;
    region: string;
  } {
    const kubeconfigPath =
      process.env.KUBECONFIG ?? path.join(os.homedir(), ".kube", "config");

    try {
      const raw = fs.readFileSync(kubeconfigPath, "utf8");
      const config = yaml.load(raw) as KubeConfig;

      const ctx = config.contexts?.find((c) => c.name === contextName);
      if (!ctx) {
        return { clusterName: contextName, profile: "default", region: "us-east-1" };
      }

      const userName = ctx.context.user;
      const user = config.users?.find((u) => u.name === userName);
      const exec = user?.user?.exec;

      let profile = "default";
      let region = "us-east-1";

      if (exec?.args) {
        // aws eks get-token --cluster-name X --region Y --profile Z
        const args = exec.args;
        const profileIdx = args.indexOf("--profile");
        if (profileIdx !== -1 && args[profileIdx + 1]) {
          profile = args[profileIdx + 1];
        }
        const regionIdx = args.indexOf("--region");
        if (regionIdx !== -1 && args[regionIdx + 1]) {
          region = args[regionIdx + 1];
        }
      }

      // Also check env block on the exec stanza
      if (exec?.env) {
        const awsProfile = exec.env.find((e) => e.name === "AWS_PROFILE");
        const awsRegion = exec.env.find((e) => e.name === "AWS_DEFAULT_REGION");
        if (awsProfile) profile = awsProfile.value;
        if (awsRegion) region = awsRegion.value;
      }

      return { clusterName: ctx.context.cluster, profile, region };
    } catch {
      return { clusterName: contextName, profile: "default", region: "us-east-1" };
    }
  }

  /** Returns all EKS contexts found in kubeconfig */
  listEksContexts(): string[] {
    const kubeconfigPath =
      process.env.KUBECONFIG ?? path.join(os.homedir(), ".kube", "config");
    try {
      const raw = fs.readFileSync(kubeconfigPath, "utf8");
      const config = yaml.load(raw) as KubeConfig;
      return (
        config.contexts
          ?.filter((ctx) => {
            const user = config.users?.find((u) => u.name === ctx.context.user);
            const cmd = user?.user?.exec?.command ?? "";
            return cmd.includes("aws") || cmd.includes("eks");
          })
          .map((c) => c.name) ?? []
      );
    } catch {
      return [];
    }
  }
}

export const contextManager = new ContextManager();
