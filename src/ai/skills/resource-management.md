# Resource Management

## QoS Classes

- **Guaranteed**: requests == limits for ALL containers. Highest priority, last to be evicted.
- **Burstable**: at least one container has requests < limits. Medium priority.
- **BestEffort**: no requests or limits set. First to be evicted under pressure.
- Recommendation: always set requests AND limits. Use Guaranteed for critical workloads.

## CPU Throttling

- CPU limits use CFS (Completely Fair Scheduler) quotas
- Throttled containers appear healthy but respond slowly
- Symptom: high latency, timeouts, but pod shows "Running"
- Check: `kubectl top pod` — if CPU usage near limit, pod is being throttled
- Fix: increase CPU limit OR remove CPU limit (keep request for scheduling)
- Some teams remove CPU limits entirely — pods can burst but are scheduled by request

## Memory Management

- Memory limits are HARD — exceeding them triggers OOMKill immediately
- Memory requests affect scheduling — pod placed on node with enough allocatable memory
- Overcommit: sum of requests can exceed node capacity; sum of limits should not
- Monitor: `kubectl top pods` vs `resources.limits.memory`
- Rule of thumb: set request = p95 usage, limit = 1.5x request

## Resource Quotas

- Namespace-level limits on total CPU/memory/pod count
- If pod creation fails with "exceeded quota", check: `kubectl describe resourcequota -n <ns>`
- LimitRange: sets default requests/limits for pods that don't specify them

## Eviction

- kubelet evicts pods when node runs low on memory/disk
- Order: BestEffort first, then Burstable (by how much they exceed request), Guaranteed last
- Check node conditions: `kubectl describe node <name>` → Conditions section
- MemoryPressure, DiskPressure, PIDPressure are warning signs
