<!--
Merged from:
- autoskills-main/packages/autoskills/skills-registry/clerk-nextjs-patterns/SKILL.md
- autoskills-main/packages/autoskills/skills-registry/clerk-react-patterns/SKILL.md
- autoskills-main/packages/autoskills/skills-registry/clerk-astro-patterns/SKILL.md
- autoskills-main/packages/autoskills/skills-registry/clerk-vue-patterns/SKILL.md
- autoskills-main/packages/autoskills/skills-registry/clerk-expo-patterns/SKILL.md
- autoskills-main/packages/autoskills/skills-registry/clerk-android/SKILL.md
- autoskills-main/packages/autoskills/skills-registry/clerk-swift/SKILL.md
- autoskills-main/packages/autoskills/skills-registry/clerk-backend-api/SKILL.md
- autoskills-main/packages/autoskills/skills-registry/clerk-setup/SKILL.md
- autoskills-main/packages/autoskills/skills-registry/clerk-custom-ui/SKILL.md
-->

# Clerk Authentication Guide

Complete authentication solution for React, Next.js, Vue, Nuxt, Astro, Express, Fastify, Expo, and mobile platforms.

## When to Use This Skill

- Adding authentication to React, Next.js, Vue, Nuxt, Astro applications
- Implementing B2B organizations and multi-tenant auth
- Setting up protected routes and middleware
- Creating custom sign-in/sign-up flows
- Migrating from another auth provider
- Integrating webhooks for user sync

---

## Framework Detection

Check `package.json` to identify the framework:

| Dependency | Framework | Package | Quickstart URL |
|------------|-----------|---------|----------------|
| `next` | Next.js | `@clerk/nextjs` | https://clerk.com/docs/nextjs/getting-started/quickstart |
| `react` (no framework) | React SPA | `@clerk/react` | https://clerk.com/docs/react/getting-started/quickstart |
| `astro` | Astro | `@clerk/astro` | https://clerk.com/docs/astro/getting-started/quickstart |
| `nuxt` | Nuxt | `@clerk/nuxt` | https://clerk.com/docs/nuxt/getting-started/quickstart |
| `react-router` | React Router | `@clerk/react-router` | https://clerk.com/docs/react-router/getting-started/quickstart |
| `@tanstack/react-start` | TanStack Start | `@clerk/tanstack-react-start` | https://clerk.com/docs/tanstack-react-start/getting-started/quickstart |
| `vue` | Vue | `@clerk/vue` | https://clerk.com/docs/vue/getting-started/quickstart |
| `express` | Express | `@clerk/express` | https://clerk.com/docs/expressjs/getting-started/quickstart |
| `fastify` | Fastify | `@clerk/fastify` | https://clerk.com/docs/fastify/getting-started/quickstart |
| `expo` | Expo | `@clerk/expo` | https://clerk.com/docs/expo/getting-started/quickstart |
| Android | Android | `@clerk/android` | https://clerk.com/docs/android/getting-started/quickstart |
| iOS | iOS/Swift | `@clerk/swift` | https://clerk.com/docs/ios/getting-started/quickstart |

---

## Setup Process

### 1. Get API Keys

**Keyless (Automatic)** - On first SDK initialization, Clerk auto-generates dev keys.

**Manual** - Get keys from [dashboard.clerk.com](https://dashboard.clerk.com/last-active?path=api-keys):
- **Publishable Key**: Starts with `pk_test_` or `pk_live_`
- **Secret Key**: Starts with `sk_test_` or `sk_live_`

### 2. Install SDK

```bash
# Next.js
npm install @clerk/nextjs

# React SPA
npm install @clerk/react

# Vue
npm install @clerk/vue

# Express/Fastify
npm install @clerk/express
```

---

## React SPA Patterns

### Setup

```tsx
// src/main.tsx
import { ClerkProvider } from '@clerk/react'
import App from './App.tsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

createRoot(document.getElementById('root')!).render(
  <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
    <App />
  </ClerkProvider>
)
```

### Minimal Pattern

```tsx
import { useAuth } from '@clerk/react'

export function Dashboard() {
  const { isLoaded, isSignedIn, userId } = useAuth()

  if (!isLoaded) return <div>Loading...</div>
  if (!isSignedIn) return <div>Please sign in</div>

  return <div>Hello {userId}</div>
}
```

### Protected Route (React Router v6/v7)

```tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@clerk/react'

export function ProtectedRoute() {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) return <div>Loading...</div>
  if (!isSignedIn) return <Navigate to="/sign-in" replace />

  return <Outlet />
}

// In routing:
<Routes>
  <Route element={<ProtectedRoute />}>
    <Route path="/dashboard" element={<Dashboard />} />
  </Route>
</Routes>
```

---

## Next.js Patterns

### Server vs Client Auth

**Server Components** use async `auth()`:
```typescript
// Server Component
import { auth } from '@clerk/nextjs/server'

export default async function Page() {
  const { isAuthenticated, userId } = await auth()  // MUST await!
  if (!isAuthenticated) return <p>Not signed in</p>
  return <p>Hello {userId}</p>
}
```

**Client Components** use hooks:
```typescript
'use client'
import { useAuth } from '@clerk/nextjs'

export function Dashboard() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  if (!isLoaded) return <div>Loading...</div>
  if (!isSignedIn) return <div>Please sign in</div>
  return <div>Hello {userId}</div>
}
```

### ClerkProvider in Root Layout

```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  )
}
```

### Token for API Calls

**Server-side:**
```typescript
import { auth } from '@clerk/nextjs/server'

export default async function Page() {
  const { getToken } = await auth()
  const token = await getToken({ template: 'hasura' })
  
  const res = await fetch('https://api.example.com/graphql', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  return <pre>{JSON.stringify(data)}</pre>
}
```

**Client-side:**
```typescript
'use client'
import { useAuth } from '@clerk/nextjs'

export function DataFetcher() {
  const { getToken } = useAuth()

  async function fetchData() {
    const token = await getToken({ template: 'supabase' })
    if (!token) return

    const res = await fetch('/api/data', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.json()
  }

  return <button onClick={fetchData}>Fetch</button>
}
```

### Middleware Configuration (Next.js 15)

```typescript
// middleware.ts
import { clerkMiddleware } from '@clerk/nextjs/server'

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
    '/api/(.*)',
  ],
}

export default clerkMiddleware()
```

---

## Vue.js Patterns

### Setup

```javascript
// plugins/clerk.ts
import { Clerk } from '@clerk/vue'

export default defineNuxtApp(() => {
  const clerk = Clerk.load({ publishableKey: useRuntimeConfig().public.clerkPublishableKey })
  return { clerk }
})
```

---

## Expo / React Native Patterns

### Setup

```typescript
// App.tsx
import { ClerkProvider, SignedIn, SignedOut } from '@clerk/expo'

export default function App() {
  return (
    <ClerkProvider publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <SignedIn>
        <MainApp />
      </SignedIn>
      <SignedOut>
        <SignInScreen />
      </SignedOut>
    </ClerkProvider>
  )
}
```

---

## Express / Fastify Patterns

### Setup

```javascript
import { clerkMiddleware, requireAuth } from '@clerk/express'
import express from 'express'

const app = express()

app.use(clerkMiddleware())

app.get('/protected', requireAuth(), (req, res) => {
  res.json({ message: `Hello ${req.auth.userId}` })
})
```

---

## Organizations (B2B Multi-Tenant)

### Detect Organization Context

```typescript
import { auth } from '@clerk/nextjs/server'

export default async function Page() {
  const { has } = await auth()
  
  // Check if user has organization
  const hasOrg = has({ permission: 'org:view' })
  
  // Get organization info from JWT claims
  const { orgId, orgSlug } = await auth()
}
```

---

## Custom Sign-In / Sign-Up

### Using Appearances

```tsx
<ClerkProvider appearance={{
  theme: shadcn,
  variables: {
    colorPrimary: '#3b82f6',
  },
  elements: {
    formButtonPrimary: 'bg-blue-500 hover:bg-blue-600',
  }
}}>
  <SignIn />
</ClerkProvider>
```

---

## Webhooks

Set up webhooks for user synchronization:

```typescript
// /api/webhooks/clerk
import { verifyWebhook } from '@clerk/webhooks'

export async function POST(req: Request) {
  const event = verifyWebhook(req)
  
  switch (event.type) {
    case 'user.created':
      // Create user in your database
      break
    case 'user.updated':
      // Update user in your database
      break
    case 'user.deleted':
      // Delete user from your database
      break
  }
}
```

---

## Backend API

Use `@clerk/backend` for manual JWT verification:

```typescript
import { verifyToken } from '@clerk/backend'

const token = req.headers.authorization?.replace('Bearer ', '')
if (!token) return res.status(401).json({ error: 'No token' })

try {
  const claims = await verifyToken(token, {
    jwtKey: process.env.CLERK_JWT_KEY,
  })
  // claims.sub = userId
} catch {
  return res.status(401).json({ error: 'Invalid token' })
}
```

---

## Migration from Other Auth Providers

### Detect Existing Auth

Check `package.json` for:
- `next-auth` / `@auth/core` → NextAuth/Auth.js
- `@supabase/supabase-js` → Supabase Auth
- `firebase` / `firebase-admin` → Firebase Auth
- `@aws-amplify/auth` → AWS Cognito
- `@auth0/nextjs-auth0` → Auth0
- `passport` → Passport.js

### Migration Strategies

- **Big bang** - Switch all users at once (simpler)
- **Trickle migration** - Run both systems temporarily (lower risk)

---

## Common Pitfalls

| Level | Issue | Solution |
|-------|-------|----------|
| CRITICAL | Missing `await` on `auth()` | In Next.js 15+, use `await auth()` |
| CRITICAL | Exposing `CLERK_SECRET_KEY` | Never use secret key in client code |
| HIGH | Missing middleware matcher | Include API routes in matcher |
| HIGH | ClerkProvider placement | Must be inside `<body>` in root layout |
| HIGH | Auth routes not public | Allow `/sign-in`, `/sign-up` in middleware |
| MEDIUM | Wrong import path | Server: `@clerk/nextjs/server`, Client: `@clerk/nextjs` |

---

## References

- [Clerk Documentation](https://clerk.com/docs)
- [Next.js SDK](https://clerk.com/docs/reference/nextjs/overview)
- [React SDK](https://clerk.com/docs/react/getting-started/quickstart)
- [Migration Guide](https://clerk.com/docs/guides/development/migrating/overview)