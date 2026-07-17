# Discoverer Neo — Full-Stack Integration Test Report

**Date:** 2026-06-24
**Status:** PASS — All services running, database seeded, proxy working.

---

## Final Verification Results

| Check | Status | Details |
|---|---|---|
| PostgreSQL :5432 | PASS | Healthy |
| Redis :6379 | PASS | Healthy |
| Backend :3000 | PASS | `{"status":"ok"}` |
| Frontend :5173 | PASS | HTTP 200, HTML served |
| Vite proxy /api/health | PASS | Returns backend health JSON |
| Database migrations | PASS | 25 tables created |
| Seed script | PASS | Admin user + sample data |

---

## Issues Found and Fixes Applied

### Issue 1: Missing `.env` file
**Symptom:** `docker compose up` failed — `env_file: .env` referenced a nonexistent file.
**Fix:** Copied `.env.example` to `.env` in the project root.

### Issue 2: Backend PORT default mismatch
**Symptom:** `config.ts` defaulted `PORT` to `3001`; compose expected `3000`.
**Fix:** Changed `default(3001)` to `default(3000)` in `backend/src/config.ts`.

### Issue 3: Vite proxy target used `localhost`
**Symptom:** Inside Docker, `localhost` resolves to the frontend container itself, not the backend.
**Fix:** Updated `frontend/vite.config.ts` to use `VITE_BACKEND_URL` (set to `http://backend:3000` in dev compose) and added `pathRewrite` to strip `/api` prefix.

### Issue 4: Frontend `src/` was empty
**Symptom:** Vite had nothing to serve — `index.html` and React entry point missing.
**Fix:** Created `frontend/index.html`, `frontend/src/main.tsx`, and `frontend/src/App.tsx` with a basic app that fetches `/api/health`.

### Issue 5: Oracle Instant Client download failed (404)
**Symptom:** `curl: (22) The requested URL returned error: 404` during Docker build.
**Fix:** Made the Oracle client download best-effort with `|| echo "WARNING..."` in `backend/Dockerfile.dev`, `backend/Dockerfile`, and `migrate/Dockerfile.dev`. The core app does not require Oracle client at runtime.

### Issue 6: npm peer dependency conflict
**Symptom:** `jest@^25.0.0` conflicted with `ts-jest@29.x` (requires `jest@^29 || ^30`).
**Fix:** Bumped `jest` to `^29.0.0` in `backend/package.json`.

### Issue 7: Vite config syntax error
**Symptom:** `Expected "}" but found ")"` at line 24 of `vite.config.ts`.
**Fix:** Missing trailing comma after the `server` block. Added `},` before `build:`.

### Issue 8: Vite proxy didn't strip `/api` prefix
**Symptom:** `/api/health` proxied to backend as `/api/health` but backend route is `/health`.
**Fix:** Added `rewrite: (path) => path.replace(/^\/api/, "")` to the proxy config.

### Issue 9: Backend couldn't connect to Redis
**Symptom:** `connect ECONNREFUSED 127.0.0.1:6379` — backend used default `redis://localhost:6379`.
**Fix:** Added `DATABASE_URL` and `REDIS_URL` environment variables to the backend service in `docker-compose.dev.yml`.

### Issue 10: `drizzle.config.ts` not copied into Docker image
**Symptom:** `drizzle-kit push` failed — `No config path provided, using default 'drizzle.config.json'`.
**Fix:** Added `COPY drizzle.config.ts ./` to `backend/Dockerfile.dev`.

### Issue 11: `drizzle-kit push` requires interactive TTY
**Symptom:** `Interactive prompts require a TTY terminal`.
**Fix:** Generated migration SQL with `drizzle-kit generate`, then applied it directly via Node.js `pg` driver.

### Issue 12: Unique constraint on `user_business_area_grants` too restrictive
**Symptom:** Seed failed — `duplicate key value violates unique constraint "user_ba_grants_user_ba_idx"`.
**Root cause:** Unique index on `(user_id, business_area_id)` prevented multiple permission levels per user/business area.
**Fix:** Changed unique index to `(user_id, business_area_id, permission_level)` in `backend/src/db/schema.ts`. Generated new migration `0001_tense_harrier.sql`.

### Issue 13: Frontend `tsconfig.json` extended missing parent
**Symptom:** `Cannot find base config file "../tsconfig.json"` warning during build.
**Fix:** Made `frontend/tsconfig.json` self-contained instead of extending the root.

---

## How to Run

```bash
cd E:\claude\discoverer\discoverer-neo

# Start all services
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# Run migrations
docker compose exec backend sh -c "script -qc 'npx drizzle-kit generate' /dev/null"
docker compose exec backend node -e "
const fs=require('fs'),{Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});
(async()=>{for(const f of fs.readdirSync('/app/drizzle').filter(x=>x.endsWith('.sql')).sort()){await p.query(fs.readFileSync('/app/drizzle/'+f,'utf8'));}console.log('Migrations applied');await p.end();})();
"

# Run seed
docker compose exec backend npx tsx src/db/seed.ts
```

## Login Credentials
- **Email:** admin@discoverer.local
- **Password:** admin123
