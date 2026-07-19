# Monitoring and Health Checks

Monitor Discoverer Neo health, performance, and resource usage.

## Health Checks

### Service Health Endpoints

**Backend:**
```bash
curl http://localhost:3000/api/health
# Response: { "status": "ok", "timestamp": "2026-07-19T12:00:00Z" }
```

**Frontend:**
```bash
curl http://localhost:80/health
# Response: healthy
```

**Docker:**
```bash
docker compose ps
# Services should show "Up (healthy)"
```

## Prometheus Metrics

Backend exposes Prometheus metrics at `/metrics`:

```bash
curl http://localhost:3000/metrics
```

### Key Metrics

**Node.js Runtime:**
- `nodejs_heap_size_used_bytes` — Memory usage
- `nodejs_eventloop_lag_seconds` — Event loop latency
- `process_cpu_usage_percent` — CPU usage

**Database:**
- `pg_pool_connections_active` — Active connections
- `pg_pool_connections_idle` — Idle connections
- `pg_query_duration_ms` — Query latency (histogram)

**Oracle:**
- `oracledb_pool_connections_active` — Per-source connections
- `oracledb_pool_connections_idle`

**Cache:**
- `redis_cache_hits` — Metadata cache hits
- `redis_cache_misses` — Cache misses

**Job Queue:**
- `bullmq_queue_waiting` — Pending jobs
- `bullmq_queue_active` — Running jobs
- `bullmq_job_duration_ms` — Job execution time

**API:**
- `http_request_duration_seconds` — Request latency (histogram)
- `http_requests_total` — Total requests (by method, status code)

## Setting Up Prometheus

### prometheus.yml

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'discoverer-neo'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

### Docker Compose Addition

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
    depends_on:
      - backend

volumes:
  prometheus_data:
```

## Setting Up Grafana

### Docker Compose

```yaml
services:
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    depends_on:
      - prometheus

volumes:
  grafana_data:
```

### Create Datasource

1. Visit http://localhost:3001
2. Login (admin/admin)
3. Add Prometheus datasource:
   - URL: http://prometheus:9090
   - Save & Test

### Dashboard Queries

**Query Latency (P95):**
```promql
histogram_quantile(0.95, http_request_duration_seconds_bucket)
```

**Request Rate:**
```promql
rate(http_requests_total[5m])
```

**Active Database Connections:**
```promql
pg_pool_connections_active
```

**Cache Hit Rate:**
```promql
rate(redis_cache_hits[5m]) / (rate(redis_cache_hits[5m]) + rate(redis_cache_misses[5m]))
```

## Log Aggregation (ELK Stack)

### Docker Compose with ELK

```yaml
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.0.0
    environment:
      - discovery.type=single-node
    ports:
      - "9200:9200"

  kibana:
    image: docker.elastic.co/kibana/kibana:8.0.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch

  logstash:
    image: docker.elastic.co/logstash/logstash:8.0.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
```

### Logstash Config

```
input {
  tcp {
    port => 5000
    codec => json
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
  }
}
```

## Alerting

### Prometheus Alerts

Create `alerts.yml`:

```yaml
groups:
  - name: discoverer-neo
    rules:
      - alert: HighMemoryUsage
        expr: nodejs_heap_size_used_bytes > 500000000  # 500MB
        for: 5m
        annotations:
          summary: "High memory usage detected"

      - alert: HighLatency
        expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 1
        for: 10m
        annotations:
          summary: "High request latency"

      - alert: DBConnectionPoolExhausted
        expr: pg_pool_connections_active >= 10
        for: 5m
        annotations:
          summary: "Database connection pool nearly exhausted"
```

### Alert Manager Integration

Configure Prometheus to use Alert Manager:

```yaml
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093
```

Send alerts to:
- Email
- Slack
- PagerDuty
- Custom webhooks

## Performance Monitoring

### Query Performance

Check slow queries:

```sql
-- PostgreSQL slow query log
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Connection Pool Saturation

Monitor:
```promql
pg_pool_connections_active / 10  # as percentage of max (10)
```

Alert when > 80% (8 connections active).

### Export Job Queue

Monitor:
```promql
bullmq_queue_waiting{queue="export"}
bullmq_queue_active{queue="export"}
```

Alert when queue waiting > 5 jobs (indicates backlog).

## Log Levels

Set via `LOG_LEVEL` environment variable:

| Level | Use |
|-------|-----|
| `fatal` | Unrecoverable errors (exit after) |
| `error` | Error conditions (operation failed) |
| `warn` | Warnings (degraded performance, missing optional) |
| `info` | **Production default** — Normal operations |
| `debug` | Development — Detailed diagnostics |
| `trace` | Maximum verbosity — Every statement |

## Common Metrics to Watch

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| Memory Usage | > 80% | Restart or scale |
| Query Latency P95 | > 1s | Optimize queries or scale DB |
| Error Rate | > 5% of requests | Check logs, scale workers |
| DB Pool Active | > 8/10 | Increase pool or reduce concurrency |
| Export Queue Pending | > 10 jobs | Increase export workers |
| Disk Usage | > 80% | Clean old exports/backups |

## Testing Alerts

```bash
# Trigger test alert (increase memory with dummy load)
docker compose exec backend node -e "
  const arr = [];
  while(true) arr.push(new Array(1000000).fill(0));
"
```

Monitor metrics go up, alerts fire.

## What's Next?

- **[Docker Deployment](docker.md)** — Container setup
- **[Backup Guide](backup.md)** — Data protection
- **[Configuration](configuration.md)** — Environment variables

---

**See Also:** [Deployment Guide](../deployment/), [Architecture](../developer-guide/architecture.md)
