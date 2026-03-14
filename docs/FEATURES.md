# Features

## Implemented

### Sidebar Dashboard

- Profile / Cluster / Namespace filter dropdowns
- Auto-grouped by AWS profile + region
- Auto-selects current kubectl context on load
- 6 resource tabs: Pods, Deployments, Services, ConfigMaps, Nodes, Events
- Count badges on each tab
- Sortable tables (click column headers)
- Row hover actions: AI Diagnose, Logs, Edit YAML, Restart, Port-Forward
- Connection status indicator + metrics-server badge
- CPU/Memory columns when metrics-server is available

### AI-Powered Pod Diagnosis

- One-click pod diagnosis from sidebar
- Claude CLI subprocess with NDJSON streaming
- Real-time streaming text in chat panel
- Session persistence across panel close/reopen
- New Chat button to start fresh
- 11 built-in knowledge base skills
- Custom team-specific skills via `.kubiq/rules/*.md`
- 4 prompt presets: default, sre-oncall, developer, security-audit
- Custom instructions via settings

### Crash Pattern Detection (Local, No AI)

- OOMKilled (exit code 137)
- CrashLoopBackOff
- ImagePullBackOff / ErrImagePull
- Container Runtime Error
- Liveness / Readiness Probe Failure
- Restart Back-off
- Insufficient Resources (CPU/Memory)
- Failed Scheduling
- Volume Mount Failure

### Pod Panel Tabs

- **Chat** — AI diagnosis with markdown rendering (bold, code, lists, headers)
- **Containers** — status table with state, restarts, image + pod conditions grid
- **Logs** — per-container tabs with previous run toggle
- **Events** — formatted kubectl events
- **Describe** — full kubectl describe with copy button
- **YAML** — full pod manifest with copy button

### Resource Management

- Edit YAML for pods, deployments, services, configmaps (themed panel, not raw editor)
- Apply YAML changes with confirmation dialog
- Restart pod (delete + let deployment recreate)
- Port-forward with multi-port support (comma-separated)
- Scale deployment (with confirmation)
- Resource detail panels (Describe + YAML tabs) for all resource types

### LLM Guardrails

- **Pre-hooks**: Secret sanitization (AWS keys, JWT, passwords, connection strings, GitHub/GitLab tokens), env var redaction, custom regex patterns
- **Post-hooks**: Destructive command flagging (delete, drain, scale-to-zero), deprecated kubectl flag detection
- **Controls**: AI on/off toggle, prompt presets, custom instructions

### Built-in Knowledge Base (11 Skills)

| Skill               | Topics                                               |
| ------------------- | ---------------------------------------------------- |
| crash-patterns      | OOMKilled, CrashLoop, ImagePull, probes              |
| resource-management | QoS classes, CPU throttling, memory, eviction        |
| networking          | DNS, service connectivity, NetworkPolicy, ingress    |
| storage             | PVC, volume mounts, CSI drivers                      |
| security            | RBAC, secrets, container security context            |
| deployments         | Rollouts, rollback, scaling, init containers         |
| cloud-providers     | EKS, GKE, AKS, kind/minikube specifics               |
| istio-service-mesh  | Sidecar injection, envoy logs, mTLS, traffic routing |
| port-forwarding     | Multi-port, database access, remote debugging        |
| node-operations     | Cordon, drain, taints, labels, node troubleshooting  |
| manifest-editing    | Env vars, secrets, configmaps, probes, sidecars      |

---

## Planned (Open Issues)

### P0 — Critical

- #2 Resource right-sizing advisor (OOM/throttling prevention)
- #3 Intelligent multi-container log viewer with AI analysis
- #4 YAML validation and misconfiguration detection
- #5 Natural language to kubectl command builder

### P1 — High Priority

- #6 RBAC permission visualizer and debugger
- #7 Service connectivity debugger (DNS + networking)
- #8 Configuration drift detector (live cluster vs Git)
- #9 Kubernetes upgrade compatibility checker
- #10 Event timeline and incident correlator
- #11 Namespace-scoped resource dashboard with quota visualization
- #23 Multi-provider LLM support (Claude, OpenAI, Ollama)
- #24 Custom model selection per provider
- #33 Session lifecycle management (auto-cleanup orphaned sessions)
- #34 Node topology graph with drill-down
- #35 Themed resource detail panels (overview, actions, AI per resource)
- #37 Right-click context menu on sidebar rows
- #46 Mermaid diagram rendering in AI chat

### P2 — Nice to Have

- #12 Container image security scanner integration
- #13 PersistentVolume/PVC troubleshooter
- #14 Multi-cluster context manager with safety guardrails
- #15 Health probe configuration assistant
- #16 HPA/VPA scaling advisor
- #17 Secret and ConfigMap inspector with validation
- #18 Deployment rollout monitor and rollback assistant
- #19 NetworkPolicy visualizer
- #20 Cost estimation for resource changes
- #27 Content size limits for LLM calls
- #28 Audit logging for LLM interactions
- #30 Response audit logging
- #31 Air-gapped / local LLM support (Ollama)
- #32 Custom API base URL for enterprise proxies
