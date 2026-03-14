# Kubernetes Security Checklist

## Container Security Context

- `runAsNonRoot: true` — prevent containers from running as root
- `readOnlyRootFilesystem: true` — prevent writes to container filesystem
- `allowPrivilegeEscalation: false` — prevent setuid binaries
- `capabilities.drop: ["ALL"]` — drop all Linux capabilities
- Only add back specific capabilities if needed (e.g., NET_BIND_SERVICE for port 80)

## RBAC Common Issues

- "Forbidden" errors: service account lacks permissions
- Check: `kubectl auth can-i <verb> <resource> --as=system:serviceaccount:<ns>:<sa>`
- Least privilege: create Role (namespace-scoped) not ClusterRole unless needed
- Common mistake: granting cluster-admin to service accounts
- Debug: check audit logs for RBAC DENY entries

## Secret Management

- K8s Secrets are base64-encoded, NOT encrypted by default
- Enable encryption at rest: `EncryptionConfiguration` on API server
- External secret managers: AWS Secrets Manager, HashiCorp Vault, Azure Key Vault
- CSI secrets driver: mounts external secrets as volumes
- Never commit secrets to Git — use sealed-secrets or external-secrets operator

## Image Security

- Always use specific image tags, never `latest` in production
- Use image digest for immutability: `image: myapp@sha256:abc123...`
- Scan images for CVEs: Trivy, Grype, Snyk
- Private registries: ensure imagePullSecrets are configured
- Pod Security Standards: enforce baseline or restricted profile

## Network Security

- Default: all pod-to-pod traffic allowed (flat network)
- Apply default-deny NetworkPolicy per namespace
- Then allow only required ingress/egress flows
- Ingress TLS: always terminate TLS, don't pass plaintext
