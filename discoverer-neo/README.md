# Discoverer Neo

> Modern open-source BI tool — an open-source replacement for Oracle Discoverer.

Discoverer Neo is a full-stack business intelligence and reporting platform designed to
replace the legacy Oracle Discoverer suite. It provides a web-based interface for
building queries, creating workbooks, defining business areas, and analyzing data — all
with a modern architecture.

## Architecture

| Workspace  | Tech Stack                                      | Purpose                                  |
| ---------- | ----------------------------------------------- | ---------------------------------------- |
| `backend`  | Node.js · TypeScript · Fastify · PostgreSQL     | REST API, authentication, query engine   |
| `frontend` | React 19 · TypeScript · Vite                     | Single-page application (SPA)            |
| `migrate`  | Node.js · TypeScript · oracledb                  | EUL migration from Oracle Discoverer 4–11 |

### Infrastructure

- **PostgreSQL** — Primary data store for metadata, user data, and query results
- **Redis** — Session caching, query result caching, and rate limiting

## Prerequisites

- [Node.js](https://nodejs.org/) >= 22
- [npm](https://www.npmjs.com/) >= 10
- [Docker](https://www.docker.com/) & Docker Compose
- (Optional) [Oracle Instant Client](https://www.oracle.com/database/technologies/instant-client.html) — required only for EUL migration

## Quickstart

### 1. Clone and install

```bash
git clone https://github.com/your-org/discoverer-neo.git
cd discoverer-neo
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Start infrastructure services

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

This starts PostgreSQL and Redis with health checks.

### 4. Run database migrations

> TODO: Add migration tooling (Prisma / Drizzle / Knex)

### 5. Start development servers

```bash
# Start all workspaces
npm run dev

# Or start individually:
npm run dev --workspace=backend
npm run dev --workspace=frontend
```

- Backend API:  <http://localhost:3000>
- Frontend SPA: <http://localhost:5173>
- Swagger UI: <http://localhost:3000/api/docs>

## Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[User Guide](docs/user-guide/)** — How to use Discoverer Neo (logging in, building maps, executing queries, exporting data)
- **[Administrator Guide](docs/admin-guide/)** — System administration (metadata management, user management, security, data sources)
- **[Developer Guide](docs/developer-guide/)** — Development setup, architecture, backend/frontend code, testing, contributing
- **[API Reference](docs/api/)** — REST API endpoints, authentication, request/response examples
- **[Deployment Guide](docs/deployment/)** — Docker deployment, configuration, SSL/TLS, backup, monitoring
- **[Migration Guide](docs/migration/)** — Migrating from Oracle Discoverer 4–11

Start with [docs/index.md](docs/index.md) for the complete documentation index.

## Project Structure

```
discoverer-neo/
├── docs/             # Complete documentation (see below)
├── backend/          # Node.js + TypeScript + Fastify API
│   └── src/
├── frontend/         # React 19 + TypeScript + Vite SPA
│   └── src/
├── migrate/          # Discoverer 4–11 EUL migration tool
│   └── src/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── package.json      # Root workspace configuration
├── tsconfig.json     # Root TypeScript config (strict mode)
├── eslint.config.js  # ESLint flat config
├── prettier.config.js
├── .gitignore
└── README.md
```

## Scripts

| Command              | Description                          |
| -------------------- | ------------------------------------ |
| `npm install`        | Install all workspace dependencies   |
| `npm run dev`        | Start all dev servers                |
| `npm run build`      | Build all workspaces                 |
| `npm run lint`       | Lint all workspaces                  |
| `npm run typecheck`  | Type-check all workspaces            |

Workspace-scoped: `npm run <script> --workspace=<name>`

## EUL Migration

Discoverer Neo includes a migration tool (`dn-migrate` CLI) for importing End User Layer (EUL) metadata from existing
Oracle Discoverer installations (versions 4.1 through 11g). This includes:

- Business Areas, Folders, Items, Joins, Hierarchies
- Workbooks and Worksheets
- Conditions, Calculations, and Analytic Functions
- Users, Privileges, and Security Settings

See the [Migration Guide](docs/migration/) for detailed instructions.

Optional: Requires Oracle Instant Client configured via `ORACLE_CLIENT_PATH` in your `.env` for legacy Discoverer versions (11.2 and earlier).

## License

[MIT](LICENSE)
