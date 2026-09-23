# Install on Debian next to Consulta Online

This guide installs Discoverer Neo on a Debian server that already runs Consulta Online (co_allianz).
Consulta Online's `nginx-proxy` container owns ports 80 and 443 and the HTTPS certificate. Neo publishes
no port of its own. `nginx-proxy` sends `/discoverer-neo/…` to Neo over the Docker network
`consulta-network`.

| Server | Neo login URLs |
|---|---|
| Test | `https://SDOCApp01-Tst.cosec.pt/discoverer-neo/login`, `https://ssiidonline-test.cosec.pt/discoverer-neo/login` |
| Prod | `https://SDOCApp01-Prod.cosec.pt/discoverer-neo/login`, `https://SSIIDOnline-Prod.cosec.pt/discoverer-neo/login` |

Do every step on each server. Do the test server first.

> This guide assumes the code changes in `docs/superpowers/plans/2026-09-23-coexist-subpath.md` are done:
> Part A (Neo, `docker-compose.coexist.yml`) and Part B (co_allianz `nginx.conf` and `basePath`).

## 1. Check the server

Run these on the server:

```bash
docker compose version
```

```bash
docker network inspect consulta-network --format '{{.Name}}'
```

```bash
docker ps --format '{{.Names}}\t{{.Ports}}'
```

You must see:

- A Compose version (v2). If the command fails, install Docker from the Docker apt repository:
  <https://docs.docker.com/engine/install/debian/>. Use the `docker-compose-plugin` package, not the old
  `docker-compose` Python tool.
- `consulta-network`. If it is missing, Consulta Online is not installed yet. Install it first.
- `nginx-proxy` on `0.0.0.0:80` and `0.0.0.0:443`. Nothing else may use these ports.

Free resources Neo needs (from the limits in `docker-compose.prod.yml`): about 2.5 GB RAM, 4 vCPU at peak,
and disk for the Postgres volume, exports and scheduled results. Start with 20 GB free.

The build needs outbound HTTPS to `registry-1.docker.io`, `registry.npmjs.org` and — in thick mode —
`download.oracle.com`. If the server can only go out through an HTTP proxy, see step 9.

## 2. Copy the code to the server

The Git repository also holds the Oracle PDFs. Send only the `discoverer-neo` folder. On your
workstation, in `E:\claude\discoverer`:

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

`git archive` sends only committed files. Commit your changes first.

Keep the folder name `discoverer-neo`. Compose uses it as the project name, so the volumes are called
`discoverer-neo_postgres_data` and so on.

## 3. Create `.env`

```bash
cd ~/APPS/discoverer-neo && cp .env.example .env && chmod 600 .env
```

Make three secrets. Run this command three times and copy each result:

```bash
openssl rand -hex 32
```

Edit `.env` and set these values:

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
- If one server runs both test and prod names, list all four.
- If a host is missing, login on that host fails. The backend log says `Origin "https://…" is not allowed`.

Do not set `TRUST_PROXY` in `.env`. `docker-compose.coexist.yml` sets it to `2`.

Leave `ROW_LEVEL_FAIL_MODE` at its default, `CLOSED`. A new install then refuses every query until you create
row-level policies or change the mode. See `docs/deployment/configuration.md`.

## 4. Build and start Neo

```bash
cd ~/APPS/discoverer-neo && docker compose -f docker-compose.prod.yml -f docker-compose.coexist.yml up -d --build
```

Always use **both** `-f` files. With only `docker-compose.prod.yml`:

- The bundled `nginx` service tries to take ports 80 and 443 and fails.
- The frontend is built for `/`, not `/discoverer-neo/`.
- The frontend does not join `consulta-network`, so `nginx-proxy` gets a 502.

Wait until all four containers are healthy:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.coexist.yml ps
```

You must see `postgres`, `redis`, `backend` and `frontend` with `(healthy)`, and no `nginx`. The backend
applies its database migrations by itself at start.

To save typing, you can add an alias:

```bash
echo "alias neo='docker compose -f ~/APPS/discoverer-neo/docker-compose.prod.yml -f ~/APPS/discoverer-neo/docker-compose.coexist.yml'" >> ~/.bashrc
```

The rest of this guide writes the long form.

## 5. Connect nginx-proxy

Do this only after Part B of the plan is applied to `~/APPS/co_allianz`.

The nginx config is copied into the `nginx-proxy` image when the image is built. A restart does not pick up
a changed `nginx.conf`. Rebuild:

```bash
cd ~/APPS/co_allianz && docker compose up -d --build
```

Check that nginx accepts the config:

```bash
docker exec nginx-proxy nginx -t
```

Check that `nginx-proxy` can find Neo:

```bash
docker exec nginx-proxy wget -qO- http://discoverer-neo-frontend/health
```

You must see `healthy`.

## 6. First login

On first start Neo creates the user `admin@discoverer.local` with a one-time password. The password is in a
CSV file in the `credential_files` volume. Neo deletes the file after 24 hours.

```bash
cd ~/APPS/discoverer-neo && docker compose -f docker-compose.prod.yml -f docker-compose.coexist.yml exec backend sh -c 'cat /app/credentials/*.csv'
```

Open `https://<host>/discoverer-neo/login` and log in. Neo asks you to set a new password.

If the file is already gone: another admin can re-issue the password from the Users page. On a fresh
install with no other admin, remove the volumes and start again (step 10).

## 7. Check that it works

Replace `<host>` with each host name of this server. Run each check for both names.

| Check | Command | Expected |
|---|---|---|
| Neo login page | `curl -sI https://<host>/discoverer-neo/login` | `200` |
| Neo without slash | `curl -sI https://<host>/discoverer-neo` | `301` to `/discoverer-neo/` |
| Neo API | `curl -s https://<host>/discoverer-neo/api/health` | JSON with status ok |
| Neo assets | open the login page, press F12, Network tab | No red lines. Files load from `/discoverer-neo/assets/…` |
| Consulta Online | `curl -sI "https://<host>/consulta-online/?id=TEST&amb=T"` | `308` or `307`, not `404` |
| Old link | `curl -sI "https://<host>/?id=TEST&amb=T"` | `301` to `/consulta-online/?id=TEST&amb=T` |
| Neo down does not break Consulta | `docker stop discoverer-neo-frontend`, then open Consulta Online, then `docker start discoverer-neo-frontend` | Consulta Online keeps working. Neo gives `502` while stopped. |

Also test one real `?id=` link end to end, in a private browser window.

## 8. Update Neo later

1. Make a new `discoverer-neo.tgz` (step 2) and copy it to the server.
2. Unpack it over the old folder. `.env` is not in the archive, so it stays.
3. Rebuild:

```bash
cd ~/APPS/discoverer-neo && docker compose -f docker-compose.prod.yml -f docker-compose.coexist.yml up -d --build
```

The data in the volumes stays. The backend runs new migrations at start. Back up Postgres first — see
`docs/deployment/backup.md`.

A Neo update does not need a change or restart in co_allianz.

## 9. Special cases

### Outbound traffic only through an HTTP proxy

Two settings are needed. Put in your real proxy address.

1. For the build (npm and the Oracle download), put this in `~/.docker/config.json`:

   ```json
   {
     "proxies": {
       "default": {
         "httpProxy": "http://proxy.example:8080",
         "httpsProxy": "http://proxy.example:8080",
         "noProxy": "localhost,127.0.0.1,postgres,redis,backend,frontend,discoverer-neo-frontend"
       }
     }
   }
   ```

   Docker also gives these values to new containers. The `noProxy` list keeps the internal names direct.
   See <https://docs.docker.com/engine/cli/proxy/>.
2. For image pulls, set the proxy for the Docker daemon: <https://docs.docker.com/engine/daemon/proxy/>.

### No outbound internet at all

Build on a machine that has internet, then move the images:

```bash
docker save discoverer-neo-backend discoverer-neo-frontend postgres:16-alpine redis:7-alpine | gzip > neo-images.tgz
```

On the server:

```bash
gunzip -c neo-images.tgz | docker load
```

Then run step 4 without `--build`.

## 10. Remove Neo

This deletes all Neo data.

```bash
cd ~/APPS/discoverer-neo && docker compose -f docker-compose.prod.yml -f docker-compose.coexist.yml down -v
```

Consulta Online keeps working. `/discoverer-neo/` answers `502` until you remove that location from
co_allianz's `nginx.conf`.

## Troubleshooting

| What you see | Cause | Fix |
|---|---|---|
| `502 Bad Gateway` on `/discoverer-neo/` | The frontend is not running, or is not on `consulta-network` | Step 4 with both `-f` files. Check with `docker network inspect consulta-network`. |
| Blank page. Assets load from `/assets/…` and fail | The frontend was built without the base path | Rebuild with both `-f` files. |
| Login fails, backend log says `Origin "…" is not allowed` | Host missing from `CORS_ALLOWED_ORIGINS`, or written with capital letters | Fix `.env`, then `up -d` (no build needed). |
| All users are blocked at login together after a few failed tries | The backend counts every request as coming from nginx | `TRUST_PROXY` must be `2`. Use both `-f` files. |
| `nginx-proxy` does not start after the change | Error in `nginx.conf` | `docker logs nginx-proxy`. Restore `co_allianz.pre-subpath` if needed. |
| Backend stops at start with an Oracle client error | `ORACLE_THICK_MODE=true`, but the image was built without the Instant Client | Rebuild with `--build`. The build reads the same variable. |
| Upload or import fails with `413` | File larger than 20 MB | Raise `client_max_body_size` in the Neo location in co_allianz's `nginx.conf`. |

Backend logs:

```bash
docker logs --tail 100 discoverer-neo-backend
```
