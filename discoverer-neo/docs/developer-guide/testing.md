# Testing

Learn how to write and run tests for Discoverer Neo.

## Backend Testing

Backend uses **Jest** for unit and integration tests.

### The tests run against their own database

Backend tests clean up with unscoped `DELETE FROM`. That is correct for a
throwaway database and destructive for a working one, so the suite runs against
**`discoverer_neo_test`**, never your dev database.

You do not have to set this up: `pretest` creates the database and applies every
migration before the suite runs, and it is idempotent.

Two rules are enforced in `src/__tests__/setup/test-database.ts`:

| `DATABASE_URL` | Result |
| --- | --- |
| unset | defaults to `discoverer_neo_test` |
| set to a `*_test` database | used as given |
| set to anything else | **the run aborts** before a single test executes |

The third row is deliberate. Passing `DATABASE_URL=…/discoverer_neo` used to
silently wipe your business areas, folders and registered Oracle data sources;
now it fails with a message naming the database and how to fix it. The guard is
never "helpful" — it will not quietly redirect you, because that would hide the
mistake.

```bash
# Create / migrate the test database by hand (pretest does this for you)
npm run db:test:setup --workspace=backend

# Start completely clean — drops and recreates it
npm run db:test:reset --workspace=backend
```

If a test run ever hangs, kill it. A hung jest process holds an open connection
and can still delete rows; leaving one running for hours is how data gets lost.

**After a run that failed or was killed, reset before believing the next one.**
The suites share one database and clean up in `afterAll`, which does not run
when a process is interrupted. The rows left behind make the *next* run fail in
unrelated suites — a global count assertion sees extra rows, a login finds a
duplicate email — and it is easy to spend an hour blaming the change you just
made. Three consecutive runs here failed 14, 9 and 10 suites for exactly that
reason, each poisoned by the one before; a reset returned every one of them to
green.

```bash
npm run db:test:reset --workspace=backend
```

### Running Tests

```bash
# All tests
npm run test --workspace=backend

# Watch mode (re-run on changes)
npm run test:watch --workspace=backend

# Only the suites that need no infrastructure — no Docker required
npm run test:unit --workspace=backend

# Integration tests only
npm run test:integration --workspace=backend

# Specific test file
npm run test -- auth.test.ts --workspace=backend

# Coverage report
npm run test -- --coverage --workspace=backend
```

### Test Files

Located in `backend/src/__tests__/`:

- `*.test.ts` — suites needing **no** infrastructure. Pure functions and
  fakes only; they run with Docker down.
- `integration/` — everything that touches Postgres, Redis, a queue or the
  Fastify app.

The split is about what a suite **needs**, not how it is scheduled: the whole
run is sequential either way, because every integration suite shares one
database. Twenty-four suites lived in the top directory while requiring a live
Postgres, which made `*.test.ts` look like a fast inner loop that did not
exist.

**It is still not a fast loop, and the reason is not the database.** A
21-assertion pure-function suite takes ~15 s, essentially all of it ts-jest
type-checking the program graph. Moving the infrastructure-bound suites made
the directory honest; making the loop quick means addressing the transform
(`isolatedModules`, swc, or a project-references split), not test placement.

**Naming:** `<feature>.test.ts`

### Writing Tests

Example unit test (`backend/src/__tests__/auth.test.ts`):

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { buildApp } from '../app';
import type { FastifyInstance } from 'fastify';

describe('Authentication', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should login with valid credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'password123'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('data.token');
  });

  it('should reject invalid password', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'wrongpassword'
      }
    });

    expect(response.statusCode).toBe(401);
  });
});
```

### Test Setup

Tests use:
- **Fastify's `inject`** — Simulate HTTP requests (no real network)
- **Jest mocks** — Mock services and database
- **Test database** — `discoverer_neo_test`, never your dev database (above)

#### `@discoverer-neo/core` resolves to source, not `dist`

`migration.test.ts` imports `@discoverer-neo/core/testing`. Both
`moduleNameMapper` **and** the ts-jest `paths` override in `jest.config.js`
point that at `migrate/src/**`, so no build is required.

The `paths` half is easy to lose and expensive when it goes: without it, ts-jest
type-checks the import through the package's `exports` map and needs
`migrate/dist/**/*.d.ts` to exist. A stale or missing build then makes the suite
fail to **load** (`TS2307`) reporting zero tests — which reads like a broken
suite rather than a missing build step, and cost real debugging time once
already. If you touch that config, verify with:

```bash
rm -rf migrate/dist && npm run test -- migration.test --workspace=backend
```

It must still pass with `dist` absent.

### Coverage

CI runs every workspace with `--coverage`, and each one fails below a **branch**
threshold set at its measured baseline. Branch coverage, not lines: for a SQL
generator full of conditionals, a line figure says almost nothing about whether
the interesting paths were taken. A commit titled "coverage push to >80%" once
left the only coverage artefact in the repository reporting 75.38% lines and
56.10% branches, with nothing checking either.

| Workspace | Branch threshold | Set in |
| --- | --- | --- |
| backend | 56% | `backend/jest.config.js` |
| migrate | 71% | `migrate/jest.config.js` |
| frontend | 78% | `frontend/vitest.config.ts` |

These are floors at what the suite measurably achieves, not targets. Raise one
in the commit that earns it. No coverage report is committed — a checked-in
artefact goes stale and then gets quoted.

```bash
npm test --workspace @discoverer-neo/backend -- --coverage
```

## Frontend Testing

Frontend uses **Vitest** for unit tests and **Playwright** for E2E tests.

### Running Tests

```bash
# Unit tests
npm run test --workspace=frontend

# Watch mode
npm run test -- --watch --workspace=frontend

# E2E tests
npm run e2e --workspace=frontend

# E2E with UI
npm run e2e:ui --workspace=frontend

# Coverage
npm run test -- --coverage --workspace=frontend
```

### Unit Tests

Located in `frontend/src/__tests__/`:

Example component test:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../components/ui/button';

describe('Button Component', () => {
  it('renders button with text', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('calls onClick handler', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    screen.getByRole('button').click();
    expect(handleClick).toHaveBeenCalled();
  });
});
```

### E2E Tests

Located in `frontend/playwright.config.ts`:

Example E2E test:

```typescript
import { test, expect } from '@playwright/test';

test('user can login', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  
  await page.fill('input[type="email"]', 'user@example.com');
  await page.fill('input[type="password"]', 'password');
  await page.click('button:has-text("Sign In")');
  
  await expect(page).toHaveURL('http://localhost:5173/dashboard');
  await expect(page.getByText('Welcome')).toBeVisible();
});

test('user can create a map', async ({ page }) => {
  await page.goto('http://localhost:5173/maps');
  
  await page.click('button:has-text("Create Map")');
  await page.fill('input[placeholder="Map name"]', 'Test Map');
  
  // ... more interactions
  
  await expect(page.getByText('Test Map')).toBeVisible();
});
```

**Note:** E2E tests require frontend running (`npm run dev --workspace=frontend`).

## Integration Tests

Integration tests verify multiple components together:

```bash
npm run test:integration --workspace=backend
```

**Requirements:**
- PostgreSQL running
- Redis running
- Environment variables set

**Example:**

```typescript
describe('Map Execution', () => {
  it('should execute map and return results', async () => {
    // 1. Create business area, folder, items (setup)
    // 2. Create map
    // 3. Execute map via API
    // 4. Verify results returned
    // 5. Check audit log created
  });
});
```

## Test Patterns

### Mocking Services

```typescript
import { jest } from '@jest/globals';

jest.mock('../services/map.service', () => ({
  getById: jest.fn().mockResolvedValue({ id: '123', name: 'Test Map' })
}));
```

### Testing Async Operations

```typescript
it('should handle async errors', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/maps',
    payload: { /* ... */ }
  });

  await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async
  expect(response.statusCode).toBe(201);
});
```

### Testing Authentication

```typescript
it('should reject unauthenticated requests', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/maps',
    // No Authorization header
  });

  expect(response.statusCode).toBe(401);
});

it('should accept authenticated requests', async () => {
  const token = app.jwt.sign({ sub: 'user-id', role: 'USER' });
  
  const response = await app.inject({
    method: 'GET',
    url: '/api/maps',
    headers: { authorization: `Bearer ${token}` }
  });

  expect(response.statusCode).toBe(200);
});
```

## Accessibility: drag-and-drop

Any new `useDraggable` or `useSortable` (`@dnd-kit`) ships with a non-drag
equivalent — a real `<button>`, not a `role="button"` on a `<div>` — and a
keyboard-only Playwright spec proving it (`.focus()` then `keyboard.press()`,
no `dragTo` / mouse). `axe-core` cannot detect a drag-only interaction: it
checks the DOM for violations, not whether a keyboard user can reach the
action at all. Skipping the keyboard spec lets this regress silently behind a
green accessibility sweep — see `frontend/e2e/map-builder.spec.ts` for the
pattern (the source-tree "Add" button, and the Sort/Calculated-Fields
reorder-pickup specs).

If the control lives inside an element that dnd-kit already marks
`role="button"` (a whole-row drag handle), make the new control a **sibling**
of that element, not a child — nesting an interactive control inside another
is an invalid interactive-in-interactive pattern, and it merges both into one
accessible name.

## CI/CD Testing

`.github/workflows/ci.yml` (repo root — GitHub only discovers workflows
there, not under `discoverer-neo/.github/`) runs four jobs on every push and
PR to `master`: `backend`, `frontend`, `migrate`, and `e2e`. Each of the first
three runs that workspace's own `lint`, `typecheck` and `test` scripts.

The `e2e` job runs the full Playwright suite (`frontend/e2e/*.spec.ts`,
including the axe-core accessibility sweep). It needs no Postgres or backend
service: every spec mocks the API via `page.route()`, and Playwright's own
`webServer` starts the frontend dev server. It installs the Chromium browser
(`npx playwright install --with-deps chromium`) and runs with
`FRONTEND_PORT=5174` — see the "Port 5173 is not safe" note in
`discoverer-neo/CLAUDE.md` for why.

Push to branch only if all pass locally:

```bash
npm run lint && npm run typecheck && npm run test --workspace=backend
```

## Debugging Tests

### Backend

```bash
# Run single test with verbose output
npm run test -- auth.test.ts --verbose --workspace=backend

# Debug in Node Inspector
node --inspect-brk node_modules/jest/bin/jest.js
```

### Frontend

```bash
# Run with UI
npm run test -- --ui --workspace=frontend

# Debug in Chrome DevTools
npm run test -- --debug --workspace=frontend
```

## Best Practices

1. **Test User Workflows** — Test what users do, not implementation details
2. **Keep Tests Fast** — Slow tests discourage running them
3. **One Assertion per Test** — Easier to identify failures
4. **Use Descriptive Names** — Test name should explain what it tests
5. **Mock External Services** — Tests should not depend on real databases/APIs
6. **Test Happy Path & Errors** — Test both success and failure cases
7. **Avoid Flaky Tests** — Don't rely on timing; use proper assertions

## Performance Test Target

Discoverer Neo targets:
- **P95 query execution:** < 500 ms (typical)
- **P99 query execution:** < 2 seconds
- **Export throughput:** 10K rows/second
- **Metadata cache hit ratio:** > 80%

Load test setup (see `backend/src/__tests__/integration/`):

```bash
npm run test:integration -- performance.test.ts --workspace=backend
```

## The four seam tests

Every other suite here checks one component against its own fixtures. That is
worth having, and it is not enough: in September 2026 this repository had 1 654
tests at 99.94% passing over an estate where 807 of 923 migrated worksheets
could not produce SQL at all. No test spanned two components, so no test could
see it.

Four tests close that gap. They live in
`backend/src/__tests__/integration/migration-seams.test.ts` and drive the shared
verifier in `migrate/src/services/migration-verify.ts` — the same code
`dn-migrate verify` runs against a real target.

| Seam | Asks | Catches |
| --- | --- | --- |
| `sql-generation` | Does every migrated map load and generate SQL? | A migration that produces rows nothing can execute |
| `formula-compile` | Does every calculated field compile, or carry a stated quarantine reason? | Formula support silently going backwards |
| `referential-closure` | Does every reference resolve to an item, folder and data source in the map's scope? | Rows that satisfy every foreign key and still cannot run |
| `reconciliation` | Do target counts match what the declared allowances say? | A regression disguised as a known gap |

### Two of them need the backend, and say so

`generateSqlForMap` and the formula parser live in `backend/`, which depends on
`@discoverer-neo/core` and not the reverse. The verifier takes both as injected
hooks. `dn-migrate verify` reports those seams **SKIPPED** — never PASS — and
`npm run verify --workspace @discoverer-neo/backend` supplies both and runs all
four. A SKIPPED seam is not a pass anywhere.

### Declared baselines, not green lights

Several seams fail today, on purpose. Their known counts are pinned as named
constants carrying a comment that names the phase which removes them, so a
regression fails the build while a known defect waits for its fix. When you fix
one, lower the constant in the same commit.

### The compile-rate buckets (D-059)

| Bucket | Means |
| --- | --- |
| `COMPILED` | Parsed **and** proven against a real Oracle. Nothing may claim this until the Oracle contract tests exist |
| `COMPILED_UNVERIFIED` | Parses against our grammar; never run anywhere |
| `QUARANTINED(reason)` | Does not compile, and we can say why |
| `FAILED` | The classifier hit a path it does not handle |

CI gates on `FAILED === 0` only. An unhandled path is our bug; a quarantine is a
data problem waiting on the phase that fixes it. A quarantine without a stated
reason is the unknown these tests exist to delete, so a classifier that returns
one gets `no reason given` counted against it in the report — visible, rather
than blending into the quarantine total.

### The expected-loss allowance file

A migration drops things, and some of that is understood and accepted. Left as
magic numbers inside assertions, a real regression looks exactly like a known
gap. They live instead in `migrate/src/verify/expected-loss.ts`, one entry per
concept: what it is, the source count, the expected target count, and why they
differ.

Seam 4 fails on **any** drift from `expectedTarget`, in either direction. Fewer
rows is a regression. More rows means a phase recovered something and left the
declaration stale, which is how an allowance quietly becomes permanent.

`explained: false` marks a gap recorded but not understood. Those are counted
separately so they cannot pass for accepted ones.

### The formula corpus agreement gate

`migrate/src/__tests__/formula-corpus-agreement.test.ts` runs the token renderer
over 37 971 aligned (stored, displayed) formula pairs from real workbooks and
refuses a drop against `migrate/corpus/agreement-baseline.json`.

It reports two rates, because they answer different questions: **distinct** is
how much of the formula language is covered, **weighted** is how many formulas
in a real estate would render. It is a ratchet — raise the baseline by hand, in
the commit that earns it.

## What's Next?

- **[Contributing](contributing.md)** — Submit changes
- **[Architecture](architecture.md)** — System design
- **[Development Setup](development.md)** — Local environment

---

**See Also:** [Developer Guide](../developer-guide/), [Backend Code Guide](backend.md)
