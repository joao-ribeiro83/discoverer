# =============================================
# Discoverer Neo — Migration CLI Dockerfile
# For running EUL imports from Oracle Discoverer (`dn-migrate`)
# =============================================
# Build context is the REPO ROOT, not migrate/ — same npm-workspaces
# constraint as backend/Dockerfile and frontend/Dockerfile (the only
# lockfile is the root package-lock.json). Build with:
#   docker build -f migrate/Dockerfile -t discoverer-neo-migrate .
# Not a docker-compose service (it's a one-shot CLI, invoked ad hoc against
# an Oracle source + the backend's Postgres target — see backend's
# services/migration.service.ts for the in-app equivalent), so it has no
# entry in docker-compose.yml.
# =============================================

# ---- Base ----
FROM node:22-bookworm-slim AS base
WORKDIR /app

# ---- Oracle Instant Client Builder ----
# Opt-in; see backend/Dockerfile for the full rationale.
FROM node:22-bookworm AS oracle-builder
ARG INSTALL_ORACLE_CLIENT=false
# Zip in the project root, apt over HTTPS, libaio as a .deb for dpkg.
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
    test -e /opt/oracle/instantclient/libclntsh.so; \
  fi; \
  rm -rf /tmp/oracle /tmp/ic /var/lib/apt/lists/*

# ---- Workspace manifests ----
FROM base AS manifests
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY migrate/package.json migrate/

# ---- Dependencies (with dev deps — needed to compile) ----
FROM manifests AS deps
RUN npm ci --workspace @discoverer-neo/core --include-workspace-root

# ---- Dependencies (runtime only) ----
FROM manifests AS prod-deps
RUN npm ci --workspace @discoverer-neo/core --omit=dev

# ---- Build ----
FROM base AS build
COPY --from=deps /app ./
COPY tsconfig.json ./
COPY migrate/tsconfig.json migrate/
COPY migrate/src migrate/src
RUN npm run build --workspace @discoverer-neo/core

# ---- Production ----
FROM base AS production
ENV NODE_ENV=production

# libaio arrives as a .deb from oracle-builder (thick mode only): no apt here.
COPY --from=oracle-builder /opt/oracle/deb /tmp/deb
RUN set -eu; \
  for deb in /tmp/deb/*.deb; do if [ -e "$deb" ]; then dpkg -i "$deb"; fi; done; \
  rm -rf /tmp/deb; \
  groupadd -r migrateuser; \
  useradd -r -g migrateuser -d /app -s /bin/bash migrateuser

# Empty unless INSTALL_ORACLE_CLIENT=true.
COPY --from=oracle-builder /opt/oracle/instantclient /opt/oracle/instantclient

COPY --from=prod-deps /app ./
COPY --from=build /app/migrate/dist ./migrate/dist

ENV LD_LIBRARY_PATH=/opt/oracle/instantclient
ENV PATH=/opt/oracle/instantclient:$PATH

USER migrateuser
WORKDIR /app/migrate

# dist/bin.js is the CLI executable (package.json's "bin" entry); dist/index.js
# is a library export with no CLI parsing — the previous ENTRYPOINT pointed at
# it and would have run nothing useful.
ENTRYPOINT ["node", "dist/bin.js"]
