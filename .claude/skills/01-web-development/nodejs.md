<!--
Merged from:
- agent-skills-main (1)/agent-skills-main/nodejs-best-practices/SKILL.md
-->

# Node.js Best Practices

Node.js development patterns for backend APIs, Express middleware, and server-side optimization.

## When to Use

- Building Node.js backend applications
- Working with Express.js or Fastify frameworks
- Optimizing Node.js performance and memory usage
- Implementing middleware patterns
- Building API routes and handlers

---

## Express.js Patterns

### Basic Server Setup

```javascript
const express = require('express');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/api/users', async (req, res) => {
  try {
    const users = await getUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### Middleware Pattern

```javascript
// Authentication middleware
function withAuth(handler) {
  return async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await verifyToken(token);
      req.user = user;
      return handler(req, res);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

// Usage
app.get('/api/protected', withAuth(async (req, res) => {
  res.json({ user: req.user });
}));
```

---

## Performance Patterns

### Query Optimization

```javascript
// Bad - N+1 queries
const markets = await db.markets.findMany();
for (const market of markets) {
  market.creator = await db.users.findUnique({ where: { id: market.creator_id } });
}

// Good - Single query with joins
const markets = await db.markets.findMany({
  include: { creator: true }
});
```

### Caching Strategy

```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 });

async function getCachedUsers() {
  const cached = cache.get('users');
  if (cached) return cached;

  const users = await db.users.findMany();
  cache.set('users', users);
  return users;
}
```

---

## Error Handling

```javascript
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Centralized error handler
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}

app.use(errorHandler);
```

---

## Best Practices

1. Use async/await for database operations
2. Implement proper error handling with try/catch
3. Validate input data with schemas (Zod, Joi)
4. Use connection pooling for databases
5. Cache expensive operations
6. Log structured data for monitoring
7. Implement rate limiting
8. Use environment variables for secrets
9. Handle graceful shutdown
10. Monitor memory usage and prevent leaks