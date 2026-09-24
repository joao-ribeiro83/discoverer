# Plan: Consulta Online and Discoverer Neo on one host, under sub-paths

Date: 2026-09-23. Status: **Parts A and B done 2026-09-24** (approved). One deviation: the B2 redirects go
through a new `appUrl(request, path)` helper in `src/lib/request-origin.ts` instead of five hand-written
`new URL(...)` calls. Install steps and the changed-file list: `docs/deployment/debian-coexistence.md`.

## Goal

| URL | Goes to |
|---|---|
| `https://<host>/consulta-online/?id=…&amb=…` | co_allianz (Next.js) |
| `https://<host>/discoverer-neo/login` | Discoverer Neo |
| `https://<host>/?id=…&amb=…` (old links) | 301 → `/consulta-online/?id=…&amb=…` |

`<host>` is one of the two names on each server:

- Test server: `SDOCApp01-Tst.cosec.pt`, `ssiidonline-test.cosec.pt`
- Prod server: `SDOCApp01-Prod.cosec.pt`, `SSIIDOnline-Prod.cosec.pt`

## Target layout

```
Internet ──443──▶ nginx-proxy (co_allianz container; only thing on host 80/443)
                   │   network: consulta-network (external, already exists)
                   ├── /consulta-online…  ──▶ nextjs-app:3000 ──▶ apollo-server:4000
                   └── /discoverer-neo/…  ──▶ discoverer-neo-frontend:80   (prefix stripped)
                                                 │  network: discoverer-neo_default
                                                 ├── /api/ ──▶ backend:3000
                                                 └── SPA files
                                              postgres, redis (no host ports)
```

Decisions:

1. **One NGINX.** co_allianz's `nginx-proxy` keeps 80/443 and the wildcard certificate. Neo's bundled
   `nginx` service does not start (it would fight for 80/443).
2. **Docker network, not a host port.** Only `discoverer-neo-frontend` joins `consulta-network`.
   Neo publishes no host port at all.
3. **nginx-proxy must start even when Neo is down.** The Neo location uses Docker's resolver
   (`127.0.0.11`) and a variable upstream. A plain `proxy_pass http://discoverer-neo-frontend` makes
   nginx refuse to start if that container does not exist — that would take Consulta Online down too.
4. **Old links keep working.** Everything outside the two prefixes gets a 301 into `/consulta-online`.
   The system that issues the `?id=` links can switch to the new URL later, at its own pace.
5. **Neo strips the prefix at nginx-proxy.** Neo's own `frontend/nginx.conf` then stays unchanged.

## Part A — Discoverer Neo (this repo)

| # | File | Change |
|---|---|---|
| A1 | `frontend/vite.config.ts:13` | Add `base: process.env.VITE_BASE_PATH \|\| '/'`. |
| A2 | `frontend/Dockerfile`, just before `RUN npm run build --workspace @discoverer-neo/frontend` | `ARG VITE_BASE_PATH=/` and `ENV VITE_BASE_PATH=$VITE_BASE_PATH`. |
| A3 | `frontend/src/main.tsx:41` | `<BrowserRouter basename={import.meta.env.BASE_URL}>`. Check that React Router 7 accepts the trailing slash; if not, strip it. |
| A4 | `frontend/src/lib/api.ts:124` | Default `` `${import.meta.env.BASE_URL}api` `` instead of `'/api'`. |
| A5 | `frontend/src/lib/api.ts:192` | `window.location.href = import.meta.env.BASE_URL + 'login'`. |
| A6 | `frontend/src/components/map-builder/ShareDialog.tsx:115` | `` `${window.location.origin}${import.meta.env.BASE_URL}maps/${mapId}/view` ``. |
| A7 | new `docker-compose.coexist.yml` | Overlay for `docker-compose.prod.yml` (below). |
| A8 | `docs/deployment/docker.md` | One line linking to `debian-coexistence.md`. |

A7 content:

```yaml
# Overlay: run Neo behind co_allianz's nginx-proxy at /discoverer-neo/.
# docker compose -f docker-compose.prod.yml -f docker-compose.coexist.yml up -d --build
services:
  frontend:
    build:
      args:
        VITE_BASE_PATH: /discoverer-neo/
    networks: [default, consulta-network]
  backend:
    environment:
      # nginx-proxy -> frontend nginx -> backend: two hops.
      TRUST_PROXY: 2
  nginx:
    profiles: [bundled-nginx]   # never starts unless asked for; nginx-proxy owns 80/443
networks:
  consulta-network:
    external: true
```

Nothing changes in the backend code. `CORS_ALLOWED_ORIGINS` is set in `.env` (see the manual).

Checks for Part A:

- `npm test -w @discoverer-neo/frontend` passes (base stays `/` in tests, so `api-errors.test.ts` is unchanged).
- `VITE_BASE_PATH=/discoverer-neo/ npm run build -w @discoverer-neo/frontend`, then
  `dist/index.html` references `/discoverer-neo/assets/…`.
- Local dev (`base` = `/`) still works at `http://localhost:5173/login`.

## Part B — co_allianz (NEEDS YOUR APPROVAL — nothing edited yet)

### B0. Pre-check

`src/app/api/pdf-proxy/route.ts:2` imports `fetchWithRetry`, but `src/lib/fetch-with-retry.ts` only
exports `fetchBufferWithRetry`. Run `npm run build` in co_allianz first. If it fails, that must be fixed
before B can ship. It is not caused by this plan.

### B1. `next.config.ts` — one source for the prefix

```ts
const basePath = '/consulta-online';

const nextConfig: NextConfig = {
	basePath,
	env: { NEXT_PUBLIC_BASE_PATH: basePath },
	output: 'standalone',
	// …rest unchanged
```

`basePath` makes Next prefix `_next/*`, `public/*`, `<Link>`, `router.push`, `redirect()` and the
middleware matcher. It does **not** prefix `fetch('/…')`, `<a href>`, or `new URL('/…', origin)`.
Those are B2–B4. Below, `BASE` means `process.env.NEXT_PUBLIC_BASE_PATH`.

### B2. Redirects built with `new URL('/…', origin)`

| File:line | Now | New |
|---|---|---|
| `src/middleware.ts:32` | `new URL('/', origin)` | `` new URL(`${BASE}`, origin) `` |
| `src/middleware.ts:43` | `new URL('/logout', origin)` | `` new URL(`${BASE}/logout`, origin) `` |
| `src/middleware.ts:47` | `new URL('/logout', origin)` | `` new URL(`${BASE}/logout`, origin) `` |
| `src/middleware.ts:56` | `new URL('/api/logout', origin)` | `` new URL(`${BASE}/api/logout`, origin) `` |
| `src/app/api/logout/route.ts:6` | `new URL('/logout', …)` | `` new URL(`${BASE}/logout`, …) `` |

`pathname` checks in the middleware (`startsWith('/api')`, `publicRoutes`) stay as they are:
`request.nextUrl.pathname` has the base path removed.

### B3. Browser and server fetches

| File:line | Now | New |
|---|---|---|
| `src/lib/apollo-client.ts:11` | `` `${NEXT_PUBLIC_SITE_URL}/api/graphql` `` | `` `${NEXT_PUBLIC_SITE_URL}${BASE}/api/graphql` `` |
| `src/lib/apollo-client.ts:12` | `"http://localhost:3000/api/graphql"` | `` `http://localhost:3000${BASE}/api/graphql` `` |
| `src/lib/apollo-client.ts:13` | `"/api/graphql"` | `` `${BASE}/api/graphql` `` |
| `src/components/UserContext.tsx:39` | `fetch('/api/user')` | `` fetch(`${BASE}/api/user`) `` |
| `src/app/documents/page.tsx:658, 744, 890` | `fetch('/api/…')` | `` fetch(`${BASE}/api/…`) `` |
| `src/components/ui/header.tsx:79` | `<a href="/api/logout">` | `` <a href={`${BASE}/api/logout`}> `` |
| `src/app/documents/PdfViewer.tsx:20` | `` `/pdf.worker.min.${…}.mjs` `` | `` `${BASE}/pdf.worker.min.${…}.mjs` `` |

B3 row 1 matters most: without it, token validation in the middleware calls the wrong URL and every
`?id=` login fails.

### B4. `nginx.conf` — the HTTPS server block (lines 62–120 replaced)

Everything above `location /api/graphql` (certificates, headers) stays the same.

```nginx
    # Consulta Online GraphQL: long, unbuffered (unchanged apart from the prefix).
    location ^~ /consulta-online/api/graphql {
        # …same body as today's `location /api/graphql`…
    }

    # Consulta Online. No trailing slash on the prefix: Next answers
    # /consulta-online/ with a 308 to /consulta-online, and that must land here too.
    location ^~ /consulta-online {
        # …same body as today's `location /`…

        location ^~ /consulta-online/_next/static/ {
            # …same body as today's `location /_next/static/`…
        }
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
            # …same body as today's static-file regex location…
        }
    }

    # Discoverer Neo. The variable + resolver lets nginx start (and serve
    # Consulta Online) even when the Neo container is not running.
    location = /discoverer-neo { return 301 /discoverer-neo/; }
    location ^~ /discoverer-neo/ {
        resolver 127.0.0.11 valid=30s ipv6=off;
        set $neo_upstream http://discoverer-neo-frontend:80;
        rewrite ^/discoverer-neo/(.*)$ /$1 break;
        proxy_pass $neo_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        client_max_body_size 20m;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 1860s;   # Neo's own ceiling for a long map run
    }

    # Old links: /?id=…&amb=… and anything else -> the same path under /consulta-online.
    location / {
        return 301 /consulta-online$request_uri;
    }
```

Why the static regex moves inside: a regex location beats a plain prefix. Left at server level it would
send `/discoverer-neo/assets/*.js` to Next.js. `^~` on both prefixes also stops it.

### B5. Docs and scripts (optional, cosmetic)

- `DEPLOYMENT.md:87, 173` — health URL becomes `/consulta-online/api/health`.
- `scripts/test_gzip.sh`, `scripts/run_curl_tests.ps1` — add `/consulta-online` to the URLs.

### Not changed

- Cookie `username` keeps `path: '/'`. Neo uses no cookies, so nothing collides.
- `graphql-oracle-server` — no change. It has no path assumptions.

## Part C — Rollout (per server; test first, then prod)

1. Back up: `cp -a ~/APPS/co_allianz ~/APPS/co_allianz.pre-subpath`.
2. Install Neo (manual: `docs/deployment/debian-coexistence.md`, steps 1–6). Neo is not reachable yet — that is fine.
3. Apply Part B in co_allianz. Rebuild both images: `docker compose up -d --build` (the nginx config is
   baked into the `nginx-proxy` image, so a plain restart does not pick it up).
4. Run the checks in the manual, step 7.
5. Tell the owners of the `?id=` link issuer about the new URL. The 301 covers them until they switch.

Rollback: restore `co_allianz.pre-subpath`, `docker compose up -d --build` in it. Neo can stay running;
nothing reaches it once the location is gone.

## Found on the way (not in scope — tell me if you want any of these)

1. **`amb` is never read** in co_allianz. The PDF routes always call environment `P`
   (`src/app/api/view-pdf/route.ts:12`, `download-pdf/route.ts:12`, `batch-download/route.ts:66`).
   The test server may be reading production PDFs.
2. **`apollo-server` publishes host port 4000**, plain HTTP, CORS `*`. Nothing needs it on the host —
   Next reaches it over Docker DNS. Consider removing `ports: "4000:4000"`, or firewall it.
3. **Neo's bundled `nginx/nginx-ssl.conf:115`** has `proxy_pass http://backend_app/;`. The trailing slash
   strips `/api`, so every API call through it 404s. Unused in this layout; a one-character fix.
4. **Same origin means shared browser storage.** Both apps share `localStorage` on each host. The keys do
   not collide, but a script bug (XSS) in one app could read the other's data, including Neo's login token.
   Consulta Online's logout page also runs `sessionStorage.clear()`, which logs out a Neo session opened
   *in the same tab* without "remember me". A separate host name (for example `discoverer-tst.cosec.pt`,
   covered by the wildcard certificate) would remove both issues, but needs a DNS entry.
