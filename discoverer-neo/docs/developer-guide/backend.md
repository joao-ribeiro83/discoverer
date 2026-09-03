# Backend Code Guide

Overview of backend structure, key modules, and patterns.

## Directory Structure

```
backend/src/
├── app.ts                  # Fastify app initialization, plugins
├── server.ts               # HTTP server entry point
├── config.ts               # Environment variables (Zod schema)
├── routes/                 # HTTP endpoint handlers
│   ├── auth.ts
│   ├── maps.ts
│   ├── business-areas.ts
│   └── ...
├── services/               # Business logic
│   ├── map.service.ts
│   ├── map-execution.service.ts
│   ├── export.service.ts
│   └── ...
├── middleware/             # Auth, validation, audit
│   ├── auth.ts
│   ├── business-area-auth.ts
│   └── audit.ts
├── lib/                    # Shared utilities
│   ├── sql-generator.ts    # SQL query builder
│   ├── metadata-cache.ts   # Redis metadata caching
│   ├── password.ts         # bcrypt helpers
│   └── ...
├── db/                     # Database layer
│   ├── index.ts            # Drizzle ORM setup
│   ├── schema.ts           # Table definitions
│   ├── seed.ts             # Test data
│   └── client.ts
├── plugins/                # Fastify plugins
│   ├── swagger.ts          # OpenAPI docs
│   ├── auth.ts             # JWT auth
│   ├── redis.ts            # Redis connection
│   ├── metrics.ts          # Prometheus metrics
│   ├── audit.ts            # Audit logging
│   └── ...
├── workers/                # Background job processing
│   ├── export.worker.ts    # Export job worker
│   ├── scheduler.worker.ts # Cron job runner
│   └── ...
├── queues/                 # Job queue setup
│   ├── export.queue.ts
│   └── scheduler.queue.ts
└── __tests__/              # Tests
```

## Key Modules

### Routes (`backend/src/routes/`)

Each route file handles one endpoint group:

```typescript
export default async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/login
  fastify.post('/api/auth/login', { schema: { ... } }, async (request, reply) => {
    // Handler
  });
}
```

**Pattern:**
1. Parse request body (Zod validation)
2. Call service method
3. Handle errors
4. Return JSON response

### Services (`backend/src/services/`)

Business logic lives here, separated from routes:

```typescript
export async function executeMap(mapId: string, params: Record<string, any>) {
  // 1. Load map from DB
  // 2. Generate SQL query
  // 3. Execute on data source
  // 4. Format results
  // 5. Return
}
```

**Why:** Services are testable independently, reusable by workers/CLI.

### Database (`backend/src/db/`)

**schema.ts:** the backend's view of the database — a re-export, not a
declaration.

The 20 tables shared with the migrator are declared once, in the
`@discoverer-neo/core` package (`migrate/src/db/schema.ts`). This file
re-exports them and declares only the 10 runtime-only tables the migrator never
writes, plus every `relations()` block.

```typescript
// Shared tables and enums — single definition in @discoverer-neo/core.
export * from '@discoverer-neo/core/db/schema';
```

**Do not add a `pgTable` call here for a shared table.** That re-creates the
drift this arrangement removed;
`backend/src/__tests__/schema-single-definition.test.ts` fails if you do. See
[architecture.md](architecture.md) for why.

The package is `@discoverer-neo/core` (the `migrate/` directory). Its subpaths:

| Import | What it is |
| --- | --- |
| `@discoverer-neo/core/db/schema` | The shared tables and enums. Free to import anywhere. |
| `@discoverer-neo/core/migration` | The Oracle EUL migration pipeline. Not request-path code — an ESLint rule restricts it to `migration.service.ts`, `credential-file.service.ts`, scripts and tests. |
| `@discoverer-neo/core/testing` | EUL fixtures and fake executors for tests. |

`npm run typecheck -w backend` builds core first (`pretypecheck`), so a
column change in core surfaces as a backend compile error rather than a stale
`dist/`.

**index.ts:** ORM client

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const sql = postgres(config.DATABASE_URL);
export const db = drizzle(sql);
```

**Query example:**

```typescript
// Select
const maps = await db.select().from(maps).where(eq(maps.id, mapId));

// Insert
await db.insert(maps).values({ name: 'Test', businessAreaId });

// Update
await db.update(maps).set({ name: 'Updated' }).where(eq(maps.id, mapId));

// Delete
await db.delete(maps).where(eq(maps.id, mapId));
```

### SQL Generator (`backend/src/lib/sql-generator.ts`)

Builds SQL queries from map definitions:

```typescript
export function generateMapSQL(map: Map, params: Record<string, any>): string {
  // 1. Start with base SELECT
  // 2. Add items (columns)
  // 3. Add joins between folders
  // 4. Add WHERE conditions (+ security policies)
  // 5. Add ORDER BY (sorts)
  // 6. Add GROUP BY (aggregations)
  // 7. Return final SQL
}
```

This is the query engine heart.

### Metadata Cache (`backend/src/lib/metadata-cache.ts`)

Redis-backed caching:

```typescript
import { cached } from '../lib/metadata-cache';

// Cache hits return in ~10ms; misses ~100ms
const businessAreas = await cached(
  fastify.redis,
  'business_areas:list',
  () => db.select().from(businessAreas)
);

// Invalidate on update
await invalidate(fastify.redis, 'business_areas:list');
```

### Plugins (`backend/src/plugins/`)

Fastify plugins extend the app:

**auth.ts** — JWT validation
**swagger.ts** — OpenAPI docs  
**redis.ts** — Redis connection
**metrics.ts** — Prometheus `/metrics`
**audit.ts** — Request logging

### Workers (`backend/src/workers/`)

Background job processing:

**export.worker.ts:**
```typescript
export function startExportWorker(logger: Logger): ExportWorkerHandle {
  const worker = new Worker(exportQueue);
  
  worker.process(async (job) => {
    const { mapId, parameters } = job.data;
    const results = await executeMap(mapId, parameters);
    return { fileUrl: '/exports/file.xlsx' };
  });
  
  return { close: () => worker.close() };
}
```

## Common Patterns

### Validation

Use Zod for request validation:

```typescript
const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const parsed = LoginBodySchema.safeParse(request.body);
if (!parsed.success) {
  return reply.code(400).send({ error: 'Invalid', details: parsed.error });
}
```

### Error Handling

Create custom error classes:

```typescript
export class MapValidationError extends Error {
  constructor(message: string, public details: any) {
    super(message);
  }
}

// In route
try {
  await createMap(body);
} catch (err) {
  if (err instanceof MapValidationError) {
    return reply.code(400).send({ error: err.message, details: err.details });
  }
  throw err; // Let global handler
}
```

### Authorization

Middleware checks permissions:

```typescript
export const requireBusinessAreaAccess = (permission: PermissionLevel) =>
  async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    
    const { hasPermission } = await userHasPermission(user.sub, baId, permission);
    if (!hasPermission) return reply.code(403).send({ error: 'Forbidden' });
  };

// Usage
fastify.get('/api/maps', {
  preHandler: [fastify.authenticate, fastify.requireBusinessAreaAccess('VIEW')]
});
```

### Async Jobs

Queue long operations:

```typescript
// In route
const { jobId } = await executeMapAsync(mapId, params);
return reply.code(202).send({ data: { jobId } });

// In worker
export async function executeMapAsync(mapId: string, params: any) {
  const job = await exportQueue.add('execute', { mapId, params });
  return { jobId: job.id };
}
```

## Configuration

Environment variables in `backend/src/config.ts`:

```typescript
const EnvSchema = z.object({
  DATABASE_URL: z.string().default('postgres://localhost:5432/db'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(16),
  ORACLE_POOL_MAX: z.coerce.number().int().default(10),
  // ...
});
```

**Accessing:**

```typescript
import { config } from './config';

console.log(config.DATABASE_URL);
console.log(config.ORACLE_POOL_MAX);
```

## Testing

See [Testing Guide](testing.md).

Quick example:

```typescript
describe('Map Service', () => {
  it('should create map', async () => {
    const result = await create({ name: 'Test', businessAreaId: '123' });
    expect(result).toHaveProperty('id');
  });
});
```

## Debugging

### Logs

```typescript
app.log.info({ userId: '123' }, 'User logged in');
app.log.error({ err }, 'Query failed');
```

**Log level:** `LOG_LEVEL` environment variable

### Metrics

Prometheus metrics at `/metrics`:

```
nodejs_heap_size_used_bytes 12345678
oracledb_pool_connections_active 5
drizzle_query_duration_ms 125
```

## What's Next?

- **[Frontend Code Guide](frontend.md)** — React/TypeScript patterns
- **[Testing](testing.md)** — Write and run tests
- **[API Reference](../api/endpoints.md)** — Endpoint details

---

**See Also:** [Architecture](architecture.md), [Development Setup](development.md)
