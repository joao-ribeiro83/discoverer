# =============================================
# Discoverer Neo — Migration Dockerfile
# For running EUL imports from Oracle Discoverer
# =============================================

# ---- Base ----
FROM node:22-bookworm-slim AS base
WORKDIR /app

# ---- Oracle Instant Client Builder ----
# Opt-in; see backend/Dockerfile for the rationale. This stage previously had no
# `|| echo` fallback, so the dead download made the whole image unbuildable —
# masked only by `migrate` not being a service in docker-compose.yml.
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

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ---- Build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig*.json ./
COPY src ./src
RUN npx tsc --noEmit false -p tsconfig.json

# ---- Production ----
FROM base AS production
ENV NODE_ENV=production

# Install runtime dependencies for Oracle Instant Client
RUN apt-get update \
  && apt-get install -y --no-install-recommends libaio1 \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r migrateuser \
  && useradd -r -g migrateuser -d /app -s /bin/bash migrateuser

# Empty unless INSTALL_ORACLE_CLIENT=true.
COPY --from=oracle-builder /opt/oracle/instantclient /opt/oracle/instantclient

# Copy built application
COPY --from=build /app/dist ./dist

# Set library path for Oracle client
ENV LD_LIBRARY_PATH=/opt/oracle/instantclient
ENV PATH=/opt/oracle/instantclient:$PATH

USER migrateuser

ENTRYPOINT ["node", "dist/index.js"]
