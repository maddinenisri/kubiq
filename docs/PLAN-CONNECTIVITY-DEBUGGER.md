# Plan: Service Connectivity Debugger (#7)

## Overview

"Test Connectivity" action that diagnoses why a pod can't reach a service.
Checks DNS, endpoints, NetworkPolicy, and port connectivity in sequence.

## User Flow

1. User clicks "Test Connectivity" on a pod row (or from command palette)
2. Enters target service name (or selects from dropdown)
3. Kubiq runs diagnostic checks in sequence, showing results live
4. Shows visual path diagram: Pod → DNS → Endpoints → NetworkPolicy → Service

## Diagnostic Checks (sequential)

### Check 1: DNS Resolution

```bash
kubectl exec <pod> -n <ns> -- nslookup <service>.<target-ns>.svc.cluster.local
```

- Pass: service DNS resolves to a ClusterIP
- Fail: DNS not resolving → check CoreDNS pods

### Check 2: Service Exists

```bash
kubectl get service <service> -n <target-ns> -o json
```

- Pass: service found with type, ports, selector
- Fail: service doesn't exist

### Check 3: Endpoints Health

```bash
kubectl get endpoints <service> -n <target-ns> -o json
```

- Pass: endpoints exist and have addresses
- Fail: empty endpoints → selector doesn't match pods, or pods not ready

### Check 4: Target Pods Ready

```bash
kubectl get pods -l <selector> -n <target-ns> -o json
```

- Pass: pods exist and are Ready
- Fail: no matching pods, or pods not ready

### Check 5: NetworkPolicy Check

```bash
kubectl get networkpolicy -n <ns> -o json
kubectl get networkpolicy -n <target-ns> -o json
```

- Pass: no NetworkPolicies, or policies allow the traffic
- Warn: NetworkPolicies exist that might block traffic

### Check 6: Port Connectivity (optional)

```bash
kubectl exec <pod> -n <ns> -- timeout 3 bash -c 'echo > /dev/tcp/<clusterIP>/<port>'
```

- Pass: TCP connection succeeds
- Fail: connection refused or timeout

## Visual Output

```
┌─ Connectivity Test: booking-pod → database-svc ────────────┐
│                                                              │
│  ✅ DNS Resolution                                          │
│     database-svc.prod.svc.cluster.local → 10.96.45.12       │
│                                                              │
│  ✅ Service Exists                                          │
│     ClusterIP: 10.96.45.12  Port: 5432/TCP                 │
│                                                              │
│  ✅ Endpoints Healthy                                       │
│     2 endpoints: 10.0.14.5:5432, 10.0.22.8:5432            │
│                                                              │
│  ✅ Target Pods Ready                                       │
│     2/2 pods matching selector app=database are Ready        │
│                                                              │
│  ⚠ NetworkPolicy                                           │
│     2 NetworkPolicies found in namespace 'prod'              │
│     ingress-deny-all may block traffic from booking-pod      │
│                                                              │
│  ❌ Port Connectivity                                       │
│     Connection to 10.96.45.12:5432 timed out                │
│     → Check if target pod is listening on port 5432          │
│                                                              │
│  [Ask AI for Help]  [Run All Again]                         │
└──────────────────────────────────────────────────────────────┘
```

## Implementation

- Opens as editor panel (like topology)
- Command: "Kubiq: Test Connectivity"
- Also accessible from pod row action button
- Results stream in as each check completes

## Estimate: 3-4 days
