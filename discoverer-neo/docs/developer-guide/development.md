# Development Setup

Get your local environment ready for Discoverer Neo development.

## Prerequisites

- **Node.js** >= 22 (check with `node --version`)
- **npm** >= 10 (check with `npm --version`)
- **Docker Desktop** (for services: PostgreSQL, Redis)
- **Git** (clone repository)
- **Text Editor/IDE** (VS Code recommended)

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/your-org/discoverer-neo.git
cd discoverer-neo
```

### 2. Install Dependencies

```bash
npm install
```

This installs dependencies for all workspaces (backend, frontend, and
`migrate/`, which publishes as `@discoverer-neo/core`).

### 3. Start Services

Start PostgreSQL and Redis via Docker:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

This starts:
- PostgreSQL (port 5432) — Metadata database
- Redis (port 6379) — Caching and job queue

### 4. Configure Environment

```bash
cp .env.example .env
# Edit .env if needed (defaults work for local dev)
```

### 5. Start Dev Servers

```bash
npm run dev
```

Or start individually:

```bash
# Terminal 1: Backend
npm run dev --workspace=backend

# Terminal 2: Frontend
npm run dev --workspace=frontend
```

**Services:**
- Backend API: http://localhost:3000
- Frontend SPA: http://localhost:5173
- Swagger UI: http://localhost:3000/api/docs
- PostgreSQL: localhost:5432 (postgres/postgres)
- Redis: localhost:6379

### 6. Test Your Setup

```bash
# Backend
curl http://localhost:3000/api/health

# Frontend
open http://localhost:5173
```

## Environment Variables

Copy `.env.example` to `.env`:

```bash
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=discoverer_neo
POSTGRES_USER=discoverer
POSTGRES_PASSWORD=change_me_in_production

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_dev_secret_min_16_chars

# Backend
BACKEND_PORT=3000

# Frontend
FRONTEND_PORT=5173
```

**Note:** Use simple values for local dev; change in production.

## IDE Setup

### VS Code

**Recommended Extensions:**
- ESLint
- Prettier
- Thunder Client (REST client)
- PostgreSQL
- Redis

**Settings:**

Create `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

## Scripts

**Root workspace:**

| Command | Description |
|---------|-------------|
| `npm install` | Install all dependencies |
| `npm run dev` | Start all dev servers |
| `npm run build` | Build all workspaces |
| `npm run lint` | Lint all workspaces |
| `npm run typecheck` | Type-check all workspaces |

**Backend (`npm run <cmd> --workspace=backend`):**

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Fastify dev server (tsx watch) |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled JS |
| `npm run test` | Run Jest tests |
| `npm run test:integration` | Run integration tests only |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check TypeScript |
| `npm run db:migrate` | Run Drizzle migrations |
| `npm run db:seed` | Seed database with test data |
| `npm run db:generate` | Generate Drizzle migration files |

**Frontend (`npm run <cmd> --workspace=frontend`):**

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run test` | Run Vitest unit tests |
| `npm run e2e` | Run Playwright E2E tests |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check TypeScript |

## Database Setup

### First Run

Backend runs migrations automatically on startup. If not:

```bash
npm run db:migrate --workspace=backend
```

### Seed Data

Populate test data:

```bash
npm run db:seed --workspace=backend
```

Creates test business areas, folders, items, users (see `backend/src/db/seed.ts`).

### Reset Database

```bash
# Stop services
docker compose down

# Remove volume
docker volume rm discoverer-neo-postgres_data

# Start fresh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Run migrations again
npm run db:migrate --workspace=backend
```

### A change to `migrate/` needs a rebuild; a change to `backend/src` does not

`docker-compose.dev.yml` bind-mounts `./backend/src` and `./frontend/src` into
their containers, so edits there are live. The `migrate` workspace — the
`@discoverer-neo/core` package, which holds the shared database schema as well
as the EUL pipeline — is **not** mounted: the backend imports it as
`@discoverer-neo/core/db/schema` and `@discoverer-neo/core/migration`, both of
which resolve to `migrate/dist`, and that is baked into the image at build
time.

So a change under `migrate/src` is invisible to a running backend until you
rebuild — the container keeps running the version it was built with, which
looks like your change having no effect:

```bash
npm run build -w @discoverer-neo/core
docker compose -f docker-compose.yml -f docker-compose.dev.yml build backend
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d backend
```

Tests are unaffected: `backend/jest.config.js` maps the package to
`migrate/src/**` (see [Testing](testing.md)), so a stale `dist` never shows up
there — only at runtime.

## Testing

### Backend Unit Tests

```bash
npm run test --workspace=backend
```

### Backend Integration Tests

```bash
npm run test:integration --workspace=backend
```

Requires running services (PostgreSQL, Redis, Oracle if migration tests).

### Frontend Unit Tests

```bash
npm run test --workspace=frontend
```

### E2E Tests

```bash
npm run e2e --workspace=frontend
```

See [Testing Guide](testing.md).

## Debugging

### Backend Debug

VS Code launch config (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Backend Debug",
      "program": "${workspaceFolder}/backend/src/server.ts",
      "preLaunchTask": "tsx",
      "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"]
    }
  ]
}
```

Or use `tsx` directly:

```bash
tsx src/server.ts --inspect
```

### Frontend Debug

Chrome DevTools (built in):

1. Open http://localhost:5173
2. Press F12
3. Use Debugger tab

### Database Debug

Connect directly:

```bash
# PostgreSQL
psql -h localhost -U discoverer -d discoverer_neo

# Redis
redis-cli
```

## Code Style

### ESLint

```bash
npm run lint                    # Check all
npm run lint -- --fix          # Auto-fix
```

### Prettier

```bash
npm run format                  # Format all files
```

### TypeScript

Strict mode enabled in `tsconfig.json`:

```bash
npm run typecheck              # Check types
```

## Making Changes

### Adding Backend Route

1. Create handler in `backend/src/routes/`
2. Register in `backend/src/app.ts`
3. Add tests in `backend/src/__tests__/`
4. Run: `npm run test --workspace=backend`

### Adding Frontend Page

1. Create component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx` (React Router)
3. Add navigation link in layout
4. Test locally

### Adding Database Table

1. Update schema in `backend/src/db/schema.ts`
2. Generate migration: `npm run db:generate --workspace=backend`
3. Review in `backend/drizzle/`
4. Run: `npm run db:migrate --workspace=backend`

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>

# Or use different port
BACKEND_PORT=3001 npm run dev --workspace=backend
```

### Docker Services Not Starting

```bash
# Check services
docker ps

# Logs
docker compose logs postgres
docker compose logs redis

# Restart
docker compose restart
```

### Module Not Found

```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
```

### TypeScript Errors

```bash
# Clear cache
rm -rf backend/dist frontend/dist

# Typecheck
npm run typecheck
```

## What's Next?

- **[Backend Code Guide](backend.md)** — Understand backend structure
- **[Frontend Code Guide](frontend.md)** — Frontend architecture
- **[Testing](testing.md)** — Write and run tests
- **[Contributing](contributing.md)** — Submit changes

---

**See Also:** [Developer Guide](../developer-guide/), [Architecture](architecture.md)
