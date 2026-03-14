import { describe, it, expect } from "vitest";
import { parseKubectl, extractKubectlCommands } from "./commandParser";

describe("kubectl command parser", () => {
  it("parses basic get command", () => {
    const ast = parseKubectl("kubectl get pods");
    expect(ast.verb).toBe("get");
    expect(ast.resourceType).toBe("pods");
    expect(ast.risk).toBe("safe");
  });

  it("parses command with namespace flag", () => {
    const ast = parseKubectl("kubectl get pods -n production");
    expect(ast.verb).toBe("get");
    expect(ast.namespace).toBe("production");
  });

  it("parses long namespace flag", () => {
    const ast = parseKubectl("kubectl get pods --namespace=kube-system");
    expect(ast.namespace).toBe("kube-system");
  });

  it("parses resource/name syntax", () => {
    const ast = parseKubectl("kubectl get deployment/my-app");
    expect(ast.resourceType).toBe("deployment");
    expect(ast.resourceName).toBe("my-app");
  });

  it("classifies get as safe", () => {
    expect(parseKubectl("kubectl get pods").risk).toBe("safe");
    expect(parseKubectl("kubectl describe pod my-pod").risk).toBe("safe");
    expect(parseKubectl("kubectl logs my-pod").risk).toBe("safe");
    expect(parseKubectl("kubectl top pods").risk).toBe("safe");
  });

  it("classifies apply as review", () => {
    expect(parseKubectl("kubectl apply -f deploy.yaml").risk).toBe("review");
    expect(parseKubectl("kubectl exec my-pod -- bash").risk).toBe("review");
  });

  it("classifies delete as dangerous", () => {
    expect(parseKubectl("kubectl delete pod my-pod").risk).toBe("dangerous");
    expect(parseKubectl("kubectl drain node-1").risk).toBe("dangerous");
    expect(parseKubectl("kubectl cordon node-1").risk).toBe("dangerous");
  });

  it("classifies scale to zero as dangerous", () => {
    const ast = parseKubectl("kubectl scale deployment/my-app --replicas=0");
    expect(ast.risk).toBe("dangerous");
  });

  it("warns on delete --all", () => {
    const ast = parseKubectl("kubectl delete pods --all -n test");
    expect(ast.risk).toBe("dangerous");
    expect(ast.issues.length).toBeGreaterThan(0);
  });

  it("detects deprecated --show-all", () => {
    const ast = parseKubectl("kubectl get pods --show-all");
    expect(ast.issues.some((i) => i.includes("--show-all"))).toBe(true);
  });

  it("detects deprecated --export", () => {
    const ast = parseKubectl("kubectl get deploy my-app -o yaml --export");
    expect(ast.issues.some((i) => i.includes("--export"))).toBe(true);
  });

  it("detects conflicting namespace flags", () => {
    const ast = parseKubectl("kubectl get pods --all-namespaces --namespace=prod");
    expect(ast.issues.some((i) => i.includes("Conflicting"))).toBe(true);
  });

  it("handles $ prefix", () => {
    const ast = parseKubectl("$ kubectl get pods");
    expect(ast.verb).toBe("get");
    expect(ast.resourceType).toBe("pods");
  });

  it("handles quoted arguments", () => {
    const ast = parseKubectl('kubectl exec my-pod -- sh -c "echo hello"');
    expect(ast.verb).toBe("exec");
  });

  it("parses output format", () => {
    const ast = parseKubectl("kubectl get pods -o json");
    expect(ast.outputFormat).toBe("json");
  });
});

describe("extractKubectlCommands", () => {
  it("extracts from code blocks", () => {
    const text = "Try this:\n```bash\nkubectl get pods\nkubectl describe pod my-pod\n```";
    const cmds = extractKubectlCommands(text);
    expect(cmds).toHaveLength(2);
    expect(cmds[0].verb).toBe("get");
    expect(cmds[1].verb).toBe("describe");
  });

  it("extracts from inline code", () => {
    const text = "Run `kubectl get pods -n prod` to check.";
    const cmds = extractKubectlCommands(text);
    expect(cmds).toHaveLength(1);
    expect(cmds[0].namespace).toBe("prod");
  });

  it("returns empty for no commands", () => {
    const text = "No kubectl commands here, just text.";
    const cmds = extractKubectlCommands(text);
    expect(cmds).toHaveLength(0);
  });
});
