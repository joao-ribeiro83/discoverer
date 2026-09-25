# =============================================
# Discoverer Neo — Backend Dockerfile
# Multi-stage production build
# =============================================
# Build context is the REPO ROOT, not backend/ — this is an npm workspaces
# monorepo whose only lockfile is the root package-lock.json, and several
# backend runtime deps hoist into the root node_modules. Build with
# `docker compose build backend`, or by hand:
#   docker build -f backend/Dockerfile .
# =============================================

# ---- Base ----
FROM node:22-bookworm-slim AS base
WORKDIR /app

# ---- Oracle Instant Client Builder ----
# Opt-in. node-oracledb runs in thin mode by default and needs no client; the
# client is only required for EUL sources older than 12.1, which the thin
# driver cannot reach. ORACLE_THICK_MODE=true in .env turns it on (compose
# passes it as INSTALL_ORACLE_CLIENT), or by hand:
#   docker compose build --build-arg INSTALL_ORACLE_CLIENT=true backend
#
# Same recipe as graphql-oracle-server's dockerfile, which builds on the COSEC
# servers: the zip is supplied by hand in the project root (next to
# package.json, not in Git), and apt goes out over HTTPS because those servers
# block plain HTTP to deb.debian.org. The full bookworm image is used here
# only because it ships ca-certificates and unzip; the slim one has neither.
# Use the 19c basic zip: 19c reaches back to Oracle Database 11.2, 23ai only
# to 19c.
#
# libaio (the client's only OS dependency) is fetched here as a .deb, so the
# production stage installs it with dpkg and never runs apt itself.
FROM node:22-bookworm AS oracle-builder
ARG INSTALL_ORACLE_CLIENT=false
# package.json is listed only so this COPY still has a match when there is no
# zip (thin mode). Exactly one instantclient-basic zip may sit in the root.
COPY package.json instantclient-basic-linux.x64-*.zip /tmp/oracle/
RUN set -eu; \
  mkdir -p /opt/oracle/instantclient /opt/oracle/deb; \
  if [ "$INSTALL_ORACLE_CLIENT" != "true" ]; then \
    echo "INSTALL_ORACLE_CLIENT is not true — skipping (thin mode)."; \
  else \
    sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources; \
    apt-get update; \
    cd /opt/oracle/deb && apt-get download libaio1; \
    unzip -q /tmp/oracle/instantclient-basic-linux.x64-*.zip -d /tmp/ic; \
    mv /tmp/ic/instantclient_*/* /opt/oracle/instantclient/; \
    # Asserts the payload really landed: an earlier build swallowed a 404 and
    # shipped an empty directory.
    test -e /opt/oracle/instantclient/libclntsh.so; \
  fi; \
  rm -rf /tmp/oracle /tmp/ic /var/lib/apt/lists/*

# ---- Workspace manifests ----
# Every workspace manifest has to be present for npm to reconcile the root
# lockfile, even though only the backend's dependencies get installed.
FROM base AS manifests
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY migrate/package.json migrate/

# ---- Dependencies (with dev deps — needed to compile) ----
# The migrate workspace is installed alongside the backend: the backend depends
# on @discoverer-neo/core (the EUL migration pipeline), which npm links as a
# workspace symlink, so migrate's own runtime deps must be present too.
FROM manifests AS deps
RUN npm ci --workspace @discoverer-neo/backend --workspace @discoverer-neo/core --include-workspace-root

# ---- Dependencies (runtime only) ----
FROM manifests AS prod-deps
RUN npm ci --workspace @discoverer-neo/backend --workspace @discoverer-neo/core --omit=dev

# ---- Build ----
FROM base AS build
# The whole tree, not just node_modules: npm hoists most packages to the root
# but leaves version-conflicting ones under backend/node_modules, and Node
# resolves through both.
COPY --from=deps /app ./
COPY tsconfig.json ./
COPY migrate/tsconfig.json migrate/
COPY migrate/src migrate/src
COPY backend/tsconfig.json backend/
COPY backend/src backend/src
# migrate first: the backend imports it as a built package (dist/index.js +
# dist/index.d.ts), so the backend's own tsc would fail without it.
RUN npm run build --workspace @discoverer-neo/core \
  && npm run build --workspace @discoverer-neo/backend

# ---- Production ----
FROM base AS production
ENV NODE_ENV=production

# libaio is the Instant Client's only OS dependency. The oracle-builder stage
# leaves its .deb in /opt/oracle/deb in thick mode only (empty in thin mode),
# so this stage never runs apt and builds with no network.
COPY --from=oracle-builder /opt/oracle/deb /tmp/deb
RUN set -eu; \
  for deb in /tmp/deb/*.deb; do if [ -e "$deb" ]; then dpkg -i "$deb"; fi; done; \
  rm -rf /tmp/deb; \
  groupadd -r appuser; \
  useradd -r -g appuser -d /app -s /bin/bash appuser

# Empty unless INSTALL_ORACLE_CLIENT=true. Harmless: thin mode never reads it,
# and thick mode refuses to start rather than limping along (see server.ts).
COPY --from=oracle-builder /opt/oracle/instantclient /opt/oracle/instantclient

# Runtime dependency tree, then the compiled application on top of it. The
# workspace layout is preserved so Node resolves imports the same way it does
# outside the container.
COPY --from=prod-deps /app ./
COPY --from=build /app/backend/dist ./backend/dist
# The backend imports @discoverer-neo/core, which npm resolves through the
# workspace symlink at node_modules/@discoverer-neo/core -> /app/migrate.
COPY --from=build /app/migrate/dist ./migrate/dist
# The Drizzle migrations and their journal. `drizzle-kit migrate` reads these
# from `out: './drizzle'` at RUNTIME, not at build time, so the image needs the
# .sql files themselves — without them the documented upgrade step
# (`docker compose exec backend npm run db:migrate`, docs/deployment/docker.md)
# fails with "Can't find meta/_journal.json" and the schema silently stays
# behind the code.
COPY backend/drizzle ./backend/drizzle
COPY backend/drizzle.config.ts ./backend/drizzle.config.ts

# Generated export files land here; docker-compose mounts a named volume over
# it. Created (and owned) up front so the unprivileged appuser can write even
# when no volume is mounted.
RUN mkdir -p /app/exports && chown -R appuser:appuser /app/exports
ENV EXPORT_DIR=/app/exports

# Same rationale as /app/exports, for scheduled-run output files.
RUN mkdir -p /app/scheduled-results && chown -R appuser:appuser /app/scheduled-results
ENV SCHEDULE_RESULT_DIR=/app/scheduled-results

# Same rationale again, for provisioned-credential files (see
# credential-file.service.ts). Without an explicit CREDENTIALS_DIR this
# defaults to a path under WORKDIR (/app/backend), which the rest of this
# stage never chowns to appuser — the startup seed's mkdir failed with EACCES
# and crashed the process after already creating the admin user, losing its
# only copy of the generated password.
RUN mkdir -p /app/credentials && chown -R appuser:appuser /app/credentials
ENV CREDENTIALS_DIR=/app/credentials

# Set library path for Oracle client
ENV LD_LIBRARY_PATH=/opt/oracle/instantclient
ENV PATH=/opt/oracle/instantclient:$PATH

USER appuser
WORKDIR /app/backend
EXPOSE 3000

# start-period covers cold start (Oracle client verification + plugin
# registration); the endpoint itself checks DB/Redis/Oracle so a healthy
# response really means the app can serve traffic, not just that Node is up.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# The entrypoint is server.ts -> dist/server.js. This previously pointed at
# dist/index.js, which the build has never produced.
CMD ["node", "dist/server.js"]
