# =============================================
# Discoverer Neo — Frontend Dockerfile
# Multi-stage production build (Vite + Nginx)
# =============================================
# Build context is the REPO ROOT, not frontend/ — this is an npm workspaces
# monorepo whose only lockfile is the root package-lock.json, and most of the
# frontend's deps hoist into the root node_modules. Build with
# `docker compose build frontend`, or by hand:
#   docker build -f frontend/Dockerfile .
# =============================================

# ---- Base ----
FROM node:22-bookworm-slim AS base
WORKDIR /app

# ---- Workspace manifests ----
# Every workspace manifest has to be present for npm to reconcile the root
# lockfile, even though only the frontend's dependencies get installed.
FROM base AS manifests
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY migrate/package.json migrate/

# ---- Dependencies (with dev deps — vite, tailwind and tsc live there) ----
FROM manifests AS deps
RUN npm ci --workspace @discoverer-neo/frontend --include-workspace-root

# ---- Build ----
FROM base AS build
# The whole tree, not just node_modules: npm hoists most packages to the root
# but leaves version-conflicting ones under frontend/node_modules, and Vite
# resolves through both.
COPY --from=deps /app ./
# Only the frontend's own files: unlike backend/tsconfig.json, the frontend
# tsconfigs are standalone and do not extend the root config.
COPY frontend/tsconfig.json frontend/tsconfig.node.json frontend/
COPY frontend/vite.config.ts frontend/index.html frontend/
COPY frontend/public frontend/public
COPY frontend/src frontend/src
# tsc -b (typecheck only) followed by vite build -> frontend/dist
RUN npm run build --workspace @discoverer-neo/frontend

# ---- Production (Nginx) ----
FROM nginx:1.27-alpine AS production
# Copy custom Nginx config
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
# Copy static build output
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
# busybox wget ships with the alpine base — no extra package needed. Hits
# nginx.conf's own /health location (a static 200, no backend dependency), so
# this only ever fails if Nginx itself is down.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
