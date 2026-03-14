# Node Operations & Management

## Node Status

- Ready: node is healthy and accepting pods
- NotReady: kubelet not responding — check node health, SSH in if possible
- SchedulingDisabled: node is cordoned — no new pods scheduled
- Check: `kubectl get nodes` and `kubectl describe node <name>`
- Conditions: MemoryPressure, DiskPressure, PIDPressure, NetworkUnavailable

## Cordon / Uncordon

- Cordon: mark node as unschedulable (existing pods keep running)
  - `kubectl cordon <node>` — no new pods will be scheduled
  - Use before maintenance or when investigating node issues
- Uncordon: mark node as schedulable again
  - `kubectl uncordon <node>`
- Cordon does NOT evict existing pods — only prevents new scheduling

## Drain

- Drain: cordon + evict all pods from the node
  - `kubectl drain <node> --ignore-daemonsets --delete-emptydir-data`
  - Respects PodDisruptionBudgets (PDBs) — drain may hang if PDB blocks
  - `--force`: evict pods not managed by a controller (standalone pods are deleted permanently)
  - `--grace-period=30`: time to wait for graceful shutdown
- Common issues:
  - Drain stuck: PDB prevents eviction — check `kubectl get pdb -A`
  - DaemonSet pods: use `--ignore-daemonsets` (they'll be recreated)
  - Local storage: use `--delete-emptydir-data` (emptyDir data will be lost)
  - Standalone pods: `--force` required but pod is permanently deleted (no controller to recreate)

## Taints & Tolerations

- Taint: repels pods from a node unless they tolerate it
  - Add: `kubectl taint nodes <node> key=value:NoSchedule`
  - Remove: `kubectl taint nodes <node> key=value:NoSchedule-` (trailing minus)
  - Effects: NoSchedule, PreferNoSchedule, NoExecute
- NoSchedule: new pods won't schedule unless they tolerate
- NoExecute: existing pods without toleration are evicted
- Common taints:
  - `node.kubernetes.io/not-ready` — auto-added when node goes NotReady
  - `node.kubernetes.io/unreachable` — node is unreachable
  - `node.kubernetes.io/memory-pressure` — node under memory pressure
  - GPU nodes: `nvidia.com/gpu=true:NoSchedule` — only GPU workloads

## Labels & Selectors

- Labels: key-value pairs for organizing and selecting nodes
  - Add: `kubectl label node <node> environment=production`
  - Remove: `kubectl label node <node> environment-`
  - Show: `kubectl get nodes --show-labels`
- nodeSelector: simplest way to schedule pods on specific nodes
  ```yaml
  spec:
    nodeSelector:
      environment: production
  ```
- Node affinity: more expressive (required/preferred, operators: In, NotIn, Exists)

## Node Resource Usage

- Check capacity vs allocatable vs actual usage:
  - `kubectl describe node <name>` → Capacity, Allocatable, Allocated resources
  - `kubectl top node` — actual CPU/memory usage (requires metrics-server)
- Capacity: total node resources
- Allocatable: capacity minus system reserved (kubelet, OS)
- Allocated: sum of all pod requests on the node
- Over-allocation: allocated > allocatable is allowed (overcommit) but risky

## Node Troubleshooting

- Node NotReady: check kubelet logs on the node (`journalctl -u kubelet`)
- Disk pressure: check `df -h` on node, clean up images: `crictl rmi --prune`
- Network issues: check CNI plugin pods (calico, cilium, aws-vpc-cni)
- Clock skew: certificates fail if node clock drifts — check `timedatectl`
- Kernel issues: check `dmesg` for OOM kills, filesystem errors

## EKS Node Groups

- Managed node groups: AWS manages ASG, updates, draining
- Self-managed: you manage the ASG and node lifecycle
- Fargate: serverless — no nodes to manage, each pod gets its own VM
- Karpenter: auto-provisions right-sized nodes, consolidates underutilized
  - Check: `kubectl get nodeclaim` and `kubectl get nodepool`

## GKE Node Pools

- Standard: you manage node configuration
- Autopilot: Google manages everything, pay per pod resource request
- Node auto-provisioning: GKE creates node pools to match pod requirements
- Spot/preemptible VMs: cheaper but can be reclaimed — use for fault-tolerant workloads

## AKS Node Pools

- System pool: runs system pods (CoreDNS, metrics-server) — at least one required
- User pool: runs application workloads
- Virtual nodes: backed by Azure Container Instances (serverless burst)
- Spot VMs: same concept as GKE preemptible
