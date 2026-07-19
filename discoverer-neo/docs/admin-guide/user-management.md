# User Management

Learn how to create users, assign roles, and manage business area permissions.

## User Roles

Discoverer Neo has four user roles with different capabilities:

| Role | Capabilities |
|------|-------------|
| **ADMIN** | Full system access — users, business areas, data sources, audit logs |
| **MANAGER** | Create and manage business areas, grant permissions to other users |
| **USER** | Create maps, execute queries, share maps with colleagues |
| **VIEWER** | Read-only access to shared maps and dashboards |

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
3. Click **+ Grant Permission**
4. Select:
   - **User** — From dropdown
   - **Permission Level** — CREATE, EDIT, DELETE, EXPORT, SCHEDULE, or VIEW
5. Click **Grant**

**Permission Levels in Business Area:**

| Permission | Maps | Metadata | Schedule | Export |
|-----------|------|----------|----------|--------|
| **CREATE** | Create new maps | ✗ | ✗ | ✗ |
| **EDIT** | Modify maps | ✗ | ✗ | ✗ |
| **DELETE** | Delete maps | ✗ | ✗ | ✗ |
| **EXPORT** | Export results | ✓ | ✗ | ✓ |
| **SCHEDULE** | Create schedules | ✓ | ✗ | ✓ |
| **VIEW** | Run/view maps | ✓ | ✓ | ✗ |

### Granting Multiple Permissions

Users typically need multiple permissions:

- **Data Users:** VIEW + EXPORT (can run maps and download)
- **Report Builders:** VIEW + CREATE + EDIT (can build and test)
- **Publishers:** CREATE + EDIT + EXPORT + SCHEDULE (full map lifecycle)

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

## Password Management

### Initial Passwords

New users receive initial passwords. Best practice:

1. Set temporary password (e.g., "TempPassword123!")
2. Instruct user to change on first login
3. User logs in, clicks **Profile** → **Change Password**
4. Enters new password

### Password Reset

If user forgets password (as admin):

1. Admin Panel → **Users**
2. Click user → **Reset Password**
3. System generates temporary password
4. Send to user (via email or out-of-band)
5. User changes password on first login

### Force Password Change

To require user password change:

1. Click user → **Edit**
2. Check **Force Password Change on Login**
3. Save

User will be prompted to change password next login.

## User Status

### Active/Inactive

Toggle user status:

- **Active** — User can log in
- **Inactive** — User cannot log in (soft delete)

Useful for temporary disabling without deleting accounts.

### Locked Account

No manual account lock in current version. Users can retry password indefinitely.

To prevent login:
- Set **Inactive** (preferred)
- Or delete user account

## Delegation

Managers can delegate user creation and permission management:

1. Promote users to **MANAGER** role
2. Managers can then:
   - Create users
   - Grant permissions in their business areas
   - Manage other users' access

Managers cannot:
- Create other managers or admins
- Access system settings or audit logs
- Manage data sources

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
- Team leads → **MANAGER** role (if managing business areas)
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
