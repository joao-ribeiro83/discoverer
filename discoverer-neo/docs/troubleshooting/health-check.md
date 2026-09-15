# What a red `/health` means

`/health` (and `/api/health`) is a **readiness** check: it reports whether
this backend instance can actually serve traffic, not just whether the Node
process is running. See [Monitoring](../deployment/monitoring.md) for the
full readiness-vs-liveness split (`/live` is the liveness endpoint, and it
does not go red for any of this).

A `503` from `/health` means `database` or `redis` in the response body is
`"disconnected"`:

```bash
curl http://localhost:3000/health
# {"status":"degraded","database":"disconnected","redis":"connected",...}
```

## `database: "disconnected"`

The backend cannot run `SELECT 1` against Postgres. In order of likelihood:

1. **Postgres container is down or still starting.**
   `docker compose -f docker-compose.prod.yml ps postgres` — if it is not
   `healthy`, check `docker compose -f docker-compose.prod.yml logs postgres`.
2. **`DATABASE_URL` is wrong** (wrong host/port/credentials). In
   `docker-compose.prod.yml` this is built from `POSTGRES_USER` /
   `POSTGRES_PASSWORD` / `POSTGRES_DB` in `.env` — confirm they match what
   Postgres was actually initialized with (changing `POSTGRES_PASSWORD` after
   the volume already exists does not retroactively change the database's own
   password).
3. **The connection pool is exhausted or the query timed out.** Bounded by
   `DATABASE_POOL_CONNECTION_TIMEOUT_MS` (default 10s) — `/health` will not
   hang indefinitely, but it will take up to that long to report red.

This does **not** crash the backend. A dead idle connection in the pool is
caught (`backend/src/db/index.ts`'s `pool.on('error', ...)`) and logged; the
pool replaces it on next use. If you see the backend container restarting
repeatedly while Postgres is down, that is a regression of this — check
`docker inspect <container> --format '{{.RestartCount}}'` and the container
logs for an uncaught `pg-pool` error.

## `redis: "disconnected"`

The backend's `redis.ping()` did not succeed within 2 seconds. Same first
check — `docker compose -f docker-compose.prod.yml ps redis` — then confirm
`REDIS_URL` matches the `redis` service's hostname (`redis://redis:6379` in
the prod compose; the ioredis client reconnects on its own once Redis comes
back, so no restart is needed here either).

The 2-second bound is deliberate: `ioredis` will otherwise queue and retry a
command against a down server for tens of seconds before rejecting, which
turned a `503` into a `504` from nginx instead — too slow for an orchestrator
or load balancer to act on.

## The Oracle version gate refused a connection

A different error, not a `/health` field: `getConnection()` throws
`OraclePoolError: Oracle Database X.Y.Z is below the minimum supported
version 12.1.0.0.0` when a data source's server reports a pre-12.1 version.
This is deliberate (see Decision D-019) — pre-12.1 Oracle uses a password
verifier `node-oracledb` thin mode cannot authenticate against, and the
failure needs to be a clear refusal naming both versions, not an opaque
authentication error three layers down. Fix: point the data source at a
12.1+ server, or set `ORACLE_THICK_MODE=true` and rebuild the backend image
(`INSTALL_ORACLE_CLIENT` follows `ORACLE_THICK_MODE` automatically in
`docker-compose.prod.yml`).

## `oracleClient: "thick_unavailable"`

Means `ORACLE_THICK_MODE=true` but the Oracle Instant Client failed to load —
this fails the whole process at boot (`server.ts` calls `process.exit(1)`),
so you will not actually see this value over HTTP; it is here for log
searches. Confirm the image was built with the client (see
[docker.md](../deployment/docker.md)'s Production Deployment section) — the
backend image logs `DPI-1047: Cannot locate a 64-bit Oracle Client library`
when it is missing.
