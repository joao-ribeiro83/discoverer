# Discoverer Neo — Capability Matrix (ground truth for the four role manuals)

> **Status 2026-09-30:** written from the code at 2.0.0 (806922a). Since then, commits 08af919 and c15da50 fixed these section 4 items: admin-only sidebar links and route guards (MANAGER no longer sees Security, Audit Log, Migration; USER/VIEWER cannot open /admin by URL), server-side log out, the Users delete wording, the wrong-current-password log-out, VIEW-only shares in the Schedules map list, and the missing SQL/Plan buttons for admins. The role manuals follow the fixed behaviour.

Version 2.0.0 (CHANGELOG [2.0.0], map access by role). Every claim is cited as `file:line`; `FE/` = `frontend/src/`, `BE/` = `backend/src/`. Built by reading code only; nothing was run. Cells: **Y** yes, **N** no, **UI:Y/API:403** = the button/page is shown but the server refuses. Role columns are ADMIN | MANAGER | USER | VIEWER. **UNVERIFIED** = could not be confirmed in code.

> Important premise: the frontend has **no route guards and almost no role-gated buttons** (FE/App.tsx:54-110; only Sidebar.tsx:102, WorkbookBrowseSection.tsx:26-28,104,120, MapsListPage.tsx:137-145, RunsPage.tsx:121-122,239, UsersPage.tsx:65-67,210,268 and SecurityPage.tsx:238,407 look at the role). The server decides. A USER/VIEWER who types an `/admin/...` URL gets the page shell and 403s. The manuals must describe what each role can *successfully do*, so use the "Y" columns after reconciling UI and API.

## 1. Role x page visibility

"Sidebar" = link shown. "URL" = what happens if the role types the address. Data modeling pages (business areas, folders, items, joins, hierarchies) additionally depend on **business-area grants** (levels VIEW < EXPORT < SCHEDULE < CREATE < EDIT < DELETE, BE/services/business-area.service.ts:19-58); only ADMIN bypasses them (BE/middleware/business-area-auth.ts:53), a MANAGER does not.

| Page | Route | i18n title key | English label (sidebar / title) | ADMIN | MANAGER | USER | VIEWER |
|---|---|---|---|---|---|---|---|
| Login | /login | auth:login.appName | Discoverer Neo / "Sign in to your account" | public | public | public | public |
| Change password | /change-password | auth:changePassword.title | Change your password | by URL / forced redirect; no menu link | same | same | same |
| Dashboard | /dashboard | mapViewer:dashboard.* | Dashboard (sidebar) / "Welcome, {name}" | Sidebar | Sidebar | Sidebar | Sidebar |
| Business Areas | /admin/business-areas | admin:businessAreas.title | Business Areas | Sidebar, full | Sidebar; only granted areas; New/Delete/Grants refused by API | URL only; empty list unless granted | URL only; same as USER |
| Folders | /admin/folders | admin:folders.title | Folders | Sidebar, full | Sidebar; needs grants; Discover Tables allowed, Import from data source ADMIN only | URL only | URL only |
| Items | /admin/items | admin:items.title | Items | Sidebar, full | Sidebar; needs grants | URL only | URL only |
| Joins | /admin/joins | admin:joins.title | Joins | Sidebar, full | Sidebar; needs grants | URL only | URL only |
| Hierarchies | /admin/hierarchies | admin:hierarchies.title | Hierarchies | Sidebar, full | Sidebar; needs grants | URL only | URL only |
| Custom Functions | /admin/custom-functions | admin:customFunctions.title | Custom Functions | Sidebar, full | Sidebar, full (read, write, refresh) | URL only; list readable, writes 403 | same as USER |
| Data Sources | /admin/data-sources | admin:dataSources.title | Data Sources | Sidebar, full | Sidebar; read, test, introspect; create/edit/delete 403 | URL only; list 403 | URL only; list 403 |
| Users | /admin/users | admin:users.title | Users | Sidebar, full | Sidebar; read-only list, per-user map list, share change, owner change | URL only; list 403 | URL only; list 403 |
| Security | /admin/security | security:page.title | Security Policies | Sidebar, full | Sidebar; page says administrators only (SecurityPage.tsx:407) | URL only; same message | URL only; same message |
| Audit Log | /admin/audit | audit:page.title | Audit Log | Sidebar, full | Sidebar; API ADMIN-only (403) | URL only; 403 | URL only; 403 |
| Migration | /admin/migration | migration:page.title | Migration | Sidebar (Other section) | Sidebar link shown (Sidebar.tsx:126); API ADMIN-only | no link; 403 | no link; 403 |
| Maps | /maps | mapViewer:mapsList.title | Maps | Sidebar; sees all maps | Sidebar; sees all maps | Sidebar; own + public + shared | Sidebar; own + public + shared; cannot Copy |
| Map builder | /maps/new, /maps/:id | (none; toolbar shows the map name) | - | any map | any map; Save only own or EDIT share; new map needs CREATE grant | own / EDIT share; new map needs CREATE grant | same as USER (nothing role-specific blocks it) |
| Map viewer | /maps/:id/view | mapViewer:viewer.* | (map name) | any map | any map | own / public / shared | own / public / shared |
| Schedules | /schedules | schedules:page.title | Schedules | Sidebar; own schedules | Sidebar; own schedules | Sidebar; own schedules | Sidebar; own schedules |
| Runs | /runs | runs:title | Runs | Sidebar; own + "Show every user's runs" | Sidebar; own runs | Sidebar; own runs | Sidebar; own runs |
| Exports | /exports | mapViewer:exportHistory.title | Exports | Sidebar; own exports | Sidebar; own | Sidebar; own | Sidebar; own |
| Settings | /settings | settings:title | Settings | Sidebar footer + user menu | same | same | same |

Sidebar section headings (nav.json): **Overview**, **Data Modeling** (ADMIN/MANAGER only), **Maps**, **Other**. The full label list and the account menu are in section 2 ("Header + user menu" and "Sidebar").

## 2. Pages and actions

Each page: visibility, then an actions table (Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices | Citation). Labels are the exact English strings from `frontend/src/locales/en/*.json`. Per-page mismatches, business rules and screenshot plans are collected in sections 4, 3.2 and 5 (grouped under the same page heading).


All paths relative to `discoverer-neo`. FE = frontend/src, BE = backend/src. Labels quoted from `frontend/src/locales/en/<ns>.json`.

### Login — route `/login` — title key `auth:login.appName` = "Discoverer Neo" (card subtitle `auth:login.subtitle` = "Sign in to your account")
Visibility: public route, wrapped in `AuthLayout` (centred card on muted background, no header/sidebar) (FE/App.tsx:58-64, FE/components/auth/AuthLayout.tsx:3-8). Not in sidebar. All four roles see the identical page; role only matters after login. No route guard on `/login` itself: an already-signed-in user who types the URL still sees the form (no redirect in LoginPage.tsx).
There is NO language selector, NO theme toggle, NO "forgot password", NO "sign up", NO SSO on this page (LoginPage.tsx:70-141 contains only the elements below). Language before login = `localStorage` `discoverer-neo-locale` if present, else default `pt-PT` (FE/i18n/index.ts:15,32,103); after login the account's saved `locale` is applied (FE/hooks/useAuth.ts:22-25).

| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| Email (`auth:login.emailLabel`) | Text field (type=email, autocomplete=email). Required + must look like an email; otherwise inline errors "Email is required" (`auth:validation.emailRequired`) / "Enter a valid email address" (`auth:validation.emailInvalid`). | Y | Y | Y | Y | free text | FE/pages/LoginPage.tsx:19-25,96-107 |
| Password (`auth:login.passwordLabel`) | Password field. Required; inline error "Password is required" (`auth:validation.passwordRequired`). | Y | Y | Y | Y | free text | LoginPage.tsx:25,109-121 |
| Remember me (`auth:login.rememberMe`) | Checkbox, ticked by default. Ticked = session kept in browser `localStorage` (survives closing the browser); unticked = `sessionStorage` (cleared when the tab/browser closes). Does NOT lengthen or shorten token life. | Y | Y | Y | Y | ticked (default) / unticked | LoginPage.tsx:52,123-132; FE/store/auth.ts:37-56 |
| Sign in (`auth:login.submit`) / "Signing in…" (`auth:login.submitting`) | Submit. POST `/api/auth/login` {email,password}; on success stores tokens, applies saved language, navigates to the page you were originally heading to (`state.from`) else `/dashboard`. Button disabled + spinner while submitting. | Y | Y | Y | Y | — | LoginPage.tsx:55-68,134-137; FE/hooks/useAuth.ts:19-30; BE/routes/auth.ts:144-279 |
| Info banner (not a control) | Grey box above the form showing `state.message`; the only producer is the session-expired redirect: "Your session has expired. Please sign in again." (`auth:login.sessionExpired`). | Y | Y | Y | Y | — | LoginPage.tsx:77-81; FE/hooks/useAuth.ts:60-66 |
| Red error banner (role=alert) | Shows the server's `error` text verbatim, else "Unable to sign in. Please try again." (`auth:login.genericError`). Server texts (English, NOT translated): "Invalid email or password" (401: unknown email, wrong password, deactivated account, or role-account); "Too many login attempts. Try again later." (429); "Validation failed" (400). | Y | Y | Y | Y | — | LoginPage.tsx:62-67,82-89; BE/routes/auth.ts:208,225,236,244 |




### Change password — route `/change-password` — title key `auth:changePassword.title` = "Change your password"
Visibility: NOT in sidebar or header menu (no link anywhere in Header.tsx/Sidebar.tsx). Reachable only by (a) automatic redirect when `mustChangePassword` is true, or (b) typing the URL. Route is wrapped in `ProtectedRoute` only (login required), OUTSIDE `Layout`, so no sidebar/header shown (FE/App.tsx:65-73; FE/components/auth/ProtectedRoute.tsx:8-33). All four roles identical. Backend `POST /api/auth/change-password` = `authenticate` only, no role check (BE/routes/auth.ts:459-475).
Two modes: "forced" (account created with a temporary password, e.g. EUL migration) vs voluntary; only labels differ (ChangePasswordPage.tsx:81,91-95,108-113).

| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| Description text | Voluntary: "Choose a new password for your account." (`auth:changePassword.description`). Forced: "This account was created with a temporary password. Choose a new one to continue — until you do, the rest of the application is unavailable." (`auth:changePassword.forcedDescription`). | Y | Y | Y | Y | — | ChangePasswordPage.tsx:91-95 |
| Temporary password (`auth:changePassword.temporaryPasswordLabel`) [forced mode] / Current password (`auth:changePassword.currentPasswordLabel`) [voluntary] | Field for the password you sign in with now. Required; error "Enter your current password" (`auth:changePassword.currentRequired`). Server re-verifies it. | Y | Y | Y | Y | free text | ChangePasswordPage.tsx:30,108-125; BE/routes/auth.ts:495-501 |
| New password (`auth:changePassword.newPasswordLabel`) | New password. Hint "At least 12 characters." (`auth:changePassword.lengthHint`, count=12). Error "Password is too short" (`auth:changePassword.tooShort`) below 12; "The new password must be different" (`auth:changePassword.mustDiffer`) if equal to current. No complexity rule (no upper/digit/symbol requirement). | Y | Y | Y | Y | free text, min 12 chars | ChangePasswordPage.tsx:25,31,38-41,127-143; BE/routes/auth.ts:122,126,503-507 |
| Confirm new password (`auth:changePassword.confirmPasswordLabel`) | Must equal New password. Errors "Confirm your new password" (`auth:changePassword.confirmRequired`), "The passwords do not match" (`auth:changePassword.mismatch`). Client-side only. | Y | Y | Y | Y | free text | ChangePasswordPage.tsx:32-37,145-160 |
| Change password (`auth:changePassword.submit`) | Submit -> POST `/api/auth/change-password` {currentPassword,newPassword}; stores new hash, clears `mustChangePassword`; toast "Password changed" (`auth:changePassword.success`); navigates to `/` (-> `/dashboard`). Spinner + disabled while pending. | Y | Y | Y | Y | — | ChangePasswordPage.tsx:67-79,168-171; BE/routes/auth.ts:509-523 |
| Red error line (role=alert) | Server error text: "Current password is incorrect" (401), "The new password must be different from the current one" (400), "Validation failed" (400) — see Mismatch 1. | Y | Y | Y | Y | — | ChangePasswordPage.tsx:78,162-166; auth.ts:499-507 |




### Header + user menu — component on every page inside `Layout` (all routes except /login and /change-password) — title key `nav:appName` = "Discoverer Neo"
Visibility: all four roles see the same header (FE/components/layout/Layout.tsx:75-89, Header.tsx:16-54). No role logic in Header.tsx. Header has NO theme toggle, NO language toggle, NO notifications, NO search, NO session list. Theme/language live only on Settings.

| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| "Discoverer Neo" heading (`nav:appName`) | Static title (h1). | Y | Y | Y | Y | — | Header.tsx:25 |
| Toggle menu (`nav:mobile.toggleMenu`, tooltip `nav:mobile.toggleMenuTitle` = "Toggle menu") | Hamburger button, visible only below the `md` breakpoint (`md:hidden`); opens a left drawer (accessible title "Navigation menu", `nav:mobile.menuTitle`) containing the same sidebar nav; choosing a link closes it. | Y | Y | Y | Y | — | FE/components/layout/MobileSidebar.tsx:13-27 |
| User button (shows `user.name`, else email, else "My Account" `auth:account.menuLabel`) | Opens the account dropdown. | Y | Y | Y | Y | — | Header.tsx:28-34 |
| "My Account" (`auth:account.menuLabel`) | Dropdown heading label. | Y | Y | Y | Y | — | Header.tsx:36 |
| (your e-mail) | Disabled menu row showing your e-mail. Not clickable. | Y | Y | Y | Y | — | Header.tsx:38 |
| Settings (`nav:items.settings`) | Navigates to `/settings`. | Y | Y | Y | Y | — | Header.tsx:40-43 |
| Log out (`auth:account.logout`) | POST `/api/auth/logout` (blacklists the access token in Redis until it expires and deletes the refresh session), then clears local state; ProtectedRoute then sends you to `/login`. Best effort: local logout happens even if the API call fails. | Y | Y | Y | Y | — | Header.tsx:45-48; FE/hooks/useAuth.ts:32-40; BE/routes/auth.ts:352-386 |


#### Sidebar (left navigation; same content in the mobile drawer) — FE/components/layout/Sidebar.tsx
Visibility rule: `canModel = role==='ADMIN' || role==='MANAGER'` (Sidebar.tsx:102). Header of sidebar = database icon + "Discoverer Neo" (Sidebar.tsx:105-108). Version footer text "Discoverer Neo v{version}" (hard-coded, not i18n; Sidebar.tsx:144). Desktop sidebar hidden below `md`, replaced by hamburger (Sidebar.tsx:152).

| Section (`nav:sections.*`) | Link label (`nav:items.*`) | Route | ADMIN | MANAGER | USER | VIEWER | Backend truth for direct URL/API | Citation |
|---|---|---|---|---|---|---|---|---|
| Overview (`overview`) | Dashboard (`dashboard`) | `/dashboard` | Y | Y | Y | Y | authenticate only | Sidebar.tsx:29,110 |
| Data Modeling (`dataModeling`) — whole section shown only if canModel | Business Areas (`businessAreas`) | `/admin/business-areas` | Y | Y | N (hidden) | N (hidden) | UNVERIFIED here (other fragments) | Sidebar.tsx:33,113-118 |
| Data Modeling | Folders (`folders`) | `/admin/folders` | Y | Y | N | N | UNVERIFIED here | Sidebar.tsx:34 |
| Data Modeling | Items (`items`) | `/admin/items` | Y | Y | N | N | UNVERIFIED here | Sidebar.tsx:35 |
| Data Modeling | Joins (`joins`) | `/admin/joins` | Y | Y | N | N | UNVERIFIED here | Sidebar.tsx:36 |
| Data Modeling | Hierarchies (`hierarchies`) | `/admin/hierarchies` | Y | Y | N | N | UNVERIFIED here | Sidebar.tsx:37 |
| Data Modeling | Custom Functions (`customFunctions`) | `/admin/custom-functions` | Y | Y | N | N | UNVERIFIED here | Sidebar.tsx:38 |
| Data Modeling | Data Sources (`dataSources`) | `/admin/data-sources` | Y | Y | N | N | UNVERIFIED here | Sidebar.tsx:39 |
| Data Modeling | Users (`users`) | `/admin/users` | Y | Y | N | N | UNVERIFIED here | Sidebar.tsx:40 |
| Data Modeling | Security (`security`) | `/admin/security` | Y | Y | N | N | UNVERIFIED here | Sidebar.tsx:41 |
| Data Modeling | Audit Log (`auditLog`) | `/admin/audit` | Y | Y | N | N | UNVERIFIED here | Sidebar.tsx:42 |
| Maps (`maps`) | Maps (`maps`) | `/maps` | Y | Y | Y | Y | authenticate; per-map rules in map.service.ts | Sidebar.tsx:45-47,122 |
| Other (`other`) | Schedules (`schedules`) | `/schedules` | Y | Y | Y | Y | UNVERIFIED here (other fragment) | Sidebar.tsx:50-54 |
| Other | Runs (`runs`) | `/runs` | Y | Y | Y | Y | UNVERIFIED here | Sidebar.tsx:52 |
| Other | Exports (`exports`) | `/exports` | Y | Y | Y | Y | UNVERIFIED here | Sidebar.tsx:53 |
| Other | Migration (`migration`) | `/admin/migration` | Y | Y (link shown) | N | N | ADMIN-only per team's verified fact -> MANAGER link leads to 403s (UI:Y/API:403) | Sidebar.tsx:58-60,126 |
| (footer, all roles) | Settings (`settings`) | `/settings` | Y | Y | Y | Y | authenticate only | Sidebar.tsx:130-143 |

Sidebar notes
- Direct-URL access: there are NO role route guards in App.tsx:81-107 — USER/VIEWER typing `/admin/...` reach the page shell and hit API 403s (team-verified fact; comment at Sidebar.tsx:99-102).
- A comment says Migration is admin-only (Sidebar.tsx:56) but code shows it to MANAGER too (Sidebar.tsx:126): FE comment/code mismatch.
- Active link is highlighted (Sidebar.tsx:80-85).


### Settings — route `/settings` — title key `settings:title` = "Settings" (subtitle `settings:subtitle` = "Manage your account preferences")
Visibility: sidebar footer link "Settings" and header user-menu "Settings" for ALL four roles; App.tsx route has no guard (FE/App.tsx:106). Backend `GET/PATCH /api/users/me/preferences` = `authenticate` only, no role check, always acts on the caller's own row (BE/routes/user-preferences.ts:59-121). All roles identical. Preferences are per-account (not per-browser): stored on the user row (`locale`, `theme`, `colorPalette`) (BE/services/user-preferences.service.ts:30-44). Page shows a spinner while loading; a red "common:states.error" line appears if loading failed (SettingsPage.tsx:74-86).
Page is only three cards + Save. No "default page size", no notifications, no profile/name/e-mail edit, no password link here.

| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| Language card: title "Language" (`settings:language.title`), description "Choose the language used across the interface." (`settings:language.description`) | Card header. | Y | Y | Y | Y | — | SettingsPage.tsx:90-91 |
| Display language (`settings:language.label`) — dropdown | Switches the UI language IMMEDIATELY in this browser (remembered in `localStorage` `discoverer-neo-locale`); it is only saved to your account when you click Save. | Y | Y | Y | Y | English; Português (Portugal); Français (France); Español (España) | SettingsPage.tsx:94-109; FE/i18n/index.ts:8,25-30,131; FE/hooks/useLocale.ts:36-49 |
| Theme card: "Theme" (`settings:theme.title`) / "Choose how the interface looks." (`settings:theme.description`) | Card header. | Y | Y | Y | Y | — | SettingsPage.tsx:115-116 |
| Appearance (`settings:theme.label`) — three swatch buttons | Click a swatch to apply the theme immediately (preview box shows real colours; check mark on the active one); saved to account only on Save. Each has a tooltip (title attr). | Y | Y | Y | Y | "Light" (tooltip "Use light theme"); "Dark" (tooltip "Use dark theme"); "High contrast" (tooltip "Use high contrast theme for better accessibility") | SettingsPage.tsx:119-152; FE/providers/ThemeProvider.tsx:15,119-135 |
| Color palette card: "Color palette" (`settings:palette.title`), description "Choose the accent colors used across the interface." (`settings:palette.description`) — or, when High contrast is active, "Not available while High contrast is selected — that mode uses its own fixed colors for accessibility." (`settings:palette.unavailableHighContrast`) | Card header; text swaps with theme. | Y | Y | Y | Y | — | SettingsPage.tsx:158-163 |
| Palette (`settings:palette.label`) — six swatch buttons | Click to apply accent colours immediately; saved on Save. All six are disabled (greyed, non-clickable) while theme = High contrast. | Y | Y | Y | Y | "Classic" (tooltip "Use classic palette"); "Navy" ("Use navy palette"); "Forest" ("Use forest palette"); "Wine" ("Use wine palette"); "Ocean" ("Use ocean palette"); "Ochre" ("Use ochre palette") | SettingsPage.tsx:166-213; FE/providers/PaletteProvider.tsx:14 |
| Save (`common:actions.save`) / "Saving…" (`common:actions.saving`) | PATCH `/api/users/me/preferences` {locale, theme, colorPalette}; success toast "Preferences saved" (`settings:saved`); failure toast titled `common:states.error` with the server message. | Y | Y | Y | Y | — | SettingsPage.tsx:60-72,216-220; BE/routes/user-preferences.ts:83-121 |




### Dashboard — route `/dashboard` (also `/` redirects here) — title: greeting `mapViewer:dashboard.welcomeWithName` = "Welcome, {{name}}" (fallback `mapViewer:dashboard.welcome` = "Welcome"), subtitle `mapViewer:dashboard.subtitle` = "Overview of your Discoverer Neo workspace."
Visibility: sidebar "Dashboard" (Overview) for all four roles; default landing page after login (LoginPage.tsx:60; App.tsx:83). No role guard. Backend: `GET /api/maps?scope=all` (authenticate) and `GET /api/dashboard/stats` (authenticate) — no role gate, but DATA differs by role (see columns) (BE/routes/maps.ts:219-250; BE/routes/dashboard.ts:15-61). Page is read-only: no buttons except links.

| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| Card "Total Maps" (`mapViewer:dashboard.totalMaps`) — big number | Count of maps you can open. Shows "—" while loading. | all active maps in system | all active maps in system | own + public + shared-with-you maps | same as USER | — | FE/pages/DashboardPage.tsx:16-27,46-50; BE/services/map.service.ts:895-927 |
| Sub-line "{{mine}} yours, {{shared}} shared with you" (`mapViewer:dashboard.totalMapsBreakdown`) | mine = maps whose `createdBy` is you; shared = total minus mine (for ADMIN/MANAGER this means "everyone else's maps", including private ones; for USER/VIEWER it also includes PUBLIC maps). | Y | Y | Y | Y | — | DashboardPage.tsx:27-28,52-57 |
| Card "Total Executions" (`mapViewer:dashboard.totalExecutions`) + text "Across every map you can see." (`mapViewer:dashboard.totalExecutionsDescription`) | Count of ALL logged executions (by anyone) of the maps you can see — not only your own runs. | all maps | all maps | visible maps | visible maps | — | DashboardPage.tsx:61-71; BE/routes/dashboard.ts:27-47 |
| Card "Scheduled Maps" (`mapViewer:dashboard.scheduledMaps`) | Number of distinct maps that have at least one ACTIVE schedule created by you (own schedules only, for every role incl. ADMIN). | own only | own only | own only | own only | — | DashboardPage.tsx:73-79; BE/routes/dashboard.ts:29,49-51; BE/services/scheduler.service.ts:396-403 |
| Link "View schedules" (`mapViewer:dashboard.viewSchedules`) [Scheduled Maps card] | Navigates to `/schedules`. | Y | Y | Y | Y | — | DashboardPage.tsx:81-83 |
| Card "Scheduled Results" (`mapViewer:dashboard.scheduledResults`) | Count of stored results produced by YOUR schedules. | own only | own only | own only | own only | — | DashboardPage.tsx:87-93; BE/routes/dashboard.ts:41-46 |
| Link "View schedules" [Scheduled Results card] | Navigates to `/schedules`. | Y | Y | Y | Y | — | DashboardPage.tsx:95-97 |
| Card "Recent Maps" (`mapViewer:dashboard.recentMaps`) + "Your last 5 updated maps." (`mapViewer:dashboard.recentMapsDescription`) | Lists up to 5 maps YOU created, newest `updatedAt` first (never other people's maps, even for ADMIN/MANAGER); each row = map name + date; click opens `/maps/{id}` (the map editor/builder route). | own maps | own maps | own maps | own maps | — | DashboardPage.tsx:30-32,102-137 |
| Recent Maps empty states | Loading: "Loading…" (`common:states.loading`). If system has no maps: "No maps exist yet. Create one to get started." (`mapViewer:mapsList.emptyNoneAtAll`). If maps exist but none are yours: "{{count}} worksheet exists; none are yours." / "{{count}} worksheets exist; none are yours." (`mapViewer:mapsList.emptyTabMine_one/_other`). | Y | Y | Y | Y | — | DashboardPage.tsx:108-115; mapViewer.json:69-72 |







Paths relative to `discoverer-neo`. FE = `frontend/src`, BE = `backend/src`. Sidebar: all four pages sit in NavSections shown to every role (`FE/components/layout/Sidebar.tsx:44-53`; only Data Modeling / Migration are gated by `canModel = ADMIN||MANAGER`, :73). `FE/App.tsx:98-105` has no role guard on them, only ProtectedRoute. Sidebar section "Maps" = `nav:sections.maps` "Maps" holds only "Maps" (`nav:items.maps`); "Schedules", "Runs", "Exports" are under section "Other" (`nav:sections.other`).

**VIEWER check (global):** the only backend role block on these pages is copy (`BE/services/map.service.ts:1305-1311` canDuplicate, `BE/routes/maps.ts:393-419`, `BE/services/workbook.service.ts:179`). Nothing blocks VIEWER on run (`BE/routes/map-runs.ts:127-160` needs only map VIEW), export (`BE/routes/export.ts:167-180` needs map EXPORT), or schedule (`BE/routes/schedules.ts:214-230` needs map SCHEDULE). VIEWER's limits come only from what the map share gives. `SHARE_ALLOWS` (`BE/services/map.service.ts:1206-1216`): VIEW=[VIEW]; EXPORT=[VIEW,EXPORT,SCHEDULE]; EDIT=all four. Public map = VIEW+EXPORT only for non-owner (:1259). MANAGER_ALLOWS=[VIEW,EXPORT,SCHEDULE] (:1222). Creating a map needs a business-area CREATE grant (`BE/routes/maps.ts:298`, `BE/middleware/business-area-auth.ts:44-81`; ADMIN bypass :53), no role check, so a VIEWER with a CREATE grant could create. UNVERIFIED whether `userHasPermission` itself rejects VIEWER. Data gate: every run goes through `assertDataEntitlement` (`BE/services/map-execution.service.ts:501`; `BE/services/business-area.service.ts:462-500`); ADMIN bypass is audited (:490-497); other roles refused with FORBIDDEN if a touched folder has no business-area grant. Exports read a stored run, so the data gate applied at run time.

### Maps list — route `/maps` — title key `mapViewer:mapsList.title` = "Maps"
Description line `mapViewer:mapsList.description` = "Browse and manage your visual maps." (`FE/pages/MapsListPage.tsx:163-164`).
Visibility: all four roles see it in the sidebar and can open the URL (no guard, `FE/App.tsx:99`). Page loads `GET /api/maps?scope=owned` and `?scope=all` (`FE/lib/api.ts:409-416`, `BE/routes/maps.ts:218-253`), `GET /api/business-areas` (authenticate only, `BE/routes/business-areas.ts:134-137`) and `GET /api/workbooks` (`BE/routes/workbooks.ts:29-43`). Row scoping: **Mine** = maps you created (`BE/services/map.service.ts:872`); **Shared with me** = maps with a share row for you, any level (:959-972); **All** = `listAll` (:895-935): ADMIN and MANAGER get every active map; USER/VIEWER get own + public + shared. A business-area grant does not list maps (:929-931). Default tab: Mine, or All if you own nothing (`FE/pages/MapsListPage.tsx:55`). Listing is not data entitlement (`BE/routes/maps.ts:216-217`).

| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| Create Map (`mapViewer:mapsList.createButton`) | Link to `/maps/new` (map builder) | Y | Y | Y | Y (UI); save needs a business-area CREATE grant (ADMIN bypasses) | | FE/pages/MapsListPage.tsx:166-170; BE/routes/maps.ts:295-298 |
| Tabs: "Mine" / "Shared with me" / "All" (`mapsList.tabs.mine/shared/all`) | Switches which list is shown | Y | Y | Y | Y | Mine = own; Shared with me = shares to you; All = everything you can see (ADMIN/MANAGER: every map; USER/VIEWER: own+public+shared) | FE MapsListPage.tsx:175-180; BE/services/map.service.ts:872,895,959 |
| Search maps by name… (`mapsList.searchPlaceholder`) | Client-side name filter | Y | Y | Y | Y | | FE MapsListPage.tsx:188-193 |
| Business Area filter (aria `mapsList.columns.businessArea`) | Filters rows by business area | Y | Y | Y | Y | "All business areas" (`mapsList.businessAreaAllOption`) + each business area name | FE MapsListPage.tsx:195-207 |
| Sort by (`mapsList.sortLabel`) | Client-side sort | Y | Y | Y | Y | "Recently updated" (`sortRecency`), "Name (A–Z)" (`sortName`) | FE MapsListPage.tsx:208-216 |
| Clear (`common:actions.clear`) | Resets search and business-area filter; only shown when a filter is active | Y | Y | Y | Y | | FE MapsListPage.tsx:217-228 |
| Row counter (`mapsList.rowCount`) "{{shown}} of {{total}} maps" | Info | Y | Y | Y | Y | | FE MapsListPage.tsx:229-231 |
| Empty-state messages | Info: "No maps exist yet. Create one to get started." (`emptyNoneAtAll`), "No maps match your search or filters." (`emptyNoMatches`), "{{count}} worksheet(s) exist; none are yours." (`emptyTabMine_*`), "...none are shared with you." (`emptyTabShared_*`) | Y | Y | Y | Y | | FE MapsListPage.tsx:147-157 |
| Columns: Name (`common:labels.name`), Workbook (`mapsList.columns.workbook`), Owner (`mapsList.columns.owner`), Business Area, Type (`common:labels.type`), Updated (`common:labels.updatedAt`), Actions (`common:labels.actions`) | Owner name and workbook name come from `withListNames`; "—" if none | Y | Y | Y | Y | Type badge shows `mapType` | FE MapsListPage.tsx:246-257,283-294; BE/services/map.service.ts:~938-957 |
| Map name link | Opens editor `/maps/:id` if you can edit, else viewer `/maps/:id/view` | Y | Y (viewer unless own or EDIT share) | Y | Y (viewer) | | FE MapsListPage.tsx:277-282 |
| Eye icon, tooltip `actions.viewTooltip` "Open the map and run it to see its rows" | Opens viewer `/maps/:id/view` | Y | Y | Y | Y | | FE MapsListPage.tsx:297-301; BE/routes/maps.ts:273-290 (VIEW) |
| Pencil icon, tooltip `actions.editTooltip` "Change the map's columns, conditions and layout" | Opens editor | Y (every map) | own maps only (UI:N/API:403 on others) | own maps, or Shared-tab rows with EDIT share | N unless owner/EDIT share (a VIEWER given EDIT can) | | FE MapsListPage.tsx:140,302-308; BE/routes/maps.ts:333-348 (EDIT); BE/services/map.service.ts:1249-1266 |
| Copy icon, tooltip `actions.copyTooltip` "Make your own copy of this map, which you can then change" | `POST /api/maps/:id/duplicate`, then opens the copy in the editor; toast "Map copied. You are now editing your copy." (`toast.copied`) | Y | Y (any map they can view) | Y (any map they can view) | N (button hidden; API 403 "A read-only VIEWER cannot copy maps") | | FE MapsListPage.tsx:145,309-319,115-122; BE/routes/maps.ts:393-419; BE/services/map.service.ts:1305-1311 |
| Share icon, tooltip `actions.shareTooltip` "Choose who else can open this map and what they may do with it" | Opens Share map dialog | Y | Y (every map) | own maps only | own maps only | | FE MapsListPage.tsx:141,320-329; BE/services/map.service.ts:1287-1297; BE/routes/map-shares.ts:48-112 |
| Calendar icon, tooltip `actions.scheduleTooltip` "Run this map on a timetable and keep the results" | Link to `/schedules?mapId=<id>` which opens New Schedule with the map preselected | Y | Y | own maps, or share EXPORT/EDIT (Shared tab only shows share level) | same rule as USER | | FE MapsListPage.tsx:143-144,330-336; FE/pages/SchedulesPage.tsx:196-204 |
| Download icon, tooltip `actions.exportTooltip` "Open the map to export its result to Excel, CSV or PDF" | Link to the viewer (exporting happens there) | Y | Y | same rule as Schedule icon | same | | FE MapsListPage.tsx:337-344 |
| Trash icon, tooltip `actions.deleteTooltip` "Delete this map" | Opens delete confirm; `DELETE /api/maps/:id` (soft delete) | Y (any) | own maps only | own maps only | own maps only | | FE MapsListPage.tsx:142,345-354; BE/routes/maps.ts:369-392 (DELETE = owner/admin only, map.service.ts:1218-1222,1249) |
| Delete confirm dialog: title "Delete map?" (`admin:shared.deleteConfirmTitle`), text "This will deactivate <name> This action can only be reversed by an administrator." (`deleteConfirmDescriptionPrefix/Suffix`), buttons Cancel (`common:actions.cancel`), Delete (`common:actions.delete`) / "Deleting..." | Confirms delete; toasts "Map deleted" (`toast.deleted`) / "Failed to delete map" (`toast.deleteFailed`) | Y | own | own | own | | FE MapsListPage.tsx:375-384; FE/components/admin/DeleteConfirmDialog.tsx:34-55 |

#### Workbooks section (top of page, only rendered if at least one visible map belongs to a workbook)
Visibility: `GET /api/workbooks` = the workbooks of `listAll` maps, grouped; a workbook shows only worksheets you can see (`BE/services/workbook.service.ts:20-66`).
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| Heading "Workbooks" (`mapsList.workbooks.title`) | Section title; "Could not load workbooks." on error (`workbooks.loadError`) | Y | Y | Y | Y | | FE/components/maps/WorkbookBrowseSection.tsx:75,79 |
| Search workbooks or worksheets... (`workbooks.filterPlaceholder`) | Filters by workbook or worksheet name; "No workbook matches this search." (`workbooks.noMatch`) | Y | Y | Y | Y | | WorkbookBrowseSection.tsx:82-95 |
| Workbook row (click to expand), "{{count}} worksheet(s)" (`workbooks.worksheetCount_*`) | Expands to list its worksheets | Y | Y | Y | Y | | WorkbookBrowseSection.tsx:98-102 |
| Worksheet link | Opens `/maps/:id/view` | Y | Y | Y | Y | | WorkbookBrowseSection.tsx:157 |
| Pencil in worksheet row, tooltip "Edit worksheet" (`mapViewer:workbookDelete.editSheet`) | Opens editor; shown only if ADMIN or you created that worksheet | Y | own sheets | own sheets | own sheets | | WorkbookBrowseSection.tsx:28,160-170 |
| Copy icon, tooltip "Make your own copy of the whole workbook, which you can then change" (`workbookDuplicate.tooltip`; aria "Copy workbook") | Opens copy dialog | Y | Y | Y | N (hidden; API refuses per sheet with canDuplicate) | | WorkbookBrowseSection.tsx:104-119; BE/routes/workbooks.ts:48-86; BE/services/workbook.service.ts:164-185 |
| Copy dialog: title `Copy "<name>"` (`workbookDuplicate.title`), text "Makes a new workbook with a private copy of every worksheet. You can then edit the copy. The original does not change." (`.description`), field "Name of the new workbook" (`.nameLabel`, default "<name> (copy)", max 255), Cancel, Copy (`.submit`) | `POST /api/workbooks/:id/duplicate`; toast `Created "<name>"` (`.done`); 403 lists refused worksheets ("Copying needs "CREATE" permission for every worksheet") | Y | Y | Y | N | | FE/components/maps/WorkbookDuplicateDialog.tsx:70-83; BE/routes/workbooks.ts:75-83 |
| Share icon, tooltip "Share workbook" (`workbookShare.shareButton`) | Opens workbook share dialog | Y | Y | N (hidden, API 403) | N | | WorkbookBrowseSection.tsx:26,120-135; BE/routes/workbooks.ts:125-128,154-157,209-212 (authorize ADMIN, MANAGER) |
| Workbook share dialog: title `Share "<name>"` (`workbookShare.title`), "Give someone every worksheet in this workbook — {{count}} in total." (`.description`), per-user detail "{{held}} of {{total}} worksheets" (`.sheetsHeld`), same user list as Share map dialog | Fans out one share per worksheet (`POST /api/workbooks/:id/shares`); ✕ removes (`DELETE .../shares/:userId`). Toasts "Shared {{count}} worksheet(s)", "Not shared: {{names}}", "Could not share the workbook", "Access removed", "Could not remove access". Each worksheet needs `canManageShares` (ADMIN, owner, or MANAGER who can view) | Y | Y (worksheets it can view) | N | N | Can view / Can export / Can edit | FE/components/maps/WorkbookShareDialog.tsx:100-112,57-92; BE/services/workbook.service.ts:73-100 |
| Trash icon, tooltip "Delete workbook" (`workbookDelete.button`) | Opens confirm; `DELETE /api/workbooks/:id` soft-deletes every worksheet. Shown only if you own every worksheet (ADMIN: always) | Y | own workbooks | own workbooks | own workbooks | | WorkbookBrowseSection.tsx:136-151; BE/routes/workbooks.ts:91-121; workbook.service.ts:215-232 (DELETE per sheet) |
| Workbook delete confirm: title "Delete workbook?", text `This deletes "<name>" and its N worksheet(s). Only an administrator can bring it back.` (`workbookDelete.description_*`), Cancel / Delete; toasts "Workbook deleted" / "Could not delete the workbook" | Confirms delete | same | same | same | same | | WorkbookBrowseSection.tsx:197-207 |

#### Share map dialog (`components/map-builder/ShareDialog.tsx`, opened by the Share icon)
Endpoints: list `GET /api/maps/:id/shares`, add `POST`, change `PUT .../shares/:userId`, remove `DELETE .../shares/:userId`, all gated by `canManageShares` (`BE/routes/map-shares.ts:48-72, 82-131, 133-186, 188-225`). User list from `GET /api/users/search?q=` (any authenticated user, `BE/routes/users.ts:86-92`; empty `q` lists everyone per CHANGELOG 2.0.0).
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| Title "Share map" (`mapBuilder:share.title`); text "Give other users access to view, export, or edit this map." (`share.description`) | Header | Y | Y | own maps | own maps | | ShareDialog.tsx:99-100 |
| Search by name or email… (`share.searchPlaceholder`; aria `share.searchAria`) | Filters the user list; "No matching users" (`share.noMatchingUsers`) | Y | Y | Y | Y | | FE/components/maps/ShareUserList.tsx:50-56,61-62 |
| Hint "Click a level next to a person to share with them. The dark button is what they have now. ✕ removes their access." (`share.listHint`) | Info | Y | Y | Y | Y | | ShareUserList.tsx:56 |
| Per-user level buttons | Click a level to share at that level or change it (creates or updates the share); the dark one is current; users holding a share are listed first. Toasts "Map shared", "Permission updated", "Could not share map" | Y | Y | own maps | own maps | "Can view" (`share.permissions.VIEW`, tooltip "Can open and run the map. Cannot export, schedule or change it."), "Can export" (`.EXPORT`, tooltip "Can open and run the map, export its result, and put it on a schedule."), "Can edit" (`.EDIT`, tooltip "Can do all of the above, and also change the map.") | ShareUserList.tsx:80-94; ShareDialog.tsx:44-64; BE/services/map.service.ts:1206-1216 |
| ✕ button (tooltip and aria "Revoke access for {{name}}", `share.revokeAria`) | Removes that user's share; toast "Access revoked"; hidden for users without a share | Y | Y | own maps | own maps | | ShareUserList.tsx:95-106; ShareDialog.tsx:66-79 |
| Public notice "This map is public — anyone with the link can view it." (`share.publicNotice`) plus **Copy link** (`share.copyLink`, tooltip "Copy this map's address, to send to someone" `share.copyLinkTooltip`) | Only if the map is public; copies `/maps/:id/view` URL; toasts "Link copied to clipboard" / "Could not copy link". There is no public/private toggle here | Y | Y | own | own | | ShareDialog.tsx:81-93,110-125 |

Transfer of owner is NOT on this page. It lives on the Users page (`FE/pages/UsersPage.tsx:438`, `apiClient.maps.transferOwner` `FE/lib/api.ts:477`) via `PUT /api/maps/:id/owner`: ADMIN or MANAGER only, 403 otherwise (`BE/routes/map-shares.ts:228-249`). Duplicate rename/rename map: no rename control on this page (UNVERIFIED elsewhere).


### Runs — route `/runs` — title key `runs:title` = "Runs"
Description `runs:description` = "Every map run you've requested — queued, in progress, or finished — and how long its result stays valid." (`FE/pages/RunsPage.tsx:198`). Note: the CHANGELOG calls it "Executions"; the UI label is "Runs".
Visibility: sidebar for all roles (Other section); URL open to all (`FE/App.tsx:104`). Backend `GET /api/runs` (`BE/routes/map-runs.ts:165-236`): non-admin gets only runs they requested; `all=true` is ADMIN only, else 403 "Only an administrator may list every user's runs" (:180-185). Every row is also dropped if you no longer have map VIEW (`canAccessMap`, :198-224), so a revoked share hides your own history. Limit 200 rows (FE RunsPage.tsx:39). Page refreshes every 2 s while any run is Queued/Running, else every 30 s (:36-38,138-139). Rows appear from live runs (viewer/editor) and scheduled runs.
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| Map filter (`runs:filters.map`) | Client-side filter to one map (options are maps present in the loaded runs) | Y | Y | Y | Y | "All maps" (`filters.allMaps`) + map names | FE RunsPage.tsx:200-212 |
| Status filter (`runs:filters.status`) | Client-side filter | Y | Y | Y | Y | "All statuses" (`filters.allStatuses`), Queued, Running, Completed, Failed, Cancelled (`statuses.*`) | RunsPage.tsx:213-225 |
| Kind filter (`runs:filters.kind`) | Client-side filter | Y | Y | Y | Y | "All kinds" (`filters.allKinds`), "Live", "Scheduled" (`kinds.*`) | RunsPage.tsx:226-238 |
| Checkbox "Show every user's runs" (`filters.allUsers`) | Reloads with `GET /api/runs?all=true`; there is no owner column, so rows of other users are not labelled | Y | N (hidden; API 403) | N | N | | RunsPage.tsx:124,239-244; BE/routes/map-runs.ts:180-185 |
| Columns: Map, Kind, Parameters, Status, Rows, Duration, Ran at, Expires in, Actions (`runs:columns.*`) | Table; Parameters show first 3 `name=value` pairs, "—" if none (`noParameters`); Duration in ms | Y | Y | Y | Y | | RunsPage.tsx:249-260,75-80,292-295 |
| Map name link | Opens `/maps/:id/view` | Y | Y | Y | Y | | RunsPage.tsx:281 |
| Status badge | Shows Queued / Running / Completed / Failed / Cancelled | Y | Y | Y | Y | | RunsPage.tsx:45-73; `runs:statuses.*` |
| Expires in (`columns.expiresIn`) | Shows "{{count}}m", "{{count}}h", "{{count}}d" or "Expired" | Y | Y | Y | Y | | RunsPage.tsx:295; FE/lib/format.ts:92-106; runs.json `expiresIn*`, `expired` |
| Open icon (`actions.open` "Open") | Opens `/maps/:id/view?run=<id>` to see that stored result | Y | Y | Y | Y | | RunsPage.tsx:298-302; BE/routes/map-runs.ts:257-286 (rows: 409 if not completed, 410 if expired) |
| Run again icon (`actions.runAgain` "Run again") | `POST /api/maps/:id/runs` with same parameters and calculated fields, force=false; toasts "Result reused"/"A valid result already existed, so nothing new ran." or "Queued"/"The run was added to the queue."; error "Couldn't run again". Needs map VIEW at that moment | Y | Y | Y | Y | | RunsPage.tsx:158-174,303-311; BE/routes/map-runs.ts:127-160; BE/services/map-run.service.ts:64-97 |
| XLSX / CSV / PDF buttons (`actions.xlsx/csv/pdf`; tooltips "Download this run's results as an Excel spreadsheet / a CSV file / a PDF document") | Creates an export job from the run then downloads it; only for Completed runs that have not expired | Y | Y | Y | Y (needs map EXPORT: API 403 when the viewer only has VIEW) | XLSX, CSV, PDF | RunsPage.tsx:41-43,83-109; BE/routes/export.ts:167-211 (map EXPORT, run must be caller's own or caller ADMIN, else 409 RUN_NOT_EXPORTABLE) |
| Cancel icon (`actions.cancel` "Cancel") | Cancels a run that is Queued (`DELETE /api/runs/:id`); toast "Run cancelled" / "Couldn't cancel the run". No cancel button for Running rows | Y | Y | Y | Y | | RunsPage.tsx:176-184,313-323; BE/services/map-run.service.ts:113-131 |
| Delete icon (`actions.delete` "Delete") | For Completed/Failed/Cancelled runs; confirm dialog then `DELETE /api/runs/:id`; toast "Run deleted" / "Couldn't delete the run" | Y | Y | Y | Y | | RunsPage.tsx:186-195,324-333; BE/routes/map-runs.ts:291-334 |
| Delete confirm: title "Delete run?", text "This permanently deletes this run of <name> and its stored rows. This cannot be undone." (`runs:deleteConfirmDescription`), Cancel, Delete | Confirms | Y | Y | Y | Y | | RunsPage.tsx:345-353 |
| Pager + loading "Loading runs…" (`runs:loading`) + empty "No runs yet. Run a map to see its history here." (`runs:empty`) | Paging | Y | Y | Y | Y | | RunsPage.tsx:263-275,343 |


### Exports — route `/exports` — title key `mapViewer:exportHistory.title` = "Exports"
Description `mapViewer:exportHistory.description` = "Your data exports, queued, running or finished. A completed export can be downloaded again at any time." (`FE/pages/ExportsPage.tsx:95-96`; note: "at any time" is not literally true, files are removed after `EXPORT_RETENTION_DAYS`, default 7, `BE/config.ts:239`, `BE/services/export.service.ts:580-610`).
Visibility: sidebar for all roles; URL open to all (`FE/App.tsx:105`). `GET /api/exports?limit=` (`BE/routes/export.ts:214-230`) returns only the caller's own jobs (no admin/all scope), newest first, FE asks 100 (ExportsPage.tsx:22), refresh 2 s while Queued/Running else 30 s (:19-21,73-74).
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| Columns: Map (`exportHistory.map`), Format, Status, Rows, Created (`exportHistory.*`) | Table; Map cell shows name (hover shows id), first 8 chars of id if map gone; Status cell hover shows the error message | Y (own jobs) | Y (own) | Y (own) | Y (own) | Format XLSX / CSV / PDF (`BE/routes/export.ts:22`) | FE ExportsPage.tsx:102-107,126-134 |
| Status badge | Shows "Queued" (PENDING), "Running" (PROCESSING), "Completed", "Failed" (`exportHistory.statuses.*`) | Y | Y | Y | Y | PENDING, PROCESSING, COMPLETED, FAILED | ExportsPage.tsx:24-53,17 |
| Download icon (tooltip "Download", `exportHistory.download`) | Only on Completed rows: `GET /api/exports/:jobId/download` streams the file, saved as `<map name>.xlsx/.csv/.pdf`; failure toast "Download failed" (`mapViewer:export.downloadFailedTitle`) | Y | Y | Y | Y if the map still gives EXPORT (API 403 "You do not have "EXPORT" access to this map" otherwise) | | ExportsPage.tsx:78-91,136-145; BE/routes/export.ts:253-280,105-145 |
| Loading "Loading exports…" (`exportHistory.loading`), empty "No exports yet." (`exportHistory.noExports`), pager | Info | Y | Y | Y | Y | | ExportsPage.tsx:111-122,153 |

There is no delete, cancel or expiry column on this page. Exports are created elsewhere (viewer, editor, Runs page, schedule history) by `POST /api/maps/:id/exports` (`BE/routes/export.ts:167-211`), which needs map EXPORT and a finished, unexpired run of the caller (or any run if ADMIN), body format XLSX|CSV|PDF (PDF may carry layout options), else 409 `RUN_NOT_EXPORTABLE`; response 202 PENDING.


### Schedules — route `/schedules` — title key `schedules:page.title` = "Schedules"
Description `schedules:page.description` = "Run maps automatically on a cron schedule and store their results." (`FE/pages/SchedulesPage.tsx:~608`, AdminPageWrapper title/description). Also opened with `?mapId=<id>` from the Maps list Calendar icon: New Schedule dialog opens with that map preselected and a Back button appears (`FE/pages/SchedulesPage.tsx:196-204,572-573` BackButton fallback `/maps`).
Visibility: sidebar for all roles; URL open to all (`FE/App.tsx:103`). `GET /api/schedules` returns only the caller's own schedules for every role, including ADMIN (`BE/routes/schedules.ts:247-257`, `listSchedulesForUser(user.sub)`). Per-schedule actions need ownership, ADMIN passes for any id by API only (`loadOwnSchedule` `BE/routes/schedules.ts:143-174`, isOwner at :157); non-owner gets 403 "You do not own this schedule". Schedules run as their creator (`BE/services/scheduler.service.ts:690-696` userId = createdBy), so the creator's business-area grants apply. Creating needs map action SCHEDULE (`schedules.ts:224-230`): owner, ADMIN, MANAGER (every map), EXPORT or EDIT share; public map does NOT allow SCHEDULE; VIEW-only share does not. VIEWER role is not blocked.
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| New Schedule button (`page.newSchedule`) | Opens create dialog | Y | Y | Y | Y (UI); API 403 unless share EXPORT/EDIT or owner | | FE SchedulesPage.tsx:~570-575 (action prop); BE/routes/schedules.ts:214-230 |
| Table columns: Name, Map, Schedule (cron text), Next Run, Format, Status, Planner (`table.*`) | Map column resolves name from your own + shared maps, else first 8 chars of id | Y (own schedules) | Y (own) | Y (own) | Y (own) | | FE SchedulesPage.tsx:330-395 |
| Status badge | "Active" / "Paused" (`table.active`, `table.paused`) | Y | Y | Y | Y | | SchedulesPage.tsx:346-352 |
| Planner badge | Shows the planner decision text (e.g. an "REFUSE(...)" code or "UNPLANNABLE", red, hover shows plain-language detail); "Not checked" (`table.plannerNotChecked`) if none. Filled by the schedule import, not editable here | Y | Y | Y | Y | | SchedulesPage.tsx:354-370; BE/services/schedule-import.service.ts:563-576 |
| Empty state "No schedules yet." (`page.emptyMessage`) | Info | Y | Y | Y | Y | | SchedulesPage.tsx:~575-580 |
| Play icon, tooltip "Run now" (`table.runNow`) | `POST /api/schedules/:id/trigger`; disabled while paused; toast "Run queued" / "Check history shortly for the result."; error "Trigger failed". Bypasses validity window; the run appears on the Runs page as Kind "Scheduled" | Y (any by API) | Y | Y | Y | | SchedulesPage.tsx:377-385,292-306; BE/routes/schedules.ts:336-356 (owner + live map SCHEDULE, else 409 "The underlying map is no longer accessible for scheduling"); scheduler.service.ts:593-611 (409 if disabled) |
| Pause/Enable icon, tooltip "Pause" (`table.pause`) or "Enable" (`table.enable`) | `POST /api/schedules/:id/toggle`; toasts "Schedule paused" / "Schedule enabled"; "Update failed" | Y | Y | Y | Y | | SchedulesPage.tsx:386-393,266-290; BE/routes/schedules.ts:315-333 (owner only, no map check) |
| History icon, tooltip "History" (`table.history`) | Opens Execution History dialog | Y | Y | Y | Y | | SchedulesPage.tsx:394-400; BE/routes/schedules.ts:359-376 |
| Edit icon, tooltip "Edit" (`table.edit`) | Opens Edit Schedule dialog | Y | Y | Y | Y | | SchedulesPage.tsx:401-407; BE/routes/schedules.ts:274-297 (owner; no live map check) |
| Delete icon, tooltip "Delete" (`table.delete`) | Opens delete dialog | Y | Y | Y | Y | | SchedulesPage.tsx:408-414; BE/routes/schedules.ts:300-312 |
| Delete dialog: title "Delete schedule?" (`deleteDialog.title`), text "This permanently deletes <name> and its execution history. This cannot be undone." (`descriptionBefore/After`), Cancel, Delete / "Deleting..." (`deleteDialog.deleting`) | `DELETE /api/schedules/:id`; toasts "Schedule deleted" / "Delete failed" | Y | Y | Y | Y | | SchedulesPage.tsx:~735-760 |

#### New Schedule / Edit Schedule dialog (`dialog.createTitle` "New Schedule" / `dialog.editTitle` "Edit Schedule")
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| Map (`dialog.mapLabel`; placeholder "Select a map to schedule" `dialog.mapPlaceholder`) | Chooses the map; only in Create (not Edit, the map cannot be changed) | Y | Y | Y | Y | Dropdown lists YOUR maps and maps shared with you (any level) with suffix "(shared)" (`dialog.sharedSuffix`); NOT every map for MANAGER/ADMIN and NOT public maps. A map arriving via `?mapId=` is added to the list. Validation "Select a map" (`validation.selectMap`) | SchedulesPage.tsx:124-131,318-323,510-520; `FE/lib/api.ts:409` listMine |
| Name (`dialog.nameLabel`) | Schedule name, max 255; error "Name is required" (`validation.nameRequired`) | Y | Y | Y | Y | | SchedulesPage.tsx:~540-546; BE/routes/schedules.ts:38 |
| Frequency (`dialog.frequencyLabel`) | Presets fill the cron expression | Y | Y | Y | Y | "Daily (midnight)" = `0 0 * * *`; "Weekly (Sunday, midnight)" = `0 0 * * 0`; "Monthly (1st, midnight)" = `0 0 1 * *`; "Custom" (`cronPresets.*`) | SchedulesPage.tsx:41-46,551-565 |
| Timezone (`dialog.timezoneLabel`) | Timezone of the cron | Y | Y | Y | Y | UTC, America/New_York, America/Chicago, America/Denver, America/Los_Angeles, America/Sao_Paulo, Europe/London, Europe/Berlin, Europe/Paris, Europe/Moscow, Asia/Kolkata, Asia/Shanghai, Asia/Tokyo, Asia/Dubai, Australia/Sydney (default UTC). Backend accepts any valid zone (`scheduler.service.ts:192-194`) | SchedulesPage.tsx:53-69,566-580 |
| Cron expression (`dialog.cronExpressionLabel`), placeholder `0 9 * * 1-5`, help "Standard 5-field cron syntax (minute hour day-of-month month day-of-week)." (`dialog.cronExpressionHelp`) | Shown only when Frequency = Custom; error "Cron expression is required" (`validation.cronExpressionRequired`); invalid cron gives API 400 "Invalid cron expression: ..." | Y | Y | Y | Y | | SchedulesPage.tsx:~584-600; BE/services/scheduler.service.ts:188-191 |
| Valid from (optional) (`dialog.validFromLabel`) | datetime-local; cron will not fire before it | Y | Y | Y | Y | | SchedulesPage.tsx:~603-607 |
| Valid until (optional) (`dialog.validUntilLabel`) | datetime-local; after it cron stops; API 400 "validFrom must be before validUntil" | Y | Y | Y | Y | | SchedulesPage.tsx:~608-611; scheduler.service.ts:196-201 |
| Output Format (`dialog.outputFormatLabel`) | Format of the stored result | Y | Y | Y | Y | "Excel (.xlsx)" (`dialog.formatExcel`), "CSV" (`dialog.formatCsv`); default CSV. PDF only from the history export buttons | SchedulesPage.tsx:~614-628; BE/routes/schedules.ts:43 |
| Parameter presets (`dialog.parameterPresetsLabel`) | One input per declared map parameter (required ones marked *), placeholder default or "Value used for every scheduled run" (`dialog.parameterValuePlaceholder`); input type text / number / date by parameter type. Only shown if the map declares parameters | Y | Y | Y | Y | | SchedulesPage.tsx:72-76,~630-655 |
| Enabled checkbox (`dialog.enabledLabel`) | Whether cron runs it; default on | Y | Y | Y | Y | | SchedulesPage.tsx:~657-666 |
| Cancel (`common:actions.cancel`) / Save (`common:actions.save`) / "Saving..." (`dialog.saving`) | Submit creates (`POST /api/maps/:mapId/schedules`) or updates (`PUT /api/schedules/:id`); toasts "Schedule created" / "Schedule updated" / "Save failed" | Y | Y | Y | Y (API 403 on create without SCHEDULE on the map) | | SchedulesPage.tsx:207-254,~668-680; BE/routes/schedules.ts:214-245,274-297 |

Not exposed in the UI though the API accepts it: `resultRetentionDays` (1-3650, default 30) (`BE/routes/schedules.ts:46`). No recipients, e-mail or delivery target exist: the result is stored on the server (UNVERIFIED that no e-mail delivery exists elsewhere; none found in `BE/routes/schedules.ts` or `scheduler.service.ts`).

#### Execution History dialog (`history.title` "Execution History — {{name}}", last 50 results; `BE/routes/schedules.ts:359-376`)
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| Columns Executed, Status, Rows, Duration (`history.*`, "{{seconds}}s") | Table; loading "Loading..." (`history.loading`), empty "No runs yet." (`history.noRuns`) | Y | Y | Y | Y | Status badge: SUCCESS, FAILED, TIMEOUT (hover shows error message) | SchedulesPage.tsx:~790-846; BE/routes/schedules.ts:97 |
| XLSX / CSV / PDF buttons (`history.xlsx/csv/pdf`; tooltips "Download as Excel / as CSV / as PDF", `export.*`) | Creates an export job from that run's stored result; only for SUCCESS results with a run id and unexpired result | Y | Y | Y | Y if map EXPORT (API 403 otherwise: a VIEW-only sharee cannot) | XLSX, CSV, PDF | SchedulesPage.tsx:~683-700,~745-770; BE/routes/export.ts:167-211 |
| Open icon (`history.open` "Open") | Opens `/maps/:id/view?run=<runId>` | Y | Y | Y | Y | | SchedulesPage.tsx:~702-706 |
| Download icon (`history.download` "Download") | Legacy results with a file on disk and no run id: `GET /api/schedules/:id/results/:resultId/download` streams the .xlsx/.csv | Y | Y | Y | Y | | SchedulesPage.tsx:~808-815; BE/routes/schedules.ts:379-424 |
| "Expires {{value}}" (`history.expiresIn`) | Shows time left, e.g. "Expires 29d" | Y | Y | Y | Y | | SchedulesPage.tsx:~820-826 |




All paths relative to `discoverer-neo`. FE = `frontend/src`, BE = `backend/src`. i18n ns `mapBuilder` = FE/locales/en/mapBuilder.json, `mapViewer` = FE/locales/en/mapViewer.json, `common` = FE/locales/en/common.json, `errors` = FE/locales/en/errors.json.

### Legend (role cells)

Map-level gate = `canAccessMap` (BE/services/map.service.ts:1249-1268) via `loadMapWithAccess` (BE/routes/maps.ts:141-168, 403 body `{error:"Forbidden", details:'You do not have "<ACTION>" access to this map'}`).
- **VIEW-gate**: ADMIN Y; MANAGER Y (every map, map.service.ts:1222,1258); USER/VIEWER Y only if map is owned by them, `isPublic`, or shared to them at any level (SHARE_ALLOWS map.service.ts:1206-1214). Written `V-gate`.
- **EXPORT-gate**: ADMIN Y; MANAGER Y; USER/VIEWER Y if owner, public, or share EXPORT/EDIT (public grants VIEW+EXPORT only, map.service.ts:1257). VIEW-only share => 403. Written `X-gate`.
- **EDIT-gate**: ADMIN Y; MANAGER, USER, VIEWER Y only if owner or EDIT share (MANAGER_ALLOWS has no EDIT, map.service.ts:1222). Written `E-gate`.
- **DELETE-gate**: owner or ADMIN only (no share level grants DELETE).
- **CREATE-gate** (new map): `requireBusinessAreaAccess('CREATE')` (BE/middleware/business-area-auth.ts:44-81): ADMIN bypass; every other role (incl. MANAGER and VIEWER) needs a business-area grant of level CREATE or higher. No role check anywhere. Written `C-gate`.
- **Data gate** (`assertDataEntitlement`, BE/services/business-area.service.ts:462-507 + row-level security BE/services/security.service.ts:467-499) runs on EVERY run/export/drill/formula-test/pick-list: needs a business-area grant on each folder touched; ADMIN bypasses (audit-logged). Called at BE/services/map-execution.service.ts:501-509 and BE/services/lov.service.ts:463. Written `D-gate`. It fails as a run FAILED with kind FORBIDDEN, not as an HTTP 403 on POST /runs.
- No frontend role guard anywhere on these pages (FE/App.tsx:98-102 routes have only ProtectedRoute; grep of `role|canEdit|readOnly|isOwner` in components/map-builder, components/parameters, pages/MapBuilderPage.tsx, pages/MapViewerPage.tsx, store/mapBuilder.ts, hooks/useMapRun.ts, hooks/useMapExport.ts = 0 hits). Therefore every control is enabled for every role; the only UI disable conditions are `mapId` null (unsaved), run in flight, or empty canvas. Where UI is enabled but backend refuses, cell reads `UI:Y/API:403`.
- The ONLY role-name check on map objects is `canDuplicate` (map.service.ts:1305-1311, VIEWER blocked from copy) and `canManageShares` (map.service.ts:1287-1296) and `PUT /api/maps/:id/owner` (BE/routes/map-shares.ts:244, ADMIN/MANAGER). `grep VIEWER` over BE/src (non-test) confirms no other gate. Neither duplicate nor owner-change is on the builder/viewer pages.
- Toast text on any 403: `getErrorMessage` (FE/lib/api.ts:81-98) shows `response.data.error` = "Forbidden" (the useful `details` field is NOT shown). So the user sees title + "Forbidden".

### Map builder — route `/maps/new` and `/maps/:id` — title key: none (page has no heading; toolbar shows the map name input, default store name `Untitled Map` FE/store/mapBuilder.ts:242) 
Route: FE/App.tsx:100 `<Route path=":id" element={<MapBuilderPage/>}/>`; `id` absent or `"new"` => new map (FE/pages/MapBuilderPage.tsx:56). Sidebar "Maps" (`nav:items.maps` = "Maps") is shown to all roles (FE/components/layout/Sidebar.tsx:46,113).

Visibility: all four roles reach the URL. Load = `GET /api/maps/:id` (BE/routes/maps.ts:276-291, V-gate) then `GET /api/items/:id` per column. If load fails (e.g. 403/404) toast title `mapBuilder:page.loadFailedTitle` = "Could not load map", description "Forbidden"/"Map not found" (FE/pages/MapBuilderPage.tsx:150-157) and an empty builder shows. A role never sees a read-only builder: a user with only VIEW access sees the identical editable builder; saving fails with 403.
Business-area choice for a NEW map: there is NO picker. The business area is fixed by the first column dropped on the canvas (`businessAreaId ?? payload.source.businessAreaId`, FE/store/mapBuilder.ts:343-368); a column from another area is refused (`page.crossBusinessAreaTitle`). Save without one => "No business area selected." (page.saveErrorNoBusinessArea, MapBuilderPage.tsx:191). Store resets to empty when the last column is removed (store:379).
Layout: toolbar (top), left "Business Areas" tree, centre canvas "Columns" + refusal preflight + results panel (opens after Run), right settings panel with 5 tabs. Sizes of three zones remembered in localStorage (`discoverer-neo-builder-left/right/results`, MapBuilderPage.tsx:24-28).

| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| "Back" (`common:actions.back`); tooltip "Go back to the page you came from" (`common:backTooltip`) | Goes to previous in-app page, else `/maps`. | Y | Y | Y | Y | — | FE/components/layout/BackButton.tsx:12-38; MapToolbar.tsx:66. No unsaved-changes prompt (grep beforeunload/useBlocker = none). |
| Map name text box (aria "Map name", `toolbar.mapNameAria`) | Edits the map name in the draft (not saved until Save). | Y | Y | Y | Y | free text | MapToolbar.tsx:67-72; persisted by PUT/POST (E-gate / C-gate) |
| Map type dropdown (aria "Map type", `toolbar.mapTypeAria`) | Sets map type in the draft. | Y | Y | Y | Y | "Table" (`mapTypes.table`, value TABLE), "Crosstab" (crosstab), "Page-Detail" (pageDetail), "Chart" (chart). Only Crosstab changes rendering (pivots when a column has edge "Across the top", ExecutionPanel.tsx:212-214). Table, Page-Detail and Chart all render as the same plain grid (no code branch for PAGE_DETAIL/CHART: grep). Default for new map: Table. | MapToolbar.tsx:26-31,74-85; store:243 |
| "● Unsaved" (`toolbar.unsavedLabel`; tooltip "Unsaved changes") | Shows when the draft differs from the saved map. Not a button. | Y | Y | Y | Y | — | MapToolbar.tsx:87-91 |
| "Run" (`common:actions.run`; tooltip "Save the map and run it. The run also shows on the Executions page.") | If canvas empty toast "Add at least one column before running." (`page.runErrorNoColumns`). If any parameter lacks a default opens the parameter prompt; else saves the map first if new or dirty (create/update), then queues a run through `POST /api/maps/:id/runs` and opens the results panel. Disabled while a run is queued/running (spinner). | Y | Y | UI:Y. New map or edited map => save step needs C-gate / E-gate, else toast "Run failed"/"Forbidden". Unedited saved map => V-gate + D-gate only | same as USER (no role gate) | — | MapToolbar.tsx:94-97; MapBuilderPage.tsx:217-249,286-301; BE/routes/map-runs.ts:127-161 (V-gate, returns 202 QUEUED, or 200 with reused=true) |
| "Save" (`common:actions.save`; tooltip "Save your changes to this map") | Empty canvas => toast "Add at least one column before saving." Creates (POST `/api/business-areas/:baId/maps`, C-gate) when new, else `PUT /api/maps/:id` (E-gate). Success toast "Map saved"; new map redirects to `/maps/<id>`. Failure toast "Save failed" + server message. | Y | UI:Y/API:403 unless C-gate (new) or owner/EDIT share (existing) | UI:Y/API:403 unless C-gate (new) or owner/EDIT share (existing) | same as USER (VIEWER can save if it owns the map or holds EDIT share / CREATE grant) | — | MapToolbar.tsx:99-102; MapBuilderPage.tsx:181-211; BE/routes/maps.ts:298-306 (C-gate), 336-348 (E-gate). No auto-save anywhere (grep autosave = none). |
| "Export" dropdown button (`common:actions.export`; tooltip "Download the map's definition as XML") | Opens menu with a single item. Disabled while an export is in progress. Excel/CSV/PDF are NOT here; they are on the results panel. | Y | Y | Y | Y | one item, see next row | MapToolbar.tsx:104-126 |
| "Map definition (.xml)" (`toolbar.exportXml`) inside Export menu | Downloads the map definition as XML via `GET /api/maps/:id/export`. Disabled until the map is saved. New map: toast "Save the map first" / "Export needs a saved map." | Y | Y | UI:Y/API:403 unless owner/public/EXPORT-or-EDIT share (X-gate) | same as USER | — | MapToolbar.tsx:122-124; MapBuilderPage.tsx:311-333; BE/routes/maps.ts:435-460 (X-gate). Failure toast "Export failed". Note the definition XML has no data rows and no D-gate. |
| "Schedule" (`toolbar.schedule`; tooltip "Run this map on a timetable and keep the results"; disabled tooltip "Save the map first to schedule it") | Navigates to `/schedules?mapId=<id>` (Schedules page; not owned by this fragment). Disabled until saved. | Y | Y | Y (page then needs SCHEDULE action: owner, public? NO — public gives only VIEW+EXPORT; EXPORT/EDIT share; MANAGER Y) | same as USER | — | MapToolbar.tsx:128-135; SCHEDULE rule in map.service.ts:1206-1222 (public excluded, line 1257) |
| "Formatting" (`toolbar.conditionalFormat`; tooltip "Colour cells that meet a rule you set"; disabled tooltip "Save the map before adding conditional formats") | Opens the Conditional formatting dialog. Disabled until saved. | Y | Y (opens; changes need E-gate) | Y (opens) | Y (opens) | — | MapToolbar.tsx:137-144 |
| "Share" (`toolbar.share`; tooltip "Choose who else can open this map and what they may do with it"; disabled tooltip "Save the map before sharing it") | Opens Share map dialog. Disabled until saved. | Y | Y (opens; manage needs canManageShares) | UI:Y (button enabled); API: only owner can manage | same as USER | — | MapToolbar.tsx:146-153 |
| "Collapse panel" / "Expand panel" (`page.collapsePanel` / `page.expandPanel`) — icon button, right edge | Hides/shows the right settings panel. | Y | Y | Y | Y | — | MapBuilderPage.tsx:496-515 |
| Resize bars: "Resize the business areas panel" / "Resize the results panel" / "Resize the settings panel" (`page.resizeTree/resizeResults/resizePanel`) | Drag to change widths (tree 160-600px, results 120-1200px, panel 220-720px); remembered. | Y | Y | Y | Y | — | MapBuilderPage.tsx:427-434,443-450,482-490 |

#### Left panel — Business Areas tree (`tree.title` = "Business Areas")
Data: `GET /api/business-areas` (BE/routes/business-areas.ts:135-190): ADMIN sees all active business areas; every other role (incl. VIEWER) sees only areas where they hold ANY grant. Then `GET /api/business-areas/:baId/folders` (BE/routes/folders.ts:220-223, needs VIEW grant) and `GET /api/folders/:id/items` (BE/routes/items.ts:141-144, requireFolderAccess VIEW). ADMIN bypasses.
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices | Citation |
|---|---|---|---|---|---|---|---|
| "Filter items…" box (aria "Filter items") | Filters items shown under folders. Empty result text "No matching items". | Y | Y | Y | Y | — | BusinessAreaTree.tsx:234-236; `tree.emptyMatchingItems` |
| Loading / empty states: "Loading…", "No business areas.", "No folders", "No items" | Informational. A user without any business-area grant sees "No business areas." and cannot build a map. | Y | Y | Y | Y | — | BusinessAreaTree.tsx:144,176-177,246-249 |
| Business area / folder row (tooltip "Expand or collapse") | Expands/collapses a node. | Y | Y | Y | Y | — | BusinessAreaTree.tsx:465-468 |
| Item row (hover title "Measure" or "Dimension"; check mark when already on canvas) | Draggable source; drop onto the canvas to add. Measure (sigma icon) vs Dimension (tag icon). | Y | Y | Y | Y | — | BusinessAreaTree.tsx:388-425 |
| "+" button per item (aria "Add {{name}} to map") | Adds column. Toast "Added to map" / `"<name>" added to the canvas.` If already there: "Already added" / `"<name>" is already on the canvas.` If from a different area than the map: "Different business area" / "All columns in a map must come from the same business area." | Y | Y | Y | Y | — | BusinessAreaTree.tsx:326-370,429-431 |

#### Centre — Columns canvas (`canvas.title` = "Columns"; count badge)
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices | Citation |
|---|---|---|---|---|---|---|---|
| Drop zone hints: "Drag items here to build your map", "Pick dimensions and measures from the tree on the left.", while dragging over: "Drop to add this column" | Drag an item from the tree here to add it (duplicate/cross-area refusals as toasts above). | Y | Y | Y | Y | — | MapCanvas.tsx:62-73; MapBuilderPage.tsx:366-390 |
| Reorder grip (aria "Reorder column") | Drag a column chip up/down (mouse or keyboard sensor) to change column order. | Y | Y | Y | Y | — | MapCanvas.tsx:104-112; MapBuilderPage.tsx:391-395 |
| Column chip (tooltip "Configure column"); shows aggregate badge (e.g. SUM), sort arrow | Opens the Configure column dialog. | Y | Y | Y | Y | — | MapCanvas.tsx:120-134 |
| X button (tooltip "Remove from canvas"; aria "Remove {{label}}") | Removes the column from the draft. | Y | Y | Y | Y | — | MapCanvas.tsx:136-146 |
| Preflight refusal banner (amber) | While composing, the canvas is sent (debounced 400 ms) to `POST /api/maps/plan`; a refused shape shows the explanation (see Refusals below) before you press Run. Any authenticated user may call it; no data is read. Silent when the plan call fails. | Y | Y | Y | Y | — | FE/components/map-builder/PlanPreflight.tsx:22-77; BE/routes/map-execution.ts:138-178 |

#### Dialog — "Configure column" (`columnConfig.title`; subtitle = column label or "Column settings")
Opens from a chip. All edits apply to the draft on its Save; nothing is sent to the server until the map Save.
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices | Citation |
|---|---|---|---|---|---|---|---|
| "Display name" | Overrides the column heading. Blank = item name. | Y | Y | Y | Y | free text | ColumnConfigDialog.tsx:152-157,118 |
| "Aggregation" | Sets the aggregate for the column. "NONE" stores no aggregate. | Y | Y | Y | Y | NONE, SUM, COUNT, AVG, MIN, MAX (raw codes, not translated) | ColumnConfigDialog.tsx:25,163-175 |
| "Sort direction" | Sorts by this column. | Y | Y | Y | Y | "None" (`common:labels.none`), "Ascending", "Descending" | ColumnConfigDialog.tsx:178-190 |
| "Format mask" (placeholder "e.g. 999,999.00") | Number/date mask. | Y | Y | Y | Y | free text | ColumnConfigDialog.tsx:196-203 |
| "Presets" dropdown (aria "Format presets") | Fills the mask box. | Y | Y | Y | Y | "Number (1,234)" = 999,999,999; "Decimal (1,234.00)" = 999,999,999.00; "Currency ($1,234.00)" = $999,999,999.00; "Percent (12.3%)" = 990.0%; "Date (DD-MON-YYYY)" = DD-MON-YYYY; "Date (YYYY-MM-DD)" = YYYY-MM-DD | ColumnConfigDialog.tsx:27-35,205-217 |
| "Sort order" (placeholder "e.g. 1") | Position of this column in multi-column sorts. | Y | Y | Y | Y | number | ColumnConfigDialog.tsx:225-231 |
| "Column width (px)" (placeholder "e.g. 120") | Column width; must be >0. | Y | Y | Y | Y | number | ColumnConfigDialog.tsx:235-241,121-124 |
| "Placement" | Role of the column in the layout. | Y | Y | Y | Y | "None", "Group by (axis)" (AXIS), "Measure" (MEASURE), "Page item" (PAGE) | ColumnConfigDialog.tsx:249-263 |
| "Crosstab edge" (hint "Only crosstabs use this. Migrated worksheets have no edge recorded.") | Where an axis column goes in a crosstab. Disabled when Placement = Measure (and cleared). | Y | Y | Y | Y | "None", "Down the side" (ROW), "Across the top" (COLUMN) | ColumnConfigDialog.tsx:268-286,131-133 |
| Checkbox "Group and break" (hint "Hide repeated values and start a new subtotal each time this column changes.") | Group-break flag: repeated values blank, subtotal per change. | Y | Y | Y | Y | checked/unchecked | ColumnConfigDialog.tsx:293-302 |
| Checkbox "Query only, do not show" (hint "The query still asks for this column, so a filter, a sort or a total can use it.") | Hides column from output but keeps it in the query. | Y | Y | Y | Y | checked/unchecked | ColumnConfigDialog.tsx:305-315 |
| "Cancel" (`common:actions.cancel`) | Closes without applying. | Y | Y | Y | Y | — | ColumnConfigDialog.tsx:322-324 |
| "Save" (`common:actions.save`) | Applies to the draft column (map still needs its own Save). | Y | Y | Y | Y | — | ColumnConfigDialog.tsx:325-327,110-138 |

#### Right panel tabs (`panels.tabs.*`): "Properties", "Conditions", "Sort", "Parameters", "Calculated Fields" — tab labels get " (n)" counts for Conditions/Sort/Parameters/Calculated Fields (RightPanelTabs.tsx:25-45). All roles.
**Properties tab**
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices | Citation |
|---|---|---|---|---|---|---|---|
| "Description" text area (placeholder "Describe what this map reports on…") | The map's heading/description printed above the results and at the top of every export. Text after `&` is a variable. | Y | Y | Y | Y | free text | DescriptionEditor.tsx:61-106 |
| "Insert variable" button (tooltip "Insert variable or parameter"), menu | Inserts `&Token` at the cursor. Hint: "Variables such as &Date are replaced with real values each time the map runs or is exported." | Y | Y | Y | Y | "Run date" (&Date), "Run time" (&Time), "Workbook name" (&Workbook), "Worksheet name" (&Worksheet); section "Parameters entered at run time" listing each parameter as &Name, or disabled "No parameters defined yet" | DescriptionEditor.tsx:20,64-95; locale panels.properties.variables.* |
| Checkbox "Public (visible to everyone in the business area)" | Sets the map public on next Save. Effect in code: ANY authenticated user (not just the business area) may VIEW and EXPORT the map object; data still needs D-gate. | Y | Y | Y | Y | checked/unchecked | RightPanelTabs.tsx:51-60; BE/services/map.service.ts:1257,918; saved via PUT (E-gate) |
| Summary counts: "Columns", "Conditions", "Parameters", "Calculated fields" | Read-only counts. | Y | Y | Y | Y | — | RightPanelTabs.tsx:61-78 |

**Conditions tab** (`panels.conditions`, title "Conditions")
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices | Citation |
|---|---|---|---|---|---|---|---|
| "Add Condition" (tooltip "Add a new condition") | Adds a row (default operator "="). Disabled while canvas empty; hint "Add columns to the canvas before adding conditions." | Y | Y | Y | Y | — | ConditionsPanel.tsx:96-104; store:414 |
| "No conditions yet." | Empty state | Y | Y | Y | Y | — | ConditionsPanel.tsx:116 |
| Row checkbox (aria "Select condition on {{label}}") | Selects conditions for grouping. | Y | Y | Y | Y | — | ConditionsPanel.tsx:218-221 |
| "Group {{count}} selected conditions" (tooltip "Group selected conditions into an OR block") | Appears when 2+ selected; groups them. Group header "Group ({{count}})". | Y | Y | Y | Y | — | ConditionsPanel.tsx:107-111,137 |
| "Ungroup" (tooltip "Remove OR grouping from this block") | Removes the group. | Y | Y | Y | Y | — | ConditionsPanel.tsx:144-147 |
| Logic operator dropdown (aria "Logic operator"), shown on every row except the first | Joins this row to the previous one. | Y | Y | Y | Y | AND, OR | ConditionsPanel.tsx:198-213 |
| Item dropdown (aria "Condition item", placeholder "Item") | Column to test; lists canvas columns. | Y | Y | Y | Y | canvas columns | ConditionsPanel.tsx:227-240 |
| Operator dropdown (aria "Operator") | Comparison. | Y | Y | Y | Y | =, <>, <, >, <=, >=, LIKE, IN, BETWEEN, "IS NULL" (raw symbols; value box hidden for IS NULL) | ConditionsPanel.tsx:23-34,249-258 |
| "Static value" toggle (tooltip "Use a fixed value for this condition") | Fixed value. | Y | Y | Y | Y | — | ConditionsPanel.tsx:264-275 |
| "Prompt at runtime" toggle (tooltip "Ask for this value when running the map") | Value asked at run time via a parameter name. | Y | Y | Y | Y | — | ConditionsPanel.tsx:276-291 |
| Value box (aria "Condition value") | Static value. Placeholders: "value1, value2, …" (IN), "low, high" (BETWEEN), "Value" (others). | Y | Y | Y | Y | free text | ConditionsPanel.tsx:36-40,296-304 |
| Parameter name box (aria "Parameter name", placeholder "Parameter name", suggests defined parameters) | Names the parameter for a runtime prompt. Backend rejects a condition that names an undefined parameter. | Y | Y | Y | Y | — | ConditionsPanel.tsx:306-321; BE/services/map.service.ts:294 |
| Trash (aria "Delete condition") | Removes the condition. | Y | Y | Y | Y | — | ConditionsPanel.tsx:328-329 |

**Sort tab** (`panels.sort`, title "Sort order")
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices | Citation |
|---|---|---|---|---|---|---|---|
| Empty texts "Add columns to configure sorting." / "No columns are sorted yet." | Info | Y | Y | Y | Y | — | SortPanel.tsx:98,108 |
| "Add sort" column dropdown (aria "Pick column to sort", placeholder "Choose a column") | Chooses a column. | Y | Y | Y | Y | canvas columns | SortPanel.tsx:130-145 |
| "Add Sort" (tooltip "Add another sort level") | Adds a sort level (disabled until a column is chosen). | Y | Y | Y | Y | — | SortPanel.tsx:147-148 |
| Reorder grip (aria "Reorder {{label}}") | Drag to change sort priority. | Y | Y | Y | Y | — | SortPanel.tsx:186 |
| Direction dropdown (aria "Sort direction for {{label}}") | Ascending/Descending. | Y | Y | Y | Y | "Ascending", "Descending" | SortPanel.tsx:202-208 |
| X (tooltip "Remove this sort level"; aria "Remove sort on {{label}}") | Removes the sort. | Y | Y | Y | Y | — | SortPanel.tsx:216-218 |

**Parameters tab** (`panels.parameters`, title "Parameters")
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices | Citation |
|---|---|---|---|---|---|---|---|
| "Add Parameter" (tooltip "Add a new parameter") | Adds a parameter (auto name Parameter1.., type STRING, not required). | Y | Y | Y | Y | — | ParametersPanel.tsx:36-37; store:470-473 |
| "No parameters. Add one to prompt users at run time." | Empty state | Y | Y | Y | Y | — | ParametersPanel.tsx:42 |
| Name box (aria "Parameter name", placeholder "Parameter name") | Parameter name (must be unique; also used as `&Name` in the description). | Y | Y | Y | Y | free text | ParametersPanel.tsx:95-96; BE map.service.ts:285 |
| Type dropdown (aria "Parameter type") | Data type of the prompt input. | Y | Y | Y | Y | STRING, NUMBER, DATE, LIST (raw codes; NUMBER/DATE use number/date inputs) | ParametersPanel.tsx:17-24,99-110 |
| Default value box (aria "Default value"; placeholder "Default value" or "comma, separated, values" for LIST) | Default. If every parameter has a default, Run skips the prompt and uses the defaults. | Y | Y | Y | Y | — | ParametersPanel.tsx:151-161; MapBuilderPage.tsx:292-300 |
| Checkbox "Required" (`common:labels.required`) | Prompt refuses blank value. | Y | Y | Y | Y | — | ParametersPanel.tsx:128-136 |
| Trash (tooltip "Remove this parameter"; aria "Delete parameter {{name}}") | Removes it. | Y | Y | Y | Y | — | ParametersPanel.tsx:118-120 |
| "Run-time prompt preview" | Read-only preview of the prompt with disabled inputs (placeholder "Enter a value"). | Y | Y | Y | Y | — | ParametersPanel.tsx:59-75,171-177 |

**Calculated Fields tab** (`panels.calculatedFields`, title "Calculated fields")
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices | Citation |
|---|---|---|---|---|---|---|---|
| "Add Calculated Field" (tooltip "Add a new calculated field") | Adds field named Calc1.. with empty formula. | Y | Y | Y | Y | — | CalculatedFieldsPanel.tsx:56-57; store:496-497 |
| "No calculated fields. Add one to derive a new column from a formula." | Empty state | Y | Y | Y | Y | — | CalculatedFieldsPanel.tsx:63 |
| Reorder grip (aria "Reorder {{name}}") | Drag to reorder. | Y | Y | Y | Y | — | CalculatedFieldsPanel.tsx:119 |
| Name box (aria "Calculated field name", placeholder "Field name") | Field name (used as `[Name]` in other formulas). | Y | Y | Y | Y | — | CalculatedFieldsPanel.tsx:131-132 |
| Display order (aria/title "Display order") | Numeric position. | Y | Y | Y | Y | number | CalculatedFieldsPanel.tsx:142-143 |
| Trash (tooltip "Remove this calculated field"; aria "Delete {{name}}") | Removes it. | Y | Y | Y | Y | — | CalculatedFieldsPanel.tsx:150-152 |
| Formula button (text "Click to write a formula…" or the formula; tooltip "Edit field formula") | Opens the Formula editor. | Y | Y | Y | Y | — | CalculatedFieldsPanel.tsx:161-169 |

#### Dialog — "Formula editor" (`panels.formula.title`; subtitle field name or "Calculated field")
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices | Citation |
|---|---|---|---|---|---|---|---|
| Formula editor (Monaco code box) | Type the formula. Live heuristic check shows red messages. | Y | Y | Y | Y | error texts: "Formula is empty.", "Unbalanced quotes.", "Unbalanced parentheses.", "Unbalanced [ ] column references.", `Unknown function "<name>".`, `Unknown column reference "[<name>]".` | FormulaEditorDialog.tsx:70-130,188-190 |
| Function chips (click inserts `NAME()`; CASE inserts `CASE WHEN  THEN  ELSE  END`) grouped by heading | Insert helper. | Y | Y | Y | Y | Arithmetic: ROUND, TRUNC, FLOOR, CEIL, ABS, MOD, POWER, SQRT, SIGN, GREATEST, LEAST. String: UPPER, LOWER, INITCAP, LENGTH, SUBSTR, TRIM, LTRIM, RTRIM, INSTR, REPLACE, CONCAT, LPAD, RPAD. Date: TO_CHAR, TO_DATE, ADD_MONTHS, MONTHS_BETWEEN, LAST_DAY. "Conditional / null handling": NVL, NVL2, COALESCE, DECODE, TO_NUMBER, CASE | FormulaEditorDialog.tsx:24-51,340-358 |
| "Columns" chips (heading `panels.formula.columnsHeader`); "No columns yet." | Inserts `[Column label]`. | Y | Y | Y | Y | canvas column labels | FormulaEditorDialog.tsx:319-335 |
| "Test formula" (tooltip "Run the formula against the first 5 rows to verify it works"); hint when unsaved "Save the map to test formulas against live data."; result header "<name> (first N row(s))"; "No rows." | Calls the SYNCHRONOUS `POST /api/maps/:id/execute` with this formula (VIEW gate + D-gate; live Oracle query, up to 5 rows shown). Disabled until map saved. Error text shows server message. | Y | Y | Y (needs V-gate, D-gate) | Y (same) | — | FormulaEditorDialog.tsx:216-236,275-305; BE/routes/map-execution.ts:181-229 |
| "Cancel" / "Save" | Save writes formula into the draft. | Y | Y | Y | Y | — | FormulaEditorDialog.tsx:364-369 |

#### Dialog — "Conditional formatting" (`conditionalFormat.title`; description "Paint a cell or a whole row when a column's value meets a test — Discoverer's Exceptions.")
Data: `GET /api/maps/:id/conditional-formats` (V-gate) + `GET /api/maps/:id` for column list (hidden columns excluded). Rules apply live to the results grid, immediately (they are stored server-side, NOT part of the map's Save).
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices | Citation |
|---|---|---|---|---|---|---|---|
| Rule list rows (colour dot, "<column> <operator> <value>", target "Cell"/"Row"); empty "No conditional formats yet." | Lists rules. | Y | Y | Y | Y | — | ConditionalFormatDialog.tsx:157-186 |
| X (aria "Delete this rule") | `DELETE /api/maps/:id/conditional-formats/:formatId`. Toast "Rule deleted" / "Could not delete rule". | Y | UI:Y/API:403 (needs owner/EDIT share) | UI:Y/API:403 unless owner/EDIT share | same as USER | — | ConditionalFormatDialog.tsx:122-124,179-180; BE/routes/conditional-formats.ts:146-160 (E-gate line 153) |
| "Add rule" (tooltip "Add a new formatting rule") | Opens the rule form. Disabled if map has no visible column. | Y | Y | Y | Y | — | ConditionalFormatDialog.tsx:193-199 |
| "Column" | Column to test. | Y | Y | Y | Y | visible map columns | ConditionalFormatDialog.tsx:206-215 |
| "Apply to" | Colour one cell or the whole row. | Y | Y | Y | Y | "Cell", "Row" | ConditionalFormatDialog.tsx:222-230 |
| "Operator" | Test. | Y | Y | Y | Y | "Equals", "Not equals", "Greater than", "Less than", "Greater than or equal to", "Less than or equal to", "Like (% and _ wildcards)", "In list", "Between", "Is empty" | locale conditionalFormat.operators; ConditionalFormatDialog.tsx:240-250; BE enum conditional-formats.ts:12 |
| "Value" (placeholders "low,high" for Between, "value1,value2,…" for In list) | Comparison value; hidden for "Is empty". | Y | Y | Y | Y | free text | ConditionalFormatDialog.tsx:255-268 |
| "Background color" colour picker + "Clear" (tooltip "Remove background color") | Sets/clears fill. | Y | Y | Y | Y | colour | ConditionalFormatDialog.tsx:279-290 |
| "Text color" colour picker + "Clear" (tooltip "Remove text color") | Sets/clears text colour. | Y | Y | Y | Y | colour | ConditionalFormatDialog.tsx:299-306 |
| Checkboxes "Bold", "Italic", "Underline" | Text style. | Y | Y | Y | Y | — | ConditionalFormatDialog.tsx:314-340 |
| "Cancel" | Discards the form. | Y | Y | Y | Y | — | ConditionalFormatDialog.tsx:346-348 |
| "Save" | `POST /api/maps/:id/conditional-formats`; toast "Rule added" / "Could not add rule". Disabled without a column. | Y | UI:Y/API:403 (owner/EDIT only) | UI:Y/API:403 unless owner/EDIT share | same as USER | — | ConditionalFormatDialog.tsx:94-120,350-359; BE conditional-formats.ts:94-117 (E-gate line 101) |

#### Dialog — "Share map" (`share.title`; description "Give other users access to view, export, or edit this map.")
Backend: list `GET /api/maps/:id/shares`, add `POST`, change `PUT /api/maps/:id/shares/:userId`, remove `DELETE` — all use `loadMapWithAccess(VIEW)` then `canManageShares` (owner, ADMIN, or MANAGER who can VIEW; an EDIT-share holder is NOT allowed) (BE/routes/map-shares.ts:63-72,97-107,151-160,206-215; map.service.ts:1287-1296). Body levels only VIEW, EDIT, EXPORT (map-shares.ts:17). User list = `GET /api/users/search?q=` open to any authenticated user (BE/routes/users.ts:86-92).
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices | Citation |
|---|---|---|---|---|---|---|---|
| Search box (placeholder "Search by name or email…", aria "Search users to share with"); "No matching users" | Filters the user list. Users already holding a share float to the top. | Y | Y | Y | Y | — | FE/components/maps/ShareUserList.tsx:35-62 |
| Hint "Click a level next to a person to share with them. The dark button is what they have now. ✕ removes their access." | Info | Y | Y | Y | Y | — | ShareUserList.tsx:56 |
| Level buttons per person (group aria "Permission for {{name}}"); tooltip = help text | Click a level to grant or change it (POST if none, PUT if held). Toast "Map shared" / "Permission updated" / "Could not share map". | Y | Y (any map it can see) | UI:Y/API:403 unless owner | same as USER | "Can view" (VIEW: "Can open and run the map. Cannot export, schedule or change it."), "Can export" (EXPORT: "Can open and run the map, export its result, and put it on a schedule."), "Can edit" (EDIT: "Can do all of the above, and also change the map.") | ShareDialog.tsx:37-63; ShareUserList.tsx:77-96; locale share.permissions, share.permissionHelp |
| ✕ per person (aria "Revoke access for {{name}}") | Removes that person's share. Disabled if none held. Toast "Access revoked" / "Could not revoke access". | Y | Y | UI:Y/API:403 unless owner | same as USER | — | ShareDialog.tsx:66-77; ShareUserList.tsx:100-103 |
| Public banner "This map is public — anyone with the link can view it." + "Copy link" (tooltip "Copy this map's address, to send to someone") | Shown only when the saved map is public. Copies the URL; toast "Link copied to clipboard" / "Could not copy link". | Y | Y | Y | Y | — | ShareDialog.tsx:110-121 |

#### Results panel (opens after Run; ExecutionPanel; header `mapViewer:execution.results` = "Results") — same component as the viewer page, see viewer table. Builder-specific differences: no Cancel button, no status line, close button present (aria "Close results").

#### Dialog — "Run parameters" (`mapViewer:parameters.title`; description "Enter values for this map's parameters, then run.") — shared with viewer
Opens when ANY parameter has no default (`needsParameterPrompt`, ParameterPromptDialog.tsx:70-74).
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices | Citation |
|---|---|---|---|---|---|---|---|
| One input per parameter (label = name, red * if required); type = text/number/date; LIST placeholder "comma, separated, values" | Value entry. If the parameter feeds a condition on an item, a value picker suggests the item's live values (`GET /api/items/:id/values`, item VIEW grant + D-gate + row-level rules; over ~limit shows "Too many values to list — type to search."; truncated shows "Showing the first N values — type to narrow the list."). | Y | Y | Y (picker needs BA grant, else list fails to load, typing still allowed) | same | — | ParameterPromptDialog.tsx:133-163; FE/components/parameters/ItemValuePicker.tsx:63-79; BE/routes/items.ts:552-559; lov.service.ts:463 |
| Error "This parameter is required." | Shown under a blank required field; blocks Run. | Y | Y | Y | Y | — | ParameterPromptDialog.tsx:103-114 |
| "Cancel" / "Run" | Cancel closes; Run submits and starts the run. | Y | Y | Y | Y | — | ParameterPromptDialog.tsx:166-173 |

#### Dialog — "Export to PDF" (`mapViewer:export.pdfDialog.title`; description "Choose the paper and the columns. The map description is printed at the top of the first page.")
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices | Citation |
|---|---|---|---|---|---|---|---|
| "Paper size" | Page size. Default A4. | Y | Y | Y | Y | "A4", "A3", "Letter" (values A4/A3/LETTER) | PdfExportDialog.tsx:23,40,71-80; BE routes/export.ts:30 |
| "Orientation" | Default Portrait. | Y | Y | Y | Y | "Portrait", "Landscape" | PdfExportDialog.tsx:41,86-96 |
| "Columns ({{count}} selected)" checkbox list | Choose columns to print; all selected by default each time it opens. | Y | Y | Y | Y | result columns | PdfExportDialog.tsx:43-48,104-130 |
| "Select all" / "Clear" toggle (tooltip "Toggle all columns") | Selects or clears all. | Y | Y | Y | Y | — | PdfExportDialog.tsx:106-117 |
| "Cancel" / "Export" | Export disabled when 0 columns selected; sends `POST /api/maps/:id/export` `{format:'PDF', runId, pdf:{pageSize,orientation,columns}}`. | Y | Y | UI:Y/API:403 unless X-gate | same as USER | — | PdfExportDialog.tsx:138-153; BE/routes/export.ts:167-210 |

#### Results grid interactions (ResultsTable / CrosstabTable / DrillDialog / banners) — shared with viewer, listed once in the viewer section below.


### Map viewer — route `/maps/:id/view` — title: none (heading `<h2>` = the map's name; `mapViewer:viewer.*` strings)
Route FE/App.tsx:101. Visibility: all roles reach the URL. Backend `GET /api/maps/:id` V-gate (BE/routes/maps.ts:276-291). If refused or missing the page shows card title `viewer.notFound` = "Map not found" with body "Forbidden"/"Map not found" (`getErrorMessage`, fallback `viewer.notFoundDescription` = "This map could not be loaded.") (MapViewerPage.tsx:133-145). While loading: "Loading map…" (`viewer.loading`). Opening with `?run=<runId>` loads that stored run (`GET /api/runs/:id`, own runs only, or ADMIN) (MapViewerPage.tsx:55-58; BE routes/map-runs.ts:98-118).

| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices | Citation |
|---|---|---|---|---|---|---|---|
| "Back" | As builder. | Y | Y | Y | Y | — | MapViewerPage.tsx:175 |
| Map name heading + description text (after a run the text has `&Date`, `&Time`, `&Workbook`, `&Worksheet` and `&<ParamName>` replaced; before a run the stored text) | Display only. Heading resolved by server `resolveHeading` on the synchronous execute path; run results carry `heading` in decoration. | Y | Y | Y | Y | — | MapViewerPage.tsx:176-184; BE map-execution.ts:215-217 |
| Collapsible "N filter(s) from Discoverer could not be migrated — this result may include more rows than the original" (`droppedFilters.summary`) listing each filter text and reason | Warning shown only for migrated maps that dropped filters. | Y | Y | Y | Y | — | MapViewerPage.tsx:187-201 |
| "Run" (`common:actions.run`; tooltip "Execute the map and display results" `viewer.runTitle`); while busy shows "Running…" (`common:actions.running`) | Same logic as builder Run but never saves. If no parameter prompt needed, uses defaults; else opens Run parameters dialog. Queues `POST /api/maps/:id/runs`. Disabled when running or when map has no columns. | Y | Y | Y (V-gate + D-gate) | Y (no role gate) | — | MapViewerPage.tsx:81-92,205-213; BE map-runs.ts:127-161 |
| Disabled reason under Run: "This worksheet has no output columns, so there is nothing to run. Open it in the builder and add at least one column." (`viewer.cannotRunNoColumns`) | Shown when the map has 0 columns. | Y | Y | Y | Y | — | MapViewerPage.tsx:162-163,214-218 |
| Status line under Run | Info: "Queued (position unknown)" (`viewer.statusQueued`), "Running…" (`viewer.statusRunning`), "Result from {{time}}, valid until {{until}}." (`viewer.statusResult`), "Showing a cached result from {{time}}, valid until {{until}}." (`viewer.statusResultReused`). Valid-until = 24 h after completion. | Y | Y | Y | Y | — | MapViewerPage.tsx:112-123; config.ts:256 |
| "Run again" (tooltip "Run the map again with the same parameters") | Only shown when the current run COMPLETED; requests a fresh run with the same parameters and `force:true` (skips cache). Disabled while running. | Y | Y | Y | Y | — | MapViewerPage.tsx:99-101,220-224 |
| "Cancel" (`common:actions.cancel`) | Shown ONLY while the run is QUEUED (not while RUNNING); `DELETE /api/runs/:id`. Server can also interrupt a RUNNING run (returns 202 "cancelling") but the viewer offers no button for it. Result shows red "Cancelled" kind. | Y | Y | Y | Y | — | MapViewerPage.tsx:225-229; useMapRun.ts:148-165; BE map-runs.ts:291-333; map-run.service.ts:110-135 |
| "Schedule management" link (tooltip "View and manage map schedules") | Opens `/schedules`. | Y | Y | Y | Y | — | MapViewerPage.tsx:231-235 |
| Run parameters dialog | Same as builder (see above). | Y | Y | Y | Y | — | MapViewerPage.tsx:257-262 |
| Toast on run request failure: "Run failed" + message; refused => "Worksheet not run" | Reports HTTP errors and failed runs. Success toast text `viewer.executedTitle` = "Map executed", `viewer.rowsReturned` = "{{count}} row(s) returned." exist in locale but the page does not call them (UNVERIFIED usage; only builder toasts "Map executed"). | Y | Y | Y | Y | — | MapViewerPage.tsx:60-70 |

#### Results panel (ExecutionPanel; used by builder and viewer, header "Results")
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices | Citation |
|---|---|---|---|---|---|---|---|
| Badge "{{count}} row(s)" and badge "{{ms}} ms" | Row count and elapsed time. | Y | Y | Y | Y | — | ExecutionPanel.tsx:222-229 |
| Badge "More rows available" (warning) | Result was truncated. | Y | Y | Y | Y | — | ExecutionPanel.tsx:230-234 |
| "SQL" button (tooltip "Show or hide the SQL statement") | Toggles the generated SQL text. Only rendered when the response contains `sql`, which the server sends to ADMIN only. | Y | N (not rendered) | N | N | — | ExecutionPanel.tsx:237-248; BE map-execution.ts:216-222, map-runs.ts:86 |
| "Plan" (`execution.explain`; tooltip "Show the database execution plan for this query") | `POST /api/maps/:id/explain` (authorizeAdmin) shows Oracle's plan. Error toast "Could not read the execution plan"; "Run the map first" if no map. Only rendered with `sql`. | Y | N | N | N (API would 403 for non-ADMIN) | — | ExecutionPanel.tsx:122-136,249-261; BE map-execution.ts:282-315 |
| "Excel" (tooltip "Export results as Excel spreadsheet") | `POST /api/maps/:id/export` `{format:'XLSX', runId, locale}` then polls `GET /api/exports/:jobId` and downloads via `GET /api/exports/:jobId/download` (X-gate on both). Only shown for a COMPLETED, unexpired run. Toasts: "Export queued" / "This may take a moment for large result sets." (slow), "Export failed", "Download failed", fallback "The export job failed.". | Y | Y | UI:Y/API:403 unless X-gate | same as USER | — | ExecutionPanel.tsx:266-282; hooks/useMapExport.ts:46-142; BE routes/export.ts:167-282 |
| "CSV" (tooltip "Export results as CSV file") | Same with format CSV. | Y | Y | UI:Y/API:403 unless X-gate | same | — | ExecutionPanel.tsx:283-297 |
| "PDF" (tooltip "Export results as PDF document") | Opens the Export to PDF dialog (see builder), then export format PDF. | Y | Y | UI:Y/API:403 unless X-gate | same | — | ExecutionPanel.tsx:298-318 |
| Close X (aria "Close results") | Builder only (viewer passes no `onClose`). | Y | Y | Y | Y | — | ExecutionPanel.tsx:321-331; MapViewerPage.tsx:241-253 (no onClose) |
| SQL box / plan box | Monospace text, ADMIN only. | Y | N | N | N | — | ExecutionPanel.tsx:335-345 |
| Empty states: "Run the map to see results." (`execution.runToSeeResults`), "Query returned no rows." (`execution.noRows`) | Info. | Y | Y | Y | Y | — | ExecutionPanel.tsx:401,410 |
| Column header click | Sorts asc/desc/none on that column. | Y | Y | Y | Y | — | ResultsTable.tsx:449-478 |
| "Filter…" box under each header (aria "Filter {{column}}") | Filters loaded rows client-side. | Y | Y | Y | Y | — | ResultsTable.tsx:483-484 |
| "Group" badge on group-break columns (tooltip "Rows are grouped by this column. Repeated values are left blank and a subtotal closes each group.") ; subtotal rows "Total for {{value}}"; footer "Grand total" | Display of group breaks/totals. Message "Sorting or filtering pauses group breaks and totals." appears when user sorts/filters. | Y | Y | Y | Y | — | ResultsTable.tsx:334,358,471-473,523 |
| Footer "{{formattedCount}} row(s)" and "(filtered from {{total}})" | Row count. NULL cells show "NULL". | Y | Y | Y | Y | — | ResultsTable.tsx:94,513-518 |
| Row double-click (tooltip "Double-click to drill to detail") | Opens Drill to Detail dialog. | Y | Y | Y (V-gate + D-gate on the drill call) | Y | — | ResultsTable.tsx:373-374,409-410; ExecutionPanel.tsx:415 |
| Dialog "Drill to Detail" (description "The raw rows behind this row's values."; loading "Drilling…") | `POST /api/maps/:id/drill-to-detail` runs a live, synchronous, un-aggregated query with the row's values pinned (not a queued run; not cached). Error shows in red. Hierarchy drill up/down is refused (BE `DrillNotAvailableError` -> 400 kind CONFIG). | Y | Y | Y | Y | — | DrillDialog.tsx:29-82; BE routes/map-execution.ts:236-275 (V-gate line 247) |
| Conditional colours in grid | Paints cells/rows by the saved rules (server sends `conditionalFormats` with the result). | Y | Y | Y | Y | — | ExecutionPanel.tsx:414 |
| Crosstab layout | Shown only when map type = Crosstab AND a column has edge "Across the top"; else grid + note `crosstab.noColumnEdge`. | Y | Y | Y | Y | — | ExecutionPanel.tsx:212-214,367-374 |
| "Not all rows are loaded." + "Load more" (tooltip "Load more rows from the result") | Fetches the next 500 stored rows via `GET /api/runs/:id/rows?offset&limit=500` (server max 1000/page). Result shows rows only from the stored run, never a live re-run. Expired run => 410 "Run has expired". | Y | Y | Y | Y | — | ExecutionPanel.tsx:429-445; useMapRun.ts:7,86; BE map-runs.ts:257-287 |

**Page size**: there is no page-size selector anywhere in builder or viewer. Rows are fetched 500 at a time ("Load more"); the grid is virtualised (ResultsTable.tsx header comment L146). Only the PDF export has a "Paper size" choice.


### Backend endpoint reference (cited)

| Endpoint | Gate | ADMIN | MANAGER | USER | VIEWER | Citation |
|---|---|---|---|---|---|---|
| `GET /api/maps/:id` | authenticate + V-gate | Y | Y | own/public/share | same | BE/routes/maps.ts:276-291 |
| `POST /api/business-areas/:baId/maps` (create) | authenticate + C-gate | Y | needs CREATE grant | needs CREATE grant | needs CREATE grant (no role block) | maps.ts:296-330 |
| `PUT /api/maps/:id` | E-gate | Y | owner/EDIT share | owner/EDIT share | owner/EDIT share | maps.ts:336-366 (check at 348) |
| `DELETE /api/maps/:id` (soft) | DELETE-gate | Y | owner only | owner only | owner only | maps.ts:372-390 (384) |
| `POST /api/maps/:id/duplicate` | V-gate + canDuplicate | Y | Y (any it can see) | own/public/share | 403 always | maps.ts:396-433 (412); map.service.ts:1305 |
| `GET /api/maps/:id/export` (XML definition) | X-gate | Y | Y | owner/public/EXPORT|EDIT share | same | maps.ts:435-460 (447) |
| `POST /api/maps/plan` | authenticate only (no data read) | Y | Y | Y | Y | map-execution.ts:138-178 |
| `POST /api/maps/:id/execute` (sync, first page; used by Formula "Test formula" and legacy load-more) | V-gate + D-gate; strips `sql` for non-ADMIN | Y | Y | V-gate | same | map-execution.ts:181-229; map-execution.service.ts:501-509 |
| `POST /api/maps/:id/drill-to-detail` | V-gate + D-gate | Y | Y | V-gate | same | map-execution.ts:236-275 |
| `POST /api/maps/:id/explain` | `authenticate` + `authorizeAdmin` (line 285), then V-gate | Y | 403 | 403 | 403 | map-execution.ts:282-315; plugins/auth.ts:136-150 |
| `GET /api/maps/:id/history` | V-gate | Y | Y | V-gate | same | map-execution.ts:318-346 |
| `POST /api/maps/:id/runs` | V-gate (D-gate applied when run executes) | Y | Y | V-gate | same | map-runs.ts:127-161 |
| `GET /api/runs`, `GET /api/runs/:id`, `GET /api/runs/:id/rows`, `DELETE /api/runs/:id` | own runs (or ADMIN) + V-gate on the map; `?all=true` ADMIN only | Y | own runs | own runs | own runs | map-runs.ts:165-335 |
| `POST /api/maps/:id/export` | X-gate + run must be requester's (or ADMIN's), same map, COMPLETED, unexpired else 409 RUN_NOT_EXPORTABLE; body formats XLSX, CSV, PDF | Y | Y | X-gate | same | export.ts:167-211 |
| `GET /api/exports`, `/api/exports/:jobId` (V-gate), `/api/exports/:jobId/download` (X-gate) | own jobs only (404 otherwise) | Y | Y | own | own | export.ts:214-282 |
| `GET/POST/PUT/DELETE /api/maps/:id/conditional-formats[/:formatId]` | GET V-gate; POST/PUT/DELETE E-gate | Y | GET Y; write owner/EDIT | GET V-gate; write owner/EDIT | same | conditional-formats.ts:80-160 |
| `GET/POST/PUT/DELETE /api/maps/:id/shares[/:userId]` | V-gate + canManageShares | Y | Y | owner only | owner only | map-shares.ts:49-224 |
| `GET /api/business-areas`, `.../folders`, `GET /api/folders/:id/items` (tree data) | ADMIN all; others by business-area grant (VIEW) | all | granted | granted | granted | business-areas.ts:135-190; folders.ts:220-223; items.ts:141-144 |
| `GET /api/items/:id/values` (parameter pick-list) | requireItemAccess VIEW + D-gate + RLS | Y | granted | granted | granted | items.ts:552-559; lov.service.ts:463 |

Row count in this fragment: builder ≈ 125 action rows (toolbar 13, tree 5, canvas 5, column dialog 13, properties 4, conditions 12, sort 6, parameters 8, calculated 7, formula 5, conditional format 13, share 5, param prompt 3, PDF 5), viewer ≈ 35 rows.



Paths relative to `discoverer-neo`. FE = `frontend/src`, BE = `backend/src`, EN = `frontend/src/locales/en/admin.json` (a:) / `common.json` (c:).
Legend: Y = allowed; N = refused; G(x) = allowed only with a grant of level x or higher on the owning business area (ADMIN bypasses grants; MANAGER/USER/VIEWER do not: `BE/middleware/business-area-auth.ts:53,173`). Levels VIEW<EXPORT<SCHEDULE<CREATE<EDIT<DELETE (`BE/services/business-area.service.ts:45-52`).

### Global facts for all seven pages
- Routes have no role guard: `FE/App.tsx:86-92` (business-areas, folders, items, joins, hierarchies, custom-functions, data-sources). USER/VIEWER can type the URL and the page renders; the API decides.
- Sidebar section "Data Modeling" (`nav:sections.dataModeling`) only for ADMIN or MANAGER: `FE/components/layout/Sidebar.tsx:102` (`canModel`), rendered at `:111-119`. Link labels (nav.json): "Business Areas", "Folders", "Items", "Joins", "Hierarchies", "Custom Functions", "Data Sources" (`FE/locales/en/nav.json:12-18`).
- None of the seven pages hides or disables any button by role (grep for `role`/`isAdmin` in the 7 page files: no hits). Every button below is drawn for every role that reaches the page.
- Business-area dropdown on Folders/Items/Joins/Hierarchies is fed by `GET /api/business-areas`: ADMIN gets all active areas; everyone else gets only areas where they hold any grant (`BE/routes/business-areas.ts:134-190`, non-admin branch `:167-189`). A MANAGER with no grant sees an empty dropdown (so cannot do anything on those four pages).
- A business-area grant is a data entitlement, it does not show maps (see brief / CHANGELOG [2.0.0]).
- Toasts use `admin:shared.saveFailed` = "Save failed" and `admin:shared.deleteFailed` = "Delete failed" with the server message as description. Delete toasts on success: "<Entity> deactivated" (all deletes are soft: `is_active=false`).

### Common admin table behaviour (`FE/components/admin/DataTable.tsx`, `DeleteConfirmDialog.tsx`, `CreateEditDialog.tsx`, `AdminPageWrapper.tsx`)
| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| (page header) title + description | AdminPageWrapper shows the page title, description and the header action buttons on the right | Y | Y | Y (by URL) | Y (by URL) | – | `FE/components/admin/AdminPageWrapper.tsx:12-22` |
| Search box in table | DOES NOT EXIST in DataTable (no filter/sort row models are registered; only core + pagination) | – | – | – | – | – | `DataTable.tsx:35-41` |
| Column sorting | DOES NOT EXIST (no `getSortedRowModel`, headers are plain text) | – | – | – | – | – | `DataTable.tsx:54-64` |
| Rows per page | DOES NOT EXIST as a control. Page size = as many rows as fit the window (min 5, fallback 10) and re-fits on window resize. `common:pagination.rowsPerPage` ("Rows per page") exists in the locale but is not used | – | – | – | – | – | `DataTable.tsx:33-34`, `FE/hooks/useFitPageSize.ts:4-5,19-40` |
| "Loading..." | Shown in a single row while the list request runs (`admin:shared.loading`) | Y | Y | Y | Y | – | `DataTable.tsx:67-72` |
| Empty message | Row text when list is empty; default "No results." (`admin:shared.defaultEmptyMessage`), each page passes its own (quoted per page below). A refused list request (403) also lands here because the table just gets no data | Y | Y | Y | Y | – | `DataTable.tsx:83-88` |
| "Page {{page}} of {{total}}" | Page counter, only rendered when there is more than 1 page (`common:pagination.pageOf`) | Y | Y | Y | Y | – | `DataTable.tsx:103-118` |
| "Previous" / "Next" | Move one page back/forward; Previous disabled on page 1, Next disabled on last page | Y | Y | Y | Y | – | `DataTable.tsx:120-130` (c:actions.previous/next) |
| Row action icons (tooltip = `title`) | Icon-only buttons at the right of each row; the tooltip is the only text (see per-page tables) | see page | see page | see page | see page | – | per page |
| Delete confirm dialog title "Delete {{itemLabel}}?" | Confirmation dialog for every delete (`admin:shared.deleteConfirmTitle`); itemLabel per page (e.g. "business area", "folder") | see page | see page | – | – | – | `DeleteConfirmDialog.tsx:22-31` |
| Delete confirm text | "This will deactivate <name>. This action can only be reversed by an administrator." (`deleteConfirmDescriptionPrefix` + `Suffix`) | see page | see page | – | – | – | `DeleteConfirmDialog.tsx:23-30`; en admin.json:15-16 |
| "Cancel" / "Delete" / "Deleting..." | Cancel closes; Delete (red) sends the delete, label changes to "Deleting..." while pending (`admin:shared.deleting`) | see page | see page | – | – | – | `DeleteConfirmDialog.tsx:34-39` |
| Create/Edit dialog shell | Modal with title (+ optional description) holding the page form; closes on Esc/overlay/Cancel. Wide variant `sm:max-w-2xl` for Hierarchies and Custom Functions | see page | see page | – | – | – | `CreateEditDialog.tsx:32-45` |
| "Save" / "Saving..." | Form submit button in every create/edit dialog (`common:actions.save`, `admin:shared.saving`); disabled while saving | see page | see page | – | – | – | e.g. `BusinessAreasPage.tsx:187-189` |
| "Cancel" | Closes the dialog without saving | Y | Y | – | – | – | e.g. `BusinessAreasPage.tsx:184-186` |
| "Name is required" | Validation message under Name when empty (`admin:shared.validation.nameRequired`); Name max 255 chars | Y | Y | – | – | – | `BusinessAreasPage.tsx:33` |


### Business Areas — route `/admin/business-areas` — title key `admin:businessAreas.title` = "Business Areas"
Description line (`admin:businessAreas.description`): "Manage business areas for your data models."
Visibility: sidebar link for ADMIN and MANAGER only (`Sidebar.tsx:102,111`). USER/VIEWER reach it by URL and see the page.
Backend: list `GET /api/business-areas` = ADMIN all, others only granted areas (`business-areas.ts:134-190`). Create = ADMIN only (`:252-256`). Edit = G(EDIT) (ADMIN bypass) (`:294-298`). Delete = ADMIN only (`:349-353`). Grants list = G(VIEW) (`:402-406`). Add grant = ADMIN only (`:443-447`). Revoke grant = ADMIN only (`:529-533`). Users list used by the grant dialog = ADMIN or MANAGER (`BE/routes/users.ts:129-132`); a USER/VIEWER with a VIEW grant would get 403 on that list (user checklist empty).
Table columns: "Name", "Description" ("—" if empty), "Status" (badge "Active"/"Inactive"), "Created" (date) (`BusinessAreasPage.tsx:111-131`; c:labels.*). Empty message: "No business areas yet." (`admin:businessAreas.emptyMessage`).

| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| "New Business Area" (tooltip "Create a new business area") key `admin:businessAreas.createButton` / `createButtonTooltip` | Opens the create dialog (POST /api/business-areas) | Y | UI:Y/API:403 | UI:Y/API:403 | UI:Y/API:403 | – | FE `BusinessAreasPage.tsx:155-159`; BE `business-areas.ts:252-256` |
| Dialog title "New Business Area" / "Edit Business Area" | Create vs edit dialog | Y (create+edit) | edit only with EDIT grant; create 403 | same as MANAGER | same as MANAGER | – | `BusinessAreasPage.tsx:166`; en admin.json:30-31 |
| "Name" (text, required) | Area name | Y | see above | – | – | – | `:172-178` |
| "Description" (textarea) | Optional description | Y | – | – | – | – | `:179-182` |
| Toasts "Business area created" / "Business area updated" | Success feedback | Y | – | – | – | – | `:83`; en admin.json:34-35 |
| Row icon, tooltip "Manage grants" (`manageGrantsTitle`) | Opens the Grants dialog for that area | Y | Y (dialog opens; read-only in practice, see below) | UI:Y (only granted areas are listed) | UI:Y (only granted areas) | – | `:137`; grants list needs G(VIEW) `business-areas.ts:402-406` |
| Row icon, tooltip "Edit" (c:actions.edit) | Opens Edit dialog prefilled (PUT /api/business-areas/:id) | Y | G(EDIT) else API:403 | G(EDIT) else API:403 | G(EDIT) else API:403 | – | `:140`; BE `:294-298` |
| Row icon, tooltip "Delete" (c:actions.delete) | Opens delete confirm; on confirm deactivates the area (soft delete) | Y | UI:Y/API:403 | UI:Y/API:403 | UI:Y/API:403 | Dialog title "Delete business area?" (`entityLabel`=business area) | `:143,194-203`; BE `:349-353` |
| Delete confirm success toast "Business area deactivated" | – | Y | – | – | – | – | `:99`; en admin.json:36 |
| Grants dialog title "Grants — {{name}}" | Modal listing and editing grants of the area | Y | Y (view) | view | view | – | `:288`; en admin.json:39 |
| Grants dialog description "Control which users can access this business area and what they can do." | Helper text | Y | Y | Y | Y | – | `:289`; en admin.json:40 |
| "User" label + counter "{{count}} selected" | Label of the user checklist and how many users are ticked | Y | UI:Y/API:403 on Add | – | – | – | `:294-297` |
| Filter box, placeholder "Filter users by name or email" | Client-side filter (case-insensitive, name or email) of the user checklist | Y | Y | – | – | – | `:299-304,259-265` |
| User checkboxes (name + email) | Tick one or many users to grant at once (multi-user grant) | Y | UI:Y/API:403 | – | – | – | `:305-319` |
| "Permission" (select; default VIEW) | Chooses the level given to every ticked user | Y | UI:Y/API:403 | – | – | VIEW, EXPORT, SCHEDULE, CREATE, EDIT, DELETE (shown as raw uppercase codes, not translated) | `:39,324-336` |
| Level note under the select (`data-testid=permission-level-help`), "<LEVEL>: <text>" | Explains what the chosen level allows (levelHelp) | Y | Y | – | – | See level table below | `:347-350` |
| "Add" (tooltip "Give every ticked user the chosen permission on this business area") | One POST /grants per ticked user; disabled until at least one user ticked; partial failures reported separately | Y | UI:Y/API:403 "Grant failed" | – | – | – | `:338-344,233-257`; BE `:443-447` |
| Toasts "Access granted to {{count}} user(s)" (1: "Access granted to 1 user"; n: "Access granted to n users"), "Grant failed" | Result of Add | Y | Grant failed | – | – | – | `:247-253`; en admin.json:61-63 |
| "Loading grants..." / "No grants yet." | List states of current grants | Y | Y | Y | Y | – | `:353-356` |
| Grant row: name/email + level badge (tooltip = that level's note) | Shows one current grant | Y | Y | Y | Y | – | `:357-366` |
| Grant row X icon, tooltip "Revoke" | Removes that user's grant (DELETE /grants/:userId) | Y | UI:Y/API:403 | UI:Y/API:403 | UI:Y/API:403 | – | `:367-374`; BE `:529-533` |
| Toast "Access revoked" | – | Y | – | – | – | – | `:280`; en admin.json:64 |
| "Close" | Closes grants dialog | Y | Y | Y | Y | – | `:381-383` |

Grant level notes (exact `admin:businessAreas.grants.levelHelp.*`, en admin.json:48-53). Levels form a ladder (`BusinessAreasPage.tsx:346`, hierarchy check `business-area.service.ts:45-62`):
| Level | Text shown in the dialog |
|---|---|
| VIEW | "Read the data in this area's folders. Run maps that are shared with the user. See the area's folders, items, joins and hierarchies." |
| EXPORT | "Same as VIEW. Export and schedule rights on a map come from how that map is shared." |
| SCHEDULE | "Same as VIEW. Export and schedule rights on a map come from how that map is shared." |
| CREATE | "Everything in VIEW, plus create new maps, folders, items, joins and hierarchies in this area." |
| EDIT | "Everything in CREATE, plus change this area and its folders, items, joins and hierarchies." |
| DELETE | "Everything in EDIT, plus delete folders, items, joins and hierarchies in this area." |
Backend meaning of each level in these pages: VIEW = list/read folders, items, joins, hierarchies, grants; CREATE = create folders (`folders.ts:309`), items (`items.ts:228`), item import (`items.ts:460`), joins (`joins.ts:239`), hierarchies (`hierarchies.ts:186`); EDIT = update area/folder/item/join/hierarchy, refresh folders, share/unshare folders (`business-areas.ts:297`, `folders.ts:187,205,401,574,615`, `items.ts:327`, `joins.ts:321`, `hierarchies.ts:267`); DELETE = delete folder/item/join/hierarchy (`folders.ts:484`, `items.ts:408`, `joins.ts:395`, `hierarchies.ts:343`). EXPORT and SCHEDULE add nothing on these pages (they sit between VIEW and CREATE in the ladder, so CREATE and above also include them).




### Folders — route `/admin/folders` — title key `admin:folders.title` = "Folders"
Description: "Manage folders (tables, views, and derived data) within a business area." (`admin:folders.description`)
Visibility: sidebar for ADMIN/MANAGER only; USER/VIEWER by URL. Everything needs a business area picked first (buttons "Refresh all" and "New Folder" disabled until then: `FoldersPage.tsx:302,308`). Prompt when none picked: "Select a business area to view its folders." (`admin:folders.selectBusinessAreaPrompt`, `:333`).
Backend: list `GET /api/business-areas/:baId/folders` = G(VIEW) (`folders.ts:220-224`); create = G(CREATE) on the area (`:306-310`); update = G(EDIT) (`:398-402`); delete = G(DELETE) (`:481-485`); refresh one = G(EDIT) (`:184-188`); refresh all = G(EDIT) on area (`:202-206`); list shares = G(VIEW) (`:546-550`); share = G(EDIT) on the folder (`:571-575`); unshare = G(EDIT) (`:612-616`); Discover Tables (`GET /api/data-sources/:dsId/tables`) = ADMIN or MANAGER (`:735-739`); Introspect = ADMIN or MANAGER (`:656-660`); Import from data source = ADMIN only (`:824-828`); data source dropdown source (`GET /api/data-sources`) = ADMIN or MANAGER (`data-sources.ts:76-80`); items import at create = G(CREATE) on the new folder (`items.ts:457-461`).
Table columns: "Name" (+ badge "Shared" with tooltip "Owned by another business area and shared into this one" when the folder is shared in), "Type" (badge, folder type code), "Table Name", "Data Source" ("—" if empty) (`FoldersPage.tsx:234-253`; a:folders.columns.*). Empty message: "No folders in this business area yet."

| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| "Business Area" select, placeholder "Select a business area" | Picks the area whose folders are shown | Y | Y (only granted areas) | Y (granted areas) | Y (granted areas) | Areas returned by GET /api/business-areas | `FoldersPage.tsx:314-328` |
| "Refresh all" (tooltip "Re-read every table and view of this business area from its data source") key `folders.refresh.all` / `allHint` | Re-reads every owned (not shared-in) table/view folder of the area from its data source: new columns become items, changed types are updated, vanished columns are only listed | Y | G(EDIT) | G(EDIT) | G(EDIT) | – | `:299-307`; BE `folders.ts:202-218` (skips shared-in folders `:212`) |
| Refresh result toast: title "Refreshed {{count}} folder(s)", text "{{added}} new item(s), {{updated}} updated, {{missing}} column(s) missing, {{failed}} folder(s) failed" (red if any failed); error toast "Refresh failed" | Summary of refresh | Y | G(EDIT) | G(EDIT) | G(EDIT) | – | `:213-227`; en admin.json:127-133 |
| "Refresh results" panel + "Close" | Per-folder list under the table: "New items: …", "Updated: …", "Column gone from the source (item kept — delete it if no map uses it): …", or the error text | Y | Y | Y | Y | – | `:336-364`; en admin.json:134-136 |
| "New Folder" (tooltip "Create a new folder") | Opens the folder wizard | Y | G(CREATE) | G(CREATE) | G(CREATE) | – | `:308-310`; BE `folders.ts:306-310` |
| Row icon, tooltip "Refresh from data source" (`folders.refresh.one`) | Same refresh for this one folder. Only drawn for folder type TABLE or VIEW that has a data source and is NOT shared-in | Y | G(EDIT) | G(EDIT) | G(EDIT) | – | `:259-271`; BE `:184-188` |
| Row icon, tooltip "Manage business areas" (`folders.manageSharing`) | Opens the sharing dialog | Y | Y (opens; changes need EDIT) | Y | Y | – | `:272-279` |
| Row icon, tooltip "Edit" | Opens the wizard in edit mode (PUT /api/folders/:id) | Y | G(EDIT) | G(EDIT) | G(EDIT) | – | `:280`; BE `:398-402` |
| Row icon, tooltip "Delete" | Confirm dialog "Delete folder?" then deactivates the folder | Y | G(DELETE) | G(DELETE) | G(DELETE) | Success toast "Folder deactivated" | `:283,551-560`; BE `:481-485` |
| Wizard title "New Folder" / "Edit Folder" | Create or edit | – | – | – | – | – | `:366`; en admin.json:81-82 |
| "Name" (required) | Folder name; auto-filled from the picked table if empty | Y | conditional | conditional | conditional | – | `:368-374,124` |
| "Description" | Free text; auto-filled from the Oracle table comment if empty | Y | conditional | conditional | conditional | – | `:375-378,125` |
| "Folder Type" (select, default TABLE) | Chooses folder kind | Y | conditional | conditional | conditional | TABLE, VIEW, DERIVED, COMPLEX, JOIN, SUMMARY (raw codes) | `:31,379-393` |
| "Custom SQL" (textarea, 4 rows) | Only shown for DERIVED and COMPLEX. The SQL that defines the folder. Backend checks it only for COMPLEX: empty is refused ("Invalid custom SQL: SQL cannot be empty for COMPLEX folders") and the text must pass the SQL validator | Y | conditional | conditional | conditional | – | `:395-399`; BE `services/folder.service.ts:120-132` |
| "Data Source" (select, placeholder "Select a data source") | Shown for all types except DERIVED/COMPLEX; lists data sources | Y | Y (list ADMIN/MANAGER) | UI:Y/list 403 -> empty dropdown | same as USER | Data sources from GET /api/data-sources | `:402-416`; BE `data-sources.ts:76-80` |
| "Discover Tables" | Reads every table/view/etc. of the chosen data source (all pages) so you can pick one; disabled until a data source is chosen | Y | Y | API:403 | API:403 | – | `:417-424`; BE `folders.ts:735-739` |
| Filter box, placeholder "Filter by name or comment…" + counter "{{shown}} of {{total}}" | Client-side filter of the discovered list by name or Oracle comment; shown once tables were discovered | Y | Y | – | – | – | `:428-440` |
| Discovered list (buttons: table name + comment) | List is limited to objects matching the chosen Folder Type; click one to fill Table Name, Table Owner, Name, Description and propose all its columns as items. Empty text: "No {{type}} objects in this schema. Change the folder type to see the others." | Y | Y | – | – | – | `:134,441-464`; en admin.json:91 |
| "Table Name" / "Table Owner" (text) | Manual or auto-filled table reference. On create of a TABLE/VIEW with a data source, backend checks the table exists and is readable; else 400 "Table \"…\" does not exist or is not accessible" | Y | conditional | conditional | conditional | – | `:466-475`; BE `folder.service.ts:145-173` |
| "Items to create ({{count}})" | Heading of the column list; create mode only, after a table was picked | Y | conditional | – | – | – | `:477-480` |
| "Select all" / "Clear" toggle | Ticks or unticks every column (label flips to "Clear" when all are ticked) | Y | conditional | – | – | – | `:481-498` |
| Helper text "Each ticked column becomes an item. Descriptions come from the column comments in Oracle; edit them before saving." | Explains the column list | Y | Y | – | – | – | `:500`; en admin.json:93 |
| Column rows: checkbox + column name + type(length) + description input (placeholder "Description") | Untick to skip a column; edit the item description (pre-filled from the Oracle column comment) | Y | conditional | – | – | – | `:501-533` |
| "Cancel" / "Save" ("Saving...") | Save creates the folder, then (if columns are ticked) creates the items in a second call (POST /folders/:id/items/import). The second call needs CREATE on the new folder | Y | G(CREATE) | G(CREATE) | G(CREATE) | Toasts "Folder created", "Folder updated", "Save failed", "Discovery failed" | `:145-189,540-547`; en admin.json:101-104 |
| Sharing dialog title "Business areas for \"{{name}}\"" | Modal for folder to business area sharing | Y | Y | Y | Y | – | `FE/components/admin/FolderSharingDialog.tsx:108` |
| Description "A folder is owned by one business area and can be shared into others, as in Oracle Discoverer." | Helper text | Y | Y | Y | Y | – | `FolderSharingDialog.tsx:110` |
| "Member of" + badges: owner badge "<Area> · owner" (tooltip "The owning business area cannot be removed") and one badge per share; "Not shared with any other business area." | Shows where the folder appears | Y | Y | Y | Y | – | `FolderSharingDialog.tsx:115-131` |
| Badge X button, aria-label "Remove share with {{name}}" | Removes that share (DELETE /api/folders/:id/business-areas/:baId). Owning area cannot be removed (409 "This is the folder's owning business area; it cannot be unshared.") | Y | G(EDIT) | G(EDIT) | G(EDIT) | Toasts "Share removed" / "Could not remove share" | BE `folders.ts:612-651`; en admin.json:120-124 |
| "Share into" select, placeholder "Select a business area" (or "No other business areas available") | Lists areas the caller can see, minus the owning area and existing shares | Y | Y | Y | Y | – | `FolderSharingDialog.tsx:98-101,143-158` |
| "Share" button | Adds the folder to the chosen area (POST /api/folders/:id/business-areas). Needs EDIT on the folder (any area it belongs to); no grant on the target area is checked. 409 if it already belongs to that area ("Folder already belongs to this business area") | Y | G(EDIT) | G(EDIT) | G(EDIT) | Toasts "Folder shared" / "Could not share folder" | BE `folders.ts:571-605`, `folder.service.ts:345-347` |




### Items — route `/admin/items` — title key `admin:items.title` = "Items"
Description: "Manage items exposed from folders — columns, calculations, and aggregations."
Visibility: sidebar ADMIN/MANAGER; USER/VIEWER by URL.
Backend: list `GET /api/folders/:folderId/items` = G(VIEW) (`items.ts:141-145`); create = G(CREATE) (`:225-229`); update = G(EDIT) (`:324-328`); delete = G(DELETE) (`:405-409`); import from columns = G(CREATE) (`:457-461`) but used only by the Folders wizard.
Flow: pick Business Area, then Folder (Folder select disabled until an area is chosen; changing the area clears the folder) (`ItemsPage.tsx:196-227`). Prompt: "Select a business area and folder to view its items." Empty: "No items in this folder yet."
Table columns: "Name", "Type" (badge code), "Column", "Data Type", "Aggregation" ("—" when none) (`:167-171`).

| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| "Business Area" select, placeholder "Select a business area" | Chooses the area | Y | Y (granted areas) | Y (granted) | Y (granted) | Areas per GET /api/business-areas | `ItemsPage.tsx:197-218` |
| "Folder" select, placeholder "Select a folder" | Chooses the folder; lists folders of the area including shared-in ones | Y | G(VIEW) | G(VIEW) | G(VIEW) | Folders of the area | `:219-235`; BE `folders.ts:220-224` |
| "New Item" (tooltip "Create a new item") | Opens create dialog; disabled until a folder is chosen | Y | G(CREATE) | G(CREATE) | G(CREATE) | – | `:191-193`; BE `items.ts:225-229` |
| Row icon "Edit" | Opens edit dialog (PUT /api/items/:id); cannot move an item to another folder | Y | G(EDIT) | G(EDIT) | G(EDIT) | – | `:173`; BE `items.ts:324-328` |
| Row icon "Delete" | Confirm "Delete item?" then deactivates; toast "Item deactivated" | Y | G(DELETE) | G(DELETE) | G(DELETE) | – | `:176`; BE `items.ts:405-409` |
| Dialog title "New Item" / "Edit Item" | – | – | – | – | – | – | en admin.json:163-164 |
| "Name" (required) | Item name | Y | conditional | – | – | – | `:263-269` |
| "Description" | Optional | Y | conditional | – | – | – | `:250-253` |
| "Item Type" (select, default "Database Item (CO)") | Chooses item kind; switches the next field | Y | conditional | – | – | "Database Item (CO)", "Created Item (CI)", "Calculated Item (CU)", "Join Item (JI)", "Hierarchy Item (HI)", "Aggregation (AG)", "Function (FU)" | `:33,255-268`; en admin.json:148-156 |
| "Column Name" (placeholder "e.g. CUSTOMER_ID") | Shown only for type CO (column-backed): the physical column | Y | conditional | – | – | – | `:36,270-275` |
| "Formula" (textarea, placeholder "e.g. QUANTITY * UNIT_PRICE") | Shown for every type except CO: the calculation. Invalid formula returns 400 "Invalid formula…" | Y | conditional | – | – | – | `:277-281`; BE `items.ts:311-316,394-398` |
| "Data Type" (placeholder "e.g. NUMBER") | Free text | Y | conditional | – | – | – | `:284-287` |
| "Format Mask" (placeholder "e.g. 999,999.00") | Free text display mask | Y | conditional | – | – | – | `:288-291` |
| "Aggregation" (select, default NONE) | Default aggregate of the item; NONE stores nothing | Y | conditional | – | – | NONE, SUM, COUNT, AVG, MIN, MAX | `:50,294-306` |
| "Cancel" / "Save" ("Saving...") | Saves item; toasts "Item created" / "Item updated" / "Save failed" | Y | conditional | – | – | – | `:314-321`; en admin.json:179-181 |

There is no Import button on this page: importing items from Oracle columns only happens inside the Folders wizard (create mode).




### Joins — route `/admin/joins` — title key `admin:joins.title` = "Joins"
Description: "Define relationships between folders within a business area."
Visibility: sidebar ADMIN/MANAGER; USER/VIEWER by URL.
Backend: list = G(VIEW) (`joins.ts:158-162`); create = G(CREATE) (`:236-240`); update = G(EDIT) (`:318-322`); delete = G(DELETE) (`:392-396`); suggestions `GET /api/folders/:folderId/joins/suggestions` = G(VIEW) on the folder (`:436-440`).
Prompt: "Select a business area to view its joins." Empty: "No joins in this business area yet."
Table columns: "Name", "Left Folder", "Right Folder", "Columns" (pairs shown as `left op right` joined with " AND "), "Type" (badge) (`JoinsPage.tsx:209-227`).

| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| "Business Area" select | Chooses the area | Y | Y (granted) | Y (granted) | Y (granted) | – | `JoinsPage.tsx:254-268` |
| "New Join" (tooltip "Create a new join") | Opens dialog; disabled until an area is chosen | Y | G(CREATE) | G(CREATE) | G(CREATE) | – | `:249-251`; BE `joins.ts:236-240` |
| Row icon "Edit" | Opens dialog prefilled from the join's predicates (falls back to the legacy single left/right item) | Y | G(EDIT) | G(EDIT) | G(EDIT) | – | `:233,112-131`; BE `:318-322` |
| Row icon "Delete" | Confirm "Delete join?"; toast "Join deactivated" | Y | G(DELETE) | G(DELETE) | G(DELETE) | – | `:236,460-469`; BE `:392-396` |
| Dialog title "New Join" / "Edit Join" | – | – | – | – | – | – | en admin.json:198-199 |
| "Name" (required) | Join name; auto-filled "<leftCol> = <rightCol>" by a suggestion if empty | Y | conditional | – | – | – | `:278-284,160-162` |
| "Left Folder" / "Right Folder" (selects, placeholder "Select folder") | The two folders being joined; both lists = folders of the chosen area. Errors "Left folder is required" / "Right folder is required". Both folders must belong to the area | Y | conditional | – | – | – | `:286-323`; en admin.json:217-218 |
| "Suggest Joins" | Asks the server for join suggestions for the LEFT folder (matching column names across folders); disabled until a left folder is chosen. Empty result toast "No join suggestions found for this folder"; failure "Suggestion failed" | Y | G(VIEW) | G(VIEW) | G(VIEW) | – | `:325-335,133-148`; BE `joins.ts:436-440`, `join.service.ts:550-560` |
| Suggestion list (buttons "<leftCol> = <rightCol> (<reason>)") | Click applies it: sets both folders, fills the first empty column pair (or adds one), sets the join type to the suggested one, names the join if empty | Y | Y | – | – | – | `:337-351,150-163` |
| Column-pair header "Left Item" / "Right Item" | Labels of the pair grid | – | – | – | – | – | `:353-359` |
| "Left Item" select (per pair, placeholder "Select item") | Item from the left folder (disabled until left folder chosen) | Y | conditional | – | – | Items of the left folder | `:362-377` |
| "Operator" select (per pair, default "=", tooltip "How the two columns must compare. Almost always \"=\".") | Comparison between the two items | Y | conditional | – | – | =, <>, <, <=, >, >= | `:46,378-392` |
| "Right Item" select (per pair) | Item from the right folder | Y | conditional | – | – | Items of the right folder | `:393-408` |
| X button per pair (tooltip "Remove this column pair from the join") | Removes that pair; disabled when only one pair is left | Y | conditional | – | – | – | `:409-419` |
| "Add column pair" (tooltip "Match the two folders on one more column. Every pair must match (AND).") | Adds another pair; all pairs are ANDed (multi-column join). Pairs with both items empty are dropped on save | Y | conditional | – | – | – | `:422-430,171-177` |
| "Join Type" (select, default INNER) | Kind of join | Y | conditional | – | – | INNER, LEFT, RIGHT (no FULL, deliberately) | `:34,433-447` |
| "Cancel" / "Save" ("Saving...") | Saves; toasts "Join created" / "Join updated" / "Save failed" | Y | conditional | – | – | – | `:449-456`; en admin.json:222-224 |




### Hierarchies — route `/admin/hierarchies` — title key `admin:hierarchies.title` = "Hierarchies"
Description: "Define drill-down hierarchies by ordering items into levels."
Visibility: sidebar ADMIN/MANAGER; USER/VIEWER by URL.
Backend: list = G(VIEW) (`hierarchies.ts:91-95`); get one (used when editing) = G(VIEW) (`:144-148`); create = G(CREATE) (`:183-187`); update = G(EDIT) (`:264-268`); delete = G(DELETE) (`:340-344`); validate-levels = G(VIEW) (`:384-388`, not called by the page).
Prompt: "Select a business area to view its hierarchies." Empty: "No hierarchies in this business area yet."
Table columns: "Name", "Levels" ("{{count}} level(s)") (`HierarchiesPage.tsx:180-186`).

| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| "Business Area" select | Chooses the area | Y | Y (granted) | Y (granted) | Y (granted) | – | `HierarchiesPage.tsx:215-229` |
| "New Hierarchy" (tooltip "Create a new hierarchy") | Opens empty dialog; disabled until an area is chosen | Y | G(CREATE) | G(CREATE) | G(CREATE) | – | `:210-212`; BE `hierarchies.ts:183-187` |
| Row icon "Edit" | Loads the hierarchy plus each level's item (extra GET calls) then opens the dialog | Y | G(VIEW) to open, G(EDIT) to save | same | same | – | `:91-111,192`; BE `:144-148,264-268` |
| Row icon "Delete" | Confirm "Delete hierarchy?"; toast "Hierarchy deactivated" | Y | G(DELETE) | G(DELETE) | G(DELETE) | – | `:195,292-301`; BE `:340-344` |
| Dialog title "New Hierarchy" / "Edit Hierarchy" | – | – | – | – | – | – | en admin.json:241-242 |
| "Name" / "Description" | Text fields | Y | conditional | – | – | – | `:245-251` |
| "Levels (top to bottom)" | Ordered list of levels; order in the list is the drill order (level number = position) | Y | conditional | – | – | – | `:255,145-149` |
| "Add Level" | Appends an empty level row | Y | conditional | – | – | – | `:256-258` |
| "No levels yet — add at least one." | Empty-state helper | Y | Y | – | – | – | `:261` |
| Drag handle (aria-label "Reorder level") + number | Drag (mouse or keyboard) to reorder levels | Y | conditional | – | – | – | `:331-340,263-278` |
| "Level name" (placeholder) | Name of the level | Y | conditional | – | – | – | `:341-346` |
| Folder select (placeholder "Folder") | Folder of the level's item; changing it clears the item | Y | conditional | – | – | Folders of the area (including shared-in) | `:347-358` |
| Item select (placeholder "Item", disabled until a folder is chosen) | The item that is this level | Y | conditional | – | – | Items of the chosen folder | `:359-370` |
| X button (tooltip "Remove this level") | Removes the level | Y | conditional | – | – | – | `:371-373` |
| "Cancel" / "Save" | Save disabled until name is non-empty, at least one level exists, and every level has a name and an item; toasts "Hierarchy created" / "Hierarchy updated" / "Save failed" | Y | conditional | – | – | – | `:203,281-288`; en admin.json:254-255 |




### Custom Functions — route `/admin/custom-functions` — title key `admin:customFunctions.title` = "Custom Functions"
Description: "Register custom SQL, PL/SQL, and package functions available to calculated items."
Visibility: sidebar ADMIN/MANAGER; USER/VIEWER by URL. No business area involved.
Backend: list and get = any authenticated user (`custom-functions.ts:119-123,144-148`); create, update, delete, refresh one, refresh all = ADMIN or MANAGER (`:116,183-187,249-253,467-475,484-488`); DB function search `GET /api/data-sources/:dsId/functions` = ADMIN or MANAGER (`:330-335`); data source names for the column/dropdown = `GET /api/data-sources` ADMIN or MANAGER (`data-sources.ts:76-80`).
Empty: "No custom functions yet."
Table columns: "Name", "Type" (badge), "Database Function" (`OWNER.PACKAGE.NAME@LINK`, or "Not set"), "Data Source", "Parameters" ("{{count}} param(s)", tooltip lists params), "Return Type" (`CustomFunctionsPage.tsx:240-269`; a:customFunctions.columns.*).

| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| "Refresh all" (tooltip "Re-read every function from Oracle and recompile the calculated fields if one changed") | Re-reads every function that has a data source from Oracle, writes changed signatures back, recompiles calculated fields; functions gone from Oracle are only listed | Y | Y | UI:Y/API:403 | UI:Y/API:403 | – | `:306-314`; BE `:467-471` |
| Refresh toast: "Checked {{count}} function(s)" + "{{changed}} changed, {{missing}} gone from Oracle, {{failed}} failed"; error "Refresh failed" | Summary | Y | Y | 403 | 403 | – | `:225-236` |
| "Refresh results" panel + "Close" | Shows "Calculated fields recompiled: {{message}}", each function with "updated: {{what}}", "gone from Oracle — kept, because calculated fields may still call it" or the error | Y | Y | – | – | – | `:321-349` |
| "New Function" (tooltip "Create a new custom function") | Opens create dialog | Y | Y | UI:Y/API:403 | UI:Y/API:403 | – | `:315-317`; BE `:183-187` |
| Filter box, placeholder "Filter by name or database function…" | Client-side filter on Name or the `OWNER.PACKAGE.NAME` text (case-insensitive); the page's only table filter | Y | Y | Y | Y | – | `:350-357,123-129` |
| Row icon, tooltip "Refresh from database" | Refresh that one function; only drawn for functions that have a data source | Y | Y | UI:Y/API:403 | UI:Y/API:403 | – | `:275-285`; BE `:473-477` |
| Row icon "Edit" | Opens edit dialog (PUT /api/custom-functions/:id) | Y | Y | UI:Y/API:403 | UI:Y/API:403 | – | `:286`; BE `:249-253` |
| Row icon "Delete" | Confirm "Delete custom function?"; toast "Function deactivated" | Y | Y | UI:Y/API:403 | UI:Y/API:403 | – | `:289,457-466`; BE `:484-488` |
| Dialog title "New Custom Function" / "Edit Custom Function" | – | – | – | – | – | – | en admin.json:275-276 |
| Group "Database function" (legend) | Boxes the fields that say which Oracle function is called | Y | Y | – | – | – | `:367-368` |
| "Data source" (select, placeholder "Choose a data source") | Data source the function lives in; preselected when only one data source exists | Y | Y | – | – | Data sources (ADMIN/MANAGER list) | `:369-383,138` |
| DB function search (only when the chosen data source is Oracle): "Owner" (default = the data source username, uppercase), "Find a function" (placeholder "Function or package name", Enter also searches), "Search" (tooltip "Search for database functions and packages") | Queries Oracle ALL_ARGUMENTS; results list `[package.]name(params) → returnType` with `#n` for overloads. "No functions found." / "More functions match. Type more of the name to narrow the search." Owner must be a plain identifier | Y | Y | 403 | 403 | – | `:385-392,472-559`; BE `custom-functions.ts:330-...,354-355` |
| Result row (button) | Click fills Name (if empty), Function Type (PACKAGE if it has a package else PLSQL), Owner, Package, Function name, clears Database link, sets Return Type and Parameters JSON. Rows Oracle says cannot be called from SQL are disabled with "Cannot be called from SQL: {{reason}}" | Y | Y | – | – | – | `:159-170,531-548` |
| "Owner" / "Package" / "Function name" / "Database link" (monospace text) | The parts of `OWNER.PACKAGE.NAME@LINK`; stored uppercase; each must be letters, digits, _, $ or # starting with a letter (link may be dotted) else "Use letters, digits, _, $ or # only, starting with a letter" | Y | Y | – | – | – | `:31-32,394-404,181-184`; en admin.json:296 |
| "Name" (required), "Description" | Display name and text | Y | Y | – | – | – | `:407-417` |
| "Function Type" (select, default PLSQL) | Kind of function | Y | Y | – | – | SQL, PLSQL, PACKAGE | `:29,420-433` |
| "Return Type" (placeholder "e.g. NUMBER") | Free text | Y | Y | – | – | – | `:434-437` |
| "Parameters (JSON)" (placeholder shows `[{ "name": "p_id", "type": "NUMBER", "required": true }]`) | JSON array; each entry needs name and type. Errors: "Parameters must be a JSON array", "Each parameter needs a \"name\" and \"type\"", "Invalid JSON" | Y | Y | – | – | – | `:439-445,41-61` |
| "Cancel" / "Save" | Save; toasts "Function created" / "Function updated" / "Save failed" | Y | Y | 403 | 403 | – | `:446-453`; en admin.json:299-300 |




### Data Sources — route `/admin/data-sources` — title key `admin:dataSources.title` = "Data Sources"
Description: "Manage database connections used to introspect and import schema."
Visibility: sidebar ADMIN/MANAGER; USER/VIEWER by URL (list request 403, so the table just shows "No data sources yet.").
Backend: list = ADMIN or MANAGER (`data-sources.ts:76-80`); get one = ADMIN or MANAGER (`:102-106`); create = ADMIN only (`:140-144`); update = ADMIN only (`:204-208`); delete = ADMIN only (`:274-278`); Test connection `POST /api/data-sources/:id/test` = ADMIN or MANAGER (`:314-318`); Introspect `POST /api/data-sources/:dsId/introspect` = ADMIN or MANAGER (`folders.ts:656-660`); tables list = ADMIN or MANAGER (`folders.ts:735-739`); Import `POST /api/data-sources/:dsId/import` = ADMIN only (`folders.ts:824-828`).
Table columns: "Name", "Type" (badge `oracle`/`postgres`), "Host", "Status" ("Active"/"Inactive"), "Created" (`DataSourcesPage.tsx:164-181`). Empty: "No data sources yet."

| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options | Citation |
|---|---|---|---|---|---|---|---|
| "New Data Source" (tooltip "Create a new data source connection") | Opens create dialog | Y | UI:Y/API:403 on Save | UI:Y/API:403 | UI:Y/API:403 | – | `:224-226`; BE `data-sources.ts:140-144` |
| Row icon, tooltip "Test connection" | Opens a connection with the stored credentials; result toast "Connection succeeded" or "Connection failed" (description = message), "Test failed" if the call errors; message also stays in a green/red box above the table | Y | Y | UI:Y/API:403 | UI:Y/API:403 | – | `:187-195,131-148,229-235`; BE `data-sources.ts:314-318` |
| Row icon, tooltip "Introspect schema" | Reads the Oracle schema (clears the cache first); toast "Introspection complete" + "Discovered {{count}} table(s)." or "Introspection failed". Disabled for non-Oracle data sources | Y | Y | 403 | 403 | Oracle only | `:196-204,150-162`; BE `folders.ts:656-720` |
| Row icon, tooltip "Import tables" | Opens the Import Tables dialog | Y | UI:Y/API:403 on Import (Discover works) | UI:Y/403 | UI:Y/403 | – | `:205-207`; BE `folders.ts:824-828` |
| Row icon "Edit" | Opens edit dialog | Y | UI:Y/API:403 | UI:Y/403 | UI:Y/403 | – | `:208`; BE `data-sources.ts:204-208` |
| Row icon "Delete" | Confirm "Delete data source?"; toast "Data source deactivated" | Y | UI:Y/API:403 | UI:Y/403 | UI:Y/403 | – | `:211,312-321`; BE `:274-278` |
| Dialog title "New Data Source" / "Edit Data Source" | – | – | – | – | – | – | en admin.json:343-344 |
| "Name" (required) | Unique; duplicate returns 409 `A data source with name "…" already exists` | Y | – | – | – | – | `:245-251`; BE `data-sources.ts:189-194` |
| "Connection Type" (select, default Oracle) | Database kind; toggles the Oracle-only fields | Y | – | – | – | "Oracle", "PostgreSQL" | `:253-266` |
| "Host" / "Port" (number) | Server address | Y | – | – | – | – | `:267-276` |
| "Service Name" / "SID" | Only shown when Connection Type = Oracle | Y | – | – | – | – | `:277-288` |
| "Username" | DB account | Y | – | – | – | – | `:289-293` |
| "Password" (masked); on edit of a source that has one, hint "(leave blank to keep)" | Sent as `passwordEnc` only when typed; blank keeps the stored one. The stored password is never returned (only `hasPassword`) | Y | – | – | – | – | `:294-299,101`; BE `data-sources.ts:65` |
| "Cancel" / "Save" | Save; toasts "Data source created" / "Data source updated" / "Save failed" | Y | 403 | 403 | 403 | – | `:301-308`; en admin.json:359-360 |
| Import dialog title "Import Tables — {{name}}" + description "Discover tables and import selected tables as folders." | – | Y | Y (opens) | – | – | – | `:383-384` |
| "Table Owner / Schema" (placeholder "e.g. SCOTT"; default = data source username) | Oracle schema to read | Y | Y | – | – | – | `:389-390,331` |
| "Discover Tables" (tooltip "Re-read the tables in this schema") | Loads the tables of that schema ("Discovering tables..." while running; "No tables discovered yet." when none) | Y | Y | 403 | 403 | – | `:392-394,414-417`; BE `folders.ts:735-739` |
| "Business Area" select, placeholder "Select destination business area" | Area that will own the new folders | Y | Y (granted areas only) | – | – | – | `:398-411` |
| Table checklist: checkbox + table name + "({{count}} columns)" | Choose which tables become folders | Y | Y | – | – | – | `:418-424` |
| "Cancel" / "Import {{count}} table(s)" ("Importing...") | Disabled until at least one table ticked, a destination area chosen and a Table Owner typed. Creates folders; existing ones skipped. Toast "Import complete" + "Created {{created}} folder(s), skipped {{skipped}}." or "Import failed" | Y | UI:Y/API:403 "Import failed" | – | – | – | `:427-437,346-368`; BE `folders.ts:824-828` |






Paths relative to discoverer-neo. FE = frontend/src, BE = backend/src. Routes have no role guard: FE/App.tsx:85-97. Sidebar: FE/components/layout/Sidebar.tsx:102 `canModel = ADMIN||MANAGER`; Users/Security/Audit Log links in section "Data Modeling" (Sidebar.tsx:36-42, section key `sections.dataModeling`); Migration link in section "Other" (Sidebar.tsx:57-59, 126). Nav labels (nav.json): "Users", "Security", "Audit Log", "Migration".

---------------------------------------------------------------------------------------------------

### Users — route `/admin/users` — title key `admin:users.title` = "Users"
Description key `admin:users.description` = "Manage user accounts and permissions."
Visibility:
- ADMIN: link in sidebar (Data Modeling); full page. (UsersPage.tsx:65 isAdmin)
- MANAGER: link in sidebar; read-only page: list + per-user map dialog only; no New User / Credentials file / edit / (de)activate / delete buttons (UsersPage.tsx:67 canView, :210 `isAdmin &&`, :268 `isAdmin &&`).
- USER / VIEWER: no link; typing the URL shows only the text `admin:users.adminOnlyMessage` = "Only administrators can manage users." (UsersPage.tsx:255-260). The list query is disabled (`enabled: canView`, :78), so no API call is made.

| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options (exact labels) | Citation |
|---|---|---|---|---|---|---|---|
| Table columns: "Name" (`common:labels.name`), "Email" (`admin:users.columns.email`), "Role" (`admin:users.columns.role`), "Status" (`admin:users.columns.status`) | Lists all accounts (GET /api/users) | Y | Y | N (message only) | N (message only) | Role cell = badge ADMIN/MANAGER/USER/VIEWER; Status badge "Active" (`admin:users.status.active`) / "Inactive" (`admin:users.status.inactive`) | UsersPage.tsx:179-191; BE routes/users.ts:129-150 (ADMIN+MANAGER) |
| Empty table text "No users yet." (`admin:users.emptyMessage`) | Shown when no users | Y | Y | N | N | - | UsersPage.tsx:285 |
| "Credentials file" (`admin:users.credentials.button`), tooltip "Issue a new temporary password to every account that still has one, and download the list as a CSV" (`admin:users.credentials.hint`) | POST /api/users/credentials: gives a NEW temporary password to every active, non-role account still flagged must-change-password, sets must-change flag, downloads CSV `discoverer-neo-credentials-<date>.csv`; toast "Credentials file downloaded" (`admin:users.credentials.issued`) or "Could not issue credentials" (`...failed`); API returns 400 "No account to issue a credential for (database roles are skipped)" if nobody qualifies | Y | N (button hidden; API 403) | N | N | - | UsersPage.tsx:101-120, 270-277; BE routes/users.ts:159-214 (adminPreHandler), :186-190 targets = mustChangePassword && !isRole && isActive; services/user.service.ts:150-176 |
| "New User" (`admin:users.createButton`), tooltip "Add a new user account" (`admin:users.createTooltip`) | Opens create dialog | Y | N | N | N | - | UsersPage.tsx:278-280; BE routes/users.ts:332 ADMIN only |
| Dialog title "New User" (`admin:users.dialog.createTitle`) / "Edit User" (`admin:users.dialog.editTitle`) | Create or edit form | Y | N | N | N | - | UsersPage.tsx:287 |
| Field "Name" (`common:labels.name`) | User's display name; required, max 255; error "Name is required" (`admin:shared.validation.nameRequired`) | Y | N | N | N | - | UsersPage.tsx:290-294, 42 |
| Field "Email" (`admin:users.form.emailLabel`) | Login email; error "Enter a valid email" (`admin:users.validation.emailInvalid`); API 409 if email already used | Y | N | N | N | - | UsersPage.tsx:297-301; BE users.ts:367-370, 421-426 |
| Field "Password" (`admin:users.form.passwordLabel`) + on edit hint "(leave blank to keep current)" (`admin:users.form.passwordKeepHint`) | Sets the password (min 8 chars; error "Password must be at least 8 characters" `admin:users.validation.passwordMinLength`). Blank on edit = unchanged. Admin-set password does NOT set the must-change flag (service update only writes passwordHash) | Y | N | N | N | - | UsersPage.tsx:53, 304-311; BE services/user.service.ts:118-127 |
| Field "Role" (`admin:users.form.roleLabel`) select | Chooses account role (default USER on create) | Y | N | N | N | ADMIN, MANAGER, USER, VIEWER (raw role codes, not translated) | UsersPage.tsx:38, 313-325, 83 |
| Role help list (below Role select; data-testid role-help; chosen role highlighted) | Explains what each role may do. VERBATIM `admin:users.roleHelp.*`: ADMIN — "Can do everything: users, business areas, data sources, security and audit. Can open, change, share and delete every map." / MANAGER — "Models the data (business areas, folders, items, joins). Can open, run and share every map, and change who owns a map. Changes only their own maps; copies a map to build a new one." / USER — "Sees only their own maps and the maps shared with them. Builds new maps by copying one of those. Runs, exports and schedules as each share allows." / VIEWER — "Read-only. Opens and runs the maps shared with them. Cannot create, copy or change maps." Rendered as `<ROLE> — <text>` | Y | N | N | N | 4 lines | UsersPage.tsx:326-336; admin.json users.roleHelp |
| "Cancel" (`common:actions.cancel`) | Closes user dialog without saving | Y | N | N | N | - | UsersPage.tsx:339-341 |
| "Save" (`common:actions.save`) / "Saving..." (`admin:shared.saving`) | POST /api/users (create) or PUT /api/users/:id (edit); toast "User created" / "User updated"; failure toast "Save failed" | Y | N | N | N | - | UsersPage.tsx:122-143, 342-344; BE users.ts:332-375, 377-450 |
| Row icon "Maps this user can open" (`admin:users.maps.button`) tooltip/aria | Opens per-user map dialog (below) | Y | Y | N | N | - | UsersPage.tsx:201-209; BE users.ts:256-329 (ADMIN+MANAGER) |
| Row icon Edit, tooltip "Change this user's name, email, password or role" (`admin:users.editTooltip`) | Opens Edit User dialog | Y | N | N | N | - | UsersPage.tsx:212-214; BE users.ts:378 |
| Row icon "Deactivate" (`admin:users.status.deactivate`) (active users only) | Opens confirm dialog; disabled for own row with tooltip "You cannot deactivate your own account" (`admin:users.status.cannotDeactivateSelf`) | Y (not own row) | N | N | N | - | UsersPage.tsx:215-225; BE users.ts:417-419 (400 "You cannot deactivate your own account") |
| Deactivate dialog: title "Deactivate user?" (`admin:users.deactivateDialog.title`); text "{{name}} is signed out on their next request and cannot sign in until you activate the account again." (`...description`); buttons "Cancel", "Deactivate" / "Deactivating..." (`admin:users.status.deactivating`) | PUT /api/users/:id {isActive:false}; toast "User deactivated" | Y | N | N | N | - | UsersPage.tsx:364-385, 161-176 |
| Row icon "Activate" (`admin:users.status.activate`) (inactive users only) | PUT /api/users/:id {isActive:true} immediately (no confirm); toast "User activated" | Y | N | N | N | - | UsersPage.tsx:226-237 |
| Row icon Delete, tooltip "Delete this user account for good" (`admin:users.deleteTooltip`); disabled on own row | Opens delete confirm | Y (not own row) | N | N | N | - | UsersPage.tsx:238-246; BE users.ts:454-486 (400 "You cannot delete your own account") |
| Delete dialog: title "Delete user?" (`admin:shared.deleteConfirmTitle` + itemLabel `admin:users.entityLabel`="user"); body "This will deactivate <name> This action can only be reversed by an administrator." (`admin:shared.deleteConfirmDescriptionPrefix/Suffix`); buttons "Cancel", "Delete" (`common:actions.delete`) / "Deleting..." | DELETE /api/users/:id = HARD delete (`db.delete(users)`), toast "User deleted"; failure "Delete failed". NOTE dialog text says "deactivate" but the action permanently deletes the row | Y | N | N | N | - | UsersPage.tsx:145-159, 349-358; FE components/admin/DeleteConfirmDialog.tsx:34-55; BE services/user.service.ts:178-181 |

#### Per-user map dialog (UserMapsDialog) — opened from row map icon
Title `admin:users.maps.title` = "Maps for {{name}}"; subtitle "Every map this user can open, and why." (`.description`) or count "{{count}} map this user can open." / "{{count}} maps this user can open." (`.count_one/_other`); loading "Loading..." (`common:states.loading` = "Loading…"); empty "This user cannot open any map. Share a map or workbook with them." (`.empty`). (UsersPage.tsx:397-465). Lists exactly what that user's own Maps page shows (BE users.ts:253-255, 305-326).

| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options (exact labels) | Citation |
|---|---|---|---|---|---|---|---|
| Map name link | Navigates to `/maps/:id/view` | Y | Y | N | N | - | UsersPage.tsx:470-472 |
| "Owner: {{name}}" (`admin:users.maps.owner`; "—" if unknown) | Shows the map's owner (createdBy) | Y | Y | N | N | - | UsersPage.tsx:473-475; BE users.ts:324-325 |
| Badge (reason user can open the map, when not a per-user share) `admin:users.maps.via.*` | Says why the user sees the map | Y | Y | N | N | "Administrator" (user is ADMIN), "Owner", "Shared", "Public", "Manager role" | UsersPage.tsx:500; BE users.ts:310-322 |
| Share-level select (for `via=SHARE`), tooltip "What this user may do with the shared map" (`admin:users.maps.shareLevelTooltip`) | PUT map share level for this user (`apiClient.maps.updateShare`); toast "Share changed" | Y | Y (BE: map owner OR MANAGER who can VIEW map; else 403) | N | N | "Can view", "Can export", "Can edit" (`mapBuilder:share.permissions.VIEW/EXPORT/EDIT`) | UsersPage.tsx:425-430, 478-498; BE routes/map-shares.ts:133-155 -> services/map.service.ts:1287-1295 canManageShares |
| Icon "Give this map to another user. The new owner can change, share and delete it." (`admin:users.maps.changeOwnerTooltip`) | Toggles inline "New owner" picker | Y | Y | N | N | - | UsersPage.tsx:502-511 |
| "New owner" (`admin:users.maps.newOwner`) select | Picking a user calls PUT /api/maps/:id/owner; toast "Owner changed". Current owner preselected; picking same owner does nothing | Y | Y | API 403 | API 403 | Options = every ACTIVE user, shown as "<Name> (<email>)" | UsersPage.tsx:436-444, 526-550; BE routes/map-shares.ts:228-262 (403 "Only an admin or a manager can change a map owner") |
| Icon X, tooltip "Remove this map from the user. They can no longer open it." (`admin:users.maps.removeShareTooltip`) (only `via=SHARE`) | DELETE share (`apiClient.maps.revokeShare`); toast "Share removed"; no confirmation | Y | Y (same canManageShares rule) | N | N | - | UsersPage.tsx:431-435, 512-523; BE map-shares.ts:188-222 |




### Security — route `/admin/security` — title key `security:page.title` = "Security Policies"
Description `security:page.description` = "Row-level security policies restrict which rows users can see. Predicates are ANDed into every query a policy's users run."
Visibility:
- ADMIN: link in sidebar; full page (SecurityPage.tsx:238 isAdmin).
- MANAGER: link visible (Sidebar.tsx:102) but page renders only description `security:page.nonAdminDescription` = "Row-level security policies restrict which rows users can see." and message `security:page.nonAdminMessage` = "Only administrators can manage security policies." (SecurityPage.tsx:407-415). Queries disabled (`enabled: isAdmin` :255, :261). All /api/security/* are ADMIN-only (BE routes/security.ts:136 adminPreHandler; routes at :141,165,195,233,278,316,350,396,439).
- USER / VIEWER: no link; URL gives the same non-admin message.

| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options (exact labels) | Citation |
|---|---|---|---|---|---|---|---|
| Table columns "Name", "Description", "Status" (`common:labels.*`), "Rules" (`security:table.rules`), "Assignments" (`security:table.assignments`) | Lists policies (GET /api/security/policies) | Y | N (message only) | N | N | Status badge "Active" / "Inactive" | SecurityPage.tsx:344-372; BE security.ts:141 |
| Empty text `security:page.emptyMessage` | "No security policies yet. Row-level security fails closed by default: until a policy covers a folder, nobody sees its rows, administrators included." | Y | N | N | N | - | SecurityPage.tsx:439 |
| "Test" (`common:actions.test`), tooltip "Test this policy with a sample query" (`security:actions.testPolicy`) | Opens "Test a policy" dialog | Y | N | N | N | - | SecurityPage.tsx:426-428 |
| "New Policy" (`security:page.newPolicy`), tooltip "Create a new security policy" (`security:actions.newPolicy`) | Opens policy dialog | Y | N | N | N | - | SecurityPage.tsx:429-431 |
| Row icon tooltip "Assignments" (`security:table.assignments`) | Opens Assignments dialog | Y | N | N | N | - | SecurityPage.tsx:381-382 |
| Row icon "Edit" (`common:actions.edit`) | Loads policy (GET /:id; on failure toast "Failed to load policy") then opens edit dialog | Y | N | N | N | - | SecurityPage.tsx:275, 389-390, 295 |
| Row icon "Delete" (`common:actions.delete`) | Opens confirm "Delete policy?" (`admin:shared.deleteConfirmTitle` + `security:deleteConfirm.itemLabel`="policy"); DELETE /api/security/policies/:id; toast "Policy deleted" / "Delete failed" | Y | N | N | N | - | SecurityPage.tsx:328-336, 397-398, 545; BE security.ts:278 |
| Policy dialog title "New Policy" / "Edit Policy" (`security:dialog.newTitle/editTitle`); description "Rules target a business area or folder; their SQL predicates are ANDed into the WHERE clause of matching queries." (`security:dialog.description`) | Form | Y | N | N | N | - | SecurityPage.tsx:446-447 |
| Field "Name" (`common:labels.name`) | Policy name, required (max 255) | Y | N | N | N | - | SecurityPage.tsx:457; BE security.ts CreateBodySchema name min1 max255 |
| Field "Description" (`common:labels.description`) textarea | Optional | Y | N | N | N | - | SecurityPage.tsx:461-467 |
| Checkbox "Active" (`common:labels.active`) | Toggles whether the policy is applied | Y | N | N | N | - | SecurityPage.tsx:471-475 |
| "Rules" (`security:dialog.rulesLabel`) heading; button "Add rule" (`security:dialog.addRule`), tooltip "Add another rule to this policy" (`security:actions.addRule`) | Adds a rule row | Y | N | N | N | - | SecurityPage.tsx:480-488 |
| Notice "A policy needs at least one rule." (`security:dialog.minRuleNotice`) | Shown when only one rule; last rule cannot be removed; API requires >=1 rule | Y | N | N | N | - | SecurityPage.tsx:509; BE security.ts (rules min(1)) |
| Rule: "Applies to" (`security:rule.appliesTo`) select, aria "Rule target type" | Chooses whether the rule targets a business area or a folder | Y | N | N | N | "Business Area" (`security:rule.businessArea`), "Folder" (`security:rule.folder`) | SecurityPage.tsx:107-122 |
| Rule: "Business Area" (`security:rule.businessAreaLabel`) select, placeholder "Select business area" | Picks the business area (lists BAs) | Y | N | N | N | all business areas | SecurityPage.tsx:127-148 |
| Rule: "Folder" (`security:rule.folderLabel`) select, placeholder "Select folder" (only when target = Folder; disabled until BA chosen) | Picks a folder of that BA | Y | N | N | N | folders of chosen BA | SecurityPage.tsx:151-166 |
| Rule icon "Remove rule" (`security:rule.removeRule`) | Removes the rule | Y | N | N | N | - | SecurityPage.tsx:175-176 |
| "SQL predicate (WHERE-clause fragment)" (`security:rule.predicateLabel`) textarea | WHERE fragment ANDed into queries; must be non-empty to save | Y | N | N | N | - | SecurityPage.tsx:182, 342 |
| "Validate" (`common:actions.validate`) tooltip "Validate this SQL predicate" (`security:actions.validatePredicate`), busy "Validating…" | POST /api/security/policies/test to check predicate; success "Valid predicate" (`security:rule.validPredicate`) else error text | Y | N | N | N | - | SecurityPage.tsx:86-95, 201-209 |
| Help "Binds: :current_user_id, :current_user_email, :current_user_role" (`security:rule.bindsLabel`) and "{alias} — resolves to the folder's query alias" (`security:rule.aliasResolves`) | Documents available bind variables and alias token | Y | N | N | N | `:current_user_id`, `:current_user_email`, `:current_user_role`, `{alias}` | SecurityPage.tsx:219-224 |
| "Cancel" / "Save" ("Saving…") | Save disabled unless name non-empty and every rule has target + predicate; POST /api/security/policies or PUT /:id; toasts "Policy created", "Policy updated", "Save failed" | Y | N | N | N | - | SecurityPage.tsx:339-342, 516-521, 306-323; BE security.ts:195, 233 |
| Assignments dialog title "Assignments — {{name}}" (`security:assignments.title`); text "The policy applies to every assigned user, and to every user holding an assigned role." | Manage who a policy applies to | Y | N | N | N | - | SecurityPage.tsx:621-622 |
| "Assign to" (`security:assignments.assignTo`) select, aria "Assignment kind" | Switch between assigning a user or a role | Y | N | N | N | "User", "Role" | SecurityPage.tsx:627-635 |
| "User" select, placeholder "Select user", aria "User to assign" (mode = User) | Picks a user (list from GET /api/users) | Y | N | N | N | all users | SecurityPage.tsx:640-653, 577-579 |
| "Role" select, placeholder "Select role", aria "Role to assign" (mode = Role) | Picks a role | Y | N | N | N | ADMIN, MANAGER, USER, VIEWER | SecurityPage.tsx:656-668; BE security.ts AssignBodySchema roleName enum |
| "Assign" (`security:assignments.assign`), tooltip "Assign this policy to users or roles" | POST /api/security/policies/:id/assignments (exactly one of user or role); toast "Policy assigned" / "Assign failed" | Y | N | N | N | - | SecurityPage.tsx:583-598, 673-677; BE security.ts:350-394 |
| Empty text "Not assigned — this policy gives rows to nobody." (`security:assignments.notAssigned`) | Warning when no assignments | Y | N | N | N | - | SecurityPage.tsx:686 |
| Assignment rows: user name or "Unknown user"; or "Role <badge>" (`security:assignments.roleLabel`) | Existing assignments | Y | N | N | N | - | SecurityPage.tsx:696-701 |
| Icon "Remove assignment" (`security:assignments.removeAssignment`) | DELETE assignment; toast "Assignment removed" / "Remove failed" | Y | N | N | N | - | SecurityPage.tsx:603-611, 707-709; BE security.ts:396 |
| "Close" (`common:actions.close`) | Closes assignments / test dialog | Y | N | N | N | - | SecurityPage.tsx:718-719, 793-794 |
| Test dialog: title "Test a policy" (`security:test.dialogTitle`); text "Preview where a policy's predicates land in a sample query. Real enforcement happens inside the SQL generator when maps execute." | Preview only | Y | N | N | N | - | SecurityPage.tsx:754-755 |
| "Policy" select, placeholder "Select policy", aria "Policy to test" | Picks the policy | Y | N | N | N | all policies | SecurityPage.tsx:759-770 |
| "Sample query" (`security:test.sampleQueryLabel`) textarea (default `SELECT * FROM SALES`) | SQL to inject predicates into | Y | N | N | N | - | SecurityPage.tsx:735, 774 |
| "Run test" (`security:test.runTest`, busy "Testing…"), tooltip "Run the policy test on this sample query" | POST /api/security/policies/test; shows "Query with security predicates" (`security:test.resultLabel`) or error; API 400 if sample SQL invalid | Y | N | N | N | - | SecurityPage.tsx:742-746, 786-800; BE security.ts:439-500 |




### Audit Log — route `/admin/audit` — title key `audit:page.title` = "Audit Log"
Description `audit:page.description` = "Every mutating request — data changes, exports, migrations, and authentication events — captured automatically."
Visibility:
- ADMIN: link in sidebar; full page.
- MANAGER: link in sidebar (Sidebar.tsx:36-42, canModel) BUT AuditLogPage has NO role branch (grep: no isAdmin) and all /api/audit* are ADMIN-only (BE routes/audit.ts:67 adminPreHandler; :73,111,175,201). MANAGER sees the page frame, filters, and (users list works, GET /api/users allows MANAGER) but log rows/stats queries return 403 -> empty/"No audit entries match these filters." UI:Y/API:403.
- USER / VIEWER: no link; by URL they get the same empty frame with 403s.

| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options (exact labels) | Citation |
|---|---|---|---|---|---|---|---|
| Stat card "Total Actions" (`audit:stats.totalActions`) with sub-text "In the selected date range" (`audit:stats.selectedDateRange`) when a From/To date is set, else "All time" (`audit:stats.allTime`) | Total count from GET /api/audit/stats | Y | UI:Y/API:403 | UI:Y/API:403 | UI:Y/API:403 | - | AuditLogPage.tsx:100, 213-220; BE audit.ts:111 |
| Card "Top Actions" (`audit:stats.topActions`), "Most frequent action types"; empty "No activity recorded yet." | Ranks most frequent actions | Y | UI:Y/API:403 | same | same | - | AuditLogPage.tsx:227-234 |
| Chart "Actions per Day" (`audit:stats.actionsPerDay`), "Daily activity volume for the selected date range"; bar series "Actions" (`audit:chart.actions`) | Bar chart of daily counts | Y | UI:Y/API:403 | same | same | - | AuditLogPage.tsx:250-286 |
| Button "Export CSV (this page)" (`audit:actions.exportCsv`), tooltip "Export the current page of audit entries as CSV" (`audit:actions.exportCsvTooltip`) | Client-side CSV of only the rows currently shown (max 25); disabled when no rows. CSV header: "Timestamp", "User", "Action", "Entity Type", "Entity ID", "IP Address"; unknown user written as "System / unauthenticated" | Y | disabled (no rows) | same | same | - | AuditLogPage.tsx:186-206, 27 PAGE_SIZE=25; csv keys audit.json |
| Card "Filters" (`audit:filters.title`) | Filter group | Y | - | - | - | - | AuditLogPage.tsx:296 |
| Filter "User" (`audit:filters.userLabel`), aria "Filter by user", first option "All users" | Filters by user id; list from GET /api/users | Y | UI:Y (list loads) / log API:403 | - | - | "All users" + every user name | AuditLogPage.tsx:301-312, 103-106 |
| Filter "Entity type" (`audit:filters.entityTypeLabel`), placeholder "e.g. maps" | Exact-match on entityType (text input) | Y | 403 | - | - | free text | AuditLogPage.tsx:318-325; BE services/audit.service.ts:85 eq() |
| Filter "Action" (`audit:filters.actionLabel`), placeholder "e.g. POST /api/maps" | Exact-match on action string (format "<METHOD> <route pattern>") | Y | 403 | - | - | free text | AuditLogPage.tsx:330-336; audit.service.ts:84; plugins/audit.ts:213 |
| Filter "From" (`audit:filters.fromLabel`) date | Start date | Y | 403 | - | - | date picker | AuditLogPage.tsx:342-350 |
| Filter "To" (`audit:filters.toLabel`) date | End date | Y | 403 | - | - | date picker | AuditLogPage.tsx:354-360 |
| "Clear" (`common:actions.clear`), tooltip "Clear all filters and reset to the beginning" (`audit:filters.clearTooltip`); appears only when any filter set | Resets filters and page | Y | - | - | - | - | AuditLogPage.tsx:364-375 |
| Table columns "Timestamp", "User", "Action", "Entity", "IP Address" (`audit:table.*`); user blank shows "System / unauthenticated" (`audit:actorUnknown`); empty "No audit entries match these filters." | Read-only log rows, GET /api/audit | Y | UI:Y/API:403 | same | same | - | AuditLogPage.tsx:122-170, 386; BE audit.ts:73 |
| Row icon "View details" (`audit:table.viewDetails`) | Opens dialog "Audit entry details" (`audit:detail.title`), description "<action> — <date>" (`audit:detail.descriptionTemplate`), body = the entry as raw JSON | Y | - | - | - | - | AuditLogPage.tsx:175, 413-431 |
| Pagination: "Showing {{from}}–{{to}} of {{total}}" (`common:pagination.showing`) or "No results" (`audit:pagination.noResults`); buttons "Previous", "Next" (`common:actions.previous/next`) | 25 rows per page, offset paging | Y | - | - | - | - | AuditLogPage.tsx:390-411 |

Action list (what is recorded; there is no fixed dropdown): every POST/PUT/PATCH/DELETE request (incl. login, logout, refresh, exports, migrations) plus GET on business-areas, folders, items, joins, hierarchies, custom-functions, data-sources. Action text = "<METHOD> <route pattern>", entityType derived from the resource segment; sensitive keys (password, secret, token, credential, apikey, authorization) redacted before storing. (BE plugins/audit.ts:15-70 summary, :213; description key `audit:page.description`.) Health, metrics, documentation are excluded (audit.ts DEFAULT_EXCLUDE_PREFIXES).




### Migration — route `/admin/migration` — title key `migration:page.title` = "Migration"
Description `migration:page.description` = "Import an Oracle Discoverer End User Layer (EUL) into Discoverer Neo."
Visibility:
- ADMIN: link in sidebar under "Other" (Sidebar.tsx:57-59, 126 `canModel ? [...other, ...adminOnlyOtherNavItems]`); full page.
- MANAGER: link shown (comment says "an administrator's job" but gate is canModel = ADMIN||MANAGER, Sidebar.tsx:102, 126). Page has no role branch; data-source dropdown loads (GET /api/data-sources allows ADMIN+MANAGER: BE routes/data-sources.ts:79) but every /api/migration/* action is ADMIN-only (BE routes/migration.ts:84; :90,126,162,215,267,314,340,356) -> 403 error toasts.
- USER / VIEWER: no link; by URL the page renders; data-source list 403s so the dropdown is empty ("No Oracle data sources"); actions 403.

| Label | What it does | ADMIN | MANAGER | USER | VIEWER | Choices/options (exact labels) | Citation |
|---|---|---|---|---|---|---|---|
| Card "Source" (`migration:source.title`) + text "Pick a registered Oracle data source. Its stored credentials are used on the server — passwords are never sent from this page. The migration always targets this Discoverer Neo database." | Explains source | Y | UI:Y/API:403 | UI:Y/API:403 | UI:Y/API:403 | - | MigrationPage.tsx:328-330 |
| "Oracle data source" (`migration:source.dataSourceLabel`) select; placeholder "Select a data source" or "No Oracle data sources" | Picks the source; only data sources of type oracle listed | Y | UI:Y (list loads)/actions 403 | UI:Y/list 403 | same | registered Oracle data sources | MigrationPage.tsx:132-140, 336-345 |
| "EUL schema owner (optional)" (`migration:source.schemaOwnerLabel`), placeholder "e.g. EUL5_US" | Optional EUL schema owner passed to all actions | Y | 403 | 403 | 403 | free text | MigrationPage.tsx:352-355 |
| "EUL version" (`migration:source.versionLabel`) select | Override EUL version for Run/Re-import calls | Y | 403 | 403 | 403 | "Auto-detect", "Force EUL4", "Force EUL5" | MigrationPage.tsx:362-373 |
| "Detect version" (`migration:actions.detectVersion`), tooltip "Detect the EUL version of the selected data source" | POST /api/migration/detect; toast "Detected {{version}}" / "Detection failed"; fills card "Detected source" | Y | API:403 | API:403 | API:403 | - | MigrationPage.tsx:152-166, 380-386; BE migration.ts:90 |
| "Analyze" (`migration:actions.analyze`), tooltip "Analyze the EUL for migration readiness and complexity" | POST /api/migration/analyze; toast "Analysis complete" / "Analysis failed"; fills "Assessment" | Y | API:403 | 403 | 403 | - | MigrationPage.tsx:169-181, 388-394; BE migration.ts:126 |
| Checkbox "Dry run (validate without writing)" (`migration:source.dryRunLabel`), default checked | When ticked Run/Re-import only validate/plan; unticking shows warning "A live migration writes into this Discoverer Neo database. Run a dry run first and review the report below." (`migration:source.liveMigrationWarning`) | Y | 403 | 403 | 403 | - | MigrationPage.tsx:125, 398-404, 470-475 |
| "Run dry run" (`migration:actions.runDryRun`) / "Run migration" (`migration:actions.runMigration`) (label follows checkbox), tooltip "Start the migration job" | POST /api/migration/run; toasts "Dry run started" / "Migration started", "Progress updates below."; on finish "Dry run complete"/"Migration complete", "No rows were written." / "Migrated from {{source}}.", or "Migration failed", or "Migration finished with blockers" | Y | API:403 | 403 | 403 | - | MigrationPage.tsx:184-202, 408-414; BE migration.ts:162 |
| "Re-import maps" (`migration:actions.reimportMaps`), tooltip "Re-import maps from the EUL, replacing existing maps" | POST /api/migration/reimport-maps (respects Dry run); rebuilds maps of an already migrated DB, replacing every map in "Migrated Workbooks" BA; toast "Map re-import started" | Y | API:403 | 403 | 403 | - | MigrationPage.tsx:207-228, 419-428; BE migration.ts:215 |
| Help text under buttons `migration:source.reimportMapsHelp` | "Re-import maps rebuilds only the maps of a database that has already been migrated, from the workbooks in the EUL. It replaces every map in the "Migrated Workbooks" business area — edits made to one since the original migration are lost — and leaves users, folders, items and grants untouched. Run it as a dry run first." | Y | - | - | - | - | MigrationPage.tsx:461 |
| "Re-import everything" (`migration:actions.reimportAll`), tooltip "Re-import all objects from the EUL with current migrator version" | POST /api/migration/delta (respects Dry run); toast "Re-import of everything started" | Y | API:403 | 403 | 403 | - | MigrationPage.tsx:232-250, 433-442; BE migration.ts:267 |
| Help `migration:source.reimportAllHelp` | "Re-import everything replays the whole migration with the current version of the migrator and rewrites, object by object, whatever now differs: business areas, folders, items, joins, hierarchies, functions, users, grants and maps. Nothing is deleted and map ids survive, so schedules and shares are kept; objects removed from the EUL are only reported. A live run ends by compiling the calculated fields. Run it as a dry run first." | Y | - | - | - | - | MigrationPage.tsx:464 |
| "Compile calculated fields" (`migration:actions.compile`), tooltip "Compile all calculated fields and generate their SQL" | POST /api/migration/compile; toast "Compiling calculated fields"; no data source needed (enabled even with none selected) | Y | API:403 | 403 | 403 | - | MigrationPage.tsx:252-260, 447-456; BE migration.ts:314 |
| Help `migration:source.compileHelp` | "Compile calculated fields checks every calculated field and writes the SQL that maps run. A migration and a re-import now do this at the end; use this button if a map says a field "has not compiled". It does not read the EUL." | Y | - | - | - | - | MigrationPage.tsx:467 |
| Card "Detected source" (`migration:detected.title`): badge "Supported"/"Not supported", "Discoverer release", "EUL schema version", "Schema owner", "EUL tables found" | Result of Detect version | Y | - | - | - | - | MigrationPage.tsx:487-511 |
| Card "Assessment" (`migration:assessment.title`): "Readiness {{score}}/100 ({{rating}}) · complexity {{complexity}} · estimated effort {{estimate}}"; counts "Business areas", "Folders", "Items", "Joins", "Hierarchies", "Custom functions", "Workbooks", "Conditions", "Security conditions", "Users", "Grants", "Orphaned objects"; "Worksheet layout coverage": "Worksheets", "Layout decoded", "Crosstabs", "With sorting", "With totals", "With forced joins", "Select distinct"; "Blockers"; "Warnings ({{count}})" | Result of Analyze | Y | - | - | - | - | MigrationPage.tsx:535-608 |
| Job card: "Dry run" / "Migration" + status; "requested {{version}}" badge; "Started"; progress bar aria "Migration progress"; polls job (GET /api/migration/jobs/:jobId) | Live progress | Y | - | - | - | - | MigrationPage.tsx:636-649; BE migration.ts:356 |
| "Target database already migrated" (`migration:job.targetBlockedTitle`) + preflight message | Shown when the target already holds a migration (a plain run cannot proceed; use Re-import) | Y | - | - | - | - | MigrationPage.tsx:663-668 |
| Tables "Rows that would be inserted" (dry run) / "Rows inserted", columns "Table", "Rows" | Per-table counts; table names `migration:tables.*` ("Users", "Business areas", "Folders", "Items", "Joins", "Hierarchies", "Hierarchy levels", "Custom functions", "Maps", "Map columns", "Grants", "Map conditions", "Map parameters", "Map calculated fields", "Map layouts", "Map totals and percentages", "Map page setup", "Map conditional formats", "Folder shares", "Workbooks read", "Worksheets read") | Y | - | - | - | - | MigrationPage.tsx:676-716; migration.json tables |
| Summary block: "Summary"; "Source integrity: {{status}} ({{errorCount}} error(s), {{warningCount}} warning(s)). Skipped {{skippedCount}} object(s). Took {{duration}}s." (valid/invalid); "Post-migration reconciliation: {{status}}" ("row counts match"/"MISMATCH"); notices: "A “Migrated Workbooks” business area was created to host the maps migrated from workbooks. Review each map and move it into the business area it belongs to."; "Migrated user accounts cannot sign in until an admin sets a password."; "Version-specific notes ({{count}})"; maps re-import summary "Replaced {{replaced}} map(s) from {{workbooks}} workbook(s) holding {{worksheets}} worksheet(s), in {{duration}}s." and "{{columns}} column(s) and {{conditions}} condition(s) could not be migrated. See the log above."; delta summary "Would write"/"Wrote", "Nothing differs from the last recorded run ({{objects}} source objects).", "{{count}} object(s) were refused (removed from the EUL, or no longer in Neo). See the log above.", "Verifier after the run: {{status}}." | Outcome text | Y | - | - | - | - | MigrationPage.tsx:729-834; migration.json job.* |
| "Migration log" (`migration:job.logTitle`), "No log entries yet.", "({{count}} earlier line(s) trimmed)" | Scrolling log (role=log) | Y | - | - | - | - | MigrationPage.tsx:863-876 |





## 3. Business rules users must understand

### 3.0 Cross-cutting (code-verified)

**How a map becomes visible (BE/services/map.service.ts:887-927, 1206-1267)**
- ADMIN and MANAGER: every active map (listAll, :900-906). Dashboard "Total Maps" and the Maps list "All" tab follow this.
- USER and VIEWER: maps they created, plus maps with **Public** ticked, plus maps explicitly shared with them at any level (:914-921). A business-area grant does **not** show maps (:914-915; CHANGELOG 2.0.0).
- GET /api/maps default scope: ADMIN "all", everyone else "owned" (BE/routes/maps.ts:236); the Maps page loads both scopes for its Mine / Shared with me / All tabs.

**What each situation allows on a map (canAccessMap, map.service.ts:1249-1268)**

| Action | Owner | ADMIN | MANAGER (not owner) | Public map (anyone) | Share VIEW | Share EXPORT | Share EDIT |
|---|---|---|---|---|---|---|---|
| View / run | Y | Y | Y | Y | Y | Y | Y |
| Export | Y | Y | Y | Y | N | Y | Y |
| Schedule | Y | Y | Y | N | N | Y | Y |
| Edit (save) | Y | Y | N | N | N | N | Y |
| Delete | Y | Y | N | N | N | N | N |

- Public gives VIEW and EXPORT only (:1257).
- Share levels are exactly **VIEW / EXPORT / EDIT**, shown as "Can view / Can export / Can edit" (CHANGELOG 2.0.0). EXPORT also allows SCHEDULE (:1206-1215).
- **Who can share** (canManageShares, :1287-1294): ADMIN, the map owner, or a MANAGER who can view the map. Receiving an EDIT share does not allow re-sharing.
- **Who can copy** (canDuplicate, :1305-1310; BE/routes/maps.ts:405-418): anyone who can view the map except the VIEWER role. The copy is private to the copier. Workbooks likewise (BE/routes/workbooks.ts:48+).
- **Ownership transfer** (transferOwnership, :1406; PUT /api/maps/:id/owner, BE/routes/map-shares.ts:228-244): ADMIN or MANAGER only, from Users page > per-user map dialog. The new owner's own share, if any, is dropped.
- **Delete** is a soft delete (map.service softDelete); CHANGELOG 1.1.0 says an administrator can restore deleted worksheets.

**Second gate: data entitlement (BE/services/business-area.service.ts ~468-533)**
- Seeing a map is not permission to read its data. Every run and export needs a business-area grant covering every folder the map touches (any level; any-of across the areas a folder belongs to). ADMIN bypasses, and the bypass is written to the audit log (DATA_ENTITLEMENT_ADMIN_BYPASS). Otherwise: "You do not have access to the data in folder ...".
- Creating (saving a new) map needs the business-area CREATE grant (BE/routes/maps.ts:296-298); ADMIN bypasses. The builder tree lists areas the user holds any grant on, so a user with only VIEW can build but not save.
- Row-level security policies (Security page, ADMIN-only) can refuse or filter rows at run time. See section 2, Security.

**Business-area grants** (BE/routes/business-areas.ts:443,529): created and removed by ADMIN only. Levels VIEW < EXPORT < SCHEDULE < CREATE < EDIT < DELETE; the highest held wins (CHANGELOG 2.0.0 Fixed). On modeling pages the level gates what a user may change (create needs CREATE, edit EDIT, delete DELETE). A grant never shows a map.

**Roles at a glance (backend truth)**
- ADMIN: everything; bypasses grants; only role that can create/delete business areas, grant/revoke, create/update/delete users and data sources, import from a data source, use Security/Audit/Migration, list every user's runs, and see generated SQL and Plan (POST /api/maps/:id/explain, BE/routes/map-execution.ts:285).
- MANAGER: sees, runs, exports, schedules and shares every map; edits and deletes only own maps; reads the Users list and each user's maps; can change a map's share levels and its owner; writes Custom Functions; reads and tests Data Sources; NO grant bypass on modeling pages.
- USER: own + public + shared maps; can build and save maps only where granted CREATE.
- VIEWER: identical to USER in the backend except it cannot copy maps or workbooks (canDuplicate). It is not blocked from running, exporting, scheduling or saving where map rights and grants allow. The VIEWER manual must say "you cannot copy maps" and otherwise describe what the shares and grants they hold allow.

**Schedules, Runs, Exports scoping**
- Schedules: every role, including ADMIN, lists only their own (BE/routes/schedules.ts:247-257); acting on someone else's schedule is 403 except ADMIN by API (:157).
- Runs: own runs; only ADMIN can tick "Show every user's runs" (BE/routes/map-runs.ts:180-185); rows for maps you can no longer view are hidden (:198-224).
- Exports: own jobs only, all roles including ADMIN (BE/routes/export.ts:214-230). Files are purged after 7 days (section 2, Exports).
- Settings, password change and Dashboard use the caller's own data (authenticate only).

### 3.1 Auth and sessions (from BE/routes/auth.ts and FE)

- Two tokens: a short-lived access token (JWT, `JWT_EXPIRES_IN` default 15 minutes) and a refresh token valid `REFRESH_TOKEN_TTL_SECONDS` = 7 days from LOGIN (BE/config.ts:75,80). Refreshing rotates the refresh secret but keeps the original expiry: a session can never outlive 7 days from sign-in (auth.ts:13-20,27-28,330-338).
- No idle timeout exists. The browser silently refreshes the access token every time it is within 5 minutes of expiry, checked every 60 s while the app is open (FE/hooks/useAuth.ts:9-10,42-72). So an open tab stays signed in up to the 7-day hard limit; a closed browser with "Remember me" unticked loses the session (store uses sessionStorage) (store/auth.ts:37-56). Inactivity with the tab closed: the access token dies after 15 min but the stored refresh token can still renew it until day 7.
- A 401 on any API call triggers one refresh + retry; if that fails the user is logged out and sent to `/login` (FE/lib/api.ts:169-196). Session-expired message banner appears when the proactive refresh fails (useAuth.ts:60-66).
- Each refresh token works once; concurrent tabs share one persisted session and pick up rotated tokens (auth.ts:281-349; store/auth.ts:25,94-101; api.ts:145-166). Reuse of a spent token returns 401 "Invalid refresh token" (auth.ts:307,338).
- Role, active status and existence are re-read from the database on EVERY request, not from the token: a deactivated, deleted or demoted account loses access on its next request; a role change applies immediately without re-login (BE/plugins/auth.ts:83-94; user.service.ts:39-54). Refreshing a deprovisioned account deletes the session (auth.ts:323-328).
- Logout (API): blacklists the access token in Redis until its expiry and deletes the refresh session (auth.ts:352-386). See Header mismatch: the header menu's Log out appears to only clear local state.
- `mustChangePassword`: see Change password section; enforced in the API guard (plugins/auth.ts:96-110).
- There is NO session list, NO "sign out everywhere", NO revoke-session endpoint, NO password reset/forgot-password endpoint in routes/auth.ts (routes present: login, refresh, logout, me, change-password only).
- Login throttling/lockout: see Login section (5 failures = 15-min account lock; 100 failures/IP per 15 min; known addresses (successful login in last 30 days) bypass the account lock).
- `GET /api/auth/me` returns id, email, name, role, locale, theme, colorPalette read fresh from the DB (auth.ts:388-452).
- Roles ADMIN/MANAGER/USER/VIEWER are enforced by `authorize(...)` / `authorizeAdmin` decorators (BE/plugins/auth.ts:113-140+); `authenticate` alone (used by dashboard, settings, maps list) has no role check.
- TRUST_PROXY default 'false' (config.ts:89): behind a reverse proxy the per-IP limit counts the proxy's IP unless configured (memory note; not a user-facing rule).


### 3.2 Per-page business rules

#### Login

Business rules
- Failed logins are counted per IP and per account (only failures count) in a 15-min window (`LOGIN_RATE_LIMIT_WINDOW_SECONDS` default 900). 5 failures on one account (`LOGIN_LOCKOUT_THRESHOLD`) lock that account for 15 min (`LOGIN_LOCKOUT_SECONDS` 900); 100 failures from one IP (`LOGIN_MAX_FAILURES_PER_IP`) block that IP for the rest of the window. Blocked = HTTP 429 + `Retry-After` header, message "Too many login attempts. Try again later." (BE/config.ts:91-97; BE/routes/auth.ts:59-115,218-226).
- An address that logged in successfully to that account in the last 30 days is NOT held by the account lock (still held by the per-IP limit), so an attacker cannot keep the real owner out (auth.ts:52-54,59,81,247-251). Lockout is audited as `auth.lockout` (auth.ts:107-114).
- Deactivated accounts and "role" accounts (`isRole`) get the same "Invalid email or password" as a wrong password (auth.ts:239-245; BE/services/user.service.ts:53).
- A successful login clears the account's failure counter (auth.ts:247-251).

#### Change password

Business rules
- While `mustChangePassword` is set, EVERY API route except `/api/auth/change-password`, `/api/auth/me`, `/api/auth/logout` returns 403 `{code:'PASSWORD_CHANGE_REQUIRED'}`; the UI redirects every protected page to `/change-password` (BE/plugins/auth.ts:26-30,96-110; ProtectedRoute.tsx:26-28).
- Min length 12 characters, must differ from current, current password must be re-entered (auth.ts:122,495-507).
- Changing the password does NOT sign out other sessions/tokens; existing token stays valid (auth.ts:518-519). No session-revocation code found in auth.ts.
- No self-service "forgot password"; a lost password must be reset by an administrator (no reset route in auth.ts; UNVERIFIED whether Users page offers reset — belongs to another fragment).

#### Settings

Business rules
- Defaults: UI language default `pt-PT` (FE/i18n/index.ts:15); fallback for missing strings `en` (index.ts:22). Theme defaults to the OS light/dark setting until an explicit choice exists (ThemeProvider.tsx:48-52,75). Palette default in DB is `navy` (backend/drizzle/0007_closed_sugar_man.sql:2; also `/me` fallback 'navy', auth.ts:447), although the UI option named "Classic" is the key `default`.
- Supported values are validated server-side: locales en, pt-PT, fr-FR, es-ES; themes light, dark, high-contrast; palettes default, navy, forest, wine, ocean, ochre; PATCH needs at least one field (BE/routes/user-preferences.ts:12-28).
- Saved preferences follow the account to other browsers/devices; the language and theme are applied at login (useAuth.ts:22-25; ThemeProvider.tsx:94-102).
- Doc/UI translations exist for pt-PT, fr-FR, es-ES; screenshots should be taken in English for the English manual.

#### Dashboard

Business rules
- Numbers are scoped by the same entitlement rules as the Maps and Schedules pages (BE/routes/dashboard.ts:8-13). ADMIN and MANAGER see every active map; others see own + public (`isPublic`) + explicitly shared; business-area grants do NOT reveal maps (map.service.ts:899-921).
- Deleted/inactive maps are excluded (`isActive=true`, map.service.ts:903,925).
- Executions count only maps visible to you but include other users' executions of them (dashboard.ts:31-39).
- No charts, no refresh button, no date filter; data refreshes on page load (react-query defaults; UNVERIFIED staleTime).
- Nothing on the dashboard is role-gated in the UI; VIEWER sees the same four cards (own schedules will normally be 0 if VIEWER cannot schedule — scheduling rules are in the Schedules fragment).

#### Maps list

Business rules (Maps list)
- ADMIN: everything on every map (`BE/services/map.service.ts:1253`).
- Owner: everything on own map (:1255).
- Public map: everyone VIEW+EXPORT only (:1259).
- MANAGER: VIEW/EXPORT/SCHEDULE on every map, EDIT and DELETE only own or via EDIT share (:1222,1260).
- Share levels: VIEW ⊂ EXPORT (+SCHEDULE) ⊂ EDIT (:1206-1216); EDIT share does not let you re-share (:1284-1285).
- Copy: anyone who can VIEW except role VIEWER; the copy is owned by the copier; running it still needs business-area grants (:1300-1311).
- Being listed is not data entitlement; run/export needs a business-area grant on each folder (`BE/routes/maps.ts:216-217`; business-area.service.ts:462).
- ADMIN default scope for `GET /api/maps` is all, others owned (`BE/routes/maps.ts:236`) but this page always requests both scopes.
- Delete is a soft delete, reversible only by an admin (FE text `admin:shared.deleteConfirmDescriptionSuffix`).


#### Runs

Business rules (Runs)
- Own runs only; ADMIN may list all (`BE/routes/map-runs.ts:163-192`). MANAGER sees only its own runs even though it sees all maps.
- Runs by other users are 404, not 403 (`BE/routes/map-runs.ts:92-118`).
- Live run result kept `MAP_RUN_LIVE_TTL_HOURS`, default 24 h (`BE/config.ts:256`, `BE/services/map-run.runner.ts:101,274-276`). Scheduled run result kept per schedule `resultRetentionDays`, default 30 days (`map-run.runner.ts:111,277-281`; `BE/services/scheduler.service.ts:55`). Failed runs keep 24 h (`map-run.runner.ts:109`). A Queued run without a claim has a 24 h placeholder expiry (`map-run.service.ts:62`).
- Same map + same conditions + same user reuses a still-valid live result unless forced (`map-run.service.ts:74-81`). One run at a time per user (FIFO queue, `BE/routes/map-runs.ts:325-329` comment).
- Runs execute under `assertDataEntitlement` (`BE/services/map-execution.service.ts:501`).
- Only ADMIN sees the SQL text of a run (`BE/routes/map-runs.ts:86`).


#### Exports

Business rules (Exports)
- Ownership is the primary gate: other users' jobs return 404 even for ADMIN (`BE/routes/export.ts:105-130`; no admin bypass there).
- Files are generated under the requester's row-level security context (`export.ts:106-111`).
- Job rows kept as history, files deleted after retention (`export.service.ts:580-610`).
- Status poll needs only map VIEW; download needs EXPORT (`export.ts:245-248,264`).


#### Schedules

Business rules (Schedules)
- Create: map SCHEDULE = ADMIN, owner, MANAGER, or EXPORT/EDIT share (`BE/services/map.service.ts:1206-1222,1249-1266`); public map or VIEW share is not enough.
- Own schedules only in the list; owner or ADMIN by id (`BE/routes/schedules.ts:157`).
- Valid cron (5 fields), valid timezone, validFrom < validUntil else 400 (`scheduler.service.ts:188-201`).
- Run now: only when active (409 "Cannot trigger a disabled schedule", `scheduler.service.ts:601-604`); manual runs may ignore the validity window (`:677-681`); scheduled runs always hit Oracle and get their own row (`map-run.service.ts:71-72`).
- Result retention default 30 days (`map-run.runner.ts:111`; schedule field `resultRetentionDays`), then rows expire and Export buttons disappear.
- Scheduled runs use the creator's identity for business-area entitlement and row-level security.
- Schedules migrated from Discoverer are imported disabled with a Planner decision (`schedule-import.service.ts:563-576`; memory note, UNVERIFIED in this pass beyond the planner fields).


#### Map builder

Business rules (builder)
- Every map needs at least one column to Save or Run (page.saveErrorNoColumns / runErrorNoColumns; BE map.service.ts:629 "A map must contain at least one item"). MapBuilderPage.tsx:183,220.
- One business area per map; items must belong to it (BE map.service.ts:212). Store enforces same (store:343-347).
- A column may appear once (duplicate refused) (store:340).
- Run always goes through the run queue (`map_runs`), so a Run shows on the Runs page ("Executions"), rows are loaded 500 at a time ("Load more"), and identical parameters by the same user on an unchanged map reuse a cached result (key includes map updatedAt and user; `force` bypasses) — FE hooks/useMapRun.ts:7,120-140; BE services/map-run.service.ts:64-92. Live results expire after 24 h (BE config.ts:256 MAP_RUN_LIVE_TTL_HOURS); row cap 100,000 (config.ts:258 MAP_RUN_MAX_ROWS); default query timeout 300 s, ceiling 1,800 s (config.ts:207-208).
- Excel/CSV/PDF export only re-uses a COMPLETED, unexpired run owned by the requester (or ADMIN): otherwise 409 `RUN_NOT_EXPORTABLE`; buttons only appear when such a run exists (ExecutionPanel.tsx:206,266; BE routes/export.ts:194-203). Export files kept 7 days (config.ts:239 EXPORT_RETENTION_DAYS).
- Conditional formats are saved immediately and separately from the map's Save, and need the map to exist first.
- Parameter prompt is skipped only when EVERY parameter has a non-empty default (MapBuilderPage.tsx:292-300).
- SQL/plan views: the generated SQL is stripped from responses for non-ADMIN (BE routes/map-execution.ts:216-222; map-runs.ts:86), so the "SQL" and "Plan" buttons only ever appear for ADMIN. `POST /api/maps/:id/explain` uses `fastify.authorizeAdmin` (BE routes/map-execution.ts:282-285; authorizeAdmin BE/plugins/auth.ts:136-150) — it returns the Oracle EXPLAIN PLAN for the map; 403 for non-ADMIN, and the FE button is only rendered when `result.sql` exists, i.e. ADMIN.
- DELETE of a map is not offered in the builder (only Maps list).
- Data gate D-gate: a user with map access but no business-area grant on a folder the map touches gets run status FAILED, error kind "Not entitled to run", message `You do not have access to the data in folder "<name>"` (BE map-execution.service.ts:501-509, business-area.service.ts:494-505). Row-level security default fail-closed (`ROW_LEVEL_FAIL_MODE=CLOSED`, config.ts:111): message `Refusing to run unfiltered: no row-level security policy resolves for you on folder(s) "<name>"` (security.service.ts:497-499); COMPLEX folder + policy => `Refusing to run: COMPLEX folder "<name>" is covered by row-level security policy ...` (security.service.ts:487-491). Both surface as red "Not entitled to run" banner.

**Refusals and errors a user can hit (`mapViewer:refusal.*`, amber "Request declined"-style box, ExecutionRefusal.tsx:33-56; preflight shows only FAN_TRAP_R1..R4 and REAGG)**
Each refusal shows a title, a "why", a "Folders involved: …" or "Joins involved: …" line, and a "what to change" line.
- NO_JOIN_PATH — "These folders are not connected, so the worksheet was not run" → remove columns from the unconnected folder or ask an administrator to define a join.
- JOIN_NO_PREDICATE — "A join in this worksheet has no join condition, so it was not run" → ask administrator to set the columns the join matches on; meanwhile use one folder.
- JOIN_BOTH_OUTER — "A join in this worksheet is set both ways at once, so it was not run" → administrator turns off one outer-join setting.
- FAN_TRAP_R1 — "These totals are measured against different things, so the worksheet was not run" → total from one set of detail rows or ask admin about join columns.
- FAN_TRAP_R2 — "These folders are joined in a circle, so the worksheet was not run" → use one of the two detail folders.
- FAN_TRAP_R3 — "This worksheet shows individual values from two sets of detail rows, so it was not run" → total instead of list, or show individual values from one set.
- FAN_TRAP_R4 — "This worksheet fans out from more than one folder, so it was not run" → split in two worksheets or remove columns reaching the second.
- FAN_TRAP_REAGG — "This kind of total cannot be worked out across a join, so the worksheet was not run" → use Sum, Count, Minimum or Maximum (Average/distinct/stddev/variance cannot be rebuilt).
- Toast for a refused run: title "Worksheet not run" (`page.runRefusedTitle`), body "The query planner declined this request. The results panel explains why." (not red). Refusal is HTTP 400 kind REFUSED (BE map-execution.ts:107-120).
- Red error banner title by kind (`execution.errorKind.*`): CONFIG "Configuration error", CONNECT "Connection error", TIMEOUT "Query timed out", QUERY "Query error", CANCELLED "Cancelled", FORBIDDEN "Not entitled to run", REFUSED "Request declined"; unknown => "Execution error". Under it the server text (generic per kind, BE map-execution.service.ts:657-666: "The map is not configured correctly and cannot be run.", "Could not connect to the data source.", "The query did not finish within the time limit.", "The query could not be completed.", "Execution was cancelled.", "You do not have access to this data."; FORBIDDEN keeps its specific message as above). HTTP status map BE map-execution.ts:86-93. Oracle ORA- text is never shown; replaced by `errors:execution.<kind>` sentences (FE lib/api.ts:91-96).
- Amber "N worksheet setting(s) could not be applied" box lists advisory warnings from the run (ExecutionPanel.tsx:379-393).
- Crosstab notes: "This crosstab has no column edge yet, so it is shown as a table. Discoverer does not record which columns went across the top — open a column and set its crosstab edge to "Across the top"." (`crosstab.noColumnEdge`); too big: "This crosstab would be {{rows}} x {{columns}}, over the {{max}} cell limit. Filter the report or group on fewer values." (`crosstab.tooLarge`).


#### Map viewer

Business rules (viewer)
- Viewing/running never modifies the map; no save step.
- Same-user, same-parameter, same-map-version run within its 24 h life is reused (statusLine says "Showing a cached result…"); "Run again" forces a fresh run (MapViewerPage.tsx:99-101; map-run.service.ts:78-82).
- Results/rows are private to the requester (ADMIN can open any run): `GET /api/runs/:id`, `/rows` return 404 for others; GET `/api/runs?all=true` is ADMIN-only (403 otherwise) (BE map-runs.ts:98-118,180-185).
- ADMIN-only extras: generated SQL text and Explain plan (see above); `sql` field on run DTO only for ADMIN (map-runs.ts:66-88).
- VIEWER is not blocked from running, viewing, exporting or (with rights) editing; its sole role-based restriction on maps is copying (`POST /api/maps/:id/duplicate` => 403 "A read-only VIEWER cannot copy maps", BE routes/maps.ts:396-433, map.service.ts:1305-1311). Not on these two pages (Copy is on the Maps list).
- Data access is always the second gate (D-gate). A viewer of a shared/public map without business-area grant on the folders sees the red "Not entitled to run" banner and the toast "Run failed".


#### Business Areas

Business rules:
- Deleting is a soft delete (deactivate) and only ADMIN can do it (`business-areas.ts:349-353`, `business-area.service.ts:135`).
- Grants are per user per area, only ADMIN creates or removes them (`business-areas.ts:443,529`); there is no grant on a whole role.
- Non-admin list contains only areas with any grant (`business-areas.ts:167-189`).
- Duplicate name on create returns 409 (declared `business-areas.ts:273`; UNVERIFIED whether the service enforces it, no check found in the route handler at `:276-291`).

#### Folders

Business rules:
- Folder is owned by one business area and can be shared into others (many-to-many like Discoverer BA_OBJ_LINKS); a grant on ANY of its areas entitles access (`middleware/business-area-auth.ts:97-127,188-199`).
- Shared-in folders are marked "Shared", cannot be refreshed from the row (button hidden) and are skipped by Refresh all: refresh from the owning area (`FoldersPage.tsx:259-261`, `folders.ts:211-212`).
- Refresh never deletes items: columns gone from the source are only listed ("item kept — delete it if no map uses it") (`admin.json:136`).
- All deletes deactivate (soft delete).
- In edit mode the "Items to create" list is not shown (`FoldersPage.tsx:477`); items are only created through the wizard at create time or via Items page.
- Folder list is cached per business area (`folders.ts:251-253`).

#### Items

Business rules:
- Delete = deactivate. An item cannot be moved between folders (`items.ts:391-393`).
- Item access is derived from the folder's areas (owning + shared) with any-of semantics (`business-area-auth.ts:129-136,194-199`).
- Item types CO/CI are not inverted any more: CO = database column item, CI = created (calculated) item (`ItemsPage.tsx:28-33`).

#### Joins

Business rules:
- No FULL join: INNER = neither side optional, LEFT = left kept without match, RIGHT = right kept without match; FULL is refused by API enum (`joins.ts:24`, `join.service.ts:32-39`, comment `JoinsPage.tsx:28-33`).
- Joins bind folders, with item pairs as predicates; every pair is ANDed (`JoinsPage.tsx:64,353-431`).
- Join access is derived from the LEFT folder's areas (`business-area-auth.ts:138-148`).
- Operators accepted by API: =, <, >, <=, >=, <> (`joins.ts:20`).

#### Hierarchies

Business rules (`hierarchy.service.ts:55-115`): at least one level ("At least one hierarchy level is required"); each level needs a name ("Each level must have a levelName") and an item; level numbers unique and start at 1; item must exist.
- Delete = deactivate.

#### Custom Functions

Business rules:
- Functions call `OWNER.PACKAGE.EXT_NAME` (+`@LINK`) with typed args and a data source (memory: custom-function-reference-fix; UI `functionReference()` `:35-39`).
- Refresh recompiles calculated fields only when something changed; functions missing in Oracle are kept (`admin.json:317,324`).
- Delete = deactivate.

#### Data Sources

Business rules:
- Delete = deactivate (`data-sources.ts:274-...`, toast "Data source deactivated").
- Introspection and function search are Oracle-only; other types return 400 "only supported for Oracle" (`folders.ts:711-714`, `custom-functions.ts:363-368`).
- Password is write-only from the UI: leaving it blank on edit keeps the current one.

#### Users

Business rules:
- Only ADMIN creates/edits/deletes/(de)activates users and issues credentials (BE users.ts:81 adminPreHandler; :84 adminManagerPreHandler only for GET list and GET /:id/maps).
- MANAGER: read list + per-user maps + tidy shares/ownership (CHANGELOG [2.0.0] Changed "A MANAGER can open the Users page (read-only)"; UsersPage.tsx:66).
- Cannot deactivate or delete own account (UI disabled: UsersPage.tsx:222, 243; API 400: users.ts:417-419, 470-472).
- Deactivated user is signed out on next request and cannot sign in (deactivateDialog text).
- Password min 8 chars (users.ts:28, 35).
- Email must be unique (409) (users.ts:367-370).
- New user default role USER (UsersPage.tsx:83; user.service.ts:107).
- Credentials file skips database-role accounts and inactive ones; gives a new password every click; the CSV is downloaded once, plus a server copy in CREDENTIALS_DIR (users.ts:152-158, 186-203).
- Map-owner change: ADMIN/MANAGER only; new owner may change, share and delete it (tooltip) (map-shares.ts:243-247).
- `via` precedence: ADMIN role > OWNER > SHARE > PUBLIC > ROLE ("Manager role") (users.ts:313-322).
- `GET /api/users/search` (share pickers) is open to any authenticated user (users.ts:89-126).

#### Security

Business rules:
- Policies are ADMIN-only end to end (BE security.ts:136; FE SecurityPage.tsx:407).
- Row-level security FAILS CLOSED: until a policy covers a folder, nobody (admins included) sees its rows (empty-state text `security:page.emptyMessage`; memory note ROW_LEVEL_FAIL_MODE default CLOSED — UNVERIFIED in code by this pass).
- A policy applies to each assigned user AND every user holding an assigned role (`security:assignments.description`).
- A policy needs >=1 rule; each rule = target (Business Area or Folder) + SQL predicate (SecurityPage.tsx:339-342, 509).
- Predicates are ANDed into WHERE of matching queries; binds `:current_user_id`, `:current_user_email`, `:current_user_role`; `{alias}` = the folder's query alias (SecurityPage.tsx:219-224).
- Assignment = exactly one of user or role (BE security.ts AssignBodySchema refine).
- Inactive policy is not applied (Active checkbox; SecurityPage.tsx:471-475) — enforcement code not read: UNVERIFIED.

#### Audit Log

Business rules:
- Audit APIs ADMIN-only (audit.ts:67, 73, 111, 175, 201).
- Page size 25 (AuditLogPage.tsx:27); date filters converted to ISO (AuditLogPage.tsx:88-89).
- Entity type and Action filters are exact match, case-sensitive (audit.service.ts:84-85).
- Reads are audited only for metadata prefixes; other GETs are not (plugins/audit.ts READ_AUDITED_PREFIXES).
- Credentials never stored in audit details (plugins/audit.ts SENSITIVE_KEY_SUBSTRINGS).

#### Migration

Business rules:
- Migration is ADMIN-only on the API (routes/migration.ts:84).
- Dry run is ON by default (MigrationPage.tsx:125); a live run needs it unticked and warns.
- Passwords are never sent from this page; the data source's stored credentials are used server-side (source.description).
- A migration cannot run against an already migrated target; use Re-import (`job.targetBlockedTitle`, MigrationPage.tsx:663).
- Re-import maps replaces every map in the "Migrated Workbooks" business area (edits lost); keeps users, folders, items, grants (reimportMapsHelp).
- Re-import everything: nothing deleted, map ids survive, schedules/shares kept; objects removed from EUL only reported (reimportAllHelp).
- Migrated user accounts cannot sign in until an admin sets a password — use Users > "Credentials file" (job.migratedAccountsNotice; users.ts:159).
- Migrations end by compiling calculated fields; the Compile button is a fallback (compileHelp).
- Buttons disabled while a job is RUNNING or no data source chosen, except Compile (MigrationPage.tsx:303-309, 447-449).
- Note: `busy` omits reimportAll/compile pending (MigrationPage.tsx:304-308) — minor, UNVERIFIED impact.

## 4. UI / backend mismatches

### 4.0 Cross-cutting
- No route guards: USER and VIEWER can open every `/admin/*` page by URL (FE/App.tsx:83-107).
- The sidebar shows Security, Audit Log and Migration to MANAGER (FE/components/layout/Sidebar.tsx:102,111,126) but their APIs are ADMIN-only (BE/routes/security.ts, audit.ts, migration.ts use adminPreHandler). A comment at Sidebar.tsx:88 says modeling is an administrator's job while the code includes MANAGER.
- The sidebar shows the Data Modeling pages to every MANAGER, but MANAGER has no grant bypass (BE/middleware/business-area-auth.ts:53), so without grants the lists are empty.
- VIEWER: the only UI and API block is Copy (MapsListPage.tsx:145, WorkbookBrowseSection.tsx:104, map.service.ts:1309). Builder, Run, Export and New Schedule stay enabled; map/share/grant rules alone decide.
- Write buttons on most admin pages are not role-gated; the API answers 403 and several delete mutations show no error toast.

### 4.1 Per page


#### Login

Mismatches
- Login errors from the server are shown as raw English strings even when the UI is pt-PT/fr-FR/es-ES (LoginPage.tsx:63-66 uses `data.error` first; only the fallback is i18n).
- `mustChangePassword` is returned by login (auth.ts:274) but the `/me` response JSON schema (auth.ts:400-411) omits it, so `/me` output is serialised without that field (UNVERIFIED at runtime; the FE does not call `/me` in the files read).

#### Change password

Mismatches
1. Wrong current password: BE returns 401 (auth.ts:499-500). `/auth/change-password` is NOT in the FE's self-handled list (`AUTH_SELF_HANDLED_PATHS` = login, refresh; FE/lib/api.ts:174), so the 401 interceptor tries a token refresh, retries once, gets 401 again, then calls `logout()` and hard-redirects to `/login` (api.ts:179-195). By code reading the user is signed out instead of seeing "Current password is incorrect". UNVERIFIED at runtime — verify before documenting; if confirmed, the manual should warn or the bug be fixed.
2. Toast/redirect: the toast comes from ChangePasswordPage but route is outside `Layout`; fine (Toaster assumed global) — UNVERIFIED that a Toaster is mounted at root.

#### Header + user menu

Mismatches
- Header.tsx uses `useAuthStore().logout` (Header.tsx:18,45), i.e. the store's local-only logout, NOT `useAuth().logout` which calls the API (useAuth.ts:32-40). By code reading, clicking "Log out" in the header only clears local state and does NOT call `/api/auth/logout`, so the token is not blacklisted and the refresh session stays alive in Redis until its TTL. UNVERIFIED at runtime; important for the manual's security wording (say "signs you out of this browser").

#### Settings

Mismatches
- Language dropdown and theme/palette swatches all change the live UI with `persist:false` (SettingsPage.tsx:97,127,180), so leaving the page without clicking Save leaves the browser showing the new choice (theme/locale also cached in localStorage) but the account still holds the old value; on next login/sync the account value wins (ThemeProvider.tsx:94-102; SettingsPage.tsx:44-58). Manual must say "click Save to keep it on every device". (Theme localStorage write at ThemeProvider.tsx:127 — line read in outline only; UNVERIFIED whether it happens before the persist branch.)

#### Dashboard

Mismatches
- Recent Maps rows link to `/maps/:id` (MapBuilderPage per App.tsx:100), not `/maps/:id/view`. A VIEWER/USER who owns nothing sees none, so mostly moot; but any role opening a map from the dashboard lands in the builder route (App.tsx:100-101). What the builder allows per role is covered in the Maps fragment.
- The empty-state copy for a user with zero own maps says "none are yours" even for VIEWER, who (per team fact) cannot copy maps — no create/copy hint offered here.

#### Dashboard

Mismatches: Login 2; Change password 2 (1 major: wrong-password 401 logs the user out); Header 1 (logout local-only); Settings 1; Dashboard 2; Sidebar 2 notes (Migration link for MANAGER, admin routes unguarded). Total listed = 10 (all by code reading, none runtime-verified).

#### Maps list

Mismatches (Maps list)
- Public map, non-owner, USER/VIEWER: backend allows EXPORT (`BE/services/map.service.ts:1259`), UI hides the Download shortcut because `canSchedule` is false (FE MapsListPage.tsx:143-144); export is still reachable from the viewer.
- "All" tab rows carry no `sharePermission`, so a USER with an EDIT share sees the Pencil and Schedule/Export icons only on the "Shared with me" tab (FE MapsListPage.tsx:132-136); API would allow.
- Share icon for MANAGER is shown on every map (UI:Y); backend `canManageShares` needs MANAGER to be able to VIEW, always true (map.service.ts:1293). No mismatch in practice.
- Pencil for MANAGER on others' maps: UI:N, API:403 (consistent).
- Workbook Share button hidden for USER/VIEWER, but a USER who owns a map can share it individually via the Share icon (per-map API allows owner).


#### Runs

Mismatches (Runs)
- Delete/Cancel/Open/Export on a run whose map you can no longer VIEW: row is hidden from the list; by id API returns 404 (`BE/routes/map-runs.ts:112-115`).
- Export buttons: shown for any Completed run regardless of role; API needs map EXPORT, so a share-VIEW user or VIEWER gets a failure toast (UI:Y / API:403). UI never checks the share level.
- ADMIN "all users" rows can be Run again'd: `requestRun` uses the admin as `userId` (BE/routes/map-runs.ts:150), so it creates the admin's own run, not the other user's.
- RUNNING rows: no UI button, but `DELETE /api/runs/:id` on a Running run tries to interrupt (202 cancelling) or 409 RUN_IN_PROGRESS (BE/routes/map-runs.ts:298-333).


#### Exports

Mismatches (Exports)
- Download icon is shown for every Completed row, including after the file has been purged (>7 days): API returns 404 file missing (`BE/routes/export.ts:277-279`).
- Description says "any time"; retention is 7 days by default.
- Download also fails with 403 if map access or EXPORT level was revoked since (`loadOwnJob` second check, export.ts:137-143).


#### Schedules

Mismatches (Schedules)
- Map dropdown (create): lists only own + shared maps (`listMine`). A MANAGER's right to schedule every map (API OK) is reachable only through the Maps list Calendar icon (`?mapId=`); ADMIN likewise. UI limit, API allows.
- Dropdown includes maps shared at VIEW level, but create then returns 403 (SCHEDULE needs EXPORT/EDIT share). UI:Y / API:403.
- ADMIN: API lets an admin edit/toggle/delete/trigger/read history of any schedule by id, but the page lists only the admin's own schedules (UI:own only / API:any by id).
- Edit/Toggle/Delete/History do not re-check map access (owner is enough); Run now does re-check SCHEDULE and returns 409 if the map is no longer accessible (`schedules.ts:143-171`).
- Cron firing does not re-check map access; only data entitlement applies when the run executes as the creator (`scheduler.service.ts:690-696`, `map-execution.service.ts:501`).
- Output Format offers XLSX and CSV only; history export offers XLSX/CSV/PDF.


#### Map builder

Mismatches (builder)
- UI:Y/API:403 — Save on existing map, Formatting Save/delete, Share level buttons, ✕, XML export, PDF/Excel/CSV (results panel) for any user lacking the required map right. No control is disabled/hidden for lack of EDIT/EXPORT (verified by absence of any gate in FE). The user only learns of it from a toast "Save failed"/"Export failed"/"Could not add rule"/"Could not share map" with message "Forbidden".
- Run tooltip says "Save the map and run it." — for a user with VIEW-only right on a map they have edited (dirty) the implicit save PUT is refused, so Run fails with "Run failed"/"Forbidden" although running unedited is allowed (MapBuilderPage.tsx:224-227).
- Public checkbox label says "visible to everyone in the business area"; code makes it visible/exportable to every authenticated user (BE map.service.ts:1257; listing :918). Data still needs D-gate.
- New map: business-area grants shown in the tree are ANY level (VIEW is enough to see and drag), but Save needs CREATE. A user with only VIEW/EXPORT on the area can compose everything and fails only at Save ("Save failed"/"Forbidden").
- Toolbar Export dropdown/tooltip says "Download the map's definition as XML"; the tooltip on the Export button is only about XML; data export is on the results panel (MapToolbar.tsx:116-121).
- FE `handleExport` still contains CSV/Excel branches (MapBuilderPage.tsx:334) but the toolbar can never call them (dead code).


#### Map viewer

Mismatches (viewer)
- Excel/CSV/PDF buttons visible to a user whose only right on the map is VIEW (share level VIEW) or who is a VIEWER role with a VIEW share: click => toast "Export failed" / "Forbidden" (BE export.ts:178 X-gate). MANAGER never hits this (MANAGER_ALLOWS includes EXPORT).
- "Schedule management" link is offered to everyone; per-map scheduling needs the SCHEDULE action (owner/ADMIN/MANAGER/EXPORT+EDIT share; not public, not VIEW share) — enforced on the Schedules page/API (not part of this fragment).
- Locale keys `viewer.executedTitle`, `viewer.rowsReturned`, `viewer.scheduleManagement` etc.: `executedTitle`/`rowsReturned` are defined but unused by MapViewerPage (grep in file) — no "Map executed" toast in the viewer. UNVERIFIED for other components.
- Note 403 vs 404 on stored runs: opening `?run=<id>` of someone else's run gives "Run not found" (404) not 403 (BE map-runs.ts:106-114).


#### 

Mismatches (common): none beyond per-page items. Note the brief mentioned search/sort/rows-per-page: the DataTable has none of them; only Custom Functions has its own filter box (below) and Folders' wizard has a table filter.

---

#### Business Areas

Mismatches:
- "New Business Area" and row "Delete": drawn for MANAGER/USER/VIEWER, API 403 (ADMIN only).
- "Add" and "Revoke" drawn for MANAGER, API 403 (ADMIN only). MANAGER can open the dialog and read grants (needs VIEW grant on that area).
- "Edit": drawn for everyone; works for ADMIN and for anyone with an EDIT-or-higher grant on that area (a MANAGER needs that grant too).
- Grant dialog user list: `GET /api/users` is ADMIN/MANAGER only; USER/VIEWER would see an empty checklist (page uses `retry:false`).

#### Folders

Mismatches:
- Every button is drawn for every role reaching the page; API answers by grant (levels in the column cells).
- Wizard: data source dropdown and Discover Tables are ADMIN/MANAGER only in the API (`data-sources.ts:76-80`, `folders.ts:735-739`); a USER/VIEWER holding a CREATE grant sees an empty data-source dropdown and Discover Tables returns 403 (custom-SQL folders don't need them).
- Introspect and Import-from-data-source are not on this page (they live on Data Sources).
- Custom SQL field also appears for DERIVED but the backend only validates COMPLEX (`folder.service.ts:120-122`); UNVERIFIED what a DERIVED folder does with the text.

#### Items

Mismatches:
- All buttons drawn for all roles; API needs the grant level shown.
- Delete failure has no error toast (deleteMutation has only onSuccess): a 403 shows nothing (`ItemsPage.tsx:129-135`). Same for joins/hierarchies/custom functions/data sources/folders delete (no onError).

#### Joins

Mismatches:
- All buttons drawn for all roles; API by grant.
- Save errors from the server, e.g. `Left item "…" does not exist or is inactive` / `does not belong to folder "…"` (`join.service.ts:139-162`), `Left folder "…" does not exist or is inactive` (`:186`) show in the "Save failed" toast.

#### Hierarchies

Mismatches:
- All buttons drawn for all roles; API by grant.
- Folder dropdown lists shared-in folders, but the server only accepts items whose folder is OWNED by the hierarchy's area: `Item referenced by level "…" does not belong to the target business area` (`hierarchy.service.ts:100-113`). Items of a shared-in folder therefore fail on Save (code-verified; not run).

#### Custom Functions

Mismatches:
- USER/VIEWER can open the page and SEE the list (list API is any authenticated user, `custom-functions.ts:119-123`) but every write, refresh and search is 403. Sidebar hides it from them.
- Data Source column shows "—" for USER/VIEWER because the data-source list is 403 for them (`CustomFunctionsPage.tsx:114-121,254`).
- Search block appears only for Oracle data sources (`:385`); Postgres data sources show only manual fields.

#### Data Sources

Mismatches:
- MANAGER: sees and can open New/Edit/Delete/Import; API is ADMIN only for create, update, delete and import (403). MANAGER CAN test connection, introspect, and discover tables (ADMIN/MANAGER).
- USER/VIEWER by URL: list is 403 (page shows "No data sources yet." and no rows); the "New Data Source" button is still drawn.
- Delete has no error toast (no onError): a 403 delete fails silently (`DataSourcesPage.tsx:122-129`).
- Introspect result is only a toast (count); nothing is stored/shown on the page.

#### Users

Mismatches:
- Delete dialog wording says "This will deactivate ..." but backend hard-deletes (UsersPage.tsx:349-358 vs services/user.service.ts:178-181). Manual must say Delete is permanent; "Deactivate" is the reversible option.
- No "force change password" control exists on this page. The only path that sets must-change-password is "Credentials file" (services/user.service.ts:163-166) and migration-created accounts. Admin Edit -> Password does not set the flag (user.service.ts:118-127). Forced user is redirected to `/change-password` (FE/components/auth/ProtectedRoute.tsx:27).
- In the map dialog a MANAGER sees share dropdown/X for every map row, but API allows only if MANAGER owns the map or (MANAGER and can VIEW it) — MANAGER sees all maps so effectively Y (map.service.ts:1291-1293). Changing owner: ADMIN/MANAGER only (map-shares.ts:243).
- The owner picker lists all active users including VIEWER; UNVERIFIED whether backend rejects a VIEWER as owner (transferOwnership not read).

#### Security

Mismatches:
- MANAGER: sidebar link shown (UI:Y) but page is a dead end with message and every API call 403 (BE security.ts:136).
- Assignment "User" list loads GET /api/users (ADMIN+MANAGER allowed) — no conflict.

#### Audit Log

Mismatches:
- MANAGER sees the sidebar link (Sidebar.tsx:102 canModel) but every audit API call returns 403 (audit.ts:67); the page has no non-admin message, so it appears empty (UI:Y/API:403).
- Export is only the current page (max 25 rows), not the whole log (label says "this page").

#### Migration

Mismatches:
- Sidebar shows "Migration" to MANAGER (Sidebar.tsx:102,126 canModel) but every migration action is ADMIN-only (BE migration.ts:84) -> 403 toast ("Detection failed", "Analysis failed", "Could not start"). Sidebar comment (Sidebar.tsx:53-56 "an administrator's job") disagrees with its gate.
- The Oracle-source dropdown loads for MANAGER (data-sources GET allows ADMIN+MANAGER) so a MANAGER sees a working-looking form. USER/VIEWER get 403 on that list.
- No non-admin message on this page (no isAdmin/role check in MigrationPage.tsx).

## 5. Screenshot plan

Numbering is per page (1., 2., ... under each page heading). Use one account per role (ADMIN, MANAGER, USER, VIEWER); where a screen is identical across roles one capture is enough. Login and pre-login screens use the default language (pt-PT unless localStorage `discoverer-neo-locale` says otherwise, FE/i18n/index.ts:15), so set English in Settings first for English manuals.


#### Login

Screenshot plan
1. `/login` blank, default (all roles identical). Show Remember me ticked.
2. `/login` with empty submit -> three inline validation errors.
3. `/login` after wrong password -> red "Invalid email or password" banner.
4. `/login` after session expiry (open any page with an expired refresh) -> grey "Your session has expired…" banner.
5. (Optional) locked account -> "Too many login attempts. Try again later." banner.

---

#### Change password

Screenshot plan
1. `/change-password` forced mode (log in as a migrated user with temporary password): label "Temporary password" + forced description.
2. `/change-password` voluntary mode (signed-in normal user types URL): label "Current password".
3. Validation errors: short password / mismatch.
4. Success toast "Password changed" (optional).

---

#### Header + user menu

Screenshot plan (header/sidebar)
1. `/dashboard` as ADMIN: full sidebar with Data Modeling + Migration.
2. `/dashboard` as MANAGER: identical to ADMIN (highlight Migration link that 403s).
3. `/dashboard` as USER and as VIEWER: sidebar WITHOUT Data Modeling and WITHOUT Migration (identical to each other).
4. User menu open (any role): My Account / e-mail / Settings / Log out.
5. Mobile width (375px): header with hamburger, drawer open.

---

#### Settings

Screenshot plan
1. `/settings` default (Light + Classic/Navy) as USER: three cards + Save.
2. Language dropdown open showing the four options.
3. `/settings` with High contrast selected: palette card greyed with the explanatory text.
4. Toast "Preferences saved" after Save.
5. Dark theme applied (shows swatch previews). Looks identical for all roles; no role-specific capture needed.

---

#### Dashboard

Screenshot plan
1. `/dashboard` as ADMIN (large Total Maps, breakdown "N yours, M shared with you").
2. `/dashboard` as USER with a few own maps + shared maps (Recent Maps filled).
3. `/dashboard` as VIEWER with zero own maps: Recent Maps empty message "…none are yours."
4. MANAGER capture optional — numbers equal ADMIN's Total Maps; note it differs from USER.

---

#### Maps list

Screenshot plan (Maps list)
1. `/maps` as USER with own maps: Mine tab, all row icons (Eye, Pencil, Copy, Share, Calendar, Download, Trash).
2. `/maps` as USER, "Shared with me" tab: row with EDIT share shows Pencil, no Trash, no Share.
3. `/maps` as MANAGER, "All" tab: every map, Copy+Share+Calendar+Download on all rows, Pencil/Trash only on own; Owner column filled.
4. `/maps` as ADMIN: Trash/Pencil on every row; Workbooks section with Share icon.
5. `/maps` as VIEWER: no Copy icon, no workbook Copy icon; compare with USER.
6. Share map dialog open (USER or MANAGER): user list, "Can view / Can export / Can edit", ✕, hint line; and a public map showing the notice + Copy link.
7. Workbook share dialog (MANAGER): "n of m worksheets" detail.
8. Copy workbook dialog; delete confirm dialogs (map and workbook).
9. Empty Mine tab message for a user owning nothing (auto-opens All).

---

#### Runs

Screenshot plan (Runs)
1. `/runs` as USER with mixed statuses: Completed row (XLSX/CSV/PDF buttons, Expires in "23h"), Queued row (Cancel), Failed row (Delete).
2. `/runs` as ADMIN with "Show every user's runs" ticked; same page as USER without it (checkbox missing).
3. Filters open: Status and Kind select lists.
4. Delete confirm dialog.
5. Expired row ("Expired", no export buttons).

---

#### Exports

Screenshot plan (Exports)
1. `/exports` as USER with one Completed, one Running, one Failed export (error tooltip on hover).
2. Same page as ADMIN (shows only admin's own jobs, no owner column).
3. Empty state "No exports yet."

---

#### Schedules

Screenshot plan (Schedules)
1. `/schedules` as USER with 2 schedules: Active and Paused rows, Planner column, five action icons.
2. `/schedules?mapId=<id>` from the Maps list Calendar icon: New Schedule dialog with map preselected and Back button.
3. New Schedule dialog with Frequency select open (4 presets) and again with Custom (cron field + help).
4. Output Format select open ("Excel (.xlsx)" / "CSV").
5. Timezone select open.
6. Execution History dialog with a SUCCESS row (XLSX/CSV/PDF buttons, "Expires 29d") and a FAILED row.
7. MANAGER creating a schedule for someone else's map via the Maps list Calendar icon (shows the map appended to the dropdown).
8. Delete schedule dialog.

#### Map builder

Screenshot plan (builder)
1. `/maps/new` empty, USER with a CREATE grant: toolbar, empty tree, empty canvas hints, right panel Properties. Same for any role (identical).
2. `/maps/new` after dragging first column (business area now fixed) then dragging a column of another area: "Different business area" toast.
3. `/maps/<id>` (owner) with several columns, "● Unsaved" visible after a rename.
4. Configure column dialog showing Aggregation list open and Placement/Crosstab edge.
5. Right panel tabs: Conditions with an AND/OR group; Sort; Parameters with preview; Calculated Fields and Formula editor with function chips.
6. Parameter prompt dialog with required error.
7. Run in progress then results panel with row/time badges, Excel/CSV/PDF buttons; ADMIN additionally shows "SQL" and "Plan" buttons (capture ADMIN vs USER side by side — only visible difference in results header).
8. PDF export dialog (all options).
9. A refusal banner (e.g. FAN_TRAP_R1) in the preflight position above the canvas and in the results panel.
10. Share dialog as owner (levels + public banner); Formatting dialog with a rule.
11. Failure state for a USER with only VIEW share who edits and presses Save: toast "Save failed" / "Forbidden" (proves UI is not read-only).
12. "Not entitled to run" red banner for a user without business-area grant on a folder.

---

#### Map viewer

Screenshot plan (viewer)
1. `/maps/<id>/view` before any run: heading, description, Run button, empty results "Run the map to see results.".
2. Same page, parameter prompt dialog open with a required error.
3. Running / queued state with "Cancel" button visible (queued only) and status line.
4. Completed run: status line "Result from … valid until …", "Run again", badges, Excel/CSV/PDF buttons; ADMIN vs USER comparison (ADMIN shows SQL + Plan buttons).
5. Grid with sort arrows, filter boxes, group-break badge, subtotals, grand total, conditional colour.
6. Drill to Detail dialog after double-clicking a row.
7. "Not all rows are loaded." + "Load more".
8. Refusal banner (e.g. FAN_TRAP_R1) and red "Not entitled to run" banner (user without business-area grant).
9. "Map not found / Forbidden" card for a user with no access to the map (USER on someone else's private map).
10. Map with dropped-filters `<details>` expanded (migrated map).
11. Crosstab fallback note vs real crosstab.

---

#### Business Areas

Screenshot plan:
1. `/admin/business-areas` as ADMIN, table with rows and the "New Business Area" button.
2. Same, New Business Area dialog (Name + Description).
3. Same, Grants dialog with a few users ticked and Permission select open showing the six levels.
4. Grants dialog with Permission = CREATE selected so the level note is visible (repeat with VIEW to show the difference).
5. As MANAGER with a VIEW grant on one area: `/admin/business-areas` shows only that area; click "New Business Area", save, capture the error toast (403). Differs for MANAGER/USER/VIEWER vs ADMIN.
6. As USER (URL typed): page renders with only granted areas (or the "No business areas yet." message).

---

#### Folders

Screenshot plan:
1. `/admin/folders` no area selected (prompt text, disabled "New Folder"/"Refresh all") as ADMIN.
2. Area selected, table with a "Shared" badge row and row icons (tooltips: Refresh from data source, Manage business areas, Edit, Delete).
3. New Folder wizard, type TABLE, data source chosen, after "Discover Tables": filter box, list, then a picked table with the "Items to create (n)" checklist and Select all/Clear.
4. Wizard with type COMPLEX showing the "Custom SQL" textarea.
5. "Refresh results" panel after "Refresh all".
6. Sharing dialog: owner badge, a share badge with X, "Share into" select open, "Share" button.
7. As MANAGER (VIEW-only grant): click Edit then Save, capture 403 toast. As USER: open New Folder, empty data source dropdown.

---

#### Items

Screenshot plan:
1. `/admin/items` with area + folder chosen, table with Type/Column/Data Type/Aggregation.
2. New Item dialog with type "Database Item (CO)" (Column Name visible).
3. Same dialog with type "Calculated Item (CU)" (Formula visible) and the Aggregation select open.
4. Item Type dropdown open showing the seven labels.
5. As MANAGER/USER with VIEW only: try Save, capture the "Save failed" toast.

---

#### Joins

Screenshot plan:
1. `/admin/joins` area chosen, table showing a multi-pair join ("a = b AND c = d").
2. New Join dialog with two folders chosen and "Suggest Joins" result list.
3. Same dialog with two column pairs and the Operator select open (six operators).
4. Join Type select open (INNER, LEFT, RIGHT).
5. Roles: same as other pages; capture 403 "Save failed" for a VIEW-only user.

---

#### Hierarchies

Screenshot plan:
1. `/admin/hierarchies` table with "n level(s)".
2. New Hierarchy dialog with 3 levels (drag handle, name, folder, item selects).
3. Empty dialog showing "No levels yet — add at least one." and the disabled Save.
4. Roles: VIEW-only MANAGER opens Edit (works) then Save (403 "Save failed").

---

#### Custom Functions

Screenshot plan:
1. `/admin/custom-functions` with rows, "Refresh all", filter box.
2. "Refresh results" panel after Refresh all.
3. New Custom Function dialog, Oracle data source chosen, search results listed (including a disabled "Cannot be called from SQL" row).
4. Dialog after picking a result: Owner/Package/Function name filled, Parameters JSON filled.
5. As USER by URL: list visible, click "New Function" then Save -> error toast.

---

#### Data Sources

Screenshot plan:
1. `/admin/data-sources` ADMIN table with the five row icons (hover tooltips: Test connection, Introspect schema, Import tables, Edit, Delete) and the result banner after Test connection.
2. New Data Source dialog: Connection Type = Oracle (Service Name + SID visible), then PostgreSQL (those two hidden).
3. Edit dialog showing the "(leave blank to keep)" hint on Password.
4. Import Tables dialog after Discover Tables with a few ticked and the "Import n table(s)" button.
5. As MANAGER: same page, click Save on Edit -> "Save failed" toast (403). As USER: page with empty table.

#### Users

Screenshot plan:
1. `/admin/users` as ADMIN: table with toolbar "Credentials file" + "New User", row icons (maps, edit, deactivate, delete). Differs for MANAGER (no toolbar/row icons except maps) and USER/VIEWER (only the "Only administrators can manage users." message).
2. `/admin/users` -> New User dialog with Role select open and the four role descriptions visible (ADMIN).
3. Edit User dialog showing "(leave blank to keep current)" (ADMIN).
4. Deactivate confirmation dialog (ADMIN); also own row with disabled icons + tooltip.
5. Delete confirmation dialog (ADMIN), showing wording.
6. Map dialog "Maps for <name>": rows with owner line, badge variants, share-level select, owner and X icons (ADMIN and MANAGER identical).
7. Map dialog with "New owner" picker expanded (ADMIN/MANAGER).
8. `/admin/users` as MANAGER (read-only view) and as USER (message).

---------------------------------------------------------------------------------------------------

#### Security

Screenshot plan:
1. `/admin/security` as ADMIN, empty state text (fail-closed message) and populated table.
2. New Policy dialog with one Business Area rule, "Validate" success showing "Valid predicate" and Binds help.
3. Rule "Applies to" select open showing Business Area / Folder.
4. Assignments dialog: "Assign to" = Role with roles list; and "Not assigned" state.
5. Test a policy dialog with result.
6. `/admin/security` as MANAGER (message only) — same for USER/VIEWER.

---------------------------------------------------------------------------------------------------

#### Audit Log

Screenshot plan:
1. `/admin/audit` as ADMIN, top: 3 stat cards + chart; scroll: filters + table + pagination.
2. Filters row with a filter set and the "Clear" button visible.
3. "Audit entry details" dialog (JSON).
4. Export CSV button hover tooltip.
5. `/admin/audit` as MANAGER: empty frame (403) — decide whether to show in manuals; USER/VIEWER only reach it by URL.

---------------------------------------------------------------------------------------------------

#### Migration

Screenshot plan:
1. `/admin/migration` as ADMIN: Source card with data source selected, all buttons (Detect version, Analyze, Dry run checkbox, Run dry run, Re-import maps, Re-import everything, Compile calculated fields) and help text.
2. Same with Dry run unticked: "Run migration" label + live warning.
3. EUL version select open (Auto-detect / Force EUL4 / Force EUL5).
4. After Analyze: Assessment card.
5. After a dry run: job card with progress, rows table, summary, log.
6. Same page as MANAGER (dropdown works, click Detect -> 403 toast) — optional; USER/VIEWER: not reachable from UI.
