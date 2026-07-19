# Configuration Reference

Complete environment variable reference for Discoverer Neo.

## Environment Variables

### Node.js / Runtime

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | development | Runtime mode: development, production, test |
| `PORT` | 3000 | Backend HTTP port |
| `HOST` | 0.0.0.0 | Backend listen address |
| `LOG_LEVEL` | info | Logging level: fatal, error, warn, info, debug, trace, silent |

### PostgreSQL Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | postgres://postgres:postgres@localhost:5432/discoverer_neo | PostgreSQL connection URL (or use individual vars below) |
| `POSTGRES_HOST` | localhost | Database host |
| `POSTGRES_PORT` | 5432 | Database port |
| `POSTGRES_DB` | discoverer_neo | Database name |
| `POSTGRES_USER` | discoverer | Database user |
| `POSTGRES_PASSWORD` | change_me_in_production | Database password |
| `DATABASE_POOL_MAX` | 10 | Max connections in pool (1–100) |
| `DATABASE_POOL_IDLE_TIMEOUT_MS` | 30000 | Idle timeout before closing (ms) |
| `DATABASE_POOL_CONNECTION_TIMEOUT_MS` | 10000 | Wait time for free connection (ms) |

### Redis Cache & Job Queue

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | redis://localhost:6379 | Redis connection URL |
| `REDIS_HOST` | localhost | Redis host |
| `REDIS_PORT` | 6379 | Redis port |
| `METADATA_CACHE_ENABLED` | true | Enable metadata caching (improves performance ~55%) |
| `METADATA_CACHE_TTL_SECONDS` | 300 | Cache timeout (5 min) |

### Authentication (JWT)

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | dev-only-insecure-secret-change-me | JWT signing secret (min 16 chars) |
| `JWT_EXPIRES_IN` | 7d | Token expiration (e.g., "7d", "24h", "3600") |
| `ENCRYPTION_KEY` | dev-only-insecure-encryption-key-change-me | AES-256 encryption for stored credentials (min 32 chars) |

### Oracle Database Connectivity

| Variable | Default | Description |
|----------|---------|-------------|
| `ORACLE_THICK_MODE` | false | Enable thick mode (requires Oracle Instant Client) |
| `ORACLE_CLIENT_PATH` | /opt/oracle/instantclient | Path to Instant Client (thick mode only) |
| `ORACLE_POOL_MIN` | 2 | Min connections per source |
| `ORACLE_POOL_MAX` | 10 | Max connections per source (1–100) |
| `ORACLE_POOL_INCREMENT` | 1 | New connections per allocation |
| `ORACLE_POOL_IDLE_TIMEOUT_SECONDS` | 300 | Idle timeout (seconds) |
| `ORACLE_CONNECT_TIMEOUT_MS` | 10000 | Connection timeout (ms) |

### Export Jobs (Excel, CSV)

| Variable | Default | Description |
|----------|---------|-------------|
| `EXPORT_DIR` | `<project>/backend/exports` | Directory for export files |
| `EXPORT_WORKER_ENABLED` | depends on NODE_ENV | Run export worker in this process |
| `EXPORT_WORKER_CONCURRENCY` | 3 | Max concurrent exports |
| `EXPORT_RETENTION_DAYS` | 7 | Days before cleanup |
| `EXPORT_CLEANUP_INTERVAL_MINUTES` | 60 | How often to cleanup |

### Scheduling (Cron-Driven Map Runs)

| Variable | Default | Description |
|----------|---------|-------------|
| `SCHEDULE_RESULT_DIR` | `<project>/backend/scheduled-results` | Directory for scheduled run output |
| `SCHEDULER_WORKER_ENABLED` | depends on NODE_ENV | Run scheduler worker in this process |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `FRONTEND_PORT` | 5173 | Frontend dev server port |

## Sample .env File

```bash
# ============================================
# Discoverer Neo — Environment Configuration
# ============================================

# --- Node.js ---
NODE_ENV=production
LOG_LEVEL=info

# --- Backend Server ---
PORT=3000
HOST=0.0.0.0

# --- PostgreSQL ---
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=discoverer_neo
POSTGRES_USER=discoverer
POSTGRES_PASSWORD=strong_random_password_here

# --- Redis ---
REDIS_HOST=redis
REDIS_PORT=6379
METADATA_CACHE_ENABLED=true
METADATA_CACHE_TTL_SECONDS=300

# --- JWT ---
JWT_SECRET=generate_strong_random_secret_min_16_chars
JWT_EXPIRES_IN=7d

# --- Encryption ---
ENCRYPTION_KEY=generate_strong_random_key_min_32_chars

# --- Oracle (optional) ---
ORACLE_THICK_MODE=false
ORACLE_POOL_MAX=10
ORACLE_CONNECT_TIMEOUT_MS=10000

# --- Exports ---
EXPORT_WORKER_ENABLED=true
EXPORT_WORKER_CONCURRENCY=3
EXPORT_RETENTION_DAYS=7
EXPORT_DIR=/app/exports

# --- Scheduler ---
SCHEDULER_WORKER_ENABLED=true
SCHEDULE_RESULT_DIR=/app/scheduled-results

# --- Frontend ---
FRONTEND_PORT=80
```

## Generating Secrets

**JWT Secret:**
```bash
# Generate random string (32 chars)
openssl rand -hex 16    # 16 bytes = 32 hex chars

# Example output
abc123def456ghi789jkl012mno345pqr
```

**Encryption Key:**
```bash
# Generate 32-byte random string (64 hex chars)
openssl rand -hex 32

# Example output
abc123def456ghi789jkl012mno345pqr789stu012vwx345yz
```

## Performance Tuning

### For Read-Heavy Workloads

```bash
# Enable metadata cache (default on)
METADATA_CACHE_ENABLED=true
METADATA_CACHE_TTL_SECONDS=600    # Longer TTL

# Increase database connections
DATABASE_POOL_MAX=25              # Only if DB supports it

# Increase Oracle pool
ORACLE_POOL_MAX=20                # Per data source
```

### For Write-Heavy Workloads

```bash
# Disable caching (metadata changes frequently)
METADATA_CACHE_ENABLED=false

# Shorter idle timeout
DATABASE_POOL_IDLE_TIMEOUT_MS=5000

# Increase cleanup/retention
EXPORT_WORKER_CONCURRENCY=5
```

### For Large Exports

```bash
# Increase export concurrency and worker memory
EXPORT_WORKER_CONCURRENCY=5
EXPORT_RETENTION_DAYS=14          # Keep longer

# Run export worker separately (in own container)
EXPORT_WORKER_ENABLED=false
```

## Common Configurations

### Local Development

```bash
NODE_ENV=development
LOG_LEVEL=debug
METADATA_CACHE_ENABLED=false      # See changes immediately
JWT_SECRET=dev-secret
ENCRYPTION_KEY=dev-encryption-key
```

### Staging/QA

```bash
NODE_ENV=production
LOG_LEVEL=info
METADATA_CACHE_ENABLED=true
METADATA_CACHE_TTL_SECONDS=300
JWT_SECRET=$(openssl rand -hex 16)
ENCRYPTION_KEY=$(openssl rand -hex 32)
DATABASE_POOL_MAX=15
ORACLE_POOL_MAX=15
```

### Production

```bash
NODE_ENV=production
LOG_LEVEL=warn                    # Only warnings/errors
METADATA_CACHE_ENABLED=true
METADATA_CACHE_TTL_SECONDS=600
JWT_SECRET=$(openssl rand -hex 16)
ENCRYPTION_KEY=$(openssl rand -hex 32)
DATABASE_POOL_MAX=25
ORACLE_POOL_MAX=20
EXPORT_RETENTION_DAYS=30
EXPORT_WORKER_CONCURRENCY=3      # Keep conservative
```

## Validation

On startup, backend validates all variables:

```typescript
const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error);
  process.exit(1);
}
```

**Common validation errors:**

- `JWT_SECRET` too short (< 16 chars) → Exit with error
- `ORACLE_POOL_MIN > ORACLE_POOL_MAX` → Exit with error
- `DATABASE_URL` invalid format → Exit with error
- Missing `ENCRYPTION_KEY` → Exit with error

## Secrets Management

### Docker Secrets

For production, use Docker secrets instead of `.env`:

```bash
# Create secrets
echo "my-secret" | docker secret create jwt_secret -
echo "my-key" | docker secret create encryption_key -

# Reference in compose
services:
  backend:
    environment:
      JWT_SECRET_FILE: /run/secrets/jwt_secret
    secrets:
      - jwt_secret
      - encryption_key
```

### Kubernetes

Use Kubernetes Secrets:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: discoverer-neo
type: Opaque
stringData:
  JWT_SECRET: my-secret
  ENCRYPTION_KEY: my-key
---
spec:
  containers:
  - env:
    - name: JWT_SECRET
      valueFrom:
        secretKeyRef:
          name: discoverer-neo
          key: JWT_SECRET
```

### HashiCorp Vault

Integrate with Vault for dynamic secrets.

## What's Next?

- **[SSL/TLS](ssl.md)** — HTTPS setup
- **[Docker Deployment](docker.md)** — Container setup
- **[Monitoring](monitoring.md)** — Health and metrics
- **[Backup Guide](backup.md)** — Data protection

---

**See Also:** [Deployment Guide](../deployment/), [Development Setup](../developer-guide/development.md)
