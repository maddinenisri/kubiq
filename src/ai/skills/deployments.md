# Deployment & Rollout Troubleshooting

## Stuck Rollout

- Deployment shows old and new ReplicaSets but never completes
- Check: `kubectl rollout status deployment/<name>`
- Common causes: new pods crashing (check pod events/logs), insufficient resources, image pull failure
- Deadline exceeded: `spec.progressDeadlineSeconds` (default 600s) passed
- Fix: `kubectl rollout undo deployment/<name>` to rollback

## Rollback

- View history: `kubectl rollout history deployment/<name>`
- Undo to previous: `kubectl rollout undo deployment/<name>`
- Undo to specific: `kubectl rollout undo deployment/<name> --to-revision=N`
- revisionHistoryLimit (default 10): how many old ReplicaSets to keep

## Scaling Issues

- HPA not scaling: check metrics-server is running, check HPA target metric
- HPA flapping: minReplicas too close to maxReplicas, or target utilization threshold too sensitive
- Scale-to-zero: not supported by HPA natively (use KEDA for event-driven scaling)
- VPA + HPA conflict: don't use both on CPU — use VPA for memory, HPA for CPU

## Rolling Update Strategy

- maxUnavailable: how many pods can be down during update (default 25%)
- maxSurge: how many extra pods can be created (default 25%)
- For zero-downtime: set maxUnavailable=0, maxSurge=1 (but slower)
- Readiness gates: use for external health checks before receiving traffic

## Init Containers

- Run before app containers, in order, one at a time
- Use for: database migrations, config file generation, waiting for dependencies
- If init container fails, pod stays in Init:CrashLoopBackOff
- Check: `kubectl logs <pod> -c <init-container-name>`
- Common mistake: init container waiting for a service that doesn't exist yet
