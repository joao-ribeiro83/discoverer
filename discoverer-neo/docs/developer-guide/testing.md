# Testing

Learn how to write and run tests for Discoverer Neo.

## Backend Testing

Backend uses **Jest** for unit and integration tests.

### Running Tests

```bash
# All tests
npm run test --workspace=backend

# Watch mode (re-run on changes)
npm run test:watch --workspace=backend

# Integration tests only
npm run test:integration --workspace=backend

# Specific test file
npm run test -- auth.test.ts --workspace=backend

# Coverage report
npm run test -- --coverage --workspace=backend
```

### Test Files

Located in `backend/src/__tests__/`:

- `**/*.test.ts` — Unit tests
- `integration/` — Integration tests (require services)

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
- **Test database** — Isolated PostgreSQL for integration tests

### Coverage Goals

Target > 80% coverage:

```bash
npm run test -- --coverage --workspace=backend

# See coverage report
open backend/coverage/lcov-report/index.html
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

## CI/CD Testing

Tests run in CI/CD pipeline (GitHub Actions):

```bash
npm run lint          # ESLint
npm run typecheck    # TypeScript type-check
npm run test         # Jest + Vitest
npm run e2e          # Playwright
```

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

## What's Next?

- **[Contributing](contributing.md)** — Submit changes
- **[Architecture](architecture.md)** — System design
- **[Development Setup](development.md)** — Local environment

---

**See Also:** [Developer Guide](../developer-guide/), [Backend Code Guide](backend.md)
