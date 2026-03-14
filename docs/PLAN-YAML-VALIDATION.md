# Plan: YAML Validation & Misconfiguration Detection (#4)

## Overview

Real-time YAML validation in the editor and in Kubiq's YAML tab. Catches misconfigurations before they reach the cluster.

## Architecture

```
User edits YAML in Kubiq panel
        ↓
┌─────────────────────┐
│ YAML AST Parser     │  Parse YAML string → AST nodes
│ (yaml library)      │  Detect syntax errors, duplicate keys
└─────────┬───────────┘
          ↓
┌─────────────────────┐
│ K8s Schema Validator │  Validate against K8s API schema
│                      │  Check apiVersion, kind, required fields
│                      │  Validate resource quantities, ports, labels
└─────────┬───────────┘
          ↓
┌─────────────────────┐
│ Best Practice Rules  │  Security: runAsNonRoot, readOnlyRootFilesystem
│                      │  Resources: missing limits/requests
│                      │  Probes: missing liveness/readiness
│                      │  Images: using :latest tag
└─────────┬───────────┘
          ↓
┌─────────────────────┐
│ Inline Annotations   │  Show errors/warnings in YAML tab
│                      │  Red: invalid YAML, missing required fields
│                      │  Yellow: best practice violations
│                      │  Green: valid
└─────────────────────┘
```

## Validation Rules

### Level 1: Syntax (AST Parse Errors)

- Invalid YAML syntax
- Duplicate keys
- Indentation errors
- Unclosed quotes/brackets

### Level 2: Schema (K8s API)

- Missing required fields: apiVersion, kind, metadata.name
- Invalid apiVersion values
- Container spec: missing image field
- Resource quantities: valid format (100m, 256Mi, 1Gi)
- Port numbers: 1-65535 range
- Label keys: valid format (alphanumeric, max 63 chars)
- Annotation values: max 256KB

### Level 3: Best Practices

| Rule              | Severity | Description                       |
| ----------------- | -------- | --------------------------------- |
| missing-resources | warning  | No resource requests/limits       |
| missing-probes    | warning  | No liveness or readiness probes   |
| latest-tag        | warning  | Image uses :latest tag            |
| run-as-root       | warning  | No `runAsNonRoot: true`           |
| no-read-only-fs   | info     | No `readOnlyRootFilesystem: true` |
| privileged        | error    | `privileged: true` is set         |
| host-network      | warning  | `hostNetwork: true`               |
| missing-namespace | info     | No namespace specified            |
| empty-selector    | error    | Deployment selector is empty      |

## Implementation Steps

1. **YAML Parser**: Use `yaml` npm package (already a dependency) with `parseDocument()` for AST access
2. **Schema Definitions**: Minimal schema for Pod, Deployment, Service, ConfigMap, Secret (not full OpenAPI — too large)
3. **Rule Engine**: Array of validation rules, each returns `{ line, severity, message }`
4. **YAML Tab Integration**: Show validation results as colored indicators next to the YAML content
5. **Apply Gate**: Block "Apply" button if there are error-level issues, show warning count

## Dependencies

- `yaml` (already installed) — provides AST parsing via `parseDocument()`
- No new dependencies needed

## Estimate: 3-4 days
