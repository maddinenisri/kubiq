# Kubernetes Networking Troubleshooting

## DNS Resolution

- All pods get DNS via CoreDNS (kube-system namespace)
- Service DNS: `<service-name>.<namespace>.svc.cluster.local`
- Test from pod: `kubectl exec <pod> -- nslookup <service-name>`
- If DNS fails: check CoreDNS pods are running, check `/etc/resolv.conf` in pod
- ndots:5 default can cause slow DNS — external domains try 5 search suffixes first

## Service Not Reachable

- Check endpoints exist: `kubectl get endpoints <service-name> -n <ns>`
- Empty endpoints = selector doesn't match any pods (label mismatch)
- Check pod labels match service selector: compare `kubectl get svc <name> -o yaml` selector vs `kubectl get pods --show-labels`
- Check pod readiness: unready pods are removed from endpoints
- Port mismatch: service targetPort must match container's listening port

## NetworkPolicy Issues

- Default: all pods can talk to all pods (no isolation)
- Once ANY NetworkPolicy selects a pod, all non-matching traffic is denied
- Common mistake: creating an ingress policy but forgetting egress (or vice versa)
- Debug: `kubectl get networkpolicy -n <ns> -o yaml` and trace the selectors
- Quick test: deploy a debug pod and curl the target service

## Ingress / LoadBalancer

- 502/504 errors: backend pods not ready or health check failing
- Check ingress controller logs (nginx-ingress, ALB controller, etc.)
- ALB (AWS): check target group health in AWS console
- Verify: service type matches ingress expectation (ClusterIP for nginx, NodePort for ALB)
- TLS: check certificate validity and secret name reference

## Pod-to-External Connectivity

- Check: can pod resolve external DNS? `kubectl exec <pod> -- nslookup google.com`
- NAT gateway / internet gateway needed for private subnets (AWS/GCP)
- NetworkPolicy might block egress — check egress rules
- Proxy settings: some corp environments require HTTP_PROXY env vars
