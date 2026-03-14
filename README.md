<p align="center">
  <img src="media/kubiq-icon.png" width="120" alt="Kubiq logo"/>
</p>
<h1 align="center">Kubiq</h1>
<p align="center">
  Standalone Kubernetes intelligence dashboard for VS Code.<br/>
  Pod diagnostics, crash analysis, and multi-cluster management with AI.<br/>
  Works with any Kubernetes cluster — EKS, GKE, AKS, on-prem, kind, minikube.
</p>

## Features

### Sidebar Dashboard

Browse all Kubernetes resources from the VS Code activity bar.

- **Filter bar** — Profile, Cluster, Namespace dropdowns (auto-grouped by AWS profile + region)
- **Resource tabs** — Pods, Deployments, Services, ConfigMaps, Nodes, Events with count badges
- **Sortable tables** — click any column header to sort
- **Row actions** — AI diagnose, view logs, edit YAML, restart pod, port-forward
- **Status bar** — live connection indicator + metrics-server badge
- **CPU/Memory columns** — shown automatically when metrics-server is available
- **Auto-selects current context** — pre-selects your active kubectl context on load

### AI-Powered Pod Diagnosis

Click any pod to open a diagnosis panel with:

- **Interactive AI chat** — Claude analyzes crash patterns, logs, and events in real time
- **Streaming responses** — see the AI thinking as it types
- **Session persistence** — conversations survive panel close/reopen and VS Code restarts
- **11 built-in knowledge base skills** — crash patterns, networking, Istio, storage, security, node operations, deployments, port-forwarding, manifest editing, resource management, cloud providers
- **Custom instructions** — add your own team-specific knowledge via `.kubiq/rules/*.md`

### Crash Pattern Detection

Instant local scan (no AI needed) for:
OOMKilled, CrashLoopBackOff, ImagePullBackOff, liveness/readiness probe failures, scheduling errors, volume mount failures, insufficient resources

### Pod Panel Tabs

| Tab        | Content                                     |
| ---------- | ------------------------------------------- |
| Chat       | AI diagnosis + interactive follow-up        |
| Containers | Status table + pod conditions grid          |
| Logs       | Per-container logs with previous run toggle |
| Events     | Kubernetes events for the pod               |
| Describe   | Full `kubectl describe` output              |
| YAML       | Full pod manifest with copy button          |

### Resource Management

- **Edit YAML** — click ✎ on any resource to edit in a themed panel with Apply/Cancel
- **Restart pods** — delete + let deployment recreate (with confirmation)
- **Port-forward** — opens VS Code terminal, supports multi-port (comma-separated)
- **Resource detail panels** — themed Describe + YAML views for deployments, services, configmaps, nodes

### LLM Guardrails

| Feature                | Setting                                    | Default                                                 |
| ---------------------- | ------------------------------------------ | ------------------------------------------------------- |
| AI on/off toggle       | `kubiq.ai.enabled`                         | `true`                                                  |
| Prompt presets         | `kubiq.ai.promptPreset`                    | `default` (also: sre-oncall, developer, security-audit) |
| Custom instructions    | `kubiq.ai.customInstructions`              | `""`                                                    |
| Secret sanitization    | `kubiq.guardrails.sanitizeSecrets`         | `true`                                                  |
| Env var redaction      | `kubiq.guardrails.sanitizeEnvVars`         | `true`                                                  |
| Custom redact patterns | `kubiq.guardrails.redactPatterns`          | `[]`                                                    |
| Command safety flags   | `kubiq.guardrails.flagDestructiveCommands` | `true`                                                  |

## Prerequisites

```bash
# kubectl (any cluster)
kubectl version --client

# Claude Code CLI (required for AI diagnosis)
npm install -g @anthropic-ai/claude-code
claude  # authenticate once

# At least one cluster in kubeconfig
kubectl config get-contexts
```

### EKS-specific (optional)

```bash
aws eks update-kubeconfig --name my-cluster --region us-east-1 --profile my-profile
```

## Installation

### From VSIX

```bash
code --install-extension kubiq-0.4.0.vsix
```

### From source

```bash
git clone https://github.com/maddinenisri/kubiq.git
cd kubiq
npm install
cd webview-ui && npm install && cd ..
npm run package
code --install-extension kubiq-0.4.0.vsix
```

## Settings

| Setting                                    | Description                                                     | Default   |
| ------------------------------------------ | --------------------------------------------------------------- | --------- |
| `kubiq.clusterProfiles`                    | Manual profile/region overrides per kubeconfig context          | `{}`      |
| `kubiq.logTailLines`                       | Log lines to fetch per container                                | `500`     |
| `kubiq.ai.enabled`                         | Enable AI diagnostics                                           | `true`    |
| `kubiq.ai.promptPreset`                    | AI personality (default, sre-oncall, developer, security-audit) | `default` |
| `kubiq.ai.customInstructions`              | Additional instructions for AI                                  | `""`      |
| `kubiq.guardrails.sanitizeSecrets`         | Strip secrets before sending to AI                              | `true`    |
| `kubiq.guardrails.sanitizeEnvVars`         | Redact env var values                                           | `true`    |
| `kubiq.guardrails.flagDestructiveCommands` | Flag destructive kubectl suggestions                            | `true`    |

## Privacy

Pod logs and Kubernetes events are sent to the Claude CLI for AI diagnosis. The Claude CLI handles data transmission per Anthropic's [privacy policy](https://www.anthropic.com/privacy). Logs are not written to disk; they exist only in memory.

**Built-in guardrails:**

- Secret sanitization strips AWS keys, JWT tokens, passwords, connection strings, GitHub/GitLab tokens before sending to AI
- Destructive kubectl commands in AI responses are flagged with warning badges
- AI can be fully disabled via `kubiq.ai.enabled: false`

## License

MIT
