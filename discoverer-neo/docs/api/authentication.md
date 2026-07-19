# Authentication Guide

Discoverer Neo uses JWT (JSON Web Token) bearer authentication for all protected API endpoints.

## Overview

- **Token Type:** JWT (RS256 signed)
- **Token Lifetime:** 7 days from issuance
- **Refresh Window:** Expired tokens can be refreshed up to 7 days after expiration
- **Transmission:** HTTP `Authorization` header: `Bearer <token>`
- **Session Invalidation:** Token blacklist in Redis (on logout)

## Login Flow

```
1. User POST /api/auth/login { email, password }
           ↓
2. Server validates credentials, generates JWT
           ↓
3. Server returns { token, user }
           ↓
4. Client stores token (sessionStorage/localStorage)
           ↓
5. Client includes in all subsequent requests:
   Authorization: Bearer <token>
```

## Endpoints

### POST /api/auth/login

Log in with email and password.

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your_password"
  }'
```

**Response:** `200 OK`
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJyb2xlIjoiVVNFUiIsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTY4NzE4NzIwMCwiZXhwIjoxNjg3NzcyMDAwfQ.signature",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "USER"
    }
  }
}
```

**Token Payload (decoded):**
```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "USER",
  "iat": 1687187200,
  "exp": 1687772000
}
```

**Error Responses:**

- `400 Bad Request` — Missing email or password
  ```json
  {
    "error": "Validation failed",
    "details": { "fieldErrors": { "email": ["Invalid email"] } }
  }
  ```

- `401 Unauthorized` — Invalid credentials
  ```json
  {
    "error": "Invalid email or password"
  }
  ```

### POST /api/auth/refresh

Refresh an expired or expiring JWT token. Tokens can be refreshed for up to 7 days after expiration.

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**Response:** `200 OK`
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWI..."
  }
}
```

**Error Responses:**

- `401 Unauthorized` — Token invalid
  ```json
  {
    "error": "Invalid token"
  }
  ```

- `401 Unauthorized` — Token expired > 7 days
  ```json
  {
    "error": "Token expired"
  }
  ```

### POST /api/auth/logout

Invalidate the current token and log out. The token is added to a Redis blacklist.

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:** `200 OK`
```json
{
  "data": {
    "message": "Logged out successfully"
  }
}
```

### GET /api/auth/me

Get the currently authenticated user's profile.

**Request:**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:** `200 OK`
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER"
  }
}
```

**Error Responses:**

- `401 Unauthorized` — Missing or invalid token
  ```json
  {
    "error": "Unauthorized"
  }
  ```

## Using Tokens

### In HTTP Headers

All protected API endpoints require the token in the `Authorization` header:

```
Authorization: Bearer <token>
```

**Example:**
```bash
curl -X GET http://localhost:3000/api/maps \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### In Axios/Fetch (JavaScript)

**Axios:**
```javascript
const token = localStorage.getItem('authToken');
const client = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    Authorization: `Bearer ${token}`
  }
});

// Use client for all requests
client.get('/maps').then(res => console.log(res.data));
```

**Fetch API:**
```javascript
const token = localStorage.getItem('authToken');
fetch('http://localhost:3000/api/maps', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
  .then(res => res.json())
  .then(data => console.log(data));
```

## Token Storage

**Client-side storage strategies:**

### Option 1: localStorage (Persistent)
```javascript
// After login
localStorage.setItem('authToken', response.data.token);

// Before logout
localStorage.removeItem('authToken');
```

**Pros:** Survives browser restart  
**Cons:** Vulnerable to XSS attacks

### Option 2: sessionStorage (Session-bound)
```javascript
// After login
sessionStorage.setItem('authToken', response.data.token);

// Cleared on browser close automatically
```

**Pros:** Cleared on browser close  
**Cons:** Lost if user closes browser tab

### Option 3: Memory (Most Secure)
```javascript
let authToken = null;

// After login
authToken = response.data.token;

// Lost on page refresh (use refresh token)
```

**Pros:** Not vulnerable to XSS attacks on localStorage  
**Cons:** Lost on page refresh (requires re-login or refresh token)

## Token Refresh Strategy

Tokens expire after 7 days. Implement client-side refresh to improve UX:

```javascript
// Check token expiration and refresh if needed
function ensureValidToken() {
  const token = localStorage.getItem('authToken');
  const decoded = jwtDecode(token);
  const expiresIn = decoded.exp * 1000 - Date.now();
  
  if (expiresIn < 60000) { // Refresh if < 1 minute left
    return fetch('http://localhost:3000/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
      .then(res => res.json())
      .then(data => {
        localStorage.setItem('authToken', data.data.token);
        return data.data.token;
      });
  }
  
  return Promise.resolve(token);
}
```

## User Roles

Tokens include a `role` claim. Use it for client-side UI logic (authorization still happens server-side):

| Role | Capabilities |
|------|-------------|
| **ADMIN** | Full system access, user management |
| **MANAGER** | Can manage business areas and grants |
| **USER** | Can create and run maps |
| **VIEWER** | Read-only access to shared maps |

```javascript
const decoded = jwtDecode(token);
if (decoded.role === 'ADMIN') {
  // Show admin panel
}
```

## Security Considerations

### Token Blacklisting

When a user logs out, the token is added to a Redis blacklist with a TTL matching the token's expiration time. The backend checks the blacklist on every authenticated request.

### JWT Secret

The JWT secret is configured via the `JWT_SECRET` environment variable (minimum 16 characters). Change it in production:

```bash
JWT_SECRET=$(openssl rand -hex 32) # Generate a strong secret
```

### HTTPS

Always transmit tokens over HTTPS in production. The backend does not enforce HTTPS, but your deployment (Nginx, load balancer, etc.) should.

### Token Expiration

Tokens expire after 7 days (`JWT_EXPIRES_IN` config). Users must refresh:

1. **Proactive Refresh:** Refresh before expiration (see example above)
2. **Reactive Refresh:** Handle 401 responses and refresh, then retry

### XSS Protection

Store tokens securely:
- Avoid `localStorage` if your app has XSS vulnerabilities
- Use `httpOnly` cookies if available (requires backend support)
- Consider memory-only storage for most-sensitive deployments

## Environment Configuration

Authentication is configured via environment variables in `backend/.env`:

```bash
# JWT secret (minimum 16 characters, should be cryptographically random)
JWT_SECRET=your_secure_secret_change_in_production

# Token lifetime (e.g., "7d", "24h", "1800" seconds)
JWT_EXPIRES_IN=7d
```

---

**See Also:** [API Endpoints Reference](endpoints.md), [Project README](../README.md)
