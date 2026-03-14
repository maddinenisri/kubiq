import { describe, it, expect } from "vitest";
import { analyzeRoleWarnings, analyzeBindingWarnings } from "./rbacAnalyzer";

describe("RBAC Analyzer", () => {
  describe("analyzeRoleWarnings", () => {
    it("flags cluster-admin", () => {
      const warnings = analyzeRoleWarnings("cluster-admin", "ClusterRole", []);
      expect(warnings.some((w) => w.message.includes("cluster-admin"))).toBe(true);
    });

    it("flags wildcard verbs", () => {
      const warnings = analyzeRoleWarnings("test-role", "Role", [
        { apiGroups: [""], resources: ["pods"], verbs: ["*"] },
      ]);
      expect(warnings.some((w) => w.message.includes("Wildcard verbs"))).toBe(true);
    });

    it("flags wildcard resources", () => {
      const warnings = analyzeRoleWarnings("test-role", "Role", [
        { apiGroups: [""], resources: ["*"], verbs: ["get"] },
      ]);
      expect(warnings.some((w) => w.message.includes("Wildcard resources"))).toBe(true);
    });

    it("flags secrets read access", () => {
      const warnings = analyzeRoleWarnings("test-role", "Role", [
        { apiGroups: [""], resources: ["secrets"], verbs: ["get", "list"] },
      ]);
      expect(warnings.some((w) => w.message.includes("Secrets"))).toBe(true);
    });

    it("flags pod exec", () => {
      const warnings = analyzeRoleWarnings("test-role", "Role", [
        { apiGroups: [""], resources: ["pods/exec"], verbs: ["create"] },
      ]);
      expect(warnings.some((w) => w.message.includes("exec"))).toBe(true);
    });

    it("flags role binding creation (escalation)", () => {
      const warnings = analyzeRoleWarnings("test-role", "Role", [
        {
          apiGroups: ["rbac.authorization.k8s.io"],
          resources: ["rolebindings"],
          verbs: ["create"],
        },
      ]);
      expect(warnings.some((w) => w.message.includes("escalation"))).toBe(true);
    });

    it("flags node access", () => {
      const warnings = analyzeRoleWarnings("test-role", "ClusterRole", [
        { apiGroups: [""], resources: ["nodes"], verbs: ["get", "list"] },
      ]);
      expect(warnings.some((w) => w.message.includes("Node access"))).toBe(true);
    });

    it("returns no warnings for minimal read-only role", () => {
      const warnings = analyzeRoleWarnings("readonly", "Role", [
        { apiGroups: [""], resources: ["pods", "services"], verbs: ["get", "list", "watch"] },
      ]);
      expect(warnings).toHaveLength(0);
    });
  });

  describe("analyzeBindingWarnings", () => {
    it("flags cluster-admin binding", () => {
      const warnings = analyzeBindingWarnings(
        ["ServiceAccount/default/my-sa"],
        "ClusterRole/cluster-admin",
      );
      expect(warnings.some((w) => w.message.includes("cluster-admin"))).toBe(true);
    });

    it("flags anonymous access", () => {
      const warnings = analyzeBindingWarnings(["User/system:anonymous"], "ClusterRole/view");
      expect(warnings.some((w) => w.message.includes("unauthenticated"))).toBe(true);
    });

    it("returns no warnings for normal binding", () => {
      const warnings = analyzeBindingWarnings(["ServiceAccount/default/my-sa"], "Role/my-role");
      expect(warnings).toHaveLength(0);
    });
  });
});
