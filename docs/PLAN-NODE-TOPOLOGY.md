# Plan: Node Topology Graph (#34)

## Overview

Interactive node topology visualization — click to drill down from nodes → pods → containers with resource usage bars and grouping.

## Architecture

Separate webview panel (editor tab), not sidebar content. Needs horizontal space for the visualization.

## Visual Layout (Pure CSS, No D3)

```
[Toolbar: GroupBy | Filter | Refresh | Stats: "12 nodes, 3 NotReady, 187 pods"]
[──────────────────────────────────────────────────────────────────────────────]
[  ┌─ us-east-1a ─────────────────────────────────────────────────────────┐   ]
[  │  ┌─────────────────────────┐  ┌─────────────────────────┐           │   ]
[  │  │ 🟢 ip-10-0-1-23  Ready │  │ 🟡 ip-10-0-1-45  Ready │           │   ]
[  │  │ m5.xlarge               │  │ m5.xlarge  MemPressure  │           │   ]
[  │  │ CPU [========|--] 78%   │  │ CPU [====|------] 45%   │           │   ]
[  │  │ MEM [======|----] 62%   │  │ MEM [=========|-] 92%   │           │   ]
[  │  │ PODS 34/110             │  │ PODS 28/110             │           │   ]
[  │  └─────────────────────────┘  └─────────────────────────┘           │   ]
[  └──────────────────────────────────────────────────────────────────────┘   ]
```

Click node → expands to show pods:

```
┌──────────────────────────────────────────────┐
│ 🟢 ip-10-0-1-23  Ready  m5.xlarge           │
│ CPU [========|--] 78%   MEM [======|----] 62%│
│ ─────────────────────────────────────────────│
│ 🟢 my-app-7f8d9-abc      Running  2/2  ↺ 0  │
│ 🔴 booking-svc-55cb...   CrashLoop  1/2 ↺31 │
│ 🟢 redis-0               Running  1/1  ↺ 0  │
│ 🟡 monitoring-x          Pending  0/1  ↺ 0  │
└──────────────────────────────────────────────┘
```

## Resource Bar Colors

- 0-60%: green (#4af0c8)
- 60-80%: yellow (#f0a84a)
- 80-100%: red (#f05a5a)

## Grouping Options

- None (flat list)
- Availability Zone (topology.kubernetes.io/zone)
- Node Group (eks.amazonaws.com/nodegroup)
- Taint (first taint key)

## Filter Options

- All Nodes
- Problem Nodes Only (NotReady, MemoryPressure, DiskPressure, or has crashing pods)

## kubectl Commands

```bash
kubectl get nodes -o json
kubectl get pods -o json --all-namespaces
kubectl top nodes --no-headers        # if metrics-server available
kubectl top pods --all-namespaces --no-headers  # if metrics-server available
```

## Data Structures (src/shared/types.ts)

- TopologyNode: name, status, labels, taints, capacity, allocated, actual usage, pods[]
- TopologyPod: name, namespace, phase, containers[], cpuRequest, memRequest
- TopologyContainer: name, ready, restartCount, state, image
- TopologyData: nodes[], fetchedAt

## Resource Parsing

- parseCpu("250m") → 250, parseCpu("1") → 1000 (millicores)
- parseMemory("256Mi") → bytes, parseMemory("1Gi") → bytes

## Files to Create

- src/utils/resources.ts — parseCpu, parseMemory
- src/webview/topologyPanel.ts — extension host panel manager
- webview-ui/src/topology.tsx — entry point
- webview-ui/src/components/topology/TopologyPanel.tsx — root
- webview-ui/src/components/topology/TopologyToolbar.tsx
- webview-ui/src/components/topology/NodeCard.tsx
- webview-ui/src/components/topology/ResourceBar.tsx
- webview-ui/src/components/topology/PodCard.tsx

## Implementation Phases

1. Data layer — resource parsing, getNodeTopology(), types (1-2 days)
2. Extension host wiring — topologyPanel.ts, command registration (1 day)
3. React UI — TopologyPanel, NodeCard, ResourceBar, PodCard (2-3 days)
4. Integration — sidebar button, grouping/filtering (1 day)

## Estimate: 5-7 days
