# User Management

Learn how to create users, assign roles, and manage business area permissions.

## User Roles

Discoverer Neo has four user roles with different capabilities:

| Role | Capabilities |
|------|-------------|
| **ADMIN** | Full system access — users, business areas, data sources, audit logs. Opens, changes, shares and deletes every map. |
| **MANAGER** | Opens, runs, exports, schedules and shares **every** map, and can change a map's owner. Changes only their own maps. Manages custom functions; views and tests data sources. Cannot change the data model (business areas, folders, items, joins, hierarchies), even with a grant. |
| **USER** | Sees only their own maps and the maps shared with them. Builds a new map by copying one of those. |
| **VIEWER** | Read-only. Opens and runs the maps shared with them. Cannot create, copy or change maps. |

The Users page shows these rules under the **Role** field when you edit a
user. A MANAGER can open the Users page to see each user's maps, and there
change a share's level, remove a share, or give a map to a new owner. Only an
ADMIN can create, change or delete users.

Anyone except a VIEWER can copy a map they can see. The copy belongs to them.
Running it still needs a grant on its business area (see "two gates" below).

## Creating Users

### Add Single User

1. Admin Panel → **Users**
2. Click **+ Create User**
3. Enter:
   - **Email** — Unique email address (login identifier)
   - **Name** — Full name or display name
   - **Password** — Initial password (user should change on first login)
   - **Role** — ADMIN, MANAGER, USER, or VIEWER
4. Click **Create**

User receives notification to log in (if email configured).

### Bulk Import

For migrating many users from Oracle Discoverer:

1. Export user list as CSV:
   ```
   email,name,role
   john@example.com,John Smith,USER
   jane@example.com,Jane Doe,MANAGER
   ```

2. Use migration tool or API to bulk create

3. Send welcome email with temporary passwords

## Assigning Roles

### Change User Role

1. Admin Panel → **Users**
2. Click user → **Edit**
3. Change **Role** dropdown
4. Click **Save**

Role change takes effect immediately.

## Business Area Permissions

After users exist, grant them access to specific business areas.

### Grant Permission

1. Admin Panel → **Business Areas**
2. Select business area → **Manage Access**
3. Tick one or more users in the list. Type in the filter box to find them.
4. Choose the **Permission** level. The box under it says what that level
   allows.
5. Click **Add**. Every ticked user gets that level.

### Permission Levels

The levels form a ladder. Each level includes every level above it in the
table. No level shows other people's maps — only a share (or the MANAGER
role) does that.

| Level | What it adds |
|-------|--------------|
| **VIEW** | Read the data in the area's folders. See the area's folders, items, joins and hierarchies. Run maps you own, maps shared with you, and public maps. |
| **EXPORT** | Same as VIEW today (see note 2). |
| **SCHEDULE** | Same as VIEW today (see note 2). |
| **CREATE** | Create new maps, folders, items, joins and hierarchies in the area. |
| **EDIT** | Change the area and its folders, items, joins and hierarchies. |
| **DELETE** | Delete folders, items, joins and hierarchies in the area. |

ADMIN users skip all of these checks.

**Note 1 — two gates.** To run a map, a user must pass two checks:

1. **May I see this map?** Yes if you are an ADMIN or a MANAGER, you own it,
   it is public, or it is shared with you.
2. **May I read its data?** Yes if you hold **any** level in the business area
   of every folder the map uses.

So a map shared with a user still fails if the user has no grant on the
area its data comes from.

**Note 2 — VIEW, EXPORT and SCHEDULE act the same on maps.** None of the
three lets a user see other people's maps. On a shared map, the **share**
decides what the user may do: a VIEW share lets them run it; an EXPORT share
adds export and schedule; an EDIT share adds changes. See
[Sharing](../user-guide/sharing.md).

### Which Level to Grant

Grant **one** level per user per business area — the highest one they need.
It already includes the levels below it. Do not add lower levels on top.

| The user must… | Grant |
|----------------|-------|
| Run maps that others share with them, or copy them | VIEW |
| Build new maps from scratch | CREATE |
| Maintain the area's folders, items and joins | EDIT |
| Also remove them | DELETE |

### Revoke Permission

1. Click business area → **Manage Access**
2. Find user in permission list
3. Click **Remove**
4. Confirm

User loses access immediately.

### Change Permission Level

1. Click business area → **Manage Access**
2. Find user
3. Click permission dropdown
4. Select new level
5. Change takes effect immediately

## Database Roles

Users imported from Oracle Discoverer are not all people. Discoverer grants
privileges to Oracle **roles** (`CONNECT`, `RESOURCE`, a reporting role) as
readily as to individuals, and the migration brings both across.

A role appears in the Users list with a **Role** badge and behaves differently:

| | Person | Database role |
| --- | --- | --- |
| Can sign in | Yes | **No — ever** |
| Holds business-area grants | Yes | Yes |
| Has a password | Yes | None. No password can match it. |

Roles are kept because they carry the grants your Discoverer security was built
on. They cannot be turned into logins — assign real users the equivalent
permissions instead, then retire the role.

## Password Management

### Imported users and temporary passwords

Discoverer stores usernames but never passwords, so nothing can be carried
across. Instead, a migration **generates a unique temporary password for every
imported person** and writes them all to a file for you to distribute.

1. Run the migration (see [Migrating users and passwords](../migration/user-credentials.md)).
2. Collect `credentials/credentials-<run-id>.csv` from the server host.
3. Give each person their own password over a channel you trust.
4. **Delete the file.** Nothing deletes it for you.

Each account must change that password before it can do anything else — this is
enforced by the server, not merely suggested by the interface.

### Creating a user by hand

When you add a user through Admin Panel → **Users**, you set their first
password directly. Tell them to change it after signing in, from
**Settings → Change Password**.

### What "must change password" means

While an account is waiting to change its password, it can reach only the
change-password screen. Every other page and API call is refused. Signing in
succeeds, but the application is unavailable until the password is rotated.

You can see who is still pending in the Users list.

### Password Reset

If user forgets password (as admin):

1. Admin Panel → **Users**
2. Click user → **Reset Password**
3. System generates temporary password
4. Send to user (via email or out-of-band)
5. User changes password on first login

### Requiring a password change

Accounts created by a migration are flagged automatically — you do not need to
do anything. There is no manual checkbox: the flag is set when an account is
provisioned with a temporary password and cleared the moment the user chooses
their own.

To force a rotation on an existing account, reset its password; the reset puts
the account back into the same "must change" state.

User will be prompted to change password next login.

### Re-provisioning at cutover

Query who still needs what — do not assume a fixed headcount, it drifts as
people complete first login:

```sql
-- Real people needing a brand-new credential (never re-provisioned):
SELECT count(*) FROM users WHERE password_hash = '!migrated-no-login' AND is_role = false;
-- Real people who already have a credential, just haven't logged in yet:
SELECT count(*) FROM users WHERE must_change_password = true AND password_hash != '!migrated-no-login';
```

Role and service accounts (`is_role = true`, plus the migration service
account) are deliberately never re-provisioned — they carry the
`!migrated-no-login` sentinel forever by design. Full procedure and a real
rehearsal of this flow: [`docs/deployment/cutover-runbook.md`](../deployment/cutover-runbook.md#step-6--re-provision-credentials).

## User Preferences

Users can manage their own interface preferences without administrator involvement:

- **Language** — Users select their preferred UI language (English, Português, Français, Español) in Settings
- **Theme** — Users choose their preferred visual theme (Light, Dark, High-Contrast) in Settings

These preferences are self-service and per-user. Each user can access Settings via the sidebar or profile dropdown to customize their experience. No administrator configuration is needed.

## User Status

### Active/Inactive

On the Users screen, the **Status** column shows each account as Active or Inactive.

1. Open **Users** in the admin sidebar.
2. To deactivate a user, click the **Deactivate** button (person with a cross) in their row, then click **Deactivate** in the confirmation dialog.
3. To activate an inactive user, click the **Activate** button (person with a tick) in their row. No confirmation is asked.

You cannot deactivate your own account; its button is disabled.

You can also set `isActive` through the API:

```bash
curl -X PUT http://localhost:3000/api/users/<user-id> \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

- **Active** (default) — User can log in
- **Inactive** — User cannot log in or refresh a session (soft delete)

Useful for temporary disabling without deleting accounts.

**Deprovisioning takes effect immediately.** Existence, active status and role
are read from the database on every request and every token refresh — never
from the token. A user you deactivate or delete is refused on their very next
request, and a user you demote is held to the new role on their very next
request. You do not have to wait for their token to expire.

### Locked Account

Failed logins lock an account for a short time. With the default settings:

- **5 failed logins** to one account within 15 minutes lock that account for
  **15 minutes**. Login returns `429 Too Many Requests` until the lock ends.
- **100 failed logins** from one IP address within 15 minutes block that
  address until the 15 minutes end, for every account.
- A successful login clears the account's failure count.
- An address that logged in to the account successfully in the last 30 days
  can still log in while the account is locked. So an attacker cannot keep
  the real user out by failing logins on purpose. That address is still held
  to the per-address limit.
- Each lock writes an `auth.lockout` event to the audit log.

A lock ends by itself; there is no manual unlock. The limits are set in
[Configuration](../deployment/configuration.md#login-rate-limiting).

To prevent login:
- Set **Inactive** (preferred)
- Or delete user account

## Delegation

Give the **MANAGER** role to someone who looks after other people's maps.
A MANAGER can:
- See, run, export, schedule and share every map
- Give a map to a new owner, change or remove its shares (Users → map icon)
- Manage custom functions, and view and test data sources

A MANAGER cannot:
- Create, change or delete users, or grant business-area access
- Change the data model: business areas, folders, items, joins, hierarchies
- Open Security, Audit Log or Migration

## Audit Trail

Track user actions in **Audit Log**:

1. Admin Panel → **Audit Log**
2. Filter by:
   - Date range
   - User
   - Action (CREATE, UPDATE, DELETE, EXECUTE)
   - Entity type (USER, MAP, BUSINESS_AREA, etc.)

User creation/modification events are logged.

## Best Practices

### Naming Conventions

Use consistent email addressing:
- ✓ firstname.lastname@example.com
- ✓ email from directory service (LDAP, Active Directory)
- ✗ Numeric IDs (hard to identify)

### Default Roles

Assign the minimum necessary role:

- Most users → **USER** role (not MANAGER or ADMIN)
- Report builders → **USER** role
- Team leads → **MANAGER** role (if looking after the team's maps)
- Only 1–2 → **ADMIN** role

### Regular Audits

Periodically review:
- User permissions (remove inactive users)
- Business area access (revoke unnecessary grants)
- Admin accounts (ensure only necessary)

### Onboarding Checklist

1. ✓ Create user account
2. ✓ Assign appropriate role
3. ✓ Grant business area permissions
4. ✓ Send welcome email with login instructions
5. ✓ Schedule walkthrough for new users

### Offboarding Checklist

1. ✓ Identify maps user owns
2. ✓ Transfer ownership or archive maps
3. ✓ Revoke business area permissions
4. ✓ Set user **Inactive** (or delete)
5. ✓ Log audit event

## Directory Integration (Future)

Future versions may support LDAP/Active Directory:
- Users auto-provisioned from directory
- Roles/permissions sync from directory groups
- SSO login support

## What's Next?

- **[Security Policies](security.md)** — Define row-level security for users
- **[Audit Logging](audit-logging.md)** — Review user activities
- **[Business Area Management](metadata-management.md)** — Organize content

---

**See Also:** [Admin Guide](../admin-guide/), [API Reference - Users](../api/endpoints.md#users)
