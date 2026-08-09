# Prometheus and Grafana Monitoring

Date: 2026-08-09

## What Was Installed

| Component | Evidence |
|---|---|
| Namespace | `monitoring` |
| Prometheus | Deployment `monitoring/prometheus`, service `prometheus:9090`, image `prom/prometheus:v2.54.1`, retention `6h` |
| Grafana | Deployment `monitoring/grafana`, service `grafana:3000`, image `grafana/grafana:11.2.2` |
| Dashboard | Provisioned dashboard `AquaShield Runtime` |
| Datasource | Grafana datasource points to `http://prometheus.monitoring.svc.cluster.local:9090` |
| Network policy | `allow-prometheus-scrape-from-monitoring` permits Prometheus to scrape AquaShield sidecar metrics on port `15020` |

## Validation

| Check | Result |
|---|---|
| Monitoring pods | `grafana-85bd64bd6b-4fsgj` and `prometheus-6cb7d8f976-t78wv` are `Running`. |
| Monitoring services | `grafana` and `prometheus` are `ClusterIP` services, intentionally private to the cluster. |
| Prometheus scrape health | `sum(up{namespace="aquashield-dev"}) = 10`, covering the ten long-running AquaShield workloads. |
| Prometheus scrape volume | `sum(scrape_samples_scraped{namespace="aquashield-dev"}) = 10350`. |
| Per-service scrape targets | `analytics-service`, `api-edge-proxy`, `audit-service`, `identity-access-service`, `ingestion-service`, `notification-service`, `pond-service`, `project-service`, `realtime-gateway`, and `sensor-service` all report `up = 1`. |
| Grafana health | `database: ok`, version `11.2.2`. |
| Istio traffic metric | `istio_requests_total` is queryable by destination service; recent traffic was visible for `api-edge-proxy` and `identity-access-service`. |

Note: `pond-daily-health` appears as a stale/down scrape target because old job pods remain in pod history. It is not one of the ten long-running application services.

## Local Access Command

```bash
kubectl -n monitoring port-forward svc/grafana 3000:3000
```

Then open `http://localhost:3000`.
