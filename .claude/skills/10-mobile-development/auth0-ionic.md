<!--
Merged from:
- autoskills-main/packages/autoskills/skills-registry/auth0-ionic-angular/SKILL.md
- autoskills-main/packages/autoskills/skills-registry/auth0-ionic-react/SKILL.md
- autoskills-main/packages/autoskills/skills-registry/auth0-ionic-vue/SKILL.md
-->

# Auth0 Ionic/Capacitor Mobile Authentication

Auth0 authentication for Ionic apps (Angular, React, Vue) using Capacitor plugins for native iOS/Android deep linking.

## Prerequisites

- Node.js 18+
- Ionic CLI (`npm install -g @ionic/cli`)
- Capacitor 5+ configured
- Auth0 account and Native application type
- iOS: Xcode 14+, Android: Android Studio API 21+

---

## Framework-Specific Setup

### Ionic Angular

**Dependencies:**
```bash
npm install @auth0/auth0-angular @capacitor/browser @capacitor/app
```

**Standalone Config (`src/app/app.config.ts`):**
```typescript
import { ApplicationConfig } from '@angular/core';
import { provideAuth0 } from '@auth0/auth0-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAuth0({
      domain: 'YOUR_AUTH0_DOMAIN',
      clientId: 'YOUR_AUTH0_CLIENT_ID',
      useRefreshTokens: true,
      useRefreshTokensFallback: false,
      authorizationParams: {
        redirect_uri: `PACKAGE_ID://DOMAIN/capacitor/PACKAGE_ID/callback`,
      },
    }),
  ],
};
```

**NgModule Config (`src/app/app.module.ts`):**
```typescript
@NgModule({
  imports: [
    AuthModule.forRoot({
      domain: 'YOUR_AUTH0_DOMAIN',
      clientId: 'YOUR_AUTH0_CLIENT_ID',
      useRefreshTokens: true,
      useRefreshTokensFallback: false,
    }),
  ],
})
export class AppModule {}
```

### Ionic React

**Dependencies:**
```bash
npm install @auth0/auth0-react @capacitor/browser @capacitor/app
```

**Provider Setup (`src/main.tsx`):**
```tsx
import { Auth0Provider } from '@auth0/auth0-react';

const redirectUri = `${packageId}://${domain}/capacitor/${packageId}/callback`;

createRoot(document.getElementById('root')!).render(
  <Auth0Provider
    domain={domain}
    clientId={clientId}
    useRefreshTokens={true}
    useRefreshTokensFallback={false}
    authorizationParams={{ redirect_uri: redirectUri }}
  >
    <App />
  </Auth0Provider>
);
```

### Ionic Vue

**Dependencies:**
```bash
npm install @auth0/auth0-vue @capacitor/browser @capacitor/app
```

**Plugin Config:**
```typescript
import { createAuth0 } from '@auth0/auth0-vue';

app.use(
  createAuth0({
    domain: 'YOUR_AUTH0_DOMAIN',
    clientId: 'YOUR_AUTH0_CLIENT_ID',
    authorizationParams: {
      redirect_uri: `PACKAGE_ID://DOMAIN/capacitor/PACKAGE_ID/callback`,
    },
  })
);
```

---

## Shared Mobile Authentication Flow

### Step 1: Configure Auth0 Dashboard

**Native Application Type Required**

| Setting | Value |
|---------|-------|
| Allowed Callback URLs | `PACKAGE_ID://{domain}/capacitor/PACKAGE_ID/callback` |
| Allowed Logout URLs | `PACKAGE_ID://{domain}/capacitor/PACKAGE_ID/callback` |
| Allowed Origins | `capacitor://localhost, http://localhost` |

### Step 2: Login

```tsx
// React/Vue
const { loginWithRedirect } = useAuth0();
await loginWithRedirect({
  async openUrl(url) {
    await Browser.open({ url, windowName: "_self" });
  }
});

// Angular
this.auth.loginWithRedirect({
  async openUrl(url: string) {
    await Browser.open({ url, windowName: '_self' });
  }
}).subscribe();
```

### Step 3: Handle Deep Link Callback

```tsx
// React/Vue
useEffect(() => {
  CapApp.addListener('appUrlOpen', async ({ url }) => {
    if (url.includes('state') && (url.includes('code') || url.includes('error'))) {
      await handleRedirectCallback(url);
    }
    await Browser.close();
  });
}, []);

// Angular (wrap in ngZone.run)
CapApp.addListener('appUrlOpen', ({ url }) => {
  this.ngZone.run(() => {
    if (url.includes('state') && (url.includes('code') || url.includes('error'))) {
      this.auth.handleRedirectCallback(url)
        .pipe(mergeMap(() => Browser.close()))
        .subscribe();
    }
  });
});
```

### Step 4: Logout

```tsx
await logout({
  logoutParams: {
    returnTo: `PACKAGE_ID://DOMAIN/capacitor/PACKAGE_ID/callback`,
  },
  async openUrl(url) {
    await Browser.open({ url, windowName: "_self" });
  }
});
```

---

## Critical Mobile Settings

| Setting | Value | Reason |
|---------|-------|--------|
| `useRefreshTokens` | `true` | Required for mobile - localStorage unreliable |
| `useRefreshTokensFallback` | `false` | Prevents iframe refresh (unsupported on mobile) |
| App type | Native | Not SPA or Regular Web App |
| Callback URL | `PACKAGE_ID://...` | Capacitor-specific format |
| Browser | System | `Browser.open()` not `window.location` |

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| App type set to SPA instead of Native | Change to **Native** in Auth0 Dashboard |
| Missing callback URL in Allowed URLs | Add `PACKAGE_ID://{domain}/capacitor/PACKAGE_ID/callback` |
| Not wrapping callback in ngZone.run() (Angular) | Angular won't detect auth state changes |
| Using `window.location.href` for login | Must use `Browser.open()` for system browser |
| Missing Capacitor plugins | Install `@capacitor/browser` and `@capacitor/app` |
| Forgetting `npx cap sync` | Always run after installing plugins |
| Not testing on physical device | Simulators may not handle deep links correctly |

---

## Related Skills

- `auth0-react-native` — React Native (bare CLI)
- `auth0-expo` — Expo with Auth0
- `auth0-swift` — Native iOS (Swift)
- `auth0-android` — Native Android (Kotlin)