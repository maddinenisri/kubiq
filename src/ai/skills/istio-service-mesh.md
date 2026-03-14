# Istio Service Mesh Troubleshooting

## Sidecar Injection Issues

- Pods not getting Envoy sidecar: check namespace label `istio-injection: enabled`
- Verify: `kubectl get namespace <ns> --show-labels`
- Manual injection: `istioctl kube-inject -f deployment.yaml | kubectl apply -f -`
- Init container `istio-init` failing: check iptables permissions, `NET_ADMIN` capability required
- Pod stuck in `Init:0/1`: istio-init can't set up iptables rules — check node kernel version

## Envoy Sidecar Logs

- ALWAYS check envoy proxy logs alongside app container logs
- Envoy logs: `kubectl logs <pod> -c istio-proxy`
- Common: app logs show "connection refused" but envoy logs show the real upstream error
- Envoy access log format: `[2024-01-01T00:00:00.000Z] "GET /api HTTP/1.1" 503 UF upstream_reset_before_response_started`
- Response flags meaning:
  - `UF` = upstream connection failure
  - `UH` = no healthy upstream
  - `UC` = upstream connection termination
  - `NR` = no route configured
  - `URX` = upstream retry limit exceeded
  - `DC` = downstream connection termination

## mTLS Issues

- 503 errors between services: mTLS mode mismatch (STRICT vs PERMISSIVE)
- Check: `kubectl get peerauthentication -A` and `kubectl get destinationrule -A`
- STRICT mode: ALL traffic must be mTLS — non-mesh clients can't connect
- PERMISSIVE mode: accepts both plaintext and mTLS (use during migration)
- Debug: `istioctl proxy-config cluster <pod> | grep <service>` — check ALPN

## Traffic Routing Problems

- VirtualService not routing: check gateway binding, host matching
- Debug: `istioctl proxy-config routes <pod>` — see all configured routes
- Header-based routing not working: ensure headers are propagated through app
- Retry storm: default retries can amplify failures — check `retries` in VirtualService
- Circuit breaking: check `connectionPool` and `outlierDetection` in DestinationRule

## Service-to-Service Connectivity

- 503 errors: check if destination service has matching DestinationRule
- If service B can't reach service C: `istioctl x describe pod <pod-B>`
- Check endpoints: `istioctl proxy-config endpoints <pod> | grep <target-service>`
- DNS: Istio uses its own DNS resolution — check `ServiceEntry` for external services
- Headless services: Istio handles them differently — check `resolution: NONE` in ServiceEntry

## Performance Issues

- Envoy sidecar adds ~2ms latency per hop (normal)
- High latency: check `istioctl proxy-config cluster <pod>` for circuit breaker trips
- Memory: each Envoy sidecar uses ~50-100MB — factor into pod resource limits
- CPU: Envoy can consume significant CPU under high throughput — set sidecar resource limits
- Config push delay: large meshes can have slow config propagation — check istiod logs

## Common Debugging Commands

- `istioctl analyze` — checks for configuration issues across the mesh
- `istioctl proxy-status` — shows sync status of all Envoy proxies
- `istioctl proxy-config listener <pod>` — shows all listeners on a proxy
- `istioctl proxy-config cluster <pod>` — shows all clusters (upstream services)
- `istioctl proxy-config endpoints <pod>` — shows all endpoints
- `istioctl proxy-config route <pod>` — shows all routes
- `istioctl x describe pod <pod>` — comprehensive pod connectivity report
