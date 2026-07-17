<!--
Merged from:
- agent-skills-main/plugins/auth0/skills/auth0-net-android/SKILL.md
- agent-skills-main/plugins/auth0/skills/auth0-net-ios/SKILL.md
-->

# Auth0 .NET Mobile Authentication

Auth0 authentication for .NET mobile applications - Android (Chrome Custom Tabs) and iOS (ASWebAuthenticationSession).

## Prerequisites

- .NET 8.0+ SDK
- Auth0 Native application configured
- Android: VS 2022 with .NET Android workload, SDK API 21+
- iOS: macOS with Xcode 15+, iOS 14.0+ deployment target

---

## When NOT to Use

| Use Case | Recommended Skill |
|----------|------------------|
| .NET MAUI cross-platform (iOS+Android+Windows) | `auth0-maui` |
| Android-native Kotlin app | `auth0-android` |
| iOS-native Swift app | `auth0-swift` |
| ASP.NET Core web app | `auth0-aspnetcore-authentication` |
| React Native mobile | `auth0-react-native` |

---

## Quick Reference

### .NET Android
```csharp
dotnet add package Auth0.OidcClient.AndroidX

// MainActivity.cs
[Activity(LaunchMode = LaunchMode.SingleTask)]
[IntentFilter(DataScheme = "PACKAGE_NAME", DataHost = "DOMAIN", DataPathPrefix = "/android/PACKAGE_NAME/callback")]
public class MainActivity : Activity {
    var client = new Auth0Client(new Auth0ClientOptions {
        Domain = "YOUR_AUTH0_DOMAIN",
        ClientId = "YOUR_AUTH0_CLIENT_ID",
        Scope = "openid profile email offline_access"
    }, this);
    
    var loginResult = await client.LoginAsync();
}

// OnNewIntent callback handler
Auth0.OidcClient.ActivityMediator.Instance.Send(intent.DataString);
```

### .NET iOS
```csharp
dotnet add package Auth0.OidcClient.iOS

// AppDelegate.cs
public override bool OpenUrl(UIApplication app, NSUrl url, NSDictionary options) {
    Auth0.OidcClient.ActivityMediator.Instance.Send(url.AbsoluteString);
    return true;
}

var client = new Auth0Client(new Auth0ClientOptions {
    Domain = "YOUR_AUTH0_DOMAIN",
    ClientId = "YOUR_AUTH0_CLIENT_ID",
    Scope = "openid profile email offline_access"
});

var loginResult = await client.LoginAsync();
```

---

## Callback URL Formats

| Platform | Format |
|----------|--------|
| Android | `PACKAGE_NAME://DOMAIN/android/PACKAGE_NAME/callback` |
| iOS | `BUNDLE_ID://DOMAIN/ios/BUNDLE_ID/callback` |

**Important:** Domain should be hostname only (e.g., `tenant.auth0.com`), not `https://tenant.auth0.com`.

---

## Authentication Flow

1. Call `LoginAsync()` on Auth0Client
2. System browser opens (Chrome Custom Tabs / ASWebAuthenticationSession)
3. User authenticates with Auth0
4. Auth0 redirects to native callback URL
5. Platform receives callback (OnNewIntent / OpenUrl)
6. `ActivityMediator.Instance.Send()` completes token exchange

---

## Critical Settings

| Setting | Android | iOS | Reason |
|---------|---------|-----|--------|
| Activity/ActivityContext | Required (`this`) | Not needed | iOS doesn't use Activity context |
| LaunchMode | `SingleTask` | N/A | Required to handle callback redirect correctly |
| URL Scheme Registration | IntentFilter | Info.plist | Required for callback interception |
| Secure Token Storage | EncryptedSharedPreferences / SecureStorage | iOS Keychain | Never use plain SharedPreferences / UserDefaults |

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| App type not set to Native | Change to "Native" in Auth0 Dashboard |
| Missing callback URL | Add to Allowed Callback URLs AND Allowed Logout URLs |
| DataScheme not lowercase (Android) | Use lowercase package name |
| Missing LaunchMode.SingleTask | Set required to prevent duplicate Activity instances |
| Not handling OnNewIntent/OpenUrl | Implement callback handler |
| Missing offline_access scope | Required for refresh tokens / silent renewal |
| Storing tokens insecurely | Use AndroidX Security or iOS Keychain |

---

## Related Skills

- `auth0-maui` — .NET MAUI cross-platform
- `auth0-android` — Native Android (Kotlin)
- `auth0-swift` — Native iOS (Swift)
- `auth0-aspnetcore-authentication` — ASP.NET Core web apps