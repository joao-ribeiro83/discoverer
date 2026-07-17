<!--
Merged from:
- application-skills-main/skills/auth0/SKILL.md
- skills-main (2)/skills-main/auth0-authentication/SKILL.md
- skills-main (5)/skills-main/auth0-authentication/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-angular/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-angular/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-aspnetcore-api/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-aspnetcore-authentication/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-branding/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-cli/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-custom-domains/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-expo/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-express/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-fastapi-api/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-fastify/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-fastify-api/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-flask/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-flutter-native/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-flutter-web/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-ionic-angular/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-ionic-react/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-ionic-vue/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-java-mvc-common/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-laravel/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-laravel-api/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-maui/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-mfa/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-migration/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-net-android/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-net-ios/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-nextjs/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-nuxt/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-php/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-php-api/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-quickstart/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-react/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-react-native/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-spa-js/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-springboot-api/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-swift/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-vue/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-winforms/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-wpf/SKILL.md
-->

# Auth0 Integration Guide

Auth0 is an identity management platform that provides authentication and authorization services for applications. Developers use Auth0 to add secure login and access control features to their web, mobile, and legacy applications. It simplifies the process of user authentication, single sign-on, and identity federation.

Official docs: https://auth0.com/docs

## Core Principles

- Always use HTTPS for all Auth0 communications and callbacks
- Store sensitive configuration (client secrets, API keys) in environment variables, never in code
- Implement proper error handling for all authentication flows
- Follow the principle of least privilege for scopes and permissions

## Auth0 Overview

- **User** - Authentication Method
- **Client** - Application
- **Connection** - Authentication provider
- **Resource Server** - API protected by Auth0
- **Custom Domain** - Custom domain for Auth0
- **Grant** - Authorization grant
- **Log** - Authentication logs
- **Branding** - Universal Login branding

---

## Auth0 CLI — Command Reference

The Auth0 CLI (`auth0`) lets you manage your tenant from the terminal.

### Install Auth0 CLI

**macOS/Linux:**
```bash
brew install auth0/auth0-cli/auth0
```

**Windows:**
```powershell
scoop install auth0
# Or: choco install auth0-cli
```

### Authenticate

```bash
auth0 login                          # interactive device-code login
auth0 login --scopes "read:client_grants"  # request extra scopes if needed
auth0 login --domain <tenant>.auth0.com --client-id <id> --client-secret "$AUTH0_CLIENT_SECRET"  # CI/CD
```

### Quick Decision Guide

| What you're doing | Command to use |
|-------------------|---------------|
| Setting up a new project | `auth0 apps create --type spa\|regular\|m2m\|native --json` |
| Need a client ID or secret | `auth0 apps show <id> -r --json` |
| Registering a backend API | `auth0 apis create --identifier "https://..." --json` |
| Finding a user's ID | `auth0 users search --query "email:..." --json` |
| Creating roles (RBAC) | `auth0 roles create` / `auth0 users roles assign` |
| B2B multi-tenancy | `auth0 orgs create` |
| Custom login logic | `auth0 actions create --trigger post-login --json` |
| Branding the login page | `auth0 ul update --logo ... --accent ...` |
| Custom domain for login | `auth0 domains create --domain "auth.myapp.com" --json` |
| Debugging a failed login | `auth0 logs tail --filter "type:f" --json-compact` |
| Testing a login flow | `auth0 test login <client-id>` |
| Exporting config as Terraform | `auth0 terraform generate --output-dir ./terraform` |

### Key Commands

**Apps - Manage Applications:**
```bash
auth0 apps create --name "My SPA" --type spa \
  --auth-method None \
  --callbacks "http://localhost:3000" \
  --logout-urls "http://localhost:3000" \
  --origins "http://localhost:3000" --json

auth0 apps list --json-compact
auth0 apps show <client-id> --json
auth0 apps update <client-id> --callbacks "http://localhost:3000,https://myapp.com" --json
```

**APIs - Manage API Resources:**
```bash
auth0 apis create --name "My API" --identifier "https://api.myapp.com" \
  --scopes "read:data,write:data" --token-lifetime 3600 --json

auth0 apis list --json-compact
auth0 apis scopes list <api-id> --json
```

---

## Framework-Specific Integration Guides

### React (Vite/CRA) - auth0-react

Add authentication to React single-page applications using @auth0/auth0-react.

**Prerequisites:**
- React 16.11+ application
- Auth0 account and application configured

**Quick Start:**

1. **Install SDK:**
```bash
npm install @auth0/auth0-react
```

2. **Configure Environment:**

**Vite:**
```bash
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
```

**Create React App:**
```bash
REACT_APP_AUTH0_DOMAIN=your-tenant.auth0.com
REACT_APP_AUTH0_CLIENT_ID=your-client-id
```

3. **Wrap App with Auth0Provider:**
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin
      }}
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>
);
```

4. **Add Authentication UI:**
```tsx
import { useAuth0 } from '@auth0/auth0-react';

export function LoginButton() {
  const { loginWithRedirect, logout, isAuthenticated, user, isLoading } = useAuth0();

  if (isLoading) return <div>Loading...</div>;

  if (isAuthenticated) {
    return (
      <div>
        <span>Welcome, {user?.name}</span>
        <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
          Logout
        </button>
      </div>
    );
  }

  return <button onClick={() => loginWithRedirect()}>Login</button>;
}
```

**Quick Reference - Core Hooks:**
- `useAuth0()` - Main authentication hook
- `isAuthenticated` - Check if user is logged in
- `user` - User profile information
- `loginWithRedirect()` - Initiate login
- `logout()` - Log out user
- `getAccessTokenSilently()` - Get access token for API calls
- `mfa` - MFA API client for enrollment, challenge, and verification

---

### Next.js - auth0-nextjs

Add authentication to Next.js applications using @auth0/nextjs-auth0. Supports both App Router and Pages Router.

**Prerequisites:**
- Next.js 13+ application
- Auth0 account and application configured

**Quick Start:**

1. **Install SDK:**
```bash
npm install @auth0/nextjs-auth0
```

2. **Configure Environment:**
```bash
AUTH0_SECRET=<generate-a-32-character-secret>
APP_BASE_URL=http://localhost:3000
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
```

Generate secret: `openssl rand -hex 32`

3. **Create Auth0 Client and Middleware:**

Create `lib/auth0.ts`:
```typescript
import { Auth0Client } from '@auth0/nextjs-auth0/server';

export const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  secret: process.env.AUTH0_SECRET!,
  appBaseUrl: process.env.APP_BASE_URL!,
});
```

**Middleware Configuration (Next.js 15):**
```typescript
import { NextRequest } from 'next/server';
import { auth0 } from '@/lib/auth0';

export async function middleware(request: NextRequest) {
  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
```

4. **Add Authentication UI:**
```typescript
'use client';

import { useUser } from '@auth0/nextjs-auth0/client';

export default function Profile() {
  const { user, isLoading } = useUser();

  if (isLoading) return <div>Loading...</div>;

  if (user) {
    return (
      <div>
        <img src={user.picture} alt={user.name} />
        <h2>Welcome, {user.name}!</h2>
        <a href="/auth/logout">Logout</a>
      </div>
    );
  }

  return <a href="/auth/login">Login</a>;
}
```

**Quick Reference - V4 Setup:**
- Detect `src/` convention: check if `src/app/` or `src/pages/` exists
- Create `lib/auth0.ts` with `Auth0Client` instance
- Create middleware configuration (required)
- Optional: Wrap with `<Auth0Provider>` for SSR user

---

### Vue.js - auth0-vue

Add authentication to Vue.js 3 single-page applications using @auth0/auth0-vue.

**Quick Start:**

1. **Install SDK:**
```bash
npm install @auth0/auth0-vue
```

2. **Configure Environment:**
```bash
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
```

3. **Configure Auth0 Plugin:**
```typescript
import { createApp } from 'vue';
import { createAuth0 } from '@auth0/auth0-vue';
import App from './App.vue';

const app = createApp(App);

app.use(
  createAuth0({
    domain: import.meta.env.VITE_AUTH0_DOMAIN,
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
    authorizationParams: {
      redirect_uri: window.location.origin
    }
  })
);

app.mount('#app');
```

4. **Add Authentication UI:**
```vue
<script setup lang="ts">
import { useAuth0 } from '@auth0/auth0-vue';

const { loginWithRedirect, logout, isAuthenticated, user, isLoading } = useAuth0();
</script>

<template>
  <div>
    <div v-if="isLoading">Loading...</div>

    <div v-else-if="isAuthenticated">
      <img :src="user?.picture" :alt="user?.name" />
      <span>Welcome, {{ user?.name }}</span>
      <button @click="logout({ logoutParams: { returnTo: window.location.origin }})">
        Logout
      </button>
    </div>

    <button v-else @click="loginWithRedirect()">
      Login
    </button>
  </div>
</template>
```

---

### Angular - auth0-angular

Add authentication to Angular applications using @auth0/auth0-angular.

**Quick Start:**

1. **Install SDK:**
```bash
npm install @auth0/auth0-angular
```

2. **Configure Environment (src/environments/environment.ts):**
```typescript
export const environment = {
  production: false,
  auth0: {
    domain: 'your-tenant.auth0.com',
    clientId: 'your-client-id',
    authorizationParams: {
      redirect_uri: window.location.origin
    }
  }
};
```

3. **Configure Auth Module:**

**For standalone components (Angular 14+):**
```typescript
import { ApplicationConfig } from '@angular/core';
import { provideAuth0 } from '@auth0/auth0-angular';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAuth0({
      domain: environment.auth0.domain,
      clientId: environment.auth0.clientId,
      authorizationParams: environment.auth0.authorizationParams
    })
  ]
};
```

4. **Add Authentication UI:**
```typescript
import { Component } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';

@Component({
  selector: 'app-root',
  template: `
    <div *ngIf="auth.isLoading$ | async; else loaded">
      <p>Loading...</p>
    </div>

    <ng-template #loaded>
      <ng-container *ngIf="auth.isAuthenticated$ | async; else loggedOut">
        <div *ngIf="auth.user$ | async as user">
          <img [src]="user.picture" [alt]="user.name" />
          <h2>Welcome, {{ user.name }}!</h2>
          <button (click)="logout()">Logout</button>
        </div>
      </ng-container>

      <ng-template #loggedOut">
        <button (click)="login()">Login</button>
      </ng-template>
    </ng-template>
  `
})
export class AppComponent {
  constructor(public auth: AuthService) {}

  login(): void {
    this.auth.loginWithRedirect();
  }

  logout(): void {
    this.auth.logout({ logoutParams: { returnTo: window.location.origin } });
  }
}
```

---

### Nuxt 3/4 - auth0-nuxt

Server-side session authentication for Nuxt 3/4. Uses encrypted cookie sessions.

**Quick Setup:**

```bash
# 1. Install
npm install @auth0/auth0-nuxt

# 2. Generate secret
openssl rand -hex 64
```

```bash
# 3. .env
NUXT_AUTH0_DOMAIN=your-tenant.auth0.com
NUXT_AUTH0_CLIENT_ID=your-client-id
NUXT_AUTH0_CLIENT_SECRET=your-client-secret
NUXT_AUTH0_SESSION_SECRET=<from-openssl>
NUXT_AUTH0_APP_BASE_URL=http://localhost:3000
NUXT_AUTH0_AUDIENCE=https://your-api  # optional
```

```typescript
// 4. nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@auth0/auth0-nuxt'],
  runtimeConfig: {
    auth0: {
      domain: '',
      clientId: '',
      clientSecret: '',
      sessionSecret: '',
      appBaseUrl: 'http://localhost:3000',
      audience: '',
    },
  },
})
```

**Built-in Routes:**
| Route | Method | Purpose |
|-------|--------|---------|
| `/auth/login` | GET | Initiates login flow |
| `/auth/callback` | GET | Handles Auth0 callback after login |
| `/auth/logout` | GET | Logs user out and redirects to Auth0 logout |
| `/auth/backchannel-logout` | POST | Receives logout tokens |

**Protecting Routes (Client navigation):**
```typescript
export default defineNuxtRouteMiddleware((to) => {
  if (!useUser().value) return navigateTo(`/auth/login?returnTo=${encodeURIComponent(to.path)}`);
});
```

**Protecting Routes (SSR protection):**
```typescript
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);
  const auth0Client = useAuth0(event);
  const session = await auth0Client.getSession();
  if (!session)  {
    return sendRedirect(event, `/auth/login?returnTo=${encodeURIComponent(url.pathname)}`);
  }
});
```

---

### Express.js - auth0-express

Add authentication to Express.js web applications using express-openid-connect.

**Quick Start:**

1. **Install SDK:**
```bash
npm install express-openid-connect dotenv
```

2. **Configure Environment (.env):**
```bash
SECRET=<openssl-rand-hex-32>
BASE_URL=http://localhost:3000
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
ISSUER_BASE_URL=https://your-tenant.auth0.com
AUDIENCE=https://your-api-identifier  # only required if calling external APIs
```

3. **Configure Auth Middleware:**
```javascript
require('dotenv').config();
const express = require('express');
const { auth, requiresAuth } = require('express-openid-connect');

const app = express();

app.use(auth({
  authRequired: false,
  auth0Logout: true,
  secret: process.env.SECRET,
  baseURL: process.env.BASE_URL,
  clientID: process.env.CLIENT_ID,
  issuerBaseURL: process.env.ISSUER_BASE_URL,
  clientSecret: process.env.CLIENT_SECRET
}));

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

4. **Add Protected Routes:**
```javascript
// Public route
app.get('/', (req, res) => {
  res.send(req.oidc.isAuthenticated() ? 'Logged in' : 'Logged out');
});

// Protected route
app.get('/profile', requiresAuth(), (req, res) => {
  res.send(`
    <h1>Profile</h1>
    <p>Name: ${req.oidc.user.name}</p>
    <p>Email: ${req.oidc.user.email}</p>
  `);
});

// With API access token
app.get('/api-call', requiresAuth(), async (req, res) => {
  const { access_token } = req.oidc.accessToken;
  const response = await fetch('https://your-api.com/data', {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  res.json(await response.json());
});
```

---

### Fastify - auth0-fastify

Add authentication to Fastify web applications using @auth0/auth0-fastify.

**Quick Start:**

1. **Install SDK:**
```bash
npm install @auth0/auth0-fastify fastify @fastify/view ejs dotenv
```

2. **Configure Environment (.env):**
```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
SESSION_SECRET=<openssl-rand-hex-64>
APP_BASE_URL=http://localhost:3000
```

3. **Configure Auth Plugin:**
```javascript
import 'dotenv/config';
import Fastify from 'fastify';
import fastifyAuth0 from '@auth0/auth0-fastify';
import fastifyView from '@fastify/view';
import ejs from 'ejs';

const fastify = Fastify({ logger: true });

await fastify.register(fastifyView, {
  engine: { ejs },
  root: './views',
});

await fastify.register(fastifyAuth0, {
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  appBaseUrl: process.env.APP_BASE_URL,
  sessionSecret: process.env.SESSION_SECRET,
});

fastify.listen({ port: 3000 });
```

4. **Add Protected Routes:**
```javascript
// Protected route with preHandler
fastify.get('/profile', {
  preHandler: async (request, reply) => {
    const session = await fastify.auth0Client.getSession({ request, reply });
    if (!session) {
      return reply.redirect('/auth/login');
    }
  }
}, async (request, reply) => {
  const user = await fastify.auth0Client.getUser({ request, reply });
  return reply.view('views/profile.ejs', { user });
});
```

---

### Flask - auth0-flask

Add login, logout, and user profile to a Flask web application using `auth0-server-python`.

**Quick Start:**

1. **Install SDK:**
```bash
pip install auth0-server-python "flask[async]" python-dotenv
```

2. **Configure Environment (.env):**
```bash
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_SECRET=your_generated_app_secret
AUTH0_REDIRECT_URI=http://localhost:5000/callback
```

3. **Create Auth Module (auth.py):**
```python
import os
from flask import session as flask_session
from auth0_server_python.auth_server.server_client import ServerClient
from auth0_server_python.auth_types import StateData, TransactionData
from auth0_server_python.store import StateStore, TransactionStore
from dotenv import load_dotenv

load_dotenv()

class FlaskSessionStateStore(StateStore):
    def __init__(self, secret: str):
        super().__init__({"secret": secret})

    async def set(self, identifier, state, remove_if_expires=False, options=None):
        data = state.dict() if hasattr(state, "dict") else state
        flask_session[identifier] = self.encrypt(identifier, data)

    async def get(self, identifier, options=None):
        data = flask_session.get(identifier)
        if data is None:
            return None
        decrypted = self.decrypt(identifier, data)
        return StateData(**decrypted) if isinstance(decrypted, dict) else decrypted

    async def delete(self, identifier, options=None):
        flask_session.pop(identifier, None)

class FlaskSessionTransactionStore(TransactionStore):
    def __init__(self, secret: str):
        super().__init__({"secret": secret})

    async def set(self, identifier, state, remove_if_expires=False, options=None):
        data = state.dict() if hasattr(state, "dict") else state
        flask_session[identifier] = self.encrypt(identifier, data)

    async def get(self, identifier, options=None):
        data = flask_session.get(identifier)
        if data is None:
            return None
        decrypted = self.decrypt(identifier, data)
        return TransactionData(**decrypted) if isinstance(decrypted, dict) else decrypted

    async def delete(self, identifier, options=None):
        flask_session.pop(identifier, None)

secret = os.getenv("AUTH0_SECRET")

auth0 = ServerClient(
    domain=os.getenv("AUTH0_DOMAIN"),
    client_id=os.getenv("AUTH0_CLIENT_ID"),
    client_secret=os.getenv("AUTH0_CLIENT_SECRET"),
    secret=secret,
    redirect_uri=os.getenv("AUTH0_REDIRECT_URI"),
    state_store=FlaskSessionStateStore(secret=secret),
    transaction_store=FlaskSessionTransactionStore(secret=secret),
    authorization_params={"scope": "openid profile email"},
)
```

4. **Configure Flask App (app.py):**
```python
import os
from flask import Flask, redirect, request
from auth import auth0
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("AUTH0_SECRET")
app.config.update(
    SESSION_COOKIE_SECURE=False,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
)
```

5. **Add Routes:**
```python
@app.route("/")
async def home():
    user = await auth0.get_user()
    if user:
        return f"Hello, {user['name']}! <a href='/profile'>Profile</a> | <a href='/logout'>Logout</a>"
    return "Welcome! <a href='/login'>Login</a>"

@app.route("/login")
async def login():
    authorization_url = await auth0.start_interactive_login()
    return redirect(authorization_url)

@app.route("/callback")
async def callback():
    try:
        await auth0.complete_interactive_login(str(request.url))
        return redirect("/")
    except Exception as e:
        return f"Authentication error: {str(e)}", 400

@app.route("/profile")
async def profile():
    user = await auth0.get_user()
    if user is None:
        return redirect("/login")
    return f"<h1>{user['name']}</h1><p>Email: {user['email']}</p><img src='{user['picture']}' alt='{user['name']}' width='100' />"

@app.route("/logout")
async def logout():
    url = await auth0.logout()
    return redirect(url)
```

---

### React Native / Expo - auth0-react-native

Add authentication to React Native and Expo mobile applications.

**Quick Start:**

1. **Install SDK:**

**Expo:**
```bash
npx expo install react-native-auth0
```

**React Native CLI:**
```bash
npm install react-native-auth0
npx pod-install  # iOS only
```

2. **Configure Native Platforms:**

**iOS Info.plist:**
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>None</string>
    <key>CFBundleURLName</key>key>
    <string>auth0</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>$(PRODUCT_BUNDLE_IDENTIFIER).auth0</string>
    </array>
  </dict>
</array>
```

**Android AndroidManifest.xml:**
```xml
<activity
    android:name="com.auth0.android.provider.RedirectActivity"
    android:exported="true">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data
            android:host="YOUR_AUTH0_DOMAIN"
            android:pathPrefix="/android/${applicationId}/callback"
            android:scheme="${applicationId}" />
    </intent-filter>
</activity>
```

3. **Add Authentication:**
```typescript
import React from 'react';
import { Auth0Provider } from 'react-native-auth0';
import App from './App';

export default function Root() {
  return (
    <Auth0Provider
      domain={process.env.AUTH0_DOMAIN}
      clientId={process.env.AUTH0_CLIENT_ID}
    >
      <App />
    </Auth0Provider>
  );
}

// In component:
import { useAuth0 } from 'react-native-auth0';

export default function App() {
  const { user, authorize, clearSession, isLoading } = useAuth0();

  const login = async () => {
    try {
      await authorize({ scope: 'openid profile email' });
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const logout = async () => {
    try {
      await clearSession();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <View>
      {user ? (
        <>
          <Text>Welcome, {user.name}!</Text>
          <Button title="Logout" onPress={logout} />
        </>
      ) : (
        <Button title="Login" onPress={login} />
      )}
    </View>
  );
}
```

---

### ASP.NET Core - auth0-aspnetcore-authentication

Use when adding authentication to ASP.NET Core web applications.

**Key points:**
- Must be Regular Web Application type in Auth0
- Use `Microsoft.AspNetCore.Authentication.Cookies`
- Configure in `Program.cs` or `Startup.cs`

---

### Mobile Platforms

**Android (Kotlin/Java):** Use `auth0-android` SDK
**iOS/Swift:** Use `auth0-swift` SDK
**Flutter:** Use `auth0-flutter-native` SDK
**Ionic:** Use appropriate SDK (auth0-ionic-angular, auth0-ionic-react, auth0-ionic-vue)

---

## Multi-Factor Authentication (MFA)

MFA requires users to provide two or more verification factors.

### Supported Factors

| Factor | Type | Description |
|--------|------|-------------|
| TOTP | Something you have | Time-based one-time passwords (Google Authenticator, Authy) |
| SMS | Something you have | One-time codes via text message |
| Email | Something you have | One-time codes via email |
| Push | Something you have | Push notifications via Auth0 Guardian app |
| WebAuthn | Something you have/are | Security keys, biometrics, passkeys |
| Voice | Something you have | One-time codes via phone call |

### Enable MFA

```bash
auth0 api get "guardian/factors"
auth0 api put "guardian/factors/otp" --data '{"enabled": true}'
auth0 api put "guardian/factors/sms" --data '{"enabled": true}'
auth0 api put "guardian/factors/push-notification" --data '{"enabled": true}'
```

### Step-Up Authentication

Request MFA for sensitive operations using `acr_values`:
```
acr_values=http://schemas.openid.net/pape/policies/2007/06/multi-factor
```

---

## Auth0 Actions Best Practices

Actions replace Rules. Follow these guidelines:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  // 1. Early returns for efficiency
  if (!event.user.email_verified) {
    api.access.deny('Please verify your email before logging in.');
    return;
  }

  // 2. Use secrets for sensitive data
  const apiKey = event.secrets.EXTERNAL_API_KEY;

  // 3. Minimize external calls
  // 4. Never log sensitive information
  console.log(`User logged in: ${event.user.user_id}`);

  // 5. Add custom claims sparingly
  api.idToken.setCustomClaim('https://myapp.com/roles', event.authorization?.roles || []);
  api.accessToken.setCustomClaim('https://myapp.com/roles', event.authorization?.roles || []);
};
```

---

## Token Management

### Access Token Validation

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

---

## Common Mistakes to Avoid

| Mistake | Fix |
|---------|-----|
| Wrong application type | SPAs need "Single Page Application", server apps need "Regular Web Application", mobile needs "Native" |
| Callback URL not configured | Add your app's callback URL to Allowed Callback URLs in Auth0 Dashboard |
| Using wrong credentials | Client Secret only needed for Regular Web Apps, not SPAs |
| Hardcoding credentials in code | Always use environment variables, never commit secrets to git |
| Not testing locally first | Set up localhost URLs in Auth0 before deploying to production |
| Mixing application types | Don't use SPA SDK for server-side apps or vice versa |
| Missing session secret | Generate secure secret with `openssl rand -hex 32/64` |
| Wrong env var prefix | Vite uses `VITE_`, CRA uses `REACT_APP_`, Nuxt uses `NUXT_AUTH0_` |

---

## Security Best Practices

- Always use HTTPS in production
- Implement proper error handling for all authentication flows
- Use short timeouts for external API calls (default 20-second limit)
- Implement session timeouts
- Validate redirect URIs in Auth0 Dashboard
- Store tokens in memory, not localStorage (XSS risk)
- Implement proper logout (both local and Auth0 session)
- Use refresh token rotation

---

## Related Skills

- `auth0-quickstart` - Basic Auth0 setup
- `auth0-migration` - Migrate from another auth provider
- `auth0-mfa` - Add Multi-Factor Authentication
- `auth0-cli` - Manage Auth0 resources from the terminal