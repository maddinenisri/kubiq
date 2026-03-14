# Crash Pattern Troubleshooting

## OOMKilled (exit code 137)

- Container exceeded its memory limit
- Check: `resources.limits.memory` vs actual usage from `kubectl top pod`
- Fix: Increase memory limit OR fix memory leak in application
- Java apps: Check `-Xmx` JVM heap setting vs container limit (leave 25% headroom for non-heap)
- Node.js: Check `--max-old-space-size` flag
- Go: Check for goroutine leaks with `runtime.NumGoroutine()`

## CrashLoopBackOff

- Container starts and immediately exits, K8s backs off restarts exponentially
- Check: `kubectl logs <pod> --previous` for the exit reason
- Common causes: missing config/secret, wrong entrypoint, port conflict, dependency not ready
- If exit code 1: application error — check logs
- If exit code 137: OOMKilled — check memory
- If exit code 143: SIGTERM — check liveness probe timing

## ImagePullBackOff / ErrImagePull

- K8s cannot pull the container image
- Check: image name/tag spelling, registry authentication, image existence
- Private registry: verify `imagePullSecrets` on the pod or service account
- ECR (AWS): check IAM permissions, token expiry (12h), region match
- If tag is `latest`: check if image was actually pushed with that tag

## Pending Pod

- Pod cannot be scheduled to any node
- Check events: `kubectl describe pod` → Events section
- Insufficient resources: no node has enough CPU/memory — check `kubectl describe nodes`
- Node affinity/taint: pod's nodeSelector or tolerations don't match any node
- PVC pending: the persistent volume claim can't bind — check StorageClass

## CreateContainerConfigError

- Container can't start due to configuration issue
- Most common: referenced ConfigMap or Secret doesn't exist
- Check: `kubectl get configmap <name> -n <namespace>` and `kubectl get secret <name> -n <namespace>`
- Also check: volume mount paths, environment variable references

## Liveness/Readiness Probe Failures

- Liveness probe failure → K8s kills and restarts the container
- Readiness probe failure → pod removed from service endpoints (no traffic)
- Check: is the probe path correct? Is the app listening on the probe port?
- Startup probe: use for slow-starting apps to prevent premature liveness kills
- Common mistake: liveness probe timeout too aggressive for apps under load
