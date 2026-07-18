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
# driver cannot reach. Build those images with:
#   docker compose build --build-arg INSTALL_ORACLE_CLIENT=true backend
#
# Unpacked to an unversioned directory so the version appears exactly once (in
# ORACLE_CLIENT_URL) instead of being restated in ENV, compose, and .env — that
# duplication is why ORACLE_CLIENT_PATH drifted to a directory that never
# existed. Bumping the client is now a one-line URL change.
FROM base AS oracle-builder
ARG INSTALL_ORACLE_CLIENT=false
# 19c reaches back to Oracle Database 11.2; 23ai only supports 19c and later.
ARG ORACLE_CLIENT_URL="https://download.oracle.com/otn_software/linux/instantclient/1931000/instantclient-basic-linux.x64-19.31.0.0.0dbru.zip"
RUN set -eu; \
  mkdir -p /opt/oracle/instantclient; \
  if [ "$INSTALL_ORACLE_CLIENT" != "true" ]; then \
    echo "INSTALL_ORACLE_CLIENT is not true — skipping (thin mode)."; \
  else \
    apt-get update; \
    apt-get install -y --no-install-recommends curl unzip ca-certificates; \
    curl -fsSL -o /tmp/ic.zip "$ORACLE_CLIENT_URL"; \
    unzip -q /tmp/ic.zip -d /tmp/ic; \
    mv /tmp/ic/instantclient_*/* /opt/oracle/instantclient/; \
    # No `|| echo` anywhere above, and this asserts the payload really landed:
    # the previous build swallowed a 404 and shipped an empty directory.
    test -e /opt/oracle/instantclient/libclntsh.so; \
    rm -rf /tmp/ic /tmp/ic.zip /var/lib/apt/lists/*; \
  fi

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
# on @discoverer-neo/migrate (the EUL migration pipeline), which npm links as a
# workspace symlink, so migrate's own runtime deps must be present too.
FROM manifests AS deps
RUN npm ci --workspace @discoverer-neo/backend --workspace @discoverer-neo/migrate --include-workspace-root

# ---- Dependencies (runtime only) ----
FROM manifests AS prod-deps
RUN npm ci --workspace @discoverer-neo/backend --workspace @discoverer-neo/migrate --omit=dev

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
RUN npm run build --workspace @discoverer-neo/migrate \
  && npm run build --workspace @discoverer-neo/backend

# ---- Production ----
FROM base AS production
ENV NODE_ENV=production

# libaio is the Instant Client's only OS dependency. Installed unconditionally
# so one image definition serves both modes; it is a few hundred KB and unused
# in thin mode.
RUN apt-get update \
  && apt-get install -y --no-install-recommends libaio1 \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r appuser \
  && useradd -r -g appuser -d /app -s /bin/bash appuser

# Empty unless INSTALL_ORACLE_CLIENT=true. Harmless: thin mode never reads it,
# and thick mode refuses to start rather than limping along (see server.ts).
COPY --from=oracle-builder /opt/oracle/instantclient /opt/oracle/instantclient

# Runtime dependency tree, then the compiled application on top of it. The
# workspace layout is preserved so Node resolves imports the same way it does
# outside the container.
COPY --from=prod-deps /app ./
COPY --from=build /app/backend/dist ./backend/dist
# The backend imports @discoverer-neo/migrate, which npm resolves through the
# workspace symlink at node_modules/@discoverer-neo/migrate -> /app/migrate.
COPY --from=build /app/migrate/dist ./migrate/dist

# Generated export files land here; docker-compose mounts a named volume over
# it. Created (and owned) up front so the unprivileged appuser can write even
# when no volume is mounted.
RUN mkdir -p /app/exports && chown -R appuser:appuser /app/exports
ENV EXPORT_DIR=/app/exports

# Same rationale as /app/exports, for scheduled-run output files.
RUN mkdir -p /app/scheduled-results && chown -R appuser:appuser /app/scheduled-results
ENV SCHEDULE_RESULT_DIR=/app/scheduled-results

# Set library path for Oracle client
ENV LD_LIBRARY_PATH=/opt/oracle/instantclient
ENV PATH=/opt/oracle/instantclient:$PATH

USER appuser
WORKDIR /app/backend
EXPOSE 3000

# The entrypoint is server.ts -> dist/server.js. This previously pointed at
# dist/index.js, which the build has never produced.
CMD ["node", "dist/server.js"]
