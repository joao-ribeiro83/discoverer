# Install on Debian: Consulta Online and Discoverer Neo on one server

This guide installs three projects on one Debian server, in Docker:

| Project | Folder on the server | Containers | Public URL |
|---|---|---|---|
| graphql-oracle-server | `~/APPS/graphql-oracle-server` | `apollo-server` | none (internal only) |
| co_allianz (Consulta Online) | `~/APPS/co_allianz` | `nextjs-app`, `nginx-proxy` | `https://<host>/consulta-online/?id=…&amb=…` |
| discoverer-neo | `~/APPS/discoverer-neo` | `discoverer-neo-postgres`, `-redis`, `-backend`, `-frontend` | `https://<host>/discoverer-neo/login` |

`<host>` is one of the two names of the server:

- Test server: `SDOCApp01-Tst.cosec.pt`, `ssiidonline-test.cosec.pt`
- Prod server: `SDOCApp01-Prod.cosec.pt`, `SSIIDOnline-Prod.cosec.pt`

How the parts connect:

```
Browser ──HTTPS 443──▶ nginx-proxy  (the only container on host ports 80/443)
                        │  Docker network: consulta-network
                        ├── /consulta-online… ──▶ nextjs-app:3000 ──▶ apollo-server:4000 ──▶ Oracle
                        ├── /discoverer-neo/… ──▶ discoverer-neo-frontend:80 ──▶ backend ──▶ Oracle
                        └── anything else     ──▶ 301 to /consulta-online + same path and query
```

Old links such as `https://<host>/?id=…&amb=T` still work. `nginx-proxy` sends them on to
`/consulta-online/?id=…&amb=T`.

Do everything on the test server first. Then do the same on the prod server.

## 1. Order

**Install and start: from the inside out.**

1. The Docker network `consulta-network`.
2. `graphql-oracle-server` — Consulta Online needs it to check the `?id=` token.
3. `discoverer-neo`.
4. `co_allianz` — `nginx-proxy` comes last, so users only get in when everything behind it runs.

**Stop and remove: from the outside in.** This is the reverse order.

1. `nginx-proxy` — no new users get in.
2. `discoverer-neo`.
3. `nextjs-app` (the rest of `co_allianz`).
4. `apollo-server`.
5. The network `consulta-network` — only when no container uses it any more.

`nginx-proxy` also starts when Neo is missing. Then `/discoverer-neo/` gives `502`, and Consulta Online
works normally. So you can install, update or remove Neo at any time without touching the other two.

## 2. Prepare the server

Check Docker:

```bash
docker compose version
```

If this fails, install Docker Engine with the Compose plugin from the Docker apt repository:
<https://docs.docker.com/engine/install/debian/>. Do not use the old `docker-compose` Python tool.

Make the folder for the projects:

```bash
mkdir -p ~/APPS
```

Make the shared network. If it already exists, Docker says so. That is fine.

```bash
docker network create consulta-network
```

Free resources:

- Neo alone: about 2.5 GB RAM, 4 vCPU at peak (the limits in `docker-compose.prod.yml`), 20 GB disk to start.
- The build needs outbound HTTPS to `registry-1.docker.io` and `registry.npmjs.org`. With Neo thick mode it
  also needs `https://deb.debian.org` (the Instant Client zip is copied by hand, see step 3). If the server has no direct internet access, see step 10.

## 3. What to copy to the server

Git does not hold every file. Some files you copy by hand, from your workstation, to the server.

### graphql-oracle-server

| What | Why |
|---|---|
| The Git content | The code (`app/`, `dockerfile`, `docker-compose.yml`, `tnsnames.ora`, `sqlnet.ora`) |
| `instantclient-basic-linux.x64-23.9.0.25.07.zip` | The build copies it in. It is not in Git. |
| `instantclient-sdk-linux.x64-23.9.0.25.07.zip` | Same |
| `.env` | Database user and password. Not in Git. On test, use the test values (`.env.tst`), renamed to `.env`. |

### co_allianz

| What | Why |
|---|---|
| The Git content | The code, `nginx.conf`, `dockerfile`, `dockerfile.nginx`, `docker-entrypoint.sh`, `.env` (test values) |
| `cert/wildcard2026.pfx` | The HTTPS certificate. Not in Git. |
| `.env.production` | Prod server only. Not in Git. |
| The PFX password | Put it in `SSL_PFX_PASSWORD` in the env file on the server. Never commit it. |

Do not copy `node_modules`, `.next` or `public/webviewer` (135 MB). The build does not use them.

### discoverer-neo

The Git repository also holds the Oracle PDFs, so send only the `discoverer-neo` folder. Commit first:
`git archive` sends only committed files. On your workstation, in `E:\claude\discoverer`:

```bash
git archive --format=tar.gz -o discoverer-neo.tgz HEAD:discoverer-neo
```

```bash
scp discoverer-neo.tgz rootadmin@SDOCApp01-Tst.cosec.pt:~/APPS/
```

On the server:

```bash
mkdir -p ~/APPS/discoverer-neo && tar -xzf ~/APPS/discoverer-neo.tgz -C ~/APPS/discoverer-neo
```

Keep the folder name `discoverer-neo`. Compose uses it as the project name.

#### Oracle Instant Client (thick mode only)

With `ORACLE_THICK_MODE=true`, copy `instantclient-basic-linux.x64-19.31.0.0.0dbru.zip` to
`~/APPS/discoverer-neo/` (next to `package.json`). `git archive` does not send it. Keep exactly one
`instantclient-basic` zip there. Use 19c, not 23.x: 23.x cannot connect to databases older than 19c.

The build unzips it and gets `libaio1` from `https://deb.debian.org`, the same way graphql-oracle-server
does. These servers block plain HTTP, so the build uses HTTPS.

## 4. Install graphql-oracle-server

1. Check `tnsnames.ora`. `COSEC_DB` must point to the database of this environment (test or prod).
2. Check `.env`: `DB_USER`, `DB_PASSWORD`, `DB_CONNECTION_STRING=COSEC_DB`.
3. Build and start:

```bash
cd ~/APPS/graphql-oracle-server && docker compose up -d --build
```

4. Wait for `(healthy)`:

```bash
docker ps --filter name=apollo-server --format '{{.Names}} {{.Status}}'
```

## 5. Install Discoverer Neo

### 5.1 Create `.env`

```bash
cd ~/APPS/discoverer-neo && cp .env.example .env && chmod 600 .env
```

Make three secrets. Run this command three times and copy each result:

```bash
openssl rand -hex 32
```

Edit `.env` and set these values. Some lines start with `#` in the template (for example
`# CORS_ALLOWED_ORIGINS=…` and the three `# ORACLE_NLS_…` lines): remove the `#` so the value is read.

| Variable | Value |
|---|---|
| `POSTGRES_PASSWORD` | secret 1 |
| `JWT_SECRET` | secret 2 |
| `ENCRYPTION_KEY` | secret 3. **Keep a copy in a safe place.** Without it, stored data-source passwords cannot be read. |
| `CORS_ALLOWED_ORIGINS` | Test: `https://sdocapp01-tst.cosec.pt,https://ssiidonline-test.cosec.pt` <br> Prod: `https://sdocapp01-prod.cosec.pt,https://ssiidonline-prod.cosec.pt` |
| `ORACLE_THICK_MODE` | `true` if any source database is older than Oracle 12.1 (the Discoverer 4 estate is). Otherwise `false`. |
| `ORACLE_NLS_NUMERIC_CHARACTERS` | `,.` |
| `ORACLE_NLS_DATE_FORMAT` | `RR.MM.DD` |
| `ORACLE_NLS_DATE_LANGUAGE` | `PORTUGUESE` |

Rules for `CORS_ALLOWED_ORIGINS`:

- Write the host names in **lowercase**. The browser sends them in lowercase, and Neo compares them exactly.
- No path and no trailing slash.
- If a host is missing, login on that host fails. The backend log says `Origin "https://…" is not allowed`.

Do not set `TRUST_PROXY` in `.env`. `docker-compose.coexist.yml` sets it to `2`.

Leave `ROW_LEVEL_FAIL_MODE` at its default, `CLOSED`. A new install then refuses every query until you create
row-level policies or change the mode. See `docs/deployment/configuration.md`.

### 5.2 Build and start

```bash
cd ~/APPS/discoverer-neo && docker compose -f docker-compose.prod.yml -f docker-compose.coexist.yml up -d --build
```

Always use **both** `-f` files. With only `docker-compose.prod.yml`:

- The bundled `nginx` service tries to take ports 80 and 443 and fails.
- The frontend is built for `/`, not `/discoverer-neo/`.
- The frontend does not join `consulta-network`, so `nginx-proxy` gets a `502`.

Wait until all four containers are healthy:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.coexist.yml ps
```

You must see `postgres`, `redis`, `backend` and `frontend` with `(healthy)`, and no `nginx`. The backend
applies its database migrations by itself at start.

To save typing, you can add an alias. The rest of this guide writes the long form.

```bash
echo "alias neo='docker compose -f ~/APPS/discoverer-neo/docker-compose.prod.yml -f ~/APPS/discoverer-neo/docker-compose.coexist.yml'" >> ~/.bashrc
```

## 6. Install co_allianz (Consulta Online and nginx-proxy)

1. Put the certificate in `~/APPS/co_allianz/cert/wildcard2026.pfx`.
2. Set the env file:
   - Test server: `.env` already has the test host names. Fill in `SSL_PFX_PASSWORD`.
   - Prod server: use `.env.production`. Fill in `SSL_PFX_PASSWORD`.
3. Build and start.

   Test server:

   ```bash
   cd ~/APPS/co_allianz && docker compose up -d --build
   ```

   Prod server:

   ```bash
   cd ~/APPS/co_allianz && docker compose --env-file .env.production up -d --build
   ```

4. Check the nginx config and the path to Neo:

```bash
docker exec nginx-proxy nginx -t
```

```bash
docker exec nginx-proxy wget -qO- http://discoverer-neo-frontend/health
```

The second command must print `healthy`.

The nginx config is copied into the `nginx-proxy` image at build time. After any change to `nginx.conf`,
run step 3 again with `--build`. A plain restart keeps the old config.

## 7. First login to Neo

On first start Neo creates the user `admin@discoverer.local` with a one-time password. The password is in a
CSV file in the `credential_files` volume. Neo deletes the file after 24 hours.

```bash
cd ~/APPS/discoverer-neo && docker compose -f docker-compose.prod.yml -f docker-compose.coexist.yml exec backend sh -c 'cat /app/credentials/*.csv'
```

Open `https://<host>/discoverer-neo/login` and log in. Neo asks you to set a new password.

If the file is already gone: another admin can re-issue the password from the Users page. On a fresh
install with no other admin, remove Neo with its data (step 11) and install it again.

## 8. Check that it works

Run each check for both host names of the server.

| Check | Command | Expected |
|---|---|---|
| Neo login page | `curl -sI https://<host>/discoverer-neo/login` | `200` |
| Neo without slash | `curl -sI https://<host>/discoverer-neo` | `301` to `/discoverer-neo/` |
| Neo API | `curl -s https://<host>/discoverer-neo/api/health` | JSON with `"status":"ok"` |
| Neo assets | Open the login page, press F12, Network tab | No red lines. Files load from `/discoverer-neo/assets/…` |
| Consulta health | `curl -s https://<host>/consulta-online/api/health` | `200` |
| Consulta link | `curl -sI "https://<host>/consulta-online/?id=TEST&amb=T"` | `308` to `/consulta-online?id=TEST&amb=T` |
| Old link | `curl -sI "https://<host>/?id=TEST&amb=T"` | `301` to `/consulta-online/?id=TEST&amb=T` |
| Neo down does not break Consulta | `docker stop discoverer-neo-frontend`, open Consulta Online, then `docker start discoverer-neo-frontend` | Consulta Online keeps working. Neo gives `502` while stopped. |

Also open one real `?id=` link end to end, in a private browser window. Then open a document and check that
the PDF shows.

## 9. Update a server that already runs the old version

The servers already run `apollo-server`, `nextjs-app` and `nginx-proxy` at `/`. This change moves
Consulta Online to `/consulta-online` and adds Neo.

1. Back up co_allianz:

   ```bash
   cp -a ~/APPS/co_allianz ~/APPS/co_allianz.pre-subpath
   ```

2. Copy the changed co_allianz files to the server (list in step 12). `graphql-oracle-server` has no changes.
   Do not copy `.env` to the prod server: it has the test host names.
3. Install Neo: steps 3 (Neo part), 5 and 7. Nothing changes for users yet.
4. Rebuild co_allianz: step 6.3. Consulta Online is down for a few seconds while the containers restart.
5. Run the checks in step 8.
6. Tell the owners of the system that makes the `?id=` links about the new URL. The redirect covers the old
   URL until they switch.

**Rollback:** restore the backup and rebuild. Neo can stay running; no request reaches it.

```bash
mv ~/APPS/co_allianz ~/APPS/co_allianz.subpath && mv ~/APPS/co_allianz.pre-subpath ~/APPS/co_allianz
```

```bash
cd ~/APPS/co_allianz && docker compose up -d --build
```

On prod, add `--env-file .env.production` to the last command.

### Update Neo later

1. Commit, make a new `discoverer-neo.tgz` (step 3) and copy it to the server.
2. Unpack it over the old folder. `.env` is not in the archive, so it stays.
3. Back up Postgres first — see `docs/deployment/backup.md`.
4. Rebuild with the command in step 5.2. The data in the volumes stays. The backend runs new migrations at start.

A Neo update needs no change or restart in the other two projects.

## 10. Special cases

### Outbound traffic only through an HTTP proxy

Two settings are needed. Put in your real proxy address.

1. For builds (npm and the Oracle download), put this in `~/.docker/config.json`:

   ```json
   {
     "proxies": {
       "default": {
         "httpProxy": "http://proxy.example:8080",
         "httpsProxy": "http://proxy.example:8080",
         "noProxy": "localhost,127.0.0.1,postgres,redis,backend,frontend,discoverer-neo-frontend,nextjs-app,apollo-server"
       }
     }
   }
   ```

   Docker also gives these values to new containers. The `noProxy` list keeps the internal names direct.
   See <https://docs.docker.com/engine/cli/proxy/>.
2. For image pulls, set the proxy for the Docker daemon: <https://docs.docker.com/engine/daemon/proxy/>.

### No outbound internet at all

Build on a machine that has internet, then move the images. For Neo:

```bash
docker save discoverer-neo-backend discoverer-neo-frontend postgres:16-alpine redis:7-alpine | gzip > neo-images.tgz
```

On the server:

```bash
gunzip -c neo-images.tgz | docker load
```

Then run the start commands without `--build`. The same works for `apollo-server-img` and the two co_allianz
images.

## 11. Remove services

Use this order (see step 1). Each command stops the containers and removes them. The images stay.

1. Stop new users:

   ```bash
   cd ~/APPS/co_allianz && docker compose stop nginx
   ```

2. Discoverer Neo. Add `-v` only if you also want to **delete all Neo data** (database, exports, results):

   ```bash
   cd ~/APPS/discoverer-neo && docker compose -f docker-compose.prod.yml -f docker-compose.coexist.yml down
   ```

3. co_allianz (`nextjs-app` and the stopped `nginx-proxy`):

   ```bash
   cd ~/APPS/co_allianz && docker compose down
   ```

4. graphql-oracle-server:

   ```bash
   cd ~/APPS/graphql-oracle-server && docker compose down
   ```

5. The network. Docker refuses if a container still uses it, which tells you something is still running:

   ```bash
   docker network rm consulta-network
   ```

To remove only Neo, do step 2 alone. Consulta Online keeps working, and `/discoverer-neo/` gives `502` until
you remove that location from co_allianz's `nginx.conf`.

## 12. Files changed for the sub-path move

Copy these files to the server, to the same relative path. Everything else is unchanged.

### co_allianz (`~/APPS/co_allianz`)

```
next.config.ts
nginx.conf
src/middleware.ts
src/lib/request-origin.ts
src/lib/apollo-client.ts
src/app/api/logout/route.ts
src/app/documents/page.tsx
src/app/documents/PdfViewer.tsx
src/components/UserContext.tsx
src/components/ui/header.tsx
DEPLOYMENT.md
scripts/test_gzip.sh
scripts/run_curl_tests.ps1
```

The last three are documentation and test scripts. The app does not need them to run. They test the real
hosts only:

- `scripts/test_gzip.sh` — run it on the server: `sh scripts/test_gzip.sh ssiidonline-test.cosec.pt`
  (default host: `SDOCApp01-Tst.cosec.pt`).
- `scripts/run_curl_tests.ps1` — run it from a Windows PC in the network:
  `.\scripts\run_curl_tests.ps1 -TargetHost SDOCApp01-Prod.cosec.pt`. It reads `payload.json` from the
  `scripts` folder.

To pack them in one file before you commit, run this in `E:\VSCODE\co_allianz` (Git Bash):

```bash
git diff --name-only -z | tar --null -T - -czf co_allianz-subpath.tgz
```

On the server:

```bash
tar -xzf co_allianz-subpath.tgz -C ~/APPS/co_allianz
```

### graphql-oracle-server

No changes.

### discoverer-neo

A first install needs the whole folder (step 3). These are the files this change touched:

```
docker-compose.coexist.yml          (new)
frontend/Dockerfile
frontend/vite.config.ts
frontend/src/main.tsx
frontend/src/lib/api.ts
frontend/src/components/map-builder/ShareDialog.tsx
docs/deployment/debian-coexistence.md   (new, this guide)
docs/deployment/docker.md
```

## Troubleshooting

| What you see | Cause | Fix |
|---|---|---|
| `502 Bad Gateway` on `/discoverer-neo/` | The Neo frontend is not running, or is not on `consulta-network` | Step 5.2 with both `-f` files. Check with `docker network inspect consulta-network`. |
| Neo shows a blank page. Assets load from `/assets/…` and fail | The Neo frontend was built without the base path | Rebuild with both `-f` files. |
| Neo login fails. Backend log says `Origin "…" is not allowed` | Host missing from `CORS_ALLOWED_ORIGINS`, or written with capital letters | Fix `.env`, then run step 5.2 again (no `--build` needed). |
| All Neo users are blocked at login together after a few failed tries | The backend counts every request as coming from nginx | `TRUST_PROXY` must be `2`. Use both `-f` files. |
| Every `?id=` link ends on the logout page | `apollo-server` is down or cannot reach Oracle | `docker logs --tail 50 apollo-server`. Check `.env` and `tnsnames.ora`. |
| Consulta Online pages load without styles, or PDFs do not open | co_allianz was built from old files | Check the files in step 12, then step 6.3 with `--build`. |
| `nginx-proxy` does not start | Error in `nginx.conf`, or a bad PFX password | `docker logs nginx-proxy`. Roll back (step 9) if needed. |
| Neo backend stops at start with an Oracle client error | `ORACLE_THICK_MODE=true`, but the image was built without the Instant Client | Rebuild with `--build`. The build reads the same variable. |
| Neo upload or import fails with `413` | File larger than 20 MB | Raise `client_max_body_size` in the Neo location in co_allianz's `nginx.conf`, then step 6.3. |

Logs:

```bash
docker logs --tail 100 discoverer-neo-backend
```

```bash
docker logs --tail 100 nginx-proxy
```
