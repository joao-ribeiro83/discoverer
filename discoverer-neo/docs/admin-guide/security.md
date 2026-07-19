# Security Policies

Learn how to define row-level security (RLS) policies that filter data by user or role.

## What is Row-Level Security?

**Row-Level Security (RLS)** automatically filters query results based on user context, without requiring changes to maps or queries.

**Example:** A sales region manager sees only their region's data, even though all regions are in the same table.

## How RLS Works

1. **Define Policy:** Create a security predicate for a folder
2. **User Context:** Associate user with context values (e.g., region = "EMEA")
3. **Query Execution:** Predicate automatically added to WHERE clause
4. **Filtered Results:** User sees only rows matching their context

```sql
-- Base query
SELECT CUSTOMER_ID, SALES_AMOUNT, REGION FROM CUSTOMERS

-- With RLS policy
SELECT CUSTOMER_ID, SALES_AMOUNT, REGION FROM CUSTOMERS
WHERE REGION = NVL2(SYS_CONTEXT('dn_user_context', 'region'),
                     SYS_CONTEXT('dn_user_context', 'region'),
                     REGION)
```

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

Policy no longer filters queries.

### Permanently Delete

1. Find policy → **Delete**
2. Confirm

Policy is removed; queries no longer filtered.

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
- **Single Predicate per Folder** — Only one policy applies per folder
- **No Row-Level UPDATE/DELETE** — RLS only filters SELECT queries

## What's Next?

- **[User Management](user-management.md)** — Create users and assign context
- **[Metadata Management](metadata-management.md)** — Organize folders
- **[Audit Logging](audit-logging.md)** — Review security events

---

**See Also:** [Admin Guide](../admin-guide/), [API Reference - Security](../api/endpoints.md#security)
