# AI Guardrails

Kubiq includes pre-hook and post-hook guardrails to ensure safe, controlled AI interactions.

## Pre-Hooks (Before LLM Call)

### Secret Sanitization

Enabled by default (`kubiq.guardrails.sanitizeSecrets: true`).

Detects and redacts:

- AWS access keys (`AKIA...`)
- AWS secret keys
- Generic passwords/tokens in env vars
- Bearer tokens
- JWT tokens (`eyJ...`)
- Private keys (PEM format)
- Base64-encoded secrets
- Connection strings with passwords (postgres://, mongodb://, etc.)
- GitHub tokens (`ghp_...`)
- GitLab tokens (`glpat-...`)

### Environment Variable Redaction

Enabled by default (`kubiq.guardrails.sanitizeEnvVars: true`).

Redacts values of environment variables that contain keywords like `SECRET`, `PASSWORD`, `TOKEN`, `KEY`, `CREDENTIAL`, `AUTH` in kubectl describe output.

### Custom Redaction Patterns

Configure additional regex patterns via `kubiq.guardrails.redactPatterns`:

```json
{
  "kubiq.guardrails.redactPatterns": ["corp\\.internal\\.com", "\\b\\d{3}-\\d{2}-\\d{4}\\b"]
}
```

## Post-Hooks (After LLM Response)

### Destructive Command Flagging

Enabled by default (`kubiq.guardrails.flagDestructiveCommands: true`).

**Danger (blocked):**

- `kubectl delete`
- `kubectl drain`
- `kubectl cordon`
- `kubectl taint`
- `kubectl replace --force`
- `kubectl scale --replicas=0`
- `kubectl patch`
- `kubectl edit`
- `kubectl rollout undo`

**Warning (review):**

- `kubectl apply`
- `kubectl exec`
- Any unrecognized kubectl command

**Safe (no flag):**

- `kubectl get`, `kubectl describe`, `kubectl logs`, `kubectl top`
- `kubectl explain`, `kubectl auth can-i`, `kubectl config`

### Deprecated Flag Detection

Warns when AI suggests deprecated kubectl flags:

- `--show-all` (removed in K8s 1.21)
- `--export` (removed in K8s 1.18)

## Prompt Configuration

### Presets (`kubiq.ai.promptPreset`)

| Preset           | Focus                                   |
| ---------------- | --------------------------------------- |
| `default`        | General Kubernetes SRE                  |
| `sre-oncall`     | Incident response, immediate mitigation |
| `developer`      | App-level debugging, stack traces       |
| `security-audit` | RBAC, CVEs, security misconfigurations  |

### Custom Instructions (`kubiq.ai.customInstructions`)

Appended to the system prompt:

```
Focus on Java Spring Boot errors. Always suggest Helm chart fixes.
```

### Workspace Knowledge Base (`.kubiq/rules/*.md`)

Drop markdown files in your project's `.kubiq/rules/` directory:

```
.kubiq/rules/
├── spring-boot.md     # "Our apps use actuator at /health"
├── istio.md           # "Always check envoy sidecar logs"
└── team-runbook.md    # "If payment-service crashes, check Redis first"
```

These are loaded once per session and injected into the AI system prompt. Workspace rules override built-in skills with the same filename.

## Disabling AI

Set `kubiq.ai.enabled: false` to disable all AI features. Crash pattern detection still works locally. Pod panel shows all tabs except chat.
