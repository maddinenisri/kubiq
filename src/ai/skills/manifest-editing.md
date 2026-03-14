# Manifest Editing Common Patterns

## Adding Environment Variables

```yaml
spec:
  containers:
    - name: app
      env:
        - name: DATABASE_URL
          value: "postgres://db:5432/mydb"
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
        - name: APP_CONFIG
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: config.json
```

## Mounting Secrets as Volumes

```yaml
spec:
  volumes:
    - name: secret-volume
      secret:
        secretName: tls-certs
  containers:
    - name: app
      volumeMounts:
        - name: secret-volume
          mountPath: /etc/certs
          readOnly: true
```

## Mounting ConfigMaps

```yaml
spec:
  volumes:
    - name: config-volume
      configMap:
        name: app-config
  containers:
    - name: app
      volumeMounts:
        - name: config-volume
          mountPath: /etc/config
```

## Adding Labels and Annotations

```yaml
metadata:
  labels:
    app: my-service
    version: v2
    environment: production
    team: backend
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"
```

## Adding Resource Limits

```yaml
spec:
  containers:
    - name: app
      resources:
        requests:
          cpu: "250m"
          memory: "256Mi"
        limits:
          cpu: "500m"
          memory: "512Mi"
```

## Adding Health Probes

```yaml
spec:
  containers:
    - name: app
      livenessProbe:
        httpGet:
          path: /healthz
          port: 8080
        initialDelaySeconds: 15
        periodSeconds: 10
      readinessProbe:
        httpGet:
          path: /ready
          port: 8080
        initialDelaySeconds: 5
        periodSeconds: 5
      startupProbe:
        httpGet:
          path: /healthz
          port: 8080
        failureThreshold: 30
        periodSeconds: 10
```

## Adding Init Containers

```yaml
spec:
  initContainers:
    - name: wait-for-db
      image: busybox
      command: ["sh", "-c", "until nslookup postgres; do sleep 2; done"]
    - name: run-migrations
      image: my-app:latest
      command: ["./migrate"]
```

## Adding Sidecars

```yaml
spec:
  containers:
    - name: app
      image: my-app:latest
    - name: log-shipper
      image: fluent-bit:latest
      volumeMounts:
        - name: shared-logs
          mountPath: /var/log/app
  volumes:
    - name: shared-logs
      emptyDir: {}
```

## Common Mistakes

- Missing `volumeMounts` when volume is defined (or vice versa)
- Wrong `secretKeyRef.key` — must match actual key in the Secret
- Forgetting to create the Secret/ConfigMap before referencing it
- Using `value` instead of `valueFrom` for secrets (exposes value in manifest)
- Port mismatch between container port and probe port
- Setting memory limit too close to request (no burst headroom)
