# Cloud Provider Specifics

## AWS EKS

- Auth: IAM roles mapped to K8s RBAC via aws-auth ConfigMap (kube-system)
- Token refresh: `aws eks get-token` via kubeconfig exec block (12h expiry)
- Node groups: managed (AWS manages ASG) vs self-managed vs Fargate
- Karpenter: if using, check Provisioner/NodePool CRDs for scheduling constraints
- Load balancer: AWS Load Balancer Controller creates ALB/NLB from Ingress/Service
- Logging: enable control plane logging in EKS console, pod logs via Fluent Bit to CloudWatch
- Common issue: aws-auth ConfigMap misconfigured → "Unauthorized" errors

## GCP GKE

- Auth: Google IAM + K8s RBAC
- Autopilot: Google manages nodes, enforces security policies, limits resource requests
- Standard: you manage node pools
- Load balancer: GKE automatically provisions Cloud Load Balancer
- Workload Identity: map K8s SA to Google SA for secure API access
- Common issue: GKE nodes can't pull from Artifact Registry → check node SA permissions

## Azure AKS

- Auth: Azure AD + K8s RBAC
- Node pools: system (for system pods) and user (for app pods)
- Virtual nodes: serverless pods via Azure Container Instances
- Load balancer: Azure LB created for LoadBalancer services
- Azure Key Vault CSI: mount secrets directly from Key Vault
- Common issue: AKS system node pool at capacity → scale up or add user pool

## Local Development

- kind: K8s in Docker. Fast, lightweight. Port-forward for access
- minikube: VM or container-based. Has addons (metrics-server, ingress, dashboard)
- Docker Desktop: built-in K8s. Simple but resource-heavy
- k3s/k3d: lightweight K8s distro. Good for CI/CD
- Common issue: resource constraints on local clusters → increase Docker memory/CPU allocation
