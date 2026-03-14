# Plan: RBAC Permission Visualizer (#6)

## Overview

Visual RBAC permission chain in Kubiq sidebar + detail panel with "Can this SA do X?" simulator.

## Architecture

### Sidebar: RBAC Tab

New tab alongside Pods/Deploys/etc. with 3 sub-tabs:

- **Service Accounts** — list with warning badges
- **Roles** — combined Role + ClusterRole list
- **Bindings** — combined RoleBinding + ClusterRoleBinding list

### Detail Panel (on SA click)

Opens editor tab showing:

```
[Subject Card] ──→ [Binding Card] ──→ [Role Card] ──→ [Resources Grid]
  SA/default        RoleBinding/rb1     Role/my-role    pods: get,list,watch
                                                        deployments: get,list
```

### Permission Matrix

Grid: resources (rows) x verbs (columns). Green check / red X per cell.

### Can-I Simulator

Dropdown (verb + resource) → "Check" button → ALLOWED/DENIED result inline.

## kubectl Commands

```bash
kubectl get serviceaccounts,roles,clusterroles,rolebindings,clusterrolebindings -o json
kubectl auth can-i --list --as=system:serviceaccount:<ns>:<sa>
kubectl auth can-i <verb> <resource> --as=system:serviceaccount:<ns>:<sa>
```

## Warning Detection (src/rbac/rbacAnalyzer.ts)

- cluster-admin role binding
- Wildcard verbs/resources/API groups (`["*"]`)
- Secrets access (get/list/watch)
- Pod exec access (create on pods/exec)
- Escalation paths (create on rolebindings)
- Node proxy access

## Files to Create/Modify

### Backend

- `src/shared/types.ts` — ServiceAccountRow, RoleRow, BindingRow, RbacPermissionChain
- `src/shared/messages.ts` — fetchRbac, rbacData, openRbacDetail, canICheck messages
- `src/services/KubectlService.ts` — getServiceAccounts, getRoles, getBindings, authCanI
- `src/rbac/rbacAnalyzer.ts` — warning detection (+ tests)
- `src/sidebar/sidebarProvider.ts` — fetchRbac handler
- `src/webview/rbacPanel.ts` — detail panel manager

### Frontend

- `webview-ui/src/rbac.tsx` — entry point
- `webview-ui/src/components/sidebar/tables/RbacView.tsx` — 3 sub-tabs in sidebar
- `webview-ui/src/components/rbac/RbacDetailPanel.tsx` — main layout
- `webview-ui/src/components/rbac/PermissionChain.tsx` — visual chain (CSS flexbox)
- `webview-ui/src/components/rbac/PermissionMatrix.tsx` — resources x verbs grid
- `webview-ui/src/components/rbac/CanISimulator.tsx` — interactive form

## Implementation Phases

1. Data layer — types, messages, kubectl methods, warning analyzer (2 days)
2. Sidebar tab — RBAC tab with 3 sub-tables (1 day)
3. Detail panel — permission chain, matrix, can-i simulator (2-3 days)
4. Polish — edge cases, tests (1 day)

## Estimate: 5-7 days
