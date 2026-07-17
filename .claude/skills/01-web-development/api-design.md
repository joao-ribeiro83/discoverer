<!--
Merged from:
- Claude-Cortex-main/skills/api-design-patterns/SKILL.md
- ECC-main/.agents/skills/api-design/SKILL.md
-->

# API Design Patterns

Comprehensive REST and GraphQL API design patterns with versioning, pagination, error handling, and HATEOAS principles.

## When to Use This Skill

- Designing new REST or GraphQL APIs from scratch
- Refactoring existing APIs for better scalability
- Defining service contracts for microservices
- Implementing versioning strategies
- Standardizing error handling and response formats
- Designing pagination for large datasets

---

## Quick Reference

| Topic | Reference |
| --- | --- |
| **Design Process** | Design systematic approach for API architecture |

---

## Core Principles

### 1. Resource-Oriented Design (REST)

**URLs represent resources, not actions:**
```
✓ GET    /users/123
✓ POST   /users
✓ PUT    /users/123
✓ DELETE /users/123

✗ GET    /getUser?id=123
✗ POST   /createUser
✗ POST   /deleteUser
```

### 2. Consistent Naming Conventions

```
Resources:        /users, /orders, /products (plural nouns)
Nested:           /users/123/orders
Collections:      /users?status=active&page=2
Sub-resources:    /users/123/settings
Actions (rare):   /users/123/activate (POST)
```

### 3. HTTP Status Codes

**Success:**
- 200 OK: Standard response for GET, PUT, PATCH
- 201 Created: Resource created (POST), return Location header
- 202 Accepted: Async processing started
- 204 No Content: Success with no response body (DELETE)

**Client Errors:**
- 400 Bad Request: Invalid syntax or validation failure
- 401 Unauthorized: Authentication required or failed
- 403 Forbidden: Authenticated but insufficient permissions
- 404 Not Found: Resource doesn't exist
- 409 Conflict: State conflict (duplicate, version mismatch)
- 422 Unprocessable Entity: Semantic validation failure
- 429 Too Many Requests: Rate limit exceeded

**Server Errors:**
- 500 Internal Server Error: Unexpected server failure
- 502 Bad Gateway: Upstream service failure
- 503 Service Unavailable: Temporary overload or maintenance

---

## Versioning Strategies

### URI Versioning (Most Common)

```
GET /v1/users/123
GET /v2/users/123

Pros: Clear, easy to route, browser-testable
Cons: URL proliferation, cache fragmentation
When: Public APIs, major breaking changes
```

### Header Versioning

```
GET /users/123
Accept: application/vnd.myapi.v2+json

Pros: Clean URLs, content negotiation
Cons: Harder to test, caching complexity
When: Internal APIs, minor version differences
```

### Deprecation Headers

```http
Sunset: Sat, 31 Dec 2024 23:59:59 GMT
Deprecation: true
Link: <https://api.example.com/v2/users/123>; rel="successor-version"
```

---

## Pagination Patterns

### Offset-Based Pagination

```
GET /users?limit=20&offset=40

Response:
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "offset": 40,
    "total": 1543
  },
  "links": {
    "next": "/users?limit=20&offset=60",
    "prev": "/users?limit=20&offset=20"
  }
}

When: Small datasets, stable data, admin UIs
```

### Cursor-Based Pagination

```
GET /users?limit=20&cursor=eyJpZCI6MTIzfQ

Response:
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTQzfQ",
    "has_more": true
  },
  "links": {
    "next": "/users?limit=20&cursor=eyJpZCI6MTQzfQ"
  }
}

When: Large datasets, real-time feeds, infinite scroll
```

---

## Error Response Format

### Standard Error Schema

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "code": "INVALID_FORMAT",
        "message": "Email format is invalid"
      }
    ],
    "request_id": "req_a3f7c9b2",
    "timestamp": "2024-01-15T10:30:00Z",
    "documentation_url": "https://docs.api.com/errors/VALIDATION_ERROR"
  }
}
```

### Error Code Patterns

```
Format: CATEGORY_SPECIFIC_REASON

Authentication:
- AUTH_MISSING_TOKEN
- AUTH_INVALID_TOKEN
- AUTH_EXPIRED_TOKEN

Authorization:
- AUTHZ_INSUFFICIENT_PERMISSIONS
- AUTHZ_RESOURCE_FORBIDDEN

Validation:
- VALIDATION_MISSING_FIELD
- VALIDATION_INVALID_FORMAT
- VALIDATION_OUT_OF_RANGE

Business Logic:
- BUSINESS_DUPLICATE_EMAIL
- BUSINESS_INSUFFICIENT_BALANCE
- BUSINESS_OPERATION_NOT_ALLOWED

System:
- SYSTEM_INTERNAL_ERROR
- SYSTEM_SERVICE_UNAVAILABLE
- SYSTEM_RATE_LIMIT_EXCEEDED
```

---

## Filtering and Searching

### Query Parameters

```
GET /users?status=active&role=admin&created_after=2024-01-01
GET /users?search=john&fields=name,email
GET /users?sort=-created_at,name  # - prefix for descending
```

### Field Selection (Sparse Fieldsets)

```
GET /users/123?fields=id,name,email

Benefits:
- Reduced payload size
- Faster response times
- Lower bandwidth consumption
- Better mobile performance
```

---

## HATEOAS (Hypermedia)

### HAL Format

```json
{
  "id": 123,
  "name": "John Doe",
  "_links": {
    "self": { "href": "/users/123" },
    "orders": { "href": "/users/123/orders" },
    "update": { "href": "/users/123", "method": "PUT" },
    "delete": { "href": "/users/123", "method": "DELETE" }
  }
}
```

---

## Rate Limiting Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 742
X-RateLimit-Reset: 1705320000
Retry-After: 3600
```

---

## Authentication Patterns

### Bearer Token (OAuth 2.0, JWT)

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

When: Modern APIs, microservices
```

### API Key

```http
X-API-Key: ak_live_a3f7c9b2d8e1f4g6h9

When: Internal services, admin APIs
```

---

## Idempotency

### Idempotency Keys (POST)

```http
POST /payments
Idempotency-Key: a3f7c9b2-d8e1-4f6g-h9i0-j1k2l3m4n5o6

# Server stores key + response for 24 hours
# Duplicate requests return cached response with 200 OK
```

---

## Caching Strategies

### ETags

```http
# Initial request
GET /users/123
ETag: "a3f7c9b2"

# Subsequent request
GET /users/123
If-None-Match: "a3f7c9b2"

# Response if unchanged:
304 Not Modified
```

---

## GraphQL Patterns

### Query Structure

```graphql
query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
    orders(first: 10) {
      edges {
        node {
          id
          total
          status
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
```

### Error Handling

```json
{
  "data": { "user": null },
  "errors": [{
    "message": "User not found",
    "extensions": { "code": "NOT_FOUND", "userId": "123" }
  }]
}
```

---

## Best Practices Summary

1. **Consistency**: Follow conventions across all endpoints
2. **Versioning**: Plan deprecation strategy from day one
3. **Documentation**: Use OpenAPI/GraphQL schemas
4. **Error Handling**: Detailed, actionable error messages
5. **Security**: HTTPS, validate inputs, rate limit
6. **Performance**: Caching, pagination, field selection
7. **Monitoring**: Log request IDs, track metrics
8. **Backward Compatibility**: Additive changes only
9. **Testing**: Contract tests, integration tests
10. **Documentation**: Interactive docs (Swagger, GraphQL Playground)