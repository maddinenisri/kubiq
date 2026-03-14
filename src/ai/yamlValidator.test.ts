import { describe, it, expect } from "vitest";
import { validateYaml } from "./yamlValidator";

describe("YAML Validator", () => {
  it("catches invalid YAML syntax", () => {
    const result = validateYaml("not: valid: yaml: [broken");
    expect(result.valid).toBe(false);
    expect(result.errors[0].rule).toBe("syntax");
  });

  it("catches missing apiVersion", () => {
    const result = validateYaml("kind: Pod\nmetadata:\n  name: test");
    expect(result.errors.some((e) => e.rule === "missing-apiversion")).toBe(true);
  });

  it("catches missing kind", () => {
    const result = validateYaml("apiVersion: v1\nmetadata:\n  name: test");
    expect(result.errors.some((e) => e.rule === "missing-kind")).toBe(true);
  });

  it("catches missing metadata.name", () => {
    const result = validateYaml("apiVersion: v1\nkind: Pod\nmetadata: {}");
    expect(result.errors.some((e) => e.rule === "missing-name")).toBe(true);
  });

  it("warns on :latest image tag", () => {
    const yaml = `apiVersion: v1
kind: Pod
metadata:
  name: test
spec:
  containers:
    - name: app
      image: myapp:latest`;
    const result = validateYaml(yaml);
    expect(result.warnings.some((w) => w.rule === "latest-tag")).toBe(true);
  });

  it("warns on image without tag", () => {
    const yaml = `apiVersion: v1
kind: Pod
metadata:
  name: test
spec:
  containers:
    - name: app
      image: myapp`;
    const result = validateYaml(yaml);
    expect(result.warnings.some((w) => w.rule === "latest-tag")).toBe(true);
  });

  it("warns on missing resource limits", () => {
    const yaml = `apiVersion: v1
kind: Pod
metadata:
  name: test
spec:
  containers:
    - name: app
      image: myapp:v1`;
    const result = validateYaml(yaml);
    expect(result.warnings.some((w) => w.rule === "missing-resources")).toBe(true);
  });

  it("warns on missing probes", () => {
    const yaml = `apiVersion: v1
kind: Pod
metadata:
  name: test
spec:
  containers:
    - name: app
      image: myapp:v1`;
    const result = validateYaml(yaml);
    expect(result.warnings.some((w) => w.rule === "missing-probes")).toBe(true);
  });

  it("errors on privileged container", () => {
    const yaml = `apiVersion: v1
kind: Pod
metadata:
  name: test
spec:
  containers:
    - name: app
      image: myapp:v1
      securityContext:
        privileged: true`;
    const result = validateYaml(yaml);
    expect(result.errors.some((e) => e.rule === "privileged")).toBe(true);
  });

  it("errors on missing containers", () => {
    const yaml = `apiVersion: v1
kind: Pod
metadata:
  name: test
spec:
  containers: []`;
    const result = validateYaml(yaml);
    expect(result.errors.some((e) => e.rule === "missing-containers")).toBe(true);
  });

  it("errors on invalid port", () => {
    const yaml = `apiVersion: v1
kind: Pod
metadata:
  name: test
spec:
  containers:
    - name: app
      image: myapp:v1
      ports:
        - containerPort: 99999`;
    const result = validateYaml(yaml);
    expect(result.errors.some((e) => e.rule === "invalid-port")).toBe(true);
  });

  it("validates deployment selector", () => {
    const yaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  selector: {}
  template:
    spec:
      containers:
        - name: app
          image: myapp:v1`;
    const result = validateYaml(yaml);
    expect(result.errors.some((e) => e.rule === "empty-selector")).toBe(true);
  });

  it("validates service selector", () => {
    const yaml = `apiVersion: v1
kind: Service
metadata:
  name: test
spec:
  selector: {}
  ports:
    - port: 80`;
    const result = validateYaml(yaml);
    expect(result.errors.some((e) => e.rule === "empty-service-selector")).toBe(true);
  });

  it("passes valid deployment", () => {
    const yaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
  namespace: prod
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      containers:
        - name: app
          image: myapp:v1.2.3
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080`;
    const result = validateYaml(yaml);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("reports info for missing namespace", () => {
    const yaml = `apiVersion: v1
kind: Pod
metadata:
  name: test
spec:
  containers:
    - name: app
      image: myapp:v1`;
    const result = validateYaml(yaml);
    expect(result.infos.some((i) => i.rule === "no-namespace")).toBe(true);
  });
});
