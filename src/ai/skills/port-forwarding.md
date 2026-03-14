# Port-Forwarding & Local Development

## Basic Port-Forward

- `kubectl port-forward pod/<name> 8080:8080` — forward local:remote
- `kubectl port-forward svc/<name> 8080:80` — forward to service (load-balanced)
- `kubectl port-forward deploy/<name> 8080:8080` — forward to deployment (picks a pod)
- Background: add `&` or use Kubiq's terminal-based port-forward

## Multi-Container Port-Forward

- Each container in a pod exposes different ports
- Forward multiple ports: `kubectl port-forward pod/<name> 8080:8080 9090:9090 3000:3000`
- Common pattern: app on 8080, debug on 5005, metrics on 9090, admin on 8081

## Common Port-Forward Issues

- "unable to listen on port": another process already using the local port
  - Fix: use a different local port or kill the process: `lsof -i :8080`
- Connection drops after idle: kubectl port-forward times out on idle connections
  - Workaround: use `--pod-running-timeout=0` or keep-alive pings
- "error: unable to forward port": pod not running or container port wrong
  - Check: `kubectl get pod <name> -o jsonpath='{.spec.containers[*].ports}'`

## Service Mesh (Istio) Port-Forward

- Forward to the app container port, NOT the Envoy proxy port
- Envoy admin: `kubectl port-forward <pod> 15000:15000` then http://localhost:15000
- Envoy stats: `kubectl port-forward <pod> 15090:15090`
- App container: use the actual application port (e.g., 8080, 3000)
- If mTLS blocks: port-forward bypasses mTLS (connects directly to pod)

## Database Access via Port-Forward

- PostgreSQL: `kubectl port-forward svc/postgres 5432:5432` then `psql -h localhost`
- MySQL: `kubectl port-forward svc/mysql 3306:3306` then `mysql -h 127.0.0.1`
- Redis: `kubectl port-forward svc/redis 6379:6379` then `redis-cli`
- MongoDB: `kubectl port-forward svc/mongo 27017:27017`
- Elasticsearch: `kubectl port-forward svc/elasticsearch 9200:9200`

## Debugging with Port-Forward

- Java remote debug: `kubectl port-forward <pod> 5005:5005` (JDWP)
  - Add to JVM args: `-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005`
- Node.js debug: `kubectl port-forward <pod> 9229:9229` (inspector)
  - Start with: `node --inspect=0.0.0.0:9229 app.js`
- Python debug: `kubectl port-forward <pod> 5678:5678` (debugpy)
- Go delve: `kubectl port-forward <pod> 2345:2345`
