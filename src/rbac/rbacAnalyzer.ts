/**
 * RBAC security analyzer — detects overly broad permissions and security risks.
 */

import type { RbacWarning, RbacPolicyRule } from "../shared/types";

export function analyzeRoleWarnings(
  roleName: string,
  roleKind: string,
  rules: RbacPolicyRule[],
): RbacWarning[] {
  const warnings: RbacWarning[] = [];

  // cluster-admin binding
  if (roleName === "cluster-admin") {
    warnings.push({
      severity: "danger",
      message: `Bound to cluster-admin — full cluster access`,
    });
  }

  for (const rule of rules) {
    // Wildcard verbs
    if (rule.verbs.includes("*")) {
      warnings.push({
        severity: "danger",
        message: `Wildcard verbs ["*"] on ${rule.resources.join(", ") || "all resources"}`,
      });
    }

    // Wildcard resources
    if (rule.resources.includes("*")) {
      warnings.push({
        severity: "danger",
        message: `Wildcard resources ["*"] — access to ALL resource types`,
      });
    }

    // Wildcard API groups
    if (rule.apiGroups.includes("*")) {
      warnings.push({
        severity: "warning",
        message: `Wildcard API groups ["*"] — access to all API groups`,
      });
    }

    // Secrets access
    if (rule.resources.some((r) => r === "secrets") && hasReadAccess(rule.verbs)) {
      warnings.push({
        severity: "warning",
        message: `Can read Secrets — potential credential exposure`,
      });
    }

    // Pod exec
    if (
      rule.resources.some((r) => r === "pods/exec" || r === "pods") &&
      rule.verbs.some((v) => v === "create" || v === "*")
    ) {
      warnings.push({
        severity: "warning",
        message: `Can exec into pods — arbitrary command execution`,
      });
    }

    // Escalation: create rolebindings/clusterrolebindings
    if (
      rule.resources.some((r) => r.includes("rolebinding") || r.includes("clusterrolebinding")) &&
      rule.verbs.some((v) => v === "create" || v === "update" || v === "patch" || v === "*")
    ) {
      warnings.push({
        severity: "danger",
        message: `Can create/modify role bindings — privilege escalation risk`,
      });
    }

    // Node access
    if (
      rule.resources.some((r) => r === "nodes" || r === "nodes/proxy") &&
      rule.verbs.some((v) => v === "*" || v === "get" || v === "proxy")
    ) {
      warnings.push({
        severity: "warning",
        message: `Node access — can inspect or proxy to cluster nodes`,
      });
    }
  }

  return warnings;
}

function hasReadAccess(verbs: string[]): boolean {
  return verbs.some((v) => v === "get" || v === "list" || v === "watch" || v === "*");
}

/**
 * Analyze a binding to detect if it grants excessive permissions.
 */
export function analyzeBindingWarnings(subjects: string[], roleRef: string): RbacWarning[] {
  const warnings: RbacWarning[] = [];

  if (roleRef.includes("cluster-admin")) {
    warnings.push({
      severity: "danger",
      message: `Grants cluster-admin to: ${subjects.join(", ")}`,
    });
  }

  // system:anonymous or system:unauthenticated
  if (
    subjects.some((s) => s.includes("system:anonymous") || s.includes("system:unauthenticated"))
  ) {
    warnings.push({
      severity: "danger",
      message: `Grants permissions to unauthenticated users`,
    });
  }

  return warnings;
}
