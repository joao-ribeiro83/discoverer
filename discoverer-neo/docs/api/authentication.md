# Authentication Guide

Discoverer Neo uses JWT (JSON Web Token) bearer authentication for all protected API endpoints.

## Overview

- **Access Token:** JWT (HS256 signed), 15 minutes by default (`JWT_EXPIRES_IN`)
- **Refresh Token:** Opaque, stored in Redis, 7 days from login by default (`REFRESH_TOKEN_TTL_SECONDS`). Rotated on every use; rotation never extends the 7 days.
- **Transmission:** HTTP `Authorization` header: `Bearer <token>`
- **Session Invalidation:** Logout blacklists the access token and deletes the refresh token
- **Account Changes:** Role, active status and existence are read from the database on every request and every refresh

## Login Flow

```
1. User POST /api/auth/login { email, password }
           ↓
2. Server validates credentials, generates JWT and refresh token
           ↓
3. Server returns { token, refreshToken, user }
           ↓
4. Client stores both (sessionStorage/localStorage)
           ↓
5. Client includes the access token in all subsequent requests:
   Authorization: Bearer <token>
           ↓
6. Before (or when) the access token expires:
   POST /api/auth/refresh { refreshToken } → { token, refreshToken }
   The old refresh token stops working at once — store the new one.
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
    "refreshToken": "3f1c2a9e-8d4b-4f6e-9a7c-1b2d3e4f5a6b.q8Zr0x1vW2...",
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
  "sid": "3f1c2a9e-8d4b-4f6e-9a7c-1b2d3e4f5a6b",
  "iat": 1687187200,
  "exp": 1687188100
}
```

The `role` claim is a hint for the UI only. The server re-reads the role from
the database on every request.

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

Exchange a refresh token for a new access token **and a new refresh token**.
The access token is not accepted here, expired or not.

Each refresh does these steps:

1. It spends the presented refresh token. The same token never works twice.
2. It reads the account from the database. A deleted or deactivated account
   gets `401`, and its session is deleted.
3. It signs the new access token with the role from the database, not the
   role in any old token.
4. It keeps the session's original expiry. A session that is refreshed every
   few minutes still ends `REFRESH_TOKEN_TTL_SECONDS` after login. Then the
   user must log in again.

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "3f1c2a9e-8d4b-4f6e-9a7c-1b2d3e4f5a6b.q8Zr0x1vW2..."
  }'
```

**Response:** `200 OK`
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWI...",
    "refreshToken": "3f1c2a9e-8d4b-4f6e-9a7c-1b2d3e4f5a6b.Vb7kP2m..."
  }
}
```

**Error Responses:**

- `401 Unauthorized` — The refresh token is unknown, already used, revoked by
  logout, past the session's expiry, or its account is deleted or deactivated.
  The response does not say which.
  ```json
  {
    "error": "Invalid refresh token"
  }
  ```

Two refreshes with the same token at the same moment: one succeeds, and the
other gets `401`. A client must send one refresh at a time and share the result.

### POST /api/auth/logout

Log out. The access token is added to a Redis blacklist, and the refresh token
of the same session is deleted. Neither token works after this call.

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

Access tokens expire after 15 minutes. Refresh before they expire, and share
one in-flight refresh between callers — each refresh token works once, so two
parallel refreshes end the session:

```javascript
let inFlight = null;

// Check token expiration and refresh if needed
function ensureValidToken() {
  const token = localStorage.getItem('authToken');
  const decoded = jwtDecode(token);
  const expiresIn = decoded.exp * 1000 - Date.now();

  if (expiresIn >= 60000) return Promise.resolve(token); // > 1 minute left

  inFlight ??= fetch('http://localhost:3000/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') })
  })
    .then(res => {
      if (!res.ok) throw new Error('Session ended — log in again');
      return res.json();
    })
    .then(({ data }) => {
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('refreshToken', data.refreshToken); // the old one is dead
      return data.token;
    })
    .finally(() => { inFlight = null; });

  return inFlight;
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

When a user logs out, the access token is added to a Redis blacklist with a TTL matching the token's expiration time, and the session's refresh token is deleted. The backend checks the blacklist on every authenticated request. `/api/auth/refresh` never accepts an access token, so a blacklisted one cannot be exchanged for a new one.

### Deprovisioning

Every authenticated request and every refresh reads the account from `users`. A deleted or deactivated account is refused on its next request; a demoted account gets its new role on its next request. The effective session lifetime after deprovisioning is zero requests, not one token lifetime.

### JWT Secret

The JWT secret is configured via the `JWT_SECRET` environment variable (minimum 16 characters). Change it in production:

```bash
JWT_SECRET=$(openssl rand -hex 32) # Generate a strong secret
```

### HTTPS

Always transmit tokens over HTTPS in production. The backend does not enforce HTTPS, but your deployment (Nginx, load balancer, etc.) should.

### Token Expiration

Access tokens expire after 15 minutes (`JWT_EXPIRES_IN`). Sessions end 7 days after login (`REFRESH_TOKEN_TTL_SECONDS`), however often they are refreshed. Clients refresh in two ways:

1. **Proactive Refresh:** Refresh before expiration (see example above)
2. **Reactive Refresh:** Handle 401 responses and refresh once, then retry

Tokens issued before refresh tokens existed have no `sid` and cannot be refreshed. Those users log in again once.

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

# Access token lifetime (e.g., "15m", "1h", "900" seconds)
JWT_EXPIRES_IN=15m

# Session lifetime from login, in seconds. Rotation does not extend it.
REFRESH_TOKEN_TTL_SECONDS=604800
```

---

**See Also:** [API Endpoints Reference](endpoints.md), [Project README](../README.md)
