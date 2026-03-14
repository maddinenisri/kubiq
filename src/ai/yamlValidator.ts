/**
 * YAML AST Validator — parses YAML into AST and validates against
 * Kubernetes schema rules and best practices.
 */
import * as yaml from "js-yaml";

export interface ValidationIssue {
  line: number;
  severity: "error" | "warning" | "info";
  rule: string;
  message: string;
  fix?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
}

export function validateYaml(content: string): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const infos: ValidationIssue[] = [];

  // Layer 1: Syntax — parse YAML
  let doc: Record<string, unknown>;
  try {
    doc = yaml.load(content) as Record<string, unknown>;
    if (!doc || typeof doc !== "object") {
      errors.push({
        line: 1,
        severity: "error",
        rule: "syntax",
        message: "Invalid YAML: not an object",
      });
      return { valid: false, errors, warnings, infos };
    }
  } catch (e) {
    const yamlError = e as { mark?: { line?: number }; message?: string };
    errors.push({
      line: (yamlError.mark?.line ?? 0) + 1,
      severity: "error",
      rule: "syntax",
      message: `YAML syntax error: ${yamlError.message?.split("\n")[0] ?? "parse failed"}`,
    });
    return { valid: false, errors, warnings, infos };
  }

  // Layer 2: K8s Schema — required fields
  const kind = doc.kind as string | undefined;
  const apiVersion = doc.apiVersion as string | undefined;
  const metadata = doc.metadata as Record<string, unknown> | undefined;
  const spec = doc.spec as Record<string, unknown> | undefined;

  if (!apiVersion) {
    errors.push({
      line: 1,
      severity: "error",
      rule: "missing-apiversion",
      message: "Missing required field: apiVersion",
    });
  }

  if (!kind) {
    errors.push({
      line: 1,
      severity: "error",
      rule: "missing-kind",
      message: "Missing required field: kind",
    });
  }

  if (!metadata?.name) {
    errors.push({
      line: findLineOf(content, "metadata"),
      severity: "error",
      rule: "missing-name",
      message: "Missing required field: metadata.name",
    });
  }

  if (!kind) {
    return { valid: errors.length === 0, errors, warnings, infos };
  }

  // Kind-specific validation
  const k = kind.toLowerCase();

  if (k === "deployment" || k === "statefulset" || k === "daemonset") {
    validateWorkload(content, doc, spec, errors, warnings, infos);
  }

  if (k === "pod") {
    const podSpec = spec;
    if (podSpec) {
      validateContainers(content, podSpec, errors, warnings, infos);
    }
  }

  if (k === "service") {
    validateService(content, spec, errors, warnings, infos);
  }

  // Namespace info
  if (!metadata?.namespace) {
    infos.push({
      line: findLineOf(content, "metadata"),
      severity: "info",
      rule: "no-namespace",
      message: "No namespace specified — will deploy to 'default'",
    });
  }

  return { valid: errors.length === 0, errors, warnings, infos };
}

function validateWorkload(
  content: string,
  doc: Record<string, unknown>,
  spec: Record<string, unknown> | undefined,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  infos: ValidationIssue[],
) {
  if (!spec) {
    errors.push({
      line: 1,
      severity: "error",
      rule: "missing-spec",
      message: "Missing required field: spec",
    });
    return;
  }

  // Selector
  const selector = spec.selector as Record<string, unknown> | undefined;
  if (!selector?.matchLabels) {
    errors.push({
      line: findLineOf(content, "selector"),
      severity: "error",
      rule: "empty-selector",
      message: "Deployment selector.matchLabels is required",
    });
  }

  // Template
  const template = spec.template as Record<string, unknown> | undefined;
  const templateSpec = template?.spec as Record<string, unknown> | undefined;
  if (!templateSpec) {
    errors.push({
      line: findLineOf(content, "template"),
      severity: "error",
      rule: "missing-template",
      message: "Missing spec.template.spec",
    });
    return;
  }

  validateContainers(content, templateSpec, errors, warnings, infos);
}

function validateContainers(
  content: string,
  podSpec: Record<string, unknown>,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  _infos: ValidationIssue[],
) {
  const containers = podSpec.containers as Array<Record<string, unknown>> | undefined;
  if (!containers || containers.length === 0) {
    errors.push({
      line: findLineOf(content, "containers"),
      severity: "error",
      rule: "missing-containers",
      message: "At least one container is required",
    });
    return;
  }

  for (const container of containers) {
    const name = container.name as string | undefined;
    const image = container.image as string | undefined;
    const resources = container.resources as Record<string, unknown> | undefined;
    const livenessProbe = container.livenessProbe;
    const readinessProbe = container.readinessProbe;
    const securityContext = container.securityContext as Record<string, unknown> | undefined;
    const ports = container.ports as Array<Record<string, unknown>> | undefined;

    const containerLabel = name ? `container '${name}'` : "container";
    const containerLine = findLineOf(content, name ?? "containers");

    // Required: image
    if (!image) {
      errors.push({
        line: containerLine,
        severity: "error",
        rule: "missing-image",
        message: `${containerLabel}: missing 'image' field`,
      });
    }

    // Warning: :latest tag
    if (image?.endsWith(":latest") || (image && !image.includes(":"))) {
      warnings.push({
        line: findLineOf(content, image ?? "image"),
        severity: "warning",
        rule: "latest-tag",
        message: `${containerLabel}: image uses ':latest' tag — use a specific version`,
        fix: `Change to a specific tag (e.g., ${image?.split(":")[0]}:v1.0.0)`,
      });
    }

    // Warning: missing resources
    if (!resources?.requests && !resources?.limits) {
      warnings.push({
        line: containerLine,
        severity: "warning",
        rule: "missing-resources",
        message: `${containerLabel}: no resource requests/limits — risk of OOM or throttling`,
        fix: "Add resources.requests (cpu: 250m, memory: 256Mi) and resources.limits",
      });
    }

    // Validate resource quantities
    if (resources) {
      validateResourceQuantities(content, resources, containerLabel, errors);
    }

    // Warning: missing probes
    if (!livenessProbe && !readinessProbe) {
      warnings.push({
        line: containerLine,
        severity: "warning",
        rule: "missing-probes",
        message: `${containerLabel}: no liveness or readiness probes`,
        fix: "Add livenessProbe and readinessProbe for health checks",
      });
    }

    // Security: privileged
    if (securityContext?.privileged === true) {
      errors.push({
        line: findLineOf(content, "privileged"),
        severity: "error",
        rule: "privileged",
        message: `${containerLabel}: running in privileged mode — security risk`,
      });
    }

    // Security: runAsRoot
    if (
      securityContext &&
      securityContext.runAsNonRoot !== true &&
      securityContext.runAsUser !== 0
    ) {
      warnings.push({
        line: containerLine,
        severity: "warning",
        rule: "run-as-root",
        message: `${containerLabel}: no runAsNonRoot: true — container may run as root`,
      });
    }

    // Validate ports
    if (ports) {
      for (const port of ports) {
        const containerPort = port.containerPort as number | undefined;
        if (containerPort !== undefined && (containerPort < 1 || containerPort > 65535)) {
          errors.push({
            line: findLineOf(content, String(containerPort)),
            severity: "error",
            rule: "invalid-port",
            message: `${containerLabel}: port ${containerPort} is out of range (1-65535)`,
          });
        }
      }
    }
  }
}

function validateResourceQuantities(
  content: string,
  resources: Record<string, unknown>,
  containerLabel: string,
  errors: ValidationIssue[],
) {
  const cpuPattern = /^\d+m?$/;
  const memPattern = /^\d+([EPTGMK]i?)?$/;

  for (const section of ["requests", "limits"] as const) {
    const vals = resources[section] as Record<string, string> | undefined;
    if (!vals) continue;

    if (vals.cpu && !cpuPattern.test(vals.cpu)) {
      errors.push({
        line: findLineOf(content, vals.cpu),
        severity: "error",
        rule: "invalid-cpu",
        message: `${containerLabel}: invalid CPU value '${vals.cpu}' — use format like '250m' or '1'`,
      });
    }

    if (vals.memory && !memPattern.test(vals.memory)) {
      errors.push({
        line: findLineOf(content, vals.memory),
        severity: "error",
        rule: "invalid-memory",
        message: `${containerLabel}: invalid memory value '${vals.memory}' — use format like '256Mi' or '1Gi'`,
      });
    }
  }
}

function validateService(
  content: string,
  spec: Record<string, unknown> | undefined,
  errors: ValidationIssue[],
  _warnings: ValidationIssue[],
  _infos: ValidationIssue[],
) {
  if (!spec) return;

  const selector = spec.selector as Record<string, unknown> | undefined;
  if (!selector || Object.keys(selector).length === 0) {
    errors.push({
      line: findLineOf(content, "selector"),
      severity: "error",
      rule: "empty-service-selector",
      message: "Service selector is empty — no pods will match",
    });
  }

  const ports = spec.ports as Array<Record<string, unknown>> | undefined;
  if (!ports || ports.length === 0) {
    errors.push({
      line: findLineOf(content, "ports"),
      severity: "error",
      rule: "missing-service-ports",
      message: "Service has no ports defined",
    });
  }
}

/** Find the line number where a string first appears in content */
function findLineOf(content: string, search: string): number {
  const idx = content.indexOf(search);
  if (idx === -1) return 1;
  return content.substring(0, idx).split("\n").length;
}
