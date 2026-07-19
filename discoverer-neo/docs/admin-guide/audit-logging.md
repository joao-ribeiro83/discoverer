# Audit Logging

Learn about Discoverer Neo's audit trail and how to review system activities.

## What is Audit Logging?

**Audit Logging** records all significant system activities — metadata changes, map executions, user login/logout, permission grants/revocations, and export jobs.

Every audit event includes:
- **Timestamp** — When the activity occurred
- **User** — Who performed the action
- **Action** — What happened (CREATE, UPDATE, DELETE, EXECUTE)
- **Entity** — What was affected (MAP, BUSINESS_AREA, USER, etc.)
- **Changes** — Details of what changed (for updates)

## Accessing Audit Logs

### View Audit Log

1. Admin Panel → **Audit Log**
2. See paginated list of recent events (newest first)
3. Filter by:
   - **Date Range** — Start and end date
   - **User** — Filter by who performed action
   - **Entity Type** — Filter by what was affected
   - **Action** — CREATE, UPDATE, DELETE, EXECUTE, GRANT, etc.
4. Click event to see full details

### Event Details

Clicking an event shows:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-07-19T12:15:30Z",
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "userEmail": "alice@example.com",
  "action": "CREATE",
  "entityType": "MAP",
  "entityId": "550e8400-e29b-41d4-a716-446655440100",
  "entityName": "Q3 Sales Report",
  "changes": {
    "name": "Q3 Sales Report",
    "mapType": "TABLE",
    "businessAreaId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

## Event Types

### Metadata Changes

| Entity | Actions |
|--------|---------|
| BUSINESS_AREA | CREATE, UPDATE, DELETE |
| FOLDER | CREATE, UPDATE, DELETE |
| ITEM | CREATE, UPDATE, DELETE |
| JOIN | CREATE, UPDATE, DELETE |
| HIERARCHY | CREATE, UPDATE, DELETE |
| CUSTOM_FUNCTION | CREATE, UPDATE, DELETE |

### Map Lifecycle

| Entity | Actions |
|--------|---------|
| MAP | CREATE, UPDATE, DELETE, DUPLICATE |
| MAP_EXECUTION | EXECUTE, CANCEL |
| MAP_SHARE | GRANT, REVOKE |

### User & Permission Management

| Entity | Actions |
|--------|---------|
| USER | CREATE, UPDATE, DELETE |
| BUSINESS_AREA_GRANT | GRANT, REVOKE, UPDATE |
| SECURITY_POLICY | CREATE, UPDATE, DELETE |

### Data & Jobs

| Entity | Actions |
|--------|---------|
| EXPORT | CREATE, START, COMPLETE, FAIL, DELETE |
| SCHEDULE | CREATE, UPDATE, DELETE, EXECUTE |

### Authentication

| Entity | Actions |
|--------|---------|
| LOGIN | LOGIN, LOGOUT |
| TOKEN | REFRESH, BLACKLIST |

## Common Queries

### Who Modified This Map?

1. Filter by Entity Type: MAP
2. Search by map name or ID
3. See CREATE → UPDATE events

### Track Permission Changes

1. Filter by Entity Type: BUSINESS_AREA_GRANT
2. Filter by User if needed
3. See who granted/revoked permissions and when

### Find Failed Exports

1. Filter by Entity Type: EXPORT
2. Look for FAIL actions
3. Check error details

### Execution History

For a specific map's runs:

1. Open map → **History** tab (in map page, not audit log)
2. See execution times, row counts, status

(Audit log shows CREATE/UPDATE on maps; execution history shows EXECUTE events)

### Users Created in Date Range

1. Filter by Entity Type: USER
2. Filter by Action: CREATE
3. Filter by Date Range
4. See all new accounts created

## Audit Retention

Audit logs are retained indefinitely (in PostgreSQL database).

**Backup:** Audit logs are included in database backups (see [Backup Guide](../deployment/backup.md)).

**Export:** To export audit logs for analysis:

```bash
# Use API to fetch logs
curl -X GET "http://localhost:3000/api/audit?limit=10000" \
  -H "Authorization: Bearer $TOKEN" > audit-logs.json

# Parse with jq or import to Excel
jq '.data[] | {timestamp, user: .userEmail, action, entity: .entityType}' audit-logs.json
```

## Security Considerations

### Access Control

Only **ADMIN** users can view audit logs. Non-admins cannot access this feature.

### Audit Log Manipulation

Audit logs are append-only; events cannot be deleted or modified (except deletion of entire database, which is not feasible for production).

### Sensitive Data

Audit logs include:
- User emails and names
- Map definitions (queries)
- Parameter names/values (may include dates, regions)
- But NOT: Database passwords (stored encrypted, not logged)

Be cautious with audit logs containing sensitive business data.

## Use Cases

### Compliance Auditing

Track who accessed what data and when:

1. Filter EXECUTION events
2. See which users ran which maps
3. Export to compliance database

### Investigating Issues

"This map stopped working on July 15":

1. Look at MAP updates around July 15
2. See who changed it and what changed
3. Understand the impact

### User Activity Monitoring

"Track user logins and logouts":

1. Filter by Entity Type: LOGIN
2. See authentication events with timestamps
3. Identify unusual activity patterns

### Permission Audits

"Who has CREATE permission in Finance area?":

1. Filter by Entity Type: BUSINESS_AREA_GRANT
2. Filter by BUSINESS_AREA name: Finance
3. See all grants and who has them

## Best Practices

1. **Regular Review** — Check audit logs weekly for anomalies
2. **Backup Audit Logs** — Include in database backups
3. **Alert on Critical Actions** — Set up monitoring for sensitive operations
4. **Archive Old Logs** — Export logs older than 1 year for archival
5. **Limit Access** — Only admins should access audit logs
6. **Document Policies** — Record your audit review process

## Performance

Audit logging has minimal performance impact:
- Events written asynchronously
- Indexed by timestamp and user for fast queries
- Does not block user operations

Large audit log queries (> 100k events) may be slow. Use date range filters.

## Troubleshooting

### Missing Audit Events

If you expect an event but don't see it:

- Check date range filter
- Verify user email spelling
- Confirm entity type name
- Check if event actually occurred (refresh page)

### Audit Log Performance Slow

For very large audit tables (millions of events):

1. Archive old events:
   ```bash
   curl -X GET "http://localhost:3000/api/audit?startDate=2026-01-01&endDate=2026-06-30&limit=100000" \
     -H "Authorization: Bearer $TOKEN" > archive.json
   ```

2. Ask DBA to analyze table statistics

## Integration

Export audit events to external systems:

```bash
# Fetch audit events as JSON
curl -X GET "http://localhost:3000/api/audit?limit=1000" \
  -H "Authorization: Bearer $TOKEN" | \
  jq '.data[] | {timestamp, userEmail, action, entityType, entityName}' | \
  # Pipe to your logging system (ELK, Splunk, etc.)
```

## What's Next?

- **[User Management](user-management.md)** — Manage user accounts
- **[Security Policies](security.md)** — Define access control
- **[Monitoring](../deployment/monitoring.md)** — System health and performance

---

**See Also:** [Admin Guide](../admin-guide/), [API Reference - Audit](../api/endpoints.md#audit-logs)
