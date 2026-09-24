# Docker Deployment

Deploy Discoverer Neo using Docker Compose.

> Sharing a server with Consulta Online behind its `nginx-proxy`, at
> `https://<host>/discoverer-neo/`? Follow [debian-coexistence.md](debian-coexistence.md) instead.

## What is Included

The Docker setup includes:

- **PostgreSQL 16** — Metadata database
- **Redis 7** — Caching and job queue
- **Backend API** — Node.js/Fastify
- **Frontend** — Nginx serving React SPA

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/your-org/discoverer-neo.git
cd discoverer-neo
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

**Important variables:**
```bash
POSTGRES_PASSWORD=change_me_in_production
JWT_SECRET=generate_a_strong_random_secret
```

### 3. Build Images

```bash
docker compose build
```

This builds:
- Backend image
- Frontend image

(PostgreSQL and Redis use pre-built images)

### 4. Start Services

```bash
docker compose up -d
```

Monitor startup:
```bash
docker compose logs -f backend
```

Wait for all services to be healthy:
```bash
docker compose ps
```

### 5. Verify

- **Backend:** http://localhost:3000/api/health → `200 ok`
- **Frontend:** http://localhost:5173 (or your frontend port)
- **Swagger:** http://localhost:3000/api/docs

## Production Deployment (`docker-compose.prod.yml`)

The **Quick Start** above (`docker compose up -d`, no `-f` flag) runs
`docker-compose.yml` — the dev/general-purpose file, which publishes Postgres
and Redis to `0.0.0.0` and has no resource limits. It is not the file to
deploy with. `docker-compose.prod.yml` is: only `nginx` publishes host ports
(80/443), every service has resource limits and a real healthcheck, and it
never mounts source — only built images run.

This is the sequence that was actually run end-to-end to verify it (Phase
8.1, 2026-09-15) — the first time this file had ever been started:

```bash
cd discoverer-neo
cp .env.example .env               # then edit: POSTGRES_PASSWORD, JWT_SECRET,
                                    # ENCRYPTION_KEY (openssl rand -hex 32 each)

# Self-signed cert for local verification — see nginx/nginx-ssl.conf's header
# for the real-certificate (Let's Encrypt) path.
mkdir -p certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/privkey.pem -out certs/fullchain.pem -subj "/CN=localhost"
cp certs/fullchain.pem certs/chain.pem

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps          # all five: healthy
curl -sk https://localhost/health                      # readiness — see below
```

**Always run `docker compose -f docker-compose.prod.yml down` before ending a
session** — a dev machine left running the production compose is a surprise
for whoever opens the repo next.

### What broke on the first real run, and the fix

None of these were visible from reading the compose file — each only showed
up once the stack actually started:

| Failure | Cause | Fix |
|---|---|---|
| Backend never becomes healthy; logs `DPI-1047: Cannot locate a 64-bit Oracle Client library` | `.env` sets `ORACLE_THICK_MODE=true` (this estate's source predates the password verifier thin mode can use), but the image build defaults `INSTALL_ORACLE_CLIENT=false` — two flags that have to agree, and only one was set | `docker-compose.prod.yml`'s `backend.build.args` now reads `INSTALL_ORACLE_CLIENT` from `ORACLE_THICK_MODE` directly — one flag, not two |
| Frontend never becomes healthy; its own container log shows nginx running fine, but `docker inspect` shows `wget: can't connect to remote host: Connection refused` | The container's healthcheck resolves `localhost` to `::1` first; `frontend/nginx.conf` only had `listen 80;` (IPv4), not `listen [::]:80;` | Added the IPv6 listener, matching `nginx/nginx-ssl.conf`, which already had both |
| Backend crashes and restarts (repeatedly, as long as Postgres stays down) the moment Postgres is stopped, rather than just reporting `/health` as degraded | `pg`'s `Pool` emits `'error'` on a dead idle client; Node's default handling of an unlistened `'error'` event is to throw and crash the process — `backend/src/db/index.ts` never attached a listener | Added `pool.on('error', ...)` — logs and lets the pool replace the connection, matching what [node-postgres itself documents](https://node-postgres.com/apis/pool) as required |
| `/health` takes 30–120s (eventually a `504` from nginx) to report Redis is down, instead of a prompt `503` | `ioredis` queues and retries a command against a down server rather than rejecting it immediately (no `maxRetriesPerRequest`/connect timeout configured) | The readiness check now races `redis.ping()` against a 2s timeout |

### Verifying `/health` goes red

```bash
docker compose -f docker-compose.prod.yml stop postgres
curl -sk https://localhost/health -w '\nHTTP %{http_code}\n'
# {"status":"degraded",...,"database":"disconnected",...}  HTTP 503
curl -sk https://localhost/api/live -w '\nHTTP %{http_code}\n'
# {"status":"ok",...}  HTTP 200 — liveness is unaffected; see monitoring.md
docker compose -f docker-compose.prod.yml start postgres
```

## Compose Files

### docker-compose.yml

Production deployment (includes all services).

**Volumes:**
- `postgres_data` — Database persistence
- `redis_data` — Redis data
- `export_files` — Generated exports
- `scheduled_results_files` — Scheduled run results

**Networks:**
- `default` — Internal network between services

### docker-compose.dev.yml

Development overrides (port mappings, env vars).

**Usage:**
```bash
# Local development
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Production (just main file)
docker compose up -d
```

## Building Backend

Backend Dockerfile uses multi-stage build:

```dockerfile
# Stage 1: Dependencies
FROM node:22 AS deps
COPY package*.json .
RUN npm ci

# Stage 2: Build
FROM deps AS build
COPY . .
RUN npm run build

# Stage 3: Runtime
FROM node:22-slim
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
CMD ["node", "dist/server.js"]
```

**Build context:** Repository root (not just backend/), because:
- npm workspaces need all `package.json` files
- Lock file at root
- Frontend dependencies hoist to root

**Build with custom args:**

```bash
# Include Oracle Instant Client for thick mode
docker compose build --build-arg INSTALL_ORACLE_CLIENT=true backend
```

## Building Frontend

Frontend Dockerfile:

```dockerfile
# Stage 1: Dependencies
FROM node:22 AS deps
COPY package*.json .
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY migrate/package.json migrate/
RUN npm ci --workspace @discoverer-neo/frontend

# Stage 2: Build
FROM deps AS build
COPY . .
RUN npm run build --workspace @discoverer-neo/frontend

# Stage 3: Nginx
FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Volume Management

### PostgreSQL Data

Persists metadata database:

```bash
# Backup
docker compose exec -T postgres pg_dump -U discoverer discoverer_neo > backup.sql

# Restore
docker compose exec -T postgres psql -U discoverer discoverer_neo < backup.sql

# Remove (careful!)
docker volume rm discoverer-neo_postgres_data
```

### Export Files

Temporarily stores generated exports:

```bash
# Cleanup old exports
docker compose exec -T backend find /app/exports -type f -mtime +7 -delete
```

**Note:** Mounted as named volume so exports survive container restart.

## Environment Variables

See [Configuration Guide](configuration.md).

## Logs

View service logs:

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f postgres

# Last N lines
docker compose logs --tail=50 backend

# Timestamp
docker compose logs -f --timestamps backend
```

## Health Checks

Services have health checks in compose file:

```bash
docker compose ps

# Healthy: Status is "Up (healthy)"
# Unhealthy: Status is "Up (unhealthy)" or "Exited"
```

**Backend health:**
```bash
curl http://localhost:3000/api/health
```

**PostgreSQL health:**
```bash
docker compose exec postgres pg_isready -U discoverer
```

**Redis health:**
```bash
docker compose exec redis redis-cli ping
```

## Scaling

### Multiple Backend Instances

Remove in-process workers for scalability:

**.env:**
```bash
EXPORT_WORKER_ENABLED=false
SCHEDULER_WORKER_ENABLED=false
MAP_RUN_WORKER_ENABLED=false
```

Then run workers separately:

```bash
docker compose up -d backend

# In separate container
docker run ... npm run worker
docker run ... npm run worker:scheduler
docker run ... npm run worker:map-runs
```

### Load Balancer

Add Nginx as reverse proxy (optional):

```yaml
services:
  nginx-lb:
    image: nginx:latest
    ports:
      - "80:80"
    volumes:
      - ./nginx-lb.conf:/etc/nginx/nginx.conf
    depends_on:
      - backend-1
      - backend-2
```

## Updates

### Update Images

```bash
# Pull latest images
docker compose pull

# Rebuild custom images
docker compose build --pull

# Restart services
docker compose up -d
```

### Database Migrations

Drizzle migrations run automatically on backend start. To manually migrate:

```bash
docker compose exec backend npm run db:migrate
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs backend

# Common issues:
# - PORT already in use: Change in .env
# - Database connection failed: Check DATABASE_URL
# - Redis connection failed: Check REDIS_URL
```

### Database Locked

```bash
# Restart PostgreSQL
docker compose restart postgres

# Or reset (loses data)
docker volume rm discoverer-neo_postgres_data
docker compose up -d
```

### Out of Disk Space

```bash
# Clean unused images/volumes
docker system prune -a

# Or check disk usage
docker system df
```

## Production Checklist

- [ ] Set strong `POSTGRES_PASSWORD`
- [ ] Generate random `JWT_SECRET` (32+ chars)
- [ ] Set `ENCRYPTION_KEY` (32+ chars)
- [ ] Configure `NODE_ENV=production`
- [ ] Use HTTPS (Nginx with SSL cert)
- [ ] Set `LOG_LEVEL=info` (not debug)
- [ ] Configure backup strategy (see [Backup Guide](backup.md))
- [ ] Set up monitoring (see [Monitoring Guide](monitoring.md))
- [ ] Review security policies (see [Security Guide](../admin-guide/security.md))

## What's Next?

- **[Configuration](configuration.md)** — Environment variables
- **[SSL/TLS](ssl.md)** — HTTPS setup
- **[Backup Guide](backup.md)** — Data protection
- **[Monitoring](monitoring.md)** — Health and performance
- **[What a red `/health` means](../troubleshooting/health-check.md)** — readiness vs. liveness, and how to diagnose a `503`

---

**See Also:** [Deployment Guide](../deployment/), [Architecture](../developer-guide/architecture.md)
