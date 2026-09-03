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
| `JWT_SECRET` | dev-only-insecure-secret-change-me | JWT signing secret (min 16 chars). **The backend refuses to start with `NODE_ENV=production` while this default is in force.** |
| `JWT_EXPIRES_IN` | 7d | Token expiration (e.g., "7d", "24h", "3600") |
| `ENCRYPTION_KEY` | dev-only-insecure-encryption-key-change-me | AES-256-GCM key for stored credentials (min 32 chars). **The backend refuses to start with `NODE_ENV=production` while this default is in force.** Changing it requires re-encrypting stored credentials — see [Rotating the encryption key](#rotating-the-encryption-key). |

Both defaults are published in this repository, so neither protects anything
from anyone holding a copy of it. The guard lives in `backend/src/config.ts`
(`assertProductionSecrets`) and throws before any config value is read.

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

## Rotating the encryption key

`ENCRYPTION_KEY` is the AES-256-GCM key protecting every stored Oracle
data-source password (`data_sources.password_enc` — the only encrypted column
in the schema).

**Changing it without re-encrypting makes every stored password permanently
undecryptable.** There is no recovery except re-entering each password by hand.
The application will not error usefully; it will simply fail to connect.

Rotate when the key may have been exposed: a leaked `.env`, an operator
leaving, or — as here — discovering the deployment was running on the
published development default.

### 1. Back up first

```bash
./scripts/backup.sh
```

This is the rollback. Note the timestamp it prints; the dump lands in
`backups/postgres/`.

### 2. Generate the new key

```bash
openssl rand -hex 32
```

Do not commit it, and do not overwrite the old one yet — the rotation needs
both at once.

### 3. Dry-run the rotation

```bash
cd backend
OLD_ENCRYPTION_KEY='<current>' NEW_ENCRYPTION_KEY='<new>' \
  npx tsx src/scripts/rotate-encryption-key.ts --dry-run
```

The dry run reports how many credentials would be rewritten and names any that
will not decrypt under the old key.

**If a credential does not decrypt, stop.** Either the old key is wrong — in
which case rotating would destroy every password — or that row was never valid
ciphertext. Inspect it. Only once you know which, re-run with
`--allow-undecryptable` to rotate the rest and leave that row untouched.

### 4. Rotate

```bash
OLD_ENCRYPTION_KEY='<current>' NEW_ENCRYPTION_KEY='<new>' \
  npx tsx src/scripts/rotate-encryption-key.ts
```

Every row is rewritten in one transaction, and each new ciphertext is decrypted
back before it replaces the old one. A crash halfway leaves the whole set on the
old key, which the old key still opens. No plaintext is printed or written.

### 5. Install the new key and restart

Set `ENCRYPTION_KEY` to the new value in `.env` (which `docker-compose` passes
through via `env_file`), then:

```bash
docker compose up -d --force-recreate backend
```

### 6. Verify

Open each data source's **Test Connection** in the admin UI. A connection that
succeeded before rotation and fails after it means the rotation did not take —
restore the backup from step 1 and start again with the correct old key.

### Rolling back

```bash
./scripts/restore.sh backups/postgres/discoverer_neo_<timestamp>.dump.gz
```

Then put the **old** `ENCRYPTION_KEY` back. The two must always move together.

### Rotating `JWT_SECRET`

Far simpler: change it and restart. Every existing session token becomes
invalid, so everyone is logged out once. Nothing stored needs rewriting.

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
