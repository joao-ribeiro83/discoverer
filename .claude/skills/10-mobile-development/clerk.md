<!--
Merged from:
- autoskills-main/packages/autoskills/skills-registry/clerk-android/SKILL.md
- autoskills-main/packages/autoskills/skills-registry/clerk-swift/SKILL.md
-->

# Clerk Authentication for Mobile Platforms

Clerk SDK implementation for native mobile platforms - Android (Kotlin/Jetpack Compose) and iOS (Swift/SwiftUI).

## Activation Rules

**Android:** Activate when project has `build.gradle(.kts)` with Android plugins, `AndroidManifest.xml`, `app/src/main/java`.
**iOS:** Activate when project has `.xcodeproj`, `.xcworkspace`, `Package.swift`, Swift targets.

Do not activate for Expo or React Native projects - route to general setup instead.

---

## Quick Start

| Step | Action |
|------|--------|
| 1 | Confirm project type is native (Android/iOS) and not Expo/React Native |
| 2 | Determine flow type (`prebuilt` or `custom`) |
| 3 | Ensure a real Clerk publishable key exists |
| 4 | Ensure correct SDK artifacts are installed |
| 5 | Verify quickstart prerequisites |
| 6 | Implement using selected flow reference |

---

## Android (Kotlin/Jetpack Compose)

Use `clerk-android-ui` (includes API) for prebuilt flows, `clerk-android-api` for custom flows.

### Setup
```kotlin
// Wire publishable key directly in initialization
Clerk.initialize(context, publishableKey = "pk_test_...")
```

**Required:**
- Native API enabled in Clerk dashboard
- Minimum SDK and Java target from quickstart
- Manifest internet permission
- App-level Clerk initialization

### Prebuilt Flow
- Use `AuthView` and `UserButton` components
- Drive behavior from runtime capability fields
- Do NOT rebuild auth forms with custom API calls

### Custom Flow
- Multi-step auth progression
- Factor-specific handling
- Separate UI, state orchestration, and Clerk API integration modules

---

## iOS (Swift/SwiftUI)

Use `clerk-ios` package with `ClerkKit` and `ClerkKitUI` products.

### Setup
```swift
// Wire publishable key directly in configuration
Clerk.configure(publishableKey: "pk_test_...")
```

**Required:**
- Associated Domains capability
- `webcredentials:{YOUR_FRONTEND_API_URL}` entry
- ClerkKit/ClerkKitUI package with up-to-next-major requirement

### Environment Call
After package install, call `/v1/environment` to determine:
- Enabled factors/social providers/MFA flags
- Apple sign-in capability
- Feature gating for the selected flow

---

## Both Platforms

### Flow Types

**Prebuilt (fastest):**
- Prebuilt `AuthView`/`UserButton` components
- Use when needing standard auth UI

**Custom (full control):**
- Custom auth flows
- Multi-step progression by default
- Feature/gating determined at runtime

### Interaction Contract

Before implementation, you MUST have:
- Flow choice: `prebuilt` or `custom`
- Real Clerk publishable key

If missing, ask the user before making any edits.

---

## Common Pitfalls

| Level | Issue | Prevention |
|-------|-------|------------|
| CRITICAL | Not asking for missing flow choice | Ask for `prebuilt` vs `custom` and wait |
| CRITICAL | Not asking for missing publishable key | Ask for key and wait before edits |
| CRITICAL | Skipping quickstart prerequisites | Verify and apply all setup steps |
| CRITICAL | Missing associated-domain capability (iOS) | Add `webcredentials:{frontend_api_url}` |
| CRITICAL | Rendering auth UI before SDK ready | Gate UI with `isInitialized` state |
| HIGH | Wrong artifact for chosen flow | Prebuilt: UI package; Custom: API package |

---

## See Also
- `clerk-setup` skill for cross-framework quickstart
- `clerk-react-patterns` for React Native
- `https://github.com/clerk/clerk-android`
- `https://github.com/clerk/clerk-ios`