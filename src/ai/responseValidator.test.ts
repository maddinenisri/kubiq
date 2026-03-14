import { describe, it, expect } from "vitest";
import { validateResponse } from "./responseValidator";

describe("responseValidator", () => {
  it("flags kubectl delete as destructive", () => {
    const response = "Try running `kubectl delete pod my-pod -n default` to restart it.";
    const result = validateResponse(response, true);
    expect(result.flaggedCommands).toHaveLength(1);
    expect(result.flaggedCommands[0].severity).toBe("danger");
    expect(result.flaggedCommands[0].command).toContain("kubectl delete");
  });

  it("flags kubectl drain as destructive", () => {
    const response = "Run `kubectl drain node-1 --ignore-daemonsets` to evacuate.";
    const result = validateResponse(response, true);
    expect(result.flaggedCommands).toHaveLength(1);
    expect(result.flaggedCommands[0].severity).toBe("danger");
  });

  it("flags kubectl scale to zero as destructive", () => {
    const response = "Scale down: `kubectl scale --replicas=0 deployment/my-app`";
    const result = validateResponse(response, true);
    expect(result.flaggedCommands).toHaveLength(1);
    expect(result.flaggedCommands[0].severity).toBe("danger");
  });

  it("does not flag read-only commands", () => {
    const response = "Check with `kubectl get pods -n default` and `kubectl describe pod my-pod`.";
    const result = validateResponse(response, true);
    expect(result.flaggedCommands).toHaveLength(0);
  });

  it("flags kubectl apply as warning (mutating but not destructive)", () => {
    const response = "Apply the fix: `kubectl apply -f deployment.yaml`";
    const result = validateResponse(response, true);
    expect(result.flaggedCommands).toHaveLength(1);
    expect(result.flaggedCommands[0].severity).toBe("warning");
  });

  it("returns empty when flagging disabled", () => {
    const response = "Run `kubectl delete namespace production` immediately.";
    const result = validateResponse(response, false);
    expect(result.flaggedCommands).toHaveLength(0);
  });

  it("detects deprecated --export flag", () => {
    const response = "Export with `kubectl get deployment -o yaml --export`";
    const result = validateResponse(response, true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("--export");
  });

  it("handles multiple commands in one response", () => {
    const response = `First check: \`kubectl get pods\`
Then fix: \`kubectl delete pod stuck-pod\`
And apply: \`kubectl apply -f fix.yaml\``;
    const result = validateResponse(response, true);
    expect(result.flaggedCommands).toHaveLength(2); // delete (danger) + apply (warning)
  });
});
