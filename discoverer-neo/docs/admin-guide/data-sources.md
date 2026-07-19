# Managing Data Sources

Learn how to add and manage Oracle and PostgreSQL data source connections.

## What is a Data Source?

A **Data Source** is a named connection to an Oracle or PostgreSQL database. Folders in business areas reference data sources to know where to fetch data.

## Creating a Data Source

### Add Oracle Connection

1. Admin Panel → **Data Sources**
2. Click **+ New Data Source**
3. Select **Oracle** as connection type
4. Enter:
   - **Name** — Unique identifier (e.g., "Production ERP")
   - **Description** — Notes (optional)
   - **Host** — Server hostname or IP
   - **Port** — Listener port (default: 1521)
   - **Service Name** or **SID** — Database identifier
   - **Username** — Database user (e.g., EUL5_US)
   - **Password** — Database password
5. Click **Test Connection** to verify
6. Click **Create**

### Add PostgreSQL Connection

1. Admin Panel → **Data Sources**
2. Click **+ New Data Source**
3. Select **PostgreSQL** as connection type
4. Enter:
   - **Name** — Unique identifier
   - **Description** — Notes (optional)
   - **Host** — Server hostname or IP
   - **Port** — Default: 5432
   - **Database** — Database name
   - **Username** — Database user
   - **Password** — Database password
5. Click **Test Connection**
6. Click **Create**

## Oracle Connection Details

### Thin Mode (Default)

Thin mode connects without Oracle Instant Client:

- **Pros:** No client installation, lighter weight, pure Node.js
- **Cons:** Cannot connect to databases older than 12.1
- **Best for:** Modern Oracle 12.1+

**No configuration needed.** Thin mode is the default.

### Thick Mode (Legacy)

Thick mode requires Oracle Instant Client for legacy databases:

- **Pros:** Supports Oracle 11.2+, enables LDAP naming, network encryption
- **Cons:** Requires Instant Client installation, larger footprint
- **Best for:** Older Oracle 11.2–12.0 databases, requires sqlnet.ora

**To enable thick mode:**

1. Build Docker image with client:
   ```bash
   docker compose build --build-arg INSTALL_ORACLE_CLIENT=true backend
   ```

2. Set environment variable:
   ```bash
   ORACLE_THICK_MODE=true
   ORACLE_CLIENT_PATH=/opt/oracle/instantclient
   ```

3. Backend verifies client is installed and fails to start if not found

## Connection Pooling

Discoverer Neo maintains a connection pool per data source:

**Pool Configuration** (environment variables):
- `ORACLE_POOL_MIN` — Minimum idle connections (default: 2)
- `ORACLE_POOL_MAX` — Maximum connections (default: 10)
- `ORACLE_POOL_INCREMENT` — New connections per allocation (default: 1)
- `ORACLE_POOL_IDLE_TIMEOUT_SECONDS` — Idle timeout (default: 300)

**Pool Sizing Guidance:**

With 4 Oracle data sources, each with `ORACLE_POOL_MAX=10`:
- Maximum 40 concurrent connections possible
- Must fit within database's `sessions`/`processes` limits

Size based on expected **concurrent map executions**, not users:
- Each map execution holds 1 connection for query duration
- Exports hold 1 connection for entire export (minutes)
- Typical deployment: 2–10 max per source

### Adjusting Pool Size

To increase connection limit (if database allows):

1. Edit `.env`:
   ```bash
   ORACLE_POOL_MAX=20
   ```

2. Increase database limits:
   ```sql
   ALTER SYSTEM SET processes=300;  # Default often 150
   ```

3. Restart backend:
   ```bash
   docker compose restart backend
   ```

## Testing Connection

After creating a data source, test connectivity:

1. Click data source → **Test Connection**
2. Status shown:
   - ✓ **Connected** — Connection successful
   - ✗ **Failed** — Error message displayed

**Common errors:**

- **Host unreachable** — Check network, firewall, hostname
- **Invalid credentials** — Verify username/password
- **Database not found** — Check service name/SID spelling
- **Listener not running** — Restart Oracle listener

## Editing Data Source

1. Click data source → **Edit**
2. Modify any field (password optionally left blank to keep existing)
3. Click **Save**

**Note:** Changing connection details may break existing folders if they can no longer access the data. Test carefully.

## Disabling Data Source

Toggle **Active** to temporarily disable:

- **Off** — Folders cannot fetch from this source
- **On** — Folders can fetch normally

Useful for maintenance without deleting the source.

## Deleting Data Source

1. Click data source → **Delete**
2. Confirm

Any folders using this source can no longer run. Maps become broken.

## Connection Encryption

Passwords are encrypted at rest using AES-256-GCM:

- **Key:** Environment variable `ENCRYPTION_KEY` (minimum 32 characters)
- **Storage:** Encrypted in PostgreSQL database
- **Transmission:** Always use HTTPS in production

Change encryption key:

1. Set new `ENCRYPTION_KEY` in environment
2. Restart backend
3. Backend re-encrypts all stored passwords automatically

**Important:** If you lose the encryption key, stored passwords become unrecoverable. Back up encryption keys securely.

## Monitoring Connection Health

Check connection pool status in monitoring:

- **Metrics:** `/metrics` endpoint
- **Gauge:** `oracledb_pool_connections_active`, `oracledb_pool_connections_idle`
- **Use:** Prometheus monitoring (see [Monitoring Guide](../deployment/monitoring.md))

## Bulk Import (Migration)

When migrating from Oracle Discoverer:

1. Use `dn-migrate` CLI to import EUL metadata
2. Create data sources for all referenced sources
3. Import business areas, folders, items using migration tool

See [Migration Guide](../migration/).

## Network Connectivity

### Firewall Rules

Ensure network connectivity:
- Backend → Oracle: Port 1521 (default Oracle)
- Backend → PostgreSQL: Port 5432 (default PostgreSQL)

### DNS Resolution

If using hostnames, verify DNS:
```bash
# Test from backend container
docker compose exec backend nslookup oracle.example.com
```

### SSH Tunneling

For secure connections over SSH:

1. Establish tunnel from backend to database host:
   ```bash
   ssh -L 1521:oracle-internal:1521 bastion-host
   ```

2. Use `localhost:1521` in connection string

3. Keep tunnel running (may need restart policy)

## Backup and Restore

Data sources are stored in PostgreSQL. See [Backup Guide](../deployment/backup.md).

To restore:
1. Restore PostgreSQL database
2. Data sources are automatically recovered
3. Connection tests work if network to sources is available

## Troubleshooting

### Connection Pool Exhausted

**Error:** "Connection timeout waiting for a connection"

**Causes:**
- Too many concurrent queries or exports
- Pool size too small
- Database connection limit reached

**Solution:**
1. Increase `ORACLE_POOL_MAX` (and database `sessions`)
2. Reduce concurrent export jobs (`EXPORT_WORKER_CONCURRENCY`)
3. Optimize slow queries

### Stale Connections

**Error:** "Connection reset by peer"

**Cause:** Database closed idle connections; pool didn't detect

**Solution:**
- Reduce `ORACLE_POOL_IDLE_TIMEOUT_SECONDS`
- Restart backend (recycles pool)

## What's Next?

- **[Oracle Introspection](oracle-introspection.md)** — Import tables automatically
- **[Metadata Management](metadata-management.md)** — Organize folders and items
- **[Security Policies](security.md)** — Define row-level security

---

**See Also:** [Admin Guide](../admin-guide/), [Deployment Configuration](../deployment/configuration.md)
