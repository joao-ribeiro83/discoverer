<!--
Merged from:
- skills-main (2)/skills-main/auth0-authentication/SKILL.md
- agents-main (2)/agents-main/plugins/auth0/skills/auth0-mfa/SKILL.md
- autoskills-main/packages/autoskills/skills-registry/clerk-astro-patterns/SKILL.md
-->

# Authentication Patterns

Comprehensive authentication patterns covering OAuth, JWT, MFA, and session management.

## Core Authentication Principles

### Security Best Practices

- Always use HTTPS for all authentication communications
- Store sensitive configuration in environment variables, never in code
- Implement proper error handling for all authentication flows
- Follow the principle of least privilege for scopes and permissions

---

## OAuth 2.0 / OIDC

### Authorization Code Flow with PKCE (Recommended for SPAs)

```javascript
import { Auth0Client } from '@auth0/auth0-spa-js';

const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: process.env.AUTH0_AUDIENCE,
  },
  cacheLocation: 'localstorage',
  useRefreshTokens: true,
});
```

### Server-Side Applications

```javascript
// Express.js example
const { auth } = require('express-openid-connect');

app.use(
  auth({
    authRequired: false,
    auth0Logout: true,
    secret: process.env.AUTH0_SECRET,
    baseURL: process.env.BASE_URL,
    clientID: process.env.AUTH0_CLIENT_ID,
    issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  })
);
```

---

## JWT Token Management

### Token Validation

```javascript
const { auth, requiredScopes } = require('express-oauth2-jwt-bearer');

const checkJwt = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
  tokenSigningAlg: 'RS256',
});

const checkScopes = requiredScopes('read:messages');

app.get('/api/private-scoped', checkJwt, checkScopes, (req, res) => {
  res.json({ message: 'Protected resource' });
});
```

### Token Best Practices

- Access tokens: 1 hour max lifetime
- Refresh tokens: Enable rotation, set appropriate lifetimes
- Implement automatic token refresh in client
- Validate tokens on every request

---

## Multi-Factor Authentication (MFA)

### Supported MFA Factors

| Factor | Type | Description |
|--------|------|-------------|
| TOTP | Something you have | Time-based one-time passwords (Google Authenticator, Authy) |
| SMS | Something you have | One-time codes via text message |
| Email | Something you have | One-time codes via email |
| Push | Something you have | Push notifications via Auth0 Guardian |
| WebAuthn | Something you have/are | Security keys, biometrics, passkeys |

### Step-Up Authentication

```javascript
// Request MFA for sensitive operations
const acr_values = 'http://schemas.openid.net/pape/policies/2007/06/multi-factor';

// Implementation pattern
exports.onExecutePostLogin = async (event, api) => {
  // Check if MFA has been completed
  if (!event.authentication?.methods?.find(m => m.name === 'mfa')) {
    api.authentication.challengeWithAny([
      { type: 'otp' },
      { type: 'push-notification' },
    ]);
  }
};
```

---

## Clerk Authentication

### React Integration

```tsx
import { ClerkProvider } from '@clerk/react'

export default function App() {
  return (
    <ClerkProvider publishableKey={process.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>
      </Routes>
    </ClerkProvider>
  )
}

export function ProtectedRoute() {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded) return <div>Loading...</div>
  if (!isSignedIn) return <Navigate to="/sign-in" replace />
  return <Outlet />
}
```

### Next.js Integration

```typescript
// Server Component
import { auth } from '@clerk/nextjs/server'

export default async function Page() {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) return <p>Not signed in</p>
  return <p>Hello {userId}</p>
}
```

---

## Session Management

### Secure Session Configuration

```javascript
// Express/Fastify session
import session from 'express-session';

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
```

### Flask Session Management

```python
app.secret_key = os.getenv("AUTH0_SECRET")
app.config.update(
    SESSION_COOKIE_SECURE=not development,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
)
```

---

## Token Storage

### Secure Storage Guidelines

- **Web**: Never store tokens in localStorage - use memory or httpOnly cookies
- **Mobile**: Use secure keychain/keystore (iOS Keychain, Android Keystore)
- **React Native**: @react-native-async-storage/async-storage with encryption
- **Server**: Never expose tokens in logs or error messages

---

## Common Mistakes to Avoid

| Mistake | Fix |
|---------|-----|
| Storing tokens in localStorage without considering XSS risks | Use httpOnly cookies or in-memory storage |
| Not validating tokens on the server side | Always validate JWT signature and claims |
| Using the implicit flow (deprecated) | Use Authorization Code Flow with PKCE |
| Hardcoding client secrets in frontend code | Use environment variables, never commit secrets |
| Not implementing proper logout | Clear both local and Auth0 session |
| Ignoring token expiration in API calls | Implement automatic refresh |
| Storing too much data in user metadata | Minimize user metadata storage |

---

## Migration Between Auth Providers

### Detection

Check `package.json` for existing auth libraries:
- `next-auth`, `@auth/core` → NextAuth/Auth.js
- `@supabase/supabase-js` → Supabase Auth
- `firebase`, `firebase-admin` → Firebase Auth
- `auth0`, `@auth0/nextjs-auth0` → Auth0
- `passport` → Passport.js

### Migration Strategy

1. Audit current auth touchpoints
2. Create user export/import plan
3. Choose migration approach:
   - **Big bang**: Switch all users at once
   - **Trickle migration**: Run both systems temporarily