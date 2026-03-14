# Kubiq

Standalone Kubernetes intelligence dashboard for AWS EKS. No dependencies on other extensions — Kubiq runs on its own.

## What's New in v0.2.0

- **Fully standalone** — no `extensionDependencies`, no ms-kubernetes-tools needed
- **Sidebar dashboard** — Kubiq hexagon icon in the VS Code activity bar with:
  - **Filter bar** — Profile, Cluster, Namespace dropdowns (auto-grouped by AWS profile + region)
  - **Status bar** — live connection indicator + metrics-server badge
  - **Resource tabs** — Pods / Deploys / Services / ConfigMaps / Nodes / Events with count badges
  - **Sortable tables** — click any column header to sort
  - **Hover actions** — AI diagnose + Logs buttons on pod rows
- **Auto-selects current context** — pre-selects the active kubectl context on load
- **CPU/Memory columns** — shown automatically if metrics-server is available

## Features

- **Sidebar Dashboard** — browse all Kubernetes resources from the activity bar. Filter by AWS profile, cluster, and namespace in seconds.

- **Pod Diagnosis Panel** — click any pod to open an editor tab with:
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

### From VSIX

```bash
code --install-extension kubiq-0.2.0.vsix
```

### From source

```bash
git clone https://github.com/maddinenisri/kubiq.git
cd kubiq
npm install
npm run package
code --install-extension kubiq-0.2.0.vsix
```

## Usage

### Sidebar Dashboard

1. Click the Kubiq icon (hexagon with K) in the activity bar
2. Select your AWS profile and cluster from the dropdowns
3. Choose a namespace (or "all namespaces")
4. Browse Pods, Deployments, Services, ConfigMaps, Nodes, Events
5. Click any pod row or hover and click "AI" to open the diagnosis panel

### Command Palette

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

```bash
npm install
npm run compile          # esbuild bundle → out/extension.js
npm run package          # compile + package into .vsix
```

### Development

```bash
npm run watch            # recompiles on file changes
# Press F5 in VS Code → launches Extension Development Host
```

### Install / Uninstall

```bash
code --install-extension kubiq-0.2.0.vsix
code --uninstall-extension kubiq.kubiq
```

## Architecture

```
src/
├── extension.ts              # activation, sidebar + command registration
├── sidebar/
│   ├── sidebarProvider.ts    # WebviewViewProvider — owns dashboard state
│   └── sidebarHtml.ts        # full dashboard HTML/CSS/JS
├── kubectl/
│   └── runner.ts             # all kubectl calls (pods, deploys, nodes, etc.)
├── clusters/
│   └── contextManager.ts     # kubeconfig parsing, AWS profile resolution
├── pods/
│   └── crashAnalyzer.ts      # local crash pattern matching + Claude prompt builder
├── claude/
│   ├── claudeSession.ts      # persistent Claude CLI subprocess (NDJSON streaming)
│   └── sessionStore.ts       # session + message persistence via VS Code globalState
└── webview/
    └── podPanel.ts           # per-pod diagnosis editor tab with full UI
```

### Design Decisions

**Standalone** — Kubiq has zero extension dependencies. It reads `~/.kube/config` directly and shells out to `kubectl` for all cluster operations.

**kubectl over client libraries** — EKS uses IAM token-based auth refreshed via `aws eks get-token`. Shelling to `kubectl` handles this transparently via the kubeconfig `exec` block.

**Claude CLI over API** — Uses `claude --print --output-format stream-json` as a persistent subprocess. Supports session resume, streaming token deltas, and inherits your existing Claude authentication.

**Sidebar-first** — Instead of a tree view, Kubiq uses a filter-bar workflow: select profile, cluster, namespace, then browse resources in sortable tables. Faster than navigating a deep tree.

**Panel-per-pod** — Each pod opens a deduplicated editor tab. Reopening the same pod brings the existing panel to focus.

## Privacy

Pod logs and Kubernetes events are sent to the Claude CLI for AI diagnosis. The Claude CLI handles data transmission per Anthropic's [privacy policy](https://www.anthropic.com/privacy). Logs are not written to disk by the extension; they exist only in memory during the session.

To limit exposure:
- Set `kubiq.logTailLines` to a smaller value
- Use the Command Palette flow to diagnose specific pods selectively

## Roadmap

- [ ] RBAC viewer — ClusterRoles, RoleBindings, IAM-to-K8s mapping
- [ ] Node operations — drain, cordon, taint from the sidebar
- [ ] Resource quota dashboard per namespace
- [ ] Streaming log tail
- [ ] Multi-cluster context switcher in status bar
- [ ] EKS-specific: node group details, add-on versions, CloudWatch log links

## License

MIT
