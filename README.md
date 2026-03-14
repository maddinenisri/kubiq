# Kubiq — VS Code Extension

Kubernetes intelligence for AWS EKS. Right-click any pod, get instant crash analysis with AI-powered diagnostics via Claude Code CLI.

Currently runs as a companion to `ms-kubernetes-tools`. Standalone mode (own cluster tree) is planned for Phase 2.

## Features

- **Pod Diagnosis Panel** — opens an editor tab per pod with:
  - Container status, restart counts, last state
  - Pod conditions grid
  - Logs per container (current + previous run)
  - Kubernetes events
  - Full `kubectl describe` output
  - **Interactive AI chat** — Claude analyzes crash patterns, logs, and events in real time

- **Crash Pattern Detection** — instant local scan for OOMKilled, CrashLoopBackOff, ImagePullBackOff, probe failures, scheduling errors, volume mount issues

- **Multi-account EKS** — auto-detects AWS profile and region from kubeconfig `exec` block, with per-context manual overrides

- **Session Persistence** — Claude conversations survive panel close/reopen and VS Code restarts

## Prerequisites

```bash
# AWS CLI v2
aws --version

# kubectl
kubectl version --client

# Claude Code CLI (required for AI diagnosis)
npm install -g @anthropic-ai/claude-code
claude  # authenticate once

# At least one EKS cluster in kubeconfig
aws eks update-kubeconfig \
  --name my-cluster \
  --region us-east-1 \
  --profile my-aws-profile
```

## Installation

### From VSIX (local build)

```bash
code --install-extension kubiq-0.1.0.vsix
```

### From source

```bash
git clone https://github.com/maddinenisri/kubiq.git
cd kubiq
npm install
npm run package
code --install-extension kubiq-0.1.0.vsix
```

Also requires the [Kubernetes extension](https://marketplace.visualstudio.com/items?itemName=ms-kubernetes-tools.vscode-kubernetes-tools) — it will prompt you to install it automatically.

## Usage

### From the Kubernetes tree view

1. Expand your EKS cluster in the Kubernetes sidebar
2. Navigate to a pod
3. Right-click → **Kubiq: Diagnose Pod**

### From the Command Palette

`Cmd+Shift+P` → **Kubiq: Diagnose Pod** → enter pod name, namespace, and select cluster context.

## Settings

| Setting | Description | Default |
|---|---|---|
| `kubiq.clusterProfiles` | Manual AWS profile/region overrides per kubeconfig context | `{}` |
| `kubiq.logTailLines` | Number of log lines to fetch per container | `500` |

### AWS Profile Override (settings.json)

```json
{
  "kubiq.clusterProfiles": {
    "prod-cluster-context-name": {
      "profile": "prod-admin",
      "region": "us-east-1"
    },
    "staging-cluster": {
      "profile": "staging",
      "region": "eu-west-1"
    }
  }
}
```

Auto-detection reads `--profile` and `--region` flags from the `exec` block in `~/.kube/config`. Manual overrides win per-field.

## Building from Source

### Quick build

```bash
npm install
npm run compile          # esbuild bundle → out/extension.js
```

### Package VSIX

```bash
npm run package          # compile + package into .vsix
```

Or use the shell script:

```bash
chmod +x build-vsix.sh
./build-vsix.sh
```

### Development (watch mode)

```bash
npm run watch            # recompiles on file changes
# Press F5 in VS Code → launches Extension Development Host
```

### Build output

```
out/
└── extension.js         # single bundled file (esbuild, ~143 KB)
```

The build uses esbuild to bundle all TypeScript into a single `out/extension.js`. The `vscode` module is externalized (provided by VS Code at runtime). Source maps are generated for debugging.

### Install locally

```bash
code --install-extension kubiq-0.1.0.vsix

# Or in VS Code: Extensions → ··· → Install from VSIX…
```

### Uninstall

```bash
code --uninstall-extension kubiq.kubiq
```

## Architecture

```
src/
├── extension.ts              # activation, command registration, orchestration
├── clusters/
│   └── contextManager.ts     # kubeconfig parsing, AWS profile resolution
├── pods/
│   ├── podDiagnostics.ts     # kubectl wrapper — logs, events, describe, pod JSON
│   └── crashAnalyzer.ts      # local pattern matching + Claude prompt builder
├── claude/
│   ├── claudeSession.ts      # persistent Claude CLI subprocess (NDJSON streaming)
│   └── sessionStore.ts       # session + message persistence via VS Code globalState
└── webview/
    └── podPanel.ts           # editor tab WebviewPanel with full HTML/CSS/JS UI
```

### Key design decisions

**kubectl over @kubernetes/client-node** — EKS uses IAM token-based auth refreshed via `aws eks get-token`. Shelling to `kubectl` handles this transparently via the kubeconfig `exec` block, no token refresh logic needed.

**Claude CLI over API** — Uses `claude --print --output-format stream-json` as a persistent subprocess. Supports session resume, streaming token deltas, and inherits the user's existing Claude authentication. No API key configuration required.

**Panel-per-pod** — Each pod opens a deduplicated editor tab. Reopening the same pod brings the existing panel to focus, mirroring how VS Code handles file editors.

**AI diagnosis flow:**
1. Local pattern scan (instant) — catches OOMKilled, CrashLoopBackOff, ImagePullBackOff, probe failures, etc.
2. Claude session — sends full pod snapshot (logs, events, container state), streams analysis in real time
3. Interactive follow-up — ask Claude to dig deeper into specific containers, suggest fixes, or explain error patterns

## Privacy

Pod logs and Kubernetes events are sent to the Claude CLI for AI diagnosis. The Claude CLI handles data transmission per Anthropic's [privacy policy](https://www.anthropic.com/privacy). Logs are not written to disk by the extension; they exist only in memory during the session.

To limit exposure:
- Set `kubiq.logTailLines` to a smaller value
- Use the Command Palette flow to diagnose specific pods selectively

## Phase 2 Roadmap

- [ ] Own cluster tree provider (remove `ms-kubernetes-tools` dependency)
- [ ] RBAC viewer — ClusterRoles, RoleBindings, IAM-to-K8s mapping
- [ ] Node operations panel — drain, cordon, taint, describe
- [ ] Resource quota dashboard per namespace
- [ ] Streaming log tail
- [ ] Multi-cluster context switcher in status bar
- [ ] EKS-specific: node group details, add-on versions, CloudWatch log links

## License

MIT
