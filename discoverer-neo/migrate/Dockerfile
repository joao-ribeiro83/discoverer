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
# Opt-in; see backend/Dockerfile for the full rationale. This stage
# previously had no `|| echo` fallback and a dead download URL, so the whole
# image was unbuildable with INSTALL_ORACLE_CLIENT=true — masked only by
# migrate not being a compose service, so nothing ever built it.
FROM base AS oracle-builder
ARG INSTALL_ORACLE_CLIENT=false
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
    test -e /opt/oracle/instantclient/libclntsh.so; \
    rm -rf /tmp/ic /tmp/ic.zip /var/lib/apt/lists/*; \
  fi

# ---- Workspace manifests ----
FROM base AS manifests
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY migrate/package.json migrate/

# ---- Dependencies (with dev deps — needed to compile) ----
FROM manifests AS deps
RUN npm ci --workspace @discoverer-neo/migrate --include-workspace-root

# ---- Dependencies (runtime only) ----
FROM manifests AS prod-deps
RUN npm ci --workspace @discoverer-neo/migrate --omit=dev

# ---- Build ----
FROM base AS build
COPY --from=deps /app ./
COPY tsconfig.json ./
COPY migrate/tsconfig.json migrate/
COPY migrate/src migrate/src
RUN npm run build --workspace @discoverer-neo/migrate

# ---- Production ----
FROM base AS production
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends libaio1 \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r migrateuser \
  && useradd -r -g migrateuser -d /app -s /bin/bash migrateuser

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
