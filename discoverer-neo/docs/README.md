# Discoverer Neo — Modern Open-Source BI Platform

Discoverer Neo is a modern, open-source business intelligence and reporting platform designed to replace the legacy Oracle Discoverer suite. It provides a web-based interface for defining business metadata, building ad-hoc queries, creating workbooks, and analyzing data — all with a contemporary cloud-ready architecture.

## Features

### Core Capabilities
- **Metadata Management** — Define business areas, folders, items, joins, and hierarchies
- **Interactive Map Builder** — Drag-and-drop query designer with conditions and parameters
- **Query Execution** — Execute queries against Oracle or PostgreSQL data sources
- **Map Types** — Build table, crosstab, page-detail, and chart visualizations
- **Calculated Fields** — Define business logic with SQL-based computed columns
- **Scheduling** — Run maps on cron schedules and capture results
- **Row-Level Security** — Define security predicates to filter data by user/role
- **Data Export** — Export results to Excel (XLSX) and CSV formats
- **Sharing** — Share maps with other users with granular permissions (VIEW, EDIT, EXPORT)

### Administration
- **Data Source Management** — Add Oracle or PostgreSQL connections (thin/thick mode for Oracle)
- **Business Area Grants** — Grant users CREATE, EDIT, DELETE, EXPORT, SCHEDULE, VIEW permissions
- **Oracle Introspection** — Auto-discover tables and views from source databases
- **User Management** — Create users, assign roles (ADMIN, MANAGER, USER, VIEWER)
- **Audit Logging** — Track metadata changes and map executions

### Migration
- **EUL Migration Tool** — Migrate Business Areas, Folders, Items, Joins, and Hierarchies from Oracle Discoverer 4–11
- **Workbook Import** — Import existing workbooks and worksheets
- **Privilege Preservation** — Migrate user grants and security conditions

## Architecture Overview

Discoverer Neo is a full-stack monorepo with three workspaces:

| Component | Tech Stack | Purpose |
|-----------|-----------|---------|
| **Backend** | Node.js 22, TypeScript, Fastify | REST API, metadata engine, query execution, job scheduler |
| **Frontend** | React 19, TypeScript, Vite, Tailwind | Single-page web application |
| **Migrate** | Node.js, TypeScript, oracledb | EUL migration CLI tool (`dn-migrate`) |

### Infrastructure
- **PostgreSQL 16** — Metadata database (business areas, folders, items, joins, workbooks, maps)
- **Redis 7** — Session caching, metadata caching, query result caching, job queue (BullMQ)
- **Oracle Database** — (Optional) Legacy EUL sources and data sources for queries
- **Prometheus/prom-client** — Metrics collection (`/metrics` endpoint)

## Quick Start

### Prerequisites
- **Node.js** >= 22
- **npm** >= 10
- **Docker** and Docker Compose (for containerized deployment)

### 1. Clone and Install
```bash
git clone https://github.com/your-org/discoverer-neo.git
cd discoverer-neo
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your settings (PostgreSQL, Redis, JWT secret, etc.)
```

### 3. Start Infrastructure
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

This starts PostgreSQL, Redis, and runs migrations automatically.

### 4. Start Development Servers
```bash
# Start all workspaces
npm run dev

# Or individually:
npm run dev --workspace=backend
npm run dev --workspace=frontend
```

- **Backend API:** http://localhost:3000
- **Frontend SPA:** http://localhost:5173
- **Swagger/OpenAPI:** http://localhost:3000/api/docs

## Workspace Scripts

| Command | Description |
|---------|-------------|
| `npm install` | Install all workspace dependencies |
| `npm run dev` | Start all dev servers with hot reload |
| `npm run build` | Build all workspaces (TypeScript, Vite) |
| `npm run lint` | Lint TypeScript and JavaScript across workspaces |
| `npm run typecheck` | Type-check all workspaces |
| `npm run test --workspace=backend` | Run backend unit + integration tests (Jest) |
| `npm run test:integration --workspace=backend` | Run backend integration tests only |
| `npm run test --workspace=frontend` | Run frontend unit tests (Vitest) |
| `npm run e2e --workspace=frontend` | Run end-to-end tests (Playwright) |

## Project Structure

```
discoverer-neo/
├── docs/                          # This documentation
├── backend/
│   ├── src/
│   │   ├── app.ts                # Fastify app setup, plugin registration
│   │   ├── config.ts             # Environment variables (Zod schema)
│   │   ├── server.ts             # HTTP listener entrypoint
│   │   ├── routes/               # API endpoint handlers
│   │   ├── services/             # Business logic (maps, exports, queries)
│   │   ├── middleware/           # Auth, entity-scoped auth, audit
│   │   ├── lib/                  # Shared libraries (SQL engine, cache, etc.)
│   │   ├── db/                   # Drizzle ORM, schema, migrations
│   │   ├── plugins/              # Fastify plugins (Swagger, JWT, Redis, etc.)
│   │   ├── workers/              # BullMQ workers (export, scheduler)
│   │   ├── queues/               # BullMQ queue setup
│   │   ├── __tests__/            # Unit and integration tests
│   │   └── scripts/              # One-off utilities (spec generation, etc.)
│   └── drizzle/                  # Database migrations
├── frontend/
│   ├── src/
│   │   ├── pages/                # Route-level components
│   │   ├── components/           # Reusable UI components
│   │   │   ├── admin/            # Admin metadata pages
│   │   │   ├── map-builder/      # Map builder UI
│   │   │   ├── auth/             # Auth forms
│   │   │   ├── data-table/       # Reusable table component
│   │   │   ├── layout/           # Navigation, sidebar
│   │   │   └── ui/               # Primitive UI (buttons, modals, etc.)
│   │   ├── hooks/                # Custom React hooks
│   │   ├── lib/                  # Utilities (API client, formatters, etc.)
│   │   ├── store/                # Zustand state management
│   │   ├── __tests__/            # Unit tests
│   │   └── App.tsx               # Root component
│   ├── nginx.conf                # Nginx config for production
│   └── vite.config.ts            # Vite bundler config
├── migrate/
│   ├── src/
│   │   ├── cli.ts                # `dn-migrate` command-line interface
│   │   ├── bin.ts                # CLI entrypoint
│   │   ├── services/             # EUL reader, migration runner, validators
│   │   ├── db/                   # Target (Postgres) connection
│   │   ├── types/                # EUL data type definitions
│   │   └── __tests__/            # Migration tests
│   └── package.json
├── docker-compose.yml            # Production deployment
├── docker-compose.dev.yml        # Development overlay
├── .env.example                  # Environment variables template
├── backend/Dockerfile            # Multi-stage Node.js build
├── frontend/Dockerfile           # Multi-stage Vite + Nginx build
├── nginx/                        # (Empty; frontend serves via Nginx)
├── package.json                  # Root workspace config
├── tsconfig.json                 # Root TypeScript config (strict)
├── eslint.config.js              # ESLint flat config
└── prettier.config.js            # Code formatting
```

## User Roles and Permissions

### User Roles
| Role | Capabilities |
|------|-------------|
| **ADMIN** | Full access to all features, user management, system settings |
| **MANAGER** | Can create and manage business areas, grant permissions to other users |
| **USER** | Can build maps, execute queries, create workbooks |
| **VIEWER** | Read-only access to shared maps and dashboards |

### Business Area Permissions
- **CREATE** — Create new maps/workbooks in the business area
- **EDIT** — Modify existing maps/workbooks
- **DELETE** — Remove maps/workbooks
- **EXPORT** — Export map results to Excel/CSV
- **SCHEDULE** — Create scheduled runs of maps
- **VIEW** — View and execute maps (read-only)

## API Overview

The backend exposes a REST API secured by JWT authentication. Key endpoint groups:

- **Auth** — Login, refresh, logout, current user
- **Data Sources** — CRUD for Oracle/Postgres connections
- **Business Areas** — Metadata hierarchy management
- **Folders** — Table/view folders in business areas
- **Items** — Columns/attributes exposed from folders
- **Joins** — Multi-folder relationships
- **Hierarchies** — Level-based hierarchies for drill-down
- **Custom Functions** — User-defined SQL/PLSQL functions
- **Maps** — Query definitions (CRUD, execution, export)
- **Map Execution** — Run maps with parameters
- **Exports** — Async export job management
- **Schedules** — Cron-driven map runs
- **Users** — User management and roles
- **Security** — Row-level security policy management
- **Audit** — Audit log retrieval
- **Migration** — EUL import status and progress

See [API Documentation](docs/api/endpoints.md) for complete endpoint reference.

## Authentication

Discoverer Neo uses JWT (JSON Web Token) bearer authentication. Login returns a token valid for 7 days; expired tokens can be refreshed for an additional 7 days. Tokens are validated on every API request.

**Login flow:**
```
POST /api/auth/login { email, password }
  ↓
JWT token + user info
  ↓
Include in subsequent requests: Authorization: Bearer <token>
```

See [Authentication Guide](docs/api/authentication.md) for details.

## Development

See [Developer Guide](docs/developer-guide/) for setup, local development, testing, and contributing.

## Deployment

See [Deployment Guide](docs/deployment/) for Docker Compose, configuration, SSL/TLS, and monitoring.

## Migration from Oracle Discoverer

See [Migration Guide](docs/migration/) for migrating from Oracle Discoverer 4–11.

## License

[MIT](LICENSE)

## Support

For bug reports, feature requests, and discussions, open an issue on GitHub.

---

**Documentation Navigation:** [Table of Contents](docs/index.md)
