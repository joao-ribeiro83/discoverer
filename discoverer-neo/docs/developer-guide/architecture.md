# Architecture Overview

Understand Discoverer Neo's system design, component relationships, and data flow.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React SPA)                      │
│            (Browser, TypeScript, Vite, Tailwind)             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                        HTTP/REST
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                     API Layer (Nginx)                        │
│               (Reverse proxy, static serving)                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                        HTTP/REST
                           │
┌──────────────────────────┴──────────────────────────────────┐
│         Backend API Server (Node.js + Fastify)              │
│              (TypeScript, routes, services)                 │
└──────┬─────────────────┬──────────────────┬─────────────────┘
       │                 │                  │
   PostgreSQL          Redis             Oracle/
   (Metadata)       (Cache, Sessions)   PostgreSQL
                                         (Data)
```

## Components

### Frontend (React SPA)

**Location:** `frontend/src/`

**Responsibilities:**
- UI rendering (forms, tables, charts)
- Route management (React Router)
- State management (Zustand)
- API client (Axios)
- Map builder (drag-and-drop)
- Authentication (JWT storage, refresh)

**Key Directories:**
- `pages/` — Route-level components
- `components/` — Reusable UI components
- `hooks/` — Custom React hooks
- `lib/` — Utilities (API client, formatters)
- `store/` — Zustand state stores

**Build:** Vite → `dist/` folder

**Deployment:** Nginx (production) or Vite dev server (development)

### Backend API Server

**Location:** `backend/src/`

**Responsibilities:**
- HTTP request handling (Fastify)
- Authentication & authorization (JWT)
- Business logic (services)
- Database operations (Drizzle ORM, PostgreSQL)
- Query generation & execution (SQL engine)
- Export generation (Excel, CSV, streaming)
- Job scheduling (BullMQ)
- Oracle/Postgres connectivity

**Key Directories:**
- `routes/` — HTTP endpoint handlers
- `services/` — Business logic (map execution, exports, etc.)
- `middleware/` — Auth, validation, audit logging
- `lib/` — Shared utilities (SQL generator, cache, etc.)
- `db/` — Database schema, migrations
- `plugins/` — Fastify plugins (Swagger, Redis, Auth, etc.)
- `workers/` — Background job processors (exports, scheduling)
- `queues/` — Job queue setup (BullMQ)

**Framework:** Fastify (HTTP server)

**Database ORM:** Drizzle (PostgreSQL)

**Job Queue:** BullMQ (Redis-backed)

### PostgreSQL Metadata Database

**Storage:**
- Business areas, folders, items, joins, hierarchies
- Maps, worksheets, parameters, conditions
- Users, roles, permissions, security policies
- Audit events, execution history

**Connection Pool:** Configurable per backend config

**Migrations:** Drizzle migrations in `backend/drizzle/`

### Redis Cache & Job Queue

**Cache:**
- Metadata (business areas, folders, items) — TTL 5 min
- Query result sets (temporary)
- Session tokens (for validation, blacklist)

**Job Queue (BullMQ):**
- Export jobs (async Excel/CSV generation)
- Scheduler jobs (cron-driven map executions)

### Oracle Data Source (Optional)

**Purpose:** Provides data for queries

**Connection:**
- Thin mode (default, Node.js pure)
- Thick mode (requires Oracle Instant Client, supports legacy 11.2+)

**Pool:** Per-source connection pooling

## Request Flow

### Executing a Map

```
1. User clicks "Run" in Frontend
   ↓
2. Frontend POST /api/maps/:id/execute { parameters, ... }
   ↓
3. Backend
   a. Authenticate request (JWT validation)
   b. Load map definition from PostgreSQL
   c. Check user permissions (business area access)
   d. Validate parameters
   e. Generate SQL from map definition
      - Apply security policies (row-level filters)
      - Add conditions, calculated fields
   f. Execute query on Oracle/Postgres data source
   g. Fetch first page of results
   h. Format for JSON response
   i. Log execution to audit log
   ↓
4. Backend returns { columns, rows, totalRowCount, ... }
   ↓
5. Frontend displays table, pagination controls
```

### Async Execution (Long Queries)

```
1. User clicks "Run in Background"
   ↓
2. Frontend POST /api/maps/:id/execute-async { ... }
   ↓
3. Backend
   a. Create execution job in memory
   b. Queue export job in BullMQ
   c. Return { jobId } immediately (202 Accepted)
   ↓
4. BullMQ Worker (export-worker)
   a. Dequeue execution job
   b. Execute query (same flow as above, but async)
   c. Stream results to file or memory
   d. Update job status: PROCESSING → COMPLETED/FAILED
   ↓
5. User polls GET /api/maps/:id/executions/:jobId
   - Until status is COMPLETED
   ↓
6. Frontend displays results or error
```

### Scheduling (Cron-Driven)

```
1. User creates schedule with cron expression
   ↓
2. Backend stores schedule in PostgreSQL
   ↓
3. BullMQ Scheduler Worker (scheduler-worker)
   a. Wakes up on schedule (cron-parser)
   b. Loads map definition
   c. Executes map (same as async flow)
   d. Stores result file
   e. Sends notification email (if configured)
   f. Logs to execution history
   ↓
4. User views results in schedule history
```

## Authentication & Authorization

### JWT Flow

```
1. User POSTs /api/auth/login { email, password }
   ↓
2. Backend verifies credentials (bcrypt comparison)
   ↓
3. Backend generates JWT:
   { sub, email, name, role, exp }
   ↓
4. Frontend stores token (localStorage/sessionStorage)
   ↓
5. Frontend includes in all requests:
   Authorization: Bearer <token>
   ↓
6. Backend validates token on each request
   a. Verify signature (JWT_SECRET)
   b. Check expiration
   c. Check token blacklist (logout)
   d. Extract user info (sub, role)
   ↓
7. Authorization checks (middleware):
   a. Is user authenticated? (401 if not)
   b. Does user have business area permission? (403 if not)
   c. Is user ADMIN? (403 if required)
```

### Permission Model

**User Roles:**
- ADMIN — All permissions
- MANAGER — Create/manage business areas
- USER — Create maps, execute queries
- VIEWER — Read-only access

**Business Area Permissions:**
- CREATE — Create maps/workbooks
- EDIT — Modify existing items
- DELETE — Remove maps
- EXPORT — Export results
- SCHEDULE — Create scheduled runs
- VIEW — View and execute (read-only)

**Row-Level Security:**
- Security policies applied per folder
- Predicates added to WHERE clause at query time
- Users only see rows matching their context

## Data Flow Examples

### Creating a Map

```
Frontend                     Backend                    Database
   │                           │                           │
   ├─POST /api/maps ──────────→│                           │
   │                           ├─Validate items ─────────→│
   │                           ←─ items OK ───────────────┤
   │                           │                           │
   │                           ├─Insert map ──────────────→│
   │                           ←─ id: UUID ────────────────┤
   │                           │                           │
   │                           ├─Insert items ────────────→│
   │                           ├─Insert conditions ───────→│
   │                           ├─Insert parameters ───────→│
   │                           │                           │
   │←─ 201 Created ────────────┤                           │
   │    { id, name, ... }      │                           │
   │                           │                           │
   └─ Redirect to map detail   │                           │
                               └─ Log: MAP.CREATE ────────→
                                                           
```

### Running a Map (Sync)

```
Frontend                Backend                        Data Sources
   │                      │                                │
   ├─POST /execute ──────→│                                │
   │                      ├─Load map def ────────────────→ PostgreSQL
   │                      ←─ (returned) ───────────────────┤
   │                      │                                │
   │                      ├─Check permissions              │
   │                      ├─Validate parameters            │
   │                      │                                │
   │                      ├─Generate SQL                   │
   │                      │  (with RLS predicates)         │
   │                      │                                │
   │                      ├─Execute query ───────────────→ Oracle/Postgres
   │                      ←─ rows: [...] ────────────────┤
   │                      │                                │
   │                      ├─Format results ─────────────→ Redis cache
   │                      ├─Log execution ─────────────→ PostgreSQL
   │                      │                                │
   │←─ 200 OK ────────────┤                                │
   │  { columns, rows }   │                                │
   │                      │                                │
   └─ Render table        │                                │
                          │                                │
```

## Caching Strategy

### Metadata Caching (Redis)

**What:** Business areas, folders, items, joins, hierarchies

**TTL:** 5 minutes (configurable)

**Invalidation:** Automatic on metadata change

**Benefit:** ~55% throughput improvement at 25 concurrent users

### Query Result Caching

**What:** Temporary caching of map execution results

**Duration:** Per request (not persisted)

**Use:** Pagination (first page cached while fetching more)

### Session Caching

**What:** JWT token validation, blacklist

**Storage:** Redis

**TTL:** Token expiration + 7 days

## Scaling Considerations

### Single Backend

Backend can be run in-process (default):
- Export worker: in-process
- Scheduler worker: in-process
- Good for dev/test

### Distributed Architecture

For production with high concurrency:

```
         ┌─── Backend API #1 ─────┐
         │ (routes only,           │
Nginx ──→│ workers disabled)       ├─→ PostgreSQL + Redis
         └─────────────────────────┘

         ┌─── Backend API #2 ─────┐
         │ (routes only,           │
         │ workers disabled)       ├─→
         └─────────────────────────┘

         ┌─── Export Worker ───────┐
         │ (standalone process)    ├─→
         └─────────────────────────┘

         ┌─── Scheduler Worker ────┐
         │ (standalone process)    ├─→
         └─────────────────────────┘
```

**Environment Variables:**
- `EXPORT_WORKER_ENABLED=false` (disable in API containers)
- Run separate worker containers with this enabled
- Workers consume same BullMQ queues (Redis-backed)

### Connection Pooling

- PostgreSQL: 1 pool (default 10 connections)
- Oracle: 1 pool per data source (default 10 each)
- Redis: 1 connection per worker/API

## Performance Characteristics

### Query Execution

- **Metadata cache hit:** ~10 ms overhead
- **Cache miss:** ~100–200 ms (DB fetch)
- **Query on Oracle:** 100 ms – minutes (depends on data)
- **Small result set:** 1–5 seconds total
- **Large export (1M rows):** 2–10 minutes

### Scaling Limits

- **Single backend:** ~25 concurrent users
- **Multiple backends:** 50+ users (load balanced)
- **Export concurrency:** Limited by pool (default 3 exports per worker)
- **Bottleneck:** Usually Oracle connection pool or data freshness

## What's Next?

- **[Development Setup](development.md)** — Get your environment running
- **[Backend Code Guide](backend.md)** — Understand backend modules
- **[Frontend Code Guide](frontend.md)** — Frontend structure and patterns
- **[Testing](testing.md)** — Run tests locally

---

**See Also:** [Developer Guide](../developer-guide/), [API Reference](../api/endpoints.md)
