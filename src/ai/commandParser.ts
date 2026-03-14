/**
 * kubectl command tokenizer and validator.
 * Parses kubectl commands into structured AST and classifies risk.
 */

export interface KubectlAST {
  raw: string;
  verb: string;
  resourceType?: string;
  resourceName?: string;
  namespace?: string;
  context?: string;
  outputFormat?: string;
  flags: Record<string, string | boolean>;
  risk: "safe" | "review" | "dangerous";
  issues: string[];
}

const SAFE_VERBS = new Set([
  "get",
  "describe",
  "logs",
  "top",
  "explain",
  "auth",
  "config",
  "version",
  "cluster-info",
  "api-resources",
  "api-versions",
]);

const REVIEW_VERBS = new Set([
  "apply",
  "create",
  "expose",
  "set",
  "label",
  "annotate",
  "rollout",
  "autoscale",
  "exec",
  "cp",
  "port-forward",
  "run",
]);

const DANGEROUS_VERBS = new Set([
  "delete",
  "drain",
  "cordon",
  "uncordon",
  "taint",
  "replace",
  "patch",
  "edit",
  "scale",
]);

const KNOWN_RESOURCES = new Set([
  "pod",
  "pods",
  "po",
  "deployment",
  "deployments",
  "deploy",
  "service",
  "services",
  "svc",
  "configmap",
  "configmaps",
  "cm",
  "secret",
  "secrets",
  "namespace",
  "namespaces",
  "ns",
  "node",
  "nodes",
  "no",
  "ingress",
  "ingresses",
  "ing",
  "persistentvolumeclaim",
  "persistentvolumeclaims",
  "pvc",
  "persistentvolume",
  "persistentvolumes",
  "pv",
  "serviceaccount",
  "serviceaccounts",
  "sa",
  "clusterrole",
  "clusterroles",
  "clusterrolebinding",
  "clusterrolebindings",
  "role",
  "roles",
  "rolebinding",
  "rolebindings",
  "daemonset",
  "daemonsets",
  "ds",
  "statefulset",
  "statefulsets",
  "sts",
  "replicaset",
  "replicasets",
  "rs",
  "job",
  "jobs",
  "cronjob",
  "cronjobs",
  "cj",
  "networkpolicy",
  "networkpolicies",
  "netpol",
  "storageclass",
  "storageclasses",
  "sc",
  "hpa",
  "horizontalpodautoscaler",
  "horizontalpodautoscalers",
  "event",
  "events",
  "ev",
  "endpoint",
  "endpoints",
  "ep",
]);

export function parseKubectl(command: string): KubectlAST {
  const raw = command.trim();
  const issues: string[] = [];

  // Tokenize respecting quotes
  const tokens = tokenize(raw);

  // Remove "kubectl" prefix
  let idx = 0;
  if (tokens[idx]?.toLowerCase() === "kubectl") idx++;
  if (tokens[idx]?.toLowerCase() === "$") idx = 0; // handle "$ kubectl"
  if (tokens[idx] === "$") idx++;
  if (tokens[idx]?.toLowerCase() === "kubectl") idx++;

  // Extract verb
  const verb = tokens[idx]?.toLowerCase() ?? "";
  idx++;

  // Parse remaining tokens
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  let namespace: string | undefined;
  let context: string | undefined;
  let outputFormat: string | undefined;

  while (idx < tokens.length) {
    const token = tokens[idx];

    if (token.startsWith("--")) {
      const eqIdx = token.indexOf("=");
      if (eqIdx !== -1) {
        const key = token.substring(2, eqIdx);
        const value = token.substring(eqIdx + 1);
        flags[key] = value;
        if (key === "namespace" || key === "n") namespace = value;
        if (key === "context") context = value;
        if (key === "output" || key === "o") outputFormat = value;
      } else {
        const key = token.substring(2);
        // Check if next token is the value
        if (idx + 1 < tokens.length && !tokens[idx + 1].startsWith("-")) {
          flags[key] = tokens[idx + 1];
          if (key === "namespace") namespace = tokens[idx + 1];
          if (key === "context") context = tokens[idx + 1];
          if (key === "output") outputFormat = tokens[idx + 1];
          idx++;
        } else {
          flags[key] = true;
        }
      }
    } else if (token.startsWith("-") && token.length === 2) {
      const key = token.substring(1);
      if (idx + 1 < tokens.length && !tokens[idx + 1].startsWith("-")) {
        flags[key] = tokens[idx + 1];
        if (key === "n") namespace = tokens[idx + 1];
        if (key === "o") outputFormat = tokens[idx + 1];
        if (key === "c") flags["container"] = tokens[idx + 1];
        idx++;
      } else {
        flags[key] = true;
      }
    } else if (token !== "--") {
      positionals.push(token);
    }

    idx++;
  }

  // Extract resource type and name from positionals
  let resourceType: string | undefined;
  let resourceName: string | undefined;

  if (positionals.length > 0) {
    // Handle "deployment/name" syntax
    const slashIdx = positionals[0].indexOf("/");
    if (slashIdx !== -1) {
      resourceType = positionals[0].substring(0, slashIdx);
      resourceName = positionals[0].substring(slashIdx + 1);
    } else if (KNOWN_RESOURCES.has(positionals[0].toLowerCase())) {
      resourceType = positionals[0].toLowerCase();
      if (positionals.length > 1) resourceName = positionals[1];
    } else {
      // Might be a subcommand (e.g., "rollout status")
      resourceType = positionals[0];
      if (positionals.length > 1) resourceName = positionals[1];
    }
  }

  // Classify risk
  let risk: "safe" | "review" | "dangerous" = "review";
  if (SAFE_VERBS.has(verb)) risk = "safe";
  else if (DANGEROUS_VERBS.has(verb)) risk = "dangerous";
  else if (REVIEW_VERBS.has(verb)) risk = "review";

  // Extra risk checks
  if (verb === "scale" && flags["replicas"] === "0") risk = "dangerous";
  if (verb === "delete" && (flags["all"] === true || positionals.includes("--all"))) {
    risk = "dangerous";
    issues.push("Deleting ALL resources — this is very destructive");
  }
  if (verb === "replace" && flags["force"] === true) risk = "dangerous";

  // Validation
  if (!verb) issues.push("No kubectl verb specified");
  if (verb === "apply" && !flags["f"] && !flags["filename"]) {
    issues.push("kubectl apply requires -f <file> or stdin");
  }
  if (flags["all-namespaces"] && namespace) {
    issues.push("Conflicting flags: --all-namespaces and --namespace");
  }

  // Deprecated flags
  if (flags["show-all"]) issues.push("--show-all is deprecated (removed in K8s 1.21)");
  if (flags["export"]) issues.push("--export is deprecated (removed in K8s 1.18)");

  return {
    raw,
    verb,
    resourceType,
    resourceName,
    namespace,
    context,
    outputFormat,
    flags,
    risk,
    issues,
  };
}

/** Extract all kubectl commands from a text (AI response) */
export function extractKubectlCommands(text: string): KubectlAST[] {
  const results: KubectlAST[] = [];
  // Match kubectl commands in code blocks and inline
  const patterns = [/```(?:bash|sh|shell)?\n?([\s\S]*?)```/g, /`(kubectl\s+[^`]+)`/g];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const block = match[1];
      // Split block into lines and find kubectl commands
      for (const line of block.split("\n")) {
        const trimmed = line.trim().replace(/^\$\s*/, "");
        if (trimmed.startsWith("kubectl ")) {
          results.push(parseKubectl(trimmed));
        }
      }
    }
  }

  return results;
}

function tokenize(cmd: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === " " && !inSingle && !inDouble) {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }

  if (current) tokens.push(current);
  return tokens;
}
