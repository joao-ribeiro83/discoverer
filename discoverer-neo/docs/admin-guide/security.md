# Security Policies

Learn how to define row-level security (RLS) policies that filter data by user or role.

## What is Row-Level Security?

**Row-Level Security (RLS)** automatically filters query results based on user context, without requiring changes to maps or queries.

**Example:** A sales region manager sees only their region's data, even though all regions are in the same table.

## How RLS Works

1. **A policy holds rules.** Each rule targets a **business area** or a
   **folder** and carries a SQL predicate — a WHERE-clause fragment such as
   `REGION = 'EMEA'` or `{alias}."SALES_REP_ID" = :current_user_id`.
2. **A policy is assigned** to users, to roles, or to both.
3. **When a query runs,** Neo finds every folder whose rows can reach the
   result: the map's items and conditions, the folders a calculation reads, and
   joined folders that filter rows. A business-area rule applies to each such
   folder that belongs to its area (owned or shared); a folder rule applies to
   its own folder.
4. **Every applicable predicate is ANDed into the WHERE clause,** each in its
   own brackets, so an `OR` in the map's own conditions cannot escape it. On a
   worksheet that summarises several sets of detail rows, the predicate goes
   inside each summary, before anything is added up.

Predicates can use three binds, filled from the signed-in user and never from
the request: `:current_user_id`, `:current_user_email` and
`:current_user_role`. A folder rule can write `{alias}` for its folder's place
in the query.

## Row-level security fails closed

**A user no policy gives rows on a folder sees nothing from that folder.** The
query is refused by name, and no SQL reaches Oracle:

> Refusing to run unfiltered: no row-level security policy resolves for you on folder(s) "SALES"

This is **deliberately unlike Discoverer**, and it is the one place Neo breaks
compatibility on purpose (D-090). Discoverer's row-level security was a
mandatory folder condition; a folder without one showed every row to everyone.
Reproducing that would be reproducing a vulnerability.

What follows from it:

- **A fresh deployment returns nothing** until policies exist — administrators
  included. To let a group see every row of a business area, give them a
  policy whose rule targets that area with the predicate `1 = 1`.
- **Removing, disabling or unassigning a policy never opens access.** It can
  only take rows away.
- **Administrators are not exempt.** They bypass business-area grants; they do
  not bypass row-level security. There is no admin bypass to audit.
- **Lists of values follow the same rule.** A pick-list over a folder you have
  no policy for is refused too.

The setting is `ROW_LEVEL_FAIL_MODE`
([Configuration](../deployment/configuration.md#row-level-security)). `OPEN`
refuses only a folder that some active policy already targets, and runs every
other folder unfiltered, as before this change. Use it only while a
deployment's policies are being written: under `OPEN`, disabling a policy does
widen access again.

### Administrators are the trust boundary for predicates

A predicate is raw SQL, spliced into every query its folder reaches. Neo
validates it when it is saved and, before every run, checks again that it
cannot break out of its brackets. It refuses:

- statement separators (`;`) and comments (`--`, `/* */`);
- anything that closes the bracket the predicate is wrapped in, such as
  `1=1) OR (1=1`, which would return every row;
- DDL, DML and PL/SQL keywords, `UNION` / `INTERSECT` / `MINUS` / `EXCEPT`, and
  `DBMS_`, `UTL_`, `OWA_`, `HTP.` and `HTF.` calls;
- binds other than the three above, and text that does not parse as a
  condition.

Those checks stop mistakes and the known ways out. **They cannot tell a wrong
rule from a right one.** Whoever can edit policies decides what every user
sees, so treat the security administrator role as you would database access.

## Creating Security Policies

### Step 1: Add Policy

1. Admin Panel → **Business Area** → **Security**
2. Click **+ Create Policy**
3. Enter:
   - **Name** — Policy identifier (e.g., "Sales by Region")
   - **Description** — Explain what the policy enforces
   - **Target Type** — FOLDER (applies to all items in folder)
   - **Target Folder** — Select folder to protect
   - **Active** — Toggle to enable/disable

### Step 2: Define Predicate

Enter the **SQL Predicate** — a WHERE clause fragment appended to queries:

```sql
REGION = NVL2(SYS_CONTEXT('dn_user_context', 'region'),
              SYS_CONTEXT('dn_user_context', 'region'),
              REGION)
```

**Breaking down the expression:**

- `SYS_CONTEXT('dn_user_context', 'region')` — Get user's region context value
- `NVL2(...)` — If context value exists, use it; otherwise use REGION (no filtering)
- Compare folder's REGION column to user's region context

### Step 3: Assign Context to Users

Users need context values for policies to filter data.

1. Admin Panel → **Users** → select user → **Security Context**
2. Set context key-value pairs:
   - **Key:** `region` (matches predicate)
   - **Value:** `EMEA` (this user's region)
3. Save

Now when this user runs a query, the predicate uses their region context.

## Security Context Values

Security context is a set of key-value pairs associated with each user:

| Key | Value | Purpose |
|-----|-------|---------|
| `region` | EMEA, APAC, AMER | Sales region manager |
| `department` | SALES, HR, FINANCE | Department-scoped data |
| `cost_center` | CC-001, CC-002 | Cost center filtering |
| `employee_id` | EMP-12345 | Employee-specific data |

**Setting context:**

1. Admin Panel → **Users**
2. Click user → **Edit**
3. Scroll to **Security Context**
4. Click **+ Add Context**
5. Enter key and value
6. Save

Users can have multiple context values. Predicates reference which context value to use.

## Predicate Examples

### Example 1: Sales Region Filtering

**Folder:** SALES_DATA
**Policy:** Only see your region's sales

```sql
REGION = SYS_CONTEXT('dn_user_context', 'region')
```

**Context Setup:**
- User: john@example.com → region = 'EMEA'
- User: jane@example.com → region = 'AMER'

**Result:**
- John sees: WHERE REGION = 'EMEA'
- Jane sees: WHERE REGION = 'AMER'

### Example 2: Department Access

**Folder:** EMPLOYEE_DATA
**Policy:** Employees see only their department

```sql
DEPARTMENT = SYS_CONTEXT('dn_user_context', 'department')
```

### Example 3: Manager Access

**Folder:** PAYROLL
**Policy:** Managers see subordinates' data

```sql
MANAGER_ID = SYS_CONTEXT('dn_user_context', 'employee_id')
OR EMPLOYEE_ID = SYS_CONTEXT('dn_user_context', 'employee_id')
```

This allows managers to see their employees' records (MANAGER_ID match) plus their own record.

### Example 4: No Filtering for Admins

**Folder:** SENSITIVE_DATA
**Policy:** Skip filtering for admins

```sql
SYS_CONTEXT('dn_user_context', 'is_admin') = 'Y'
OR DATA_OWNER = SYS_CONTEXT('dn_user_context', 'employee_id')
```

Admins have `is_admin='Y'` context; others see only their own records.

## Testing Policies

### Test as User

1. Log out (or use incognito browser)
2. Log in as test user
3. Execute a map using the protected folder
4. Verify results are filtered correctly

### Check Predicate in Logs

Audit logs show executed SQL:

1. Admin Panel → **Audit Log**
2. Filter by map execution
3. See generated SQL with predicate applied

## Disabling Policies

### Temporarily Disable

1. Find policy → **Edit**
2. Uncheck **Active**
3. Save

The policy stops applying. Its users do **not** get unfiltered rows back: a
folder they no longer have an active policy for is refused, as described in
[Row-level security fails closed](#row-level-security-fails-closed). Only under
`ROW_LEVEL_FAIL_MODE=OPEN` does disabling or deleting a policy widen access.

### Permanently Delete

1. Find policy → **Delete**
2. Confirm

The policy, its rules and its assignments are removed. As with disabling, this
takes rows away and never gives them back.

## Performance Considerations

Security predicates are added to all queries on protected folders:

**Impact:**
- Adds execution time (typically <10% for well-indexed columns)
- Indexed context columns perform better
- Large IN lists (many regions) slow down queries

**Optimization:**
1. Index columns referenced in predicates:
   ```sql
   CREATE INDEX idx_sales_region ON SALES_DATA(REGION);
   ```

2. Use simple predicates (equality) when possible

3. Monitor query performance with/without RLS

## Security Audit

Track security policy changes:

1. Admin Panel → **Audit Log**
2. Filter by entity type: SECURITY_POLICY
3. See who created/modified/deleted policies

## Credential redaction in the audit log

Every mutating request (`POST`, `PUT`, `PATCH`, `DELETE`) has its parameters,
query string, body and response body stored in `audit_log.details`. Some of
those bodies carry credentials in plaintext — a data source's Oracle password
reaches the API as plaintext and is encrypted server-side, and a password
change carries the new password.

### The rule

Before anything is stored, any key whose name **contains** one of these
substrings, case-insensitively, at any depth, has its value replaced with
`[REDACTED]`:

| Substring | Catches, among others |
|-----------|-----------------------|
| `password` | `password`, `passwordEnc`, `newPassword`, `currentPassword`, `passwordHash` |
| `secret` | `secret`, `clientSecret`, `client_secret` |
| `token` | `token`, `apiToken`, `refreshToken`, `accessToken` |
| `credential` | `credential`, `dbCredential`, `credentials` |
| `apikey` | `apiKey`, `api_key` |
| `authorization` | `authorization` |

The rule is `isSensitiveKey` in `backend/src/plugins/audit.ts`. Arrays and
nested objects are walked to a depth of six.

### Why substring, not an exact list

It used to be an exact list of key names, and an exact list is a list of the
names somebody thought of. Two were missing — `passwordEnc` and `newPassword` —
and **174 Oracle data-source passwords and 5 user passwords were written to
`audit_log` in cleartext**. Not encrypted; the plain string.

A substring rule catches every prefixed, suffixed and camel-cased variant of
the same word without anyone having to enumerate them. The existing cleartext
was purged by migration `0011_purge_audit_log_credentials`, which redacts the
values in place rather than deleting rows — an audit trail whose rows vanish is
a worse audit trail.

### What redaction does not cover

- **Values, not keys.** A password pasted into a *description* field is stored.
  The redactor matches on the field name; it cannot recognise a secret by
  looking at it.
- **Error text.** An Oracle or Postgres failure message may quote the word
  "password" ("password authentication failed"). Those are messages, not
  credentials, and are left intact.

### If you add a field carrying a secret

Name it so it contains one of the six substrings. `apiToken` is covered;
`apiPass` is not. Adding a name that does not match means adding a leak, and
the audit hook has no way to warn you.

`backend/src/__tests__/audit-redaction.test.ts` pins the rule.

## What changed for business-area grants

Three changes to how a grant is read. All of them tighten access; none of them
widens it.

### 1. A grant on the map's business area is no longer enough

Running a map now requires a grant on **every folder the query touches**, not
on the business area recorded against the map. A folder is entitled by a grant
on *any* business area it belongs to — the one that owns it, or any it has been
shared into.

This closes an escalation: previously, owning or being shared a map let you
read folders in a business area you had never been granted, because the owner,
public and share checks all returned before the grant check ran.

**What you may see:** a user who could open a shared or public report before now
gets *"You do not have access to the data in folder X"*. The fix is a grant on a
business area that folder belongs to — not a change to the map.

Admins still bypass this gate. The bypass is now recorded in the audit log as
`DATA_ENTITLEMENT_ADMIN_BYPASS`, and only when the admin genuinely holds no
grant, so the log shows real bypasses rather than every admin query.

### 2. A business-area policy now follows the folders, not the map

A `BUSINESS_AREA`-scoped rule fires when **any folder the query reads** belongs
to that business area — owning it or shared into it. It used to be matched
against a single column on the map row.

**What you may see:** a policy reaching a report you did not expect it to,
because that report reads a folder in your business area even though the report
itself is filed elsewhere. That is the intended behaviour: the policy protects
the data, not the report.

### 3. A folder with no policy for you is refused

Running a query needs a row-level security policy that covers **every folder
it reads**. A user without one is refused by name rather than handed every row
— see [Row-level security fails closed](#row-level-security-fails-closed).

**What you may see:** *"Refusing to run unfiltered: no row-level security policy
resolves for you on folder(s) X"*. The fix is to assign that user (or their
role) a policy covering the folder. If they are meant to see everything, assign
them a permissive policy (`1 = 1`) rather than leaving them unassigned — the
absence of a policy is never read as permission.

This applies to **admins too**. Admins bypass grants; they do not bypass
row-level policies.

This started in Phase 1.1 as a narrower rule — refuse only a folder that some
active policy already targeted — and became the full fail-closed in Phase 6.3.
`ROW_LEVEL_FAIL_MODE=OPEN` brings the narrower rule back; it never lets a
folder that a policy targets run unfiltered.

## Object-level access

Reading one folder, item, join or hierarchy by its id needs the same grant as
listing it. A user without a grant on a business area the object belongs to gets
`403 Forbidden`, not the object. Admins bypass the check.

A folder belongs to its owning business area and to every area it is shared
into; a grant on any one of them is enough. Items and joins follow their folder.
Hierarchies follow their business area.

Before this, those reads checked only that you were signed in, so any account
could walk the metadata layer one id at a time — table names, column names and
join topology for areas it had never been granted.

`backend/src/__tests__/get-by-id-scoping.test.ts` scans every route file and
fails if a `GET` route keyed by an id names no access gate. A route that
genuinely holds no per-area data must be listed there with its reason.

Reads are not yet written to the audit log. That is Phase 6.4.

## Custom SQL on COMPLEX folders

A COMPLEX folder's SQL is inlined into every query that reads it, so it is
checked on **create and on update** by the same function
(`assertValidFolderSql` in `folder.service.ts`). It must be one `SELECT` or
`WITH` statement; DDL, DML, `EXEC`, `EXECUTE IMMEDIATE` and `DBMS_` calls are
refused with `400`. Changing a folder's type to COMPLEX without SQL is refused
too.

Before this, only create was checked: a folder created with a clean `SELECT`
could be edited to anything.

**A COMPLEX folder that a row-level security policy reaches refuses to run.**
Its SQL is inlined as a derived table, and a policy's predicate is ANDed onto
the query around it — never into the tables that SQL reads — so Neo cannot
prove the predicate filters anything. The refusal names the folder and the
policy, applies to every user, and holds whether the policy targets the folder
or its business area:

> Refusing to run: COMPLEX folder "X" is covered by row-level security policy "P", and a policy's predicate cannot yet be proven to filter the rows a COMPLEX folder's own SQL reads

Under the default `CLOSED` mode a COMPLEX folder therefore cannot be read at
all: without a policy it is refused as uncovered, and with one it is refused
here. Read the same data through an ordinary folder over the underlying table
or view instead, and put the policy on that folder.

## Best Practices

1. **Start Simple** — Begin with single-column filtering (region, department)
2. **Document Policies** — Explain intent and maintenance requirements
3. **Test Thoroughly** — Verify each user sees only appropriate data
4. **Monitor Performance** — Complex predicates may impact query speed
5. **Use Consistent Keys** — Keep context key names consistent (e.g., always `region`, not `region_code`)
6. **Review Regularly** — Audit policies quarterly to ensure still appropriate

## Limitations

- **Manual Context Assignment** — Users' context currently set manually (no automatic LDAP sync in v0.1)
- **No Temporal RLS** — No time-based filtering yet
- **Policies Combine with AND** — When several of your policies reach a folder, you see only the rows all of them allow
- **No Row-Level UPDATE/DELETE** — RLS only filters SELECT queries

## What's Next?

- **[User Management](user-management.md)** — Create users and assign context
- **[Metadata Management](metadata-management.md)** — Organize folders
- **[Audit Logging](audit-logging.md)** — Review security events

---

**See Also:** [Admin Guide](../admin-guide/), [API Reference - Security](../api/endpoints.md#security)
