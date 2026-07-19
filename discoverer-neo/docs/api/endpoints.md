# API Endpoints Reference

Complete reference for Discoverer Neo REST API endpoints. All endpoints require JWT authentication (except `/api/auth/login`).

## Base URL
- Development: `http://localhost:3000/api`
- Production: `https://your-domain/api`

## Interactive Documentation

The API automatically generates interactive Swagger/OpenAPI documentation available at `/api/docs` when the backend is running.

## Authentication

See [Authentication Guide](authentication.md) for JWT flow details.

## Endpoints by Category

### Health Check

#### GET /api/health
Health check endpoint (no authentication required).

**Response:** `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2026-07-19T12:00:00Z"
}
```

---

### Authentication

#### POST /api/auth/login
Log in with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "USER"
    }
  }
}
```

#### POST /api/auth/refresh
Refresh an expired or expiring JWT token (valid for 7 days after expiration).

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Errors:**
- `401 Unauthorized` — Token invalid or expired > 7 days

#### POST /api/auth/logout
Invalidate current token and log out.

**Authentication:** Required (Bearer token)

**Response:** `200 OK`
```json
{
  "data": {
    "message": "Logged out successfully"
  }
}
```

#### GET /api/auth/me
Get currently authenticated user info.

**Authentication:** Required (Bearer token)

**Response:** `200 OK`
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER"
  }
}
```

---

### Data Sources

#### GET /api/data-sources
List all data sources (Oracle/PostgreSQL connections).

**Authentication:** Required (ADMIN only)

**Query Parameters:**
- `active` (optional, boolean) — Filter by active status

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Oracle Production",
      "description": "Production ERP database",
      "connectionType": "oracle",
      "host": "prod-oracle.example.com",
      "port": 1521,
      "serviceName": "PROD",
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-07-19T00:00:00Z"
    }
  ]
}
```

#### POST /api/data-sources
Create a new data source.

**Authentication:** Required (ADMIN only)

**Request Body:**
```json
{
  "name": "Oracle Production",
  "description": "Production ERP database",
  "connectionType": "oracle",
  "host": "prod-oracle.example.com",
  "port": 1521,
  "serviceName": "PROD",
  "username": "eul5_us",
  "password": "secret_password"
}
```

**Response:** `201 Created`

#### GET /api/data-sources/:id
Get a single data source (sensitive fields redacted).

**Authentication:** Required (ADMIN only)

#### PUT /api/data-sources/:id
Update a data source.

**Authentication:** Required (ADMIN only)

#### DELETE /api/data-sources/:id
Delete a data source (soft delete).

**Authentication:** Required (ADMIN only)

#### POST /api/data-sources/:id/test
Test connectivity to a data source.

**Authentication:** Required (ADMIN only)

**Response:** `200 OK`
```json
{
  "data": {
    "connected": true,
    "message": "Successfully connected to database"
  }
}
```

---

### Business Areas

#### GET /api/business-areas
List all business areas the user has access to (or all if ADMIN).

**Authentication:** Required

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Sales",
      "description": "Sales and revenue analytics",
      "createdBy": "550e8400-e29b-41d4-a716-446655440001",
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedBy": "550e8400-e29b-41d4-a716-446655440001",
      "updatedAt": "2026-07-19T00:00:00Z",
      "isActive": true
    }
  ]
}
```

#### GET /api/business-areas/:id
Get a business area with grants and user permissions.

**Authentication:** Required (VIEW grant or ADMIN)

**Response:** `200 OK`
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Sales",
    "description": "Sales and revenue analytics",
    "grants": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440100",
        "userId": "550e8400-e29b-41d4-a716-446655440001",
        "userEmail": "manager@example.com",
        "userName": "Jane Smith",
        "permissionLevel": "CREATE",
        "grantedBy": "550e8400-e29b-41d4-a716-446655440001",
        "grantedAt": "2026-07-01T00:00:00Z"
      }
    ],
    "permissions": ["VIEW", "CREATE", "EDIT"]
  }
}
```

#### POST /api/business-areas
Create a new business area.

**Authentication:** Required (ADMIN only)

**Request Body:**
```json
{
  "name": "Finance",
  "description": "Financial reporting and analysis"
}
```

**Response:** `201 Created`

#### PUT /api/business-areas/:id
Update a business area.

**Authentication:** Required (EDIT grant or ADMIN)

**Request Body:**
```json
{
  "name": "Finance Updated",
  "description": "Updated description"
}
```

#### DELETE /api/business-areas/:id
Delete a business area (soft delete).

**Authentication:** Required (ADMIN only)

#### POST /api/business-areas/:id/grant
Grant a user permission in a business area.

**Authentication:** Required (ADMIN or user with EDIT grant)

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440002",
  "permissionLevel": "CREATE"
}
```

**Response:** `200 OK` with grant details

#### DELETE /api/business-areas/:id/grant/:grantId
Revoke a user's permission in a business area.

**Authentication:** Required (ADMIN or user with EDIT grant)

**Response:** `200 OK`

---

### Folders

Folders are containers for Items (columns/attributes) within a Business Area. They typically represent tables or views from a data source.

#### GET /api/business-areas/:baId/folders
List folders in a business area.

**Authentication:** Required (VIEW grant or ADMIN)

**Query Parameters:**
- `dataSourceId` (optional) — Filter by data source
- `type` (optional) — Filter by folder type: `TABLE`, `VIEW`, `DERIVED`, `COMPLEX`, `JOIN`, `SUMMARY`

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "businessAreaId": "550e8400-e29b-41d4-a716-446655440000",
      "dataSourceId": "550e8400-e29b-41d4-a716-446655440200",
      "name": "CUSTOMERS",
      "description": "Customer master data",
      "type": "TABLE",
      "schemaName": "SALES",
      "tableName": "CUSTOMERS",
      "sqlText": null,
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /api/business-areas/:baId/folders
Create a folder (typically imported from Oracle/Postgres).

**Authentication:** Required (CREATE grant or ADMIN)

#### GET /api/business-areas/:baId/folders/:folderId
Get folder details with items.

**Authentication:** Required (VIEW grant)

#### PUT /api/business-areas/:baId/folders/:folderId
Update folder metadata.

**Authentication:** Required (EDIT grant)

#### DELETE /api/business-areas/:baId/folders/:folderId
Delete a folder and its items.

**Authentication:** Required (DELETE grant)

#### POST /api/business-areas/:baId/folders/:folderId/introspect
Discover tables/views from a data source and create folders.

**Authentication:** Required (CREATE grant)

**Request Body:**
```json
{
  "dataSourceId": "550e8400-e29b-41d4-a716-446655440200",
  "schema": "SALES",
  "tables": ["CUSTOMERS", "ORDERS"]
}
```

---

### Items

Items are columns/attributes within a Folder.

#### GET /api/business-areas/:baId/folders/:folderId/items
List items in a folder.

**Authentication:** Required (VIEW grant)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440100",
      "folderId": "550e8400-e29b-41d4-a716-446655440010",
      "name": "CUSTOMER_ID",
      "type": "CI",
      "dataType": "NUMBER",
      "columnName": "CUSTOMER_ID",
      "displayName": "Customer ID",
      "description": "Unique customer identifier",
      "isKey": true,
      "isHidden": false,
      "isRequired": false,
      "displayOrder": 1,
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /api/business-areas/:baId/folders/:folderId/items
Create an item.

**Authentication:** Required (CREATE grant)

#### PUT /api/business-areas/:baId/items/:itemId
Update an item.

**Authentication:** Required (EDIT grant)

#### DELETE /api/business-areas/:baId/items/:itemId
Delete an item.

**Authentication:** Required (DELETE grant)

---

### Joins

Joins define relationships between folders.

#### GET /api/business-areas/:baId/joins
List joins in a business area.

**Authentication:** Required (VIEW grant)

#### POST /api/business-areas/:baId/joins
Create a join.

**Authentication:** Required (CREATE grant)

**Request Body:**
```json
{
  "name": "Customers to Orders",
  "folderId1": "550e8400-e29b-41d4-a716-446655440010",
  "folderId2": "550e8400-e29b-41d4-a716-446655440020",
  "joinType": "INNER",
  "conditions": [
    {
      "itemId1": "550e8400-e29b-41d4-a716-446655440100",
      "itemId2": "550e8400-e29b-41d4-a716-446655440200",
      "operator": "="
    }
  ]
}
```

#### PUT /api/business-areas/:baId/joins/:joinId
Update a join.

**Authentication:** Required (EDIT grant)

#### DELETE /api/business-areas/:baId/joins/:joinId
Delete a join.

**Authentication:** Required (DELETE grant)

---

### Hierarchies

Hierarchies enable drill-down navigation on dimensions.

#### GET /api/business-areas/:baId/hierarchies
List hierarchies in a business area.

**Authentication:** Required (VIEW grant)

#### POST /api/business-areas/:baId/hierarchies
Create a hierarchy.

**Authentication:** Required (CREATE grant)

**Request Body:**
```json
{
  "name": "Calendar",
  "description": "Time hierarchy",
  "folderId": "550e8400-e29b-41d4-a716-446655440010",
  "levels": [
    {
      "itemId": "550e8400-e29b-41d4-a716-446655440100",
      "levelName": "Year",
      "levelNumber": 1
    },
    {
      "itemId": "550e8400-e29b-41d4-a716-446655440101",
      "levelName": "Month",
      "levelNumber": 2
    }
  ]
}
```

#### PUT /api/business-areas/:baId/hierarchies/:hierarchyId
Update a hierarchy.

**Authentication:** Required (EDIT grant)

#### DELETE /api/business-areas/:baId/hierarchies/:hierarchyId
Delete a hierarchy.

**Authentication:** Required (DELETE grant)

---

### Maps

Maps are saved queries (similar to Discoverer Workbooks).

#### GET /api/maps
Get current user's maps (own + shared with them).

**Authentication:** Required

**Response:** `200 OK`
```json
{
  "data": {
    "mine": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440300",
        "businessAreaId": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Customer Sales Report",
        "description": "Sales by customer",
        "mapType": "TABLE",
        "createdBy": "550e8400-e29b-41d4-a716-446655440001",
        "createdAt": "2026-07-01T00:00:00Z",
        "isPublic": false,
        "items": [],
        "conditions": [],
        "parameters": [],
        "calculatedFields": []
      }
    ],
    "shared": []
  }
}
```

#### GET /api/business-areas/:baId/maps
List maps in a business area.

**Authentication:** Required (VIEW grant)

#### GET /api/maps/:id
Get full map definition.

**Authentication:** Required (VIEW access)

**Response:** `200 OK`
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440300",
    "businessAreaId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Customer Sales Report",
    "mapType": "TABLE",
    "items": [
      {
        "itemId": "550e8400-e29b-41d4-a716-446655440100",
        "displayName": "Customer",
        "displayOrder": 1,
        "sortDirection": "ASC",
        "sortOrder": 1
      }
    ],
    "conditions": [
      {
        "itemId": "550e8400-e29b-41d4-a716-446655440100",
        "operator": ">",
        "value": "2026-01-01",
        "conditionType": "STATIC"
      }
    ],
    "parameters": [
      {
        "name": "start_date",
        "paramType": "DATE",
        "isRequired": true,
        "defaultValue": "2026-01-01"
      }
    ],
    "calculatedFields": [
      {
        "name": "total_revenue",
        "formula": "AMOUNT * QUANTITY",
        "displayOrder": 10
      }
    ]
  }
}
```

#### POST /api/business-areas/:baId/maps
Create a map.

**Authentication:** Required (CREATE grant)

**Request Body:**
```json
{
  "name": "Sales Report",
  "description": "Sales by region",
  "mapType": "TABLE",
  "isPublic": false,
  "items": [
    {
      "itemId": "550e8400-e29b-41d4-a716-446655440100",
      "displayOrder": 1
    }
  ],
  "conditions": [],
  "parameters": []
}
```

**Response:** `201 Created`

#### PUT /api/maps/:id
Update a map (replaces items, conditions, parameters if provided).

**Authentication:** Required (EDIT access)

#### DELETE /api/maps/:id
Soft-delete a map.

**Authentication:** Required (DELETE access)

#### POST /api/maps/:id/duplicate
Deep-copy a map.

**Authentication:** Required (VIEW access + CREATE permission in business area)

**Request Body:**
```json
{
  "name": "Sales Report - Copy"
}
```

**Response:** `201 Created` with new map

#### GET /api/maps/:id/export
Export map definition as XML.

**Authentication:** Required (EXPORT access)

---

### Map Execution

Execute maps and retrieve results.

#### POST /api/maps/:id/execute
Execute map synchronously and return first page of results.

**Authentication:** Required (VIEW access)

**Request Body:**
```json
{
  "parameters": {
    "start_date": "2026-01-01",
    "region": "EMEA"
  },
  "timeoutMs": 30000,
  "offset": 0,
  "calculatedFields": [
    {
      "name": "revenue_pct",
      "formula": "REVENUE / SUM(REVENUE) OVER ()"
    }
  ]
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "columns": [
      {
        "name": "customer_id",
        "displayName": "Customer ID",
        "dataType": "NUMBER"
      }
    ],
    "rows": [
      [1, "Acme Corp", 50000],
      [2, "TechStart Inc", 75000]
    ],
    "totalRowCount": 1000,
    "hasMore": true
  }
}
```

**Errors:**
- `400 Bad Request` — Invalid parameters or configuration
- `502 Bad Gateway` — Database connection failed
- `504 Gateway Timeout` — Query exceeded timeout

#### POST /api/maps/:id/execute-async
Queue map execution asynchronously (for long-running queries).

**Authentication:** Required (VIEW access)

**Request Body:** Same as synchronous execute

**Response:** `202 Accepted`
```json
{
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440400"
  }
}
```

#### GET /api/maps/:id/executions/:jobId
Check status of async execution.

**Authentication:** Required (VIEW access)

**Response:** `200 OK`
```json
{
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440400",
    "mapId": "550e8400-e29b-41d4-a716-446655440300",
    "status": "PROCESSING",
    "progress": { "rowsProcessed": 5000, "totalRows": 10000 },
    "startedAt": "2026-07-19T12:00:00Z"
  }
}
```

**Statuses:** `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`

#### DELETE /api/maps/:id/executions/:jobId
Cancel a running async execution.

**Authentication:** Required (VIEW access)

**Response:** `200 OK`
```json
{
  "data": {
    "cancelled": true,
    "message": "Execution cancelled"
  }
}
```

#### GET /api/maps/:id/history
Get execution history (recent runs) for a map.

**Authentication:** Required (VIEW access)

**Query Parameters:**
- `limit` (optional, 1–200, default: 20) — Number of entries

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440401",
      "mapId": "550e8400-e29b-41d4-a716-446655440300",
      "executedBy": "550e8400-e29b-41d4-a716-446655440001",
      "executedAt": "2026-07-19T12:00:00Z",
      "status": "SUCCESS",
      "rowsReturned": 150,
      "durationMs": 1234
    }
  ]
}
```

---

### Map Shares

Share maps with other users.

#### GET /api/maps/:id/shares
List map share permissions.

**Authentication:** Required (owner or ADMIN)

#### POST /api/maps/:id/shares
Grant another user access to a map.

**Authentication:** Required (owner or ADMIN)

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440002",
  "permissionLevel": "VIEW"
}
```

**Response:** `201 Created`

#### DELETE /api/maps/:id/shares/:shareId
Revoke map access from a user.

**Authentication:** Required (owner or ADMIN)

---

### Exports

Async export jobs (Excel, CSV).

#### POST /api/exports
Start an export job.

**Authentication:** Required (EXPORT permission)

**Request Body:**
```json
{
  "mapId": "550e8400-e29b-41d4-a716-446655440300",
  "format": "XLSX",
  "parameters": {
    "start_date": "2026-01-01"
  }
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440500",
    "status": "PENDING",
    "format": "XLSX",
    "createdAt": "2026-07-19T12:00:00Z"
  }
}
```

#### GET /api/exports/:jobId
Check export job status.

**Authentication:** Required

**Response:** `200 OK`
```json
{
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440500",
    "status": "COMPLETED",
    "format": "XLSX",
    "fileSize": 1024000,
    "downloadUrl": "/api/exports/550e8400-e29b-41d4-a716-446655440500/download",
    "expiresAt": "2026-07-26T12:00:00Z"
  }
}
```

#### GET /api/exports/:jobId/download
Download completed export file.

**Authentication:** Required

**Response:** `200 OK` (binary file)

#### DELETE /api/exports/:jobId
Delete export job and file.

**Authentication:** Required

---

### Schedules

Cron-based scheduled map execution.

#### GET /api/schedules
List user's scheduled jobs.

**Authentication:** Required

#### POST /api/schedules
Create a scheduled job.

**Authentication:** Required (SCHEDULE permission)

**Request Body:**
```json
{
  "mapId": "550e8400-e29b-41d4-a716-446655440300",
  "name": "Daily Sales Report",
  "cronExpression": "0 9 * * MON-FRI",
  "isActive": true,
  "parameters": {
    "region": "EMEA"
  },
  "notificationEmail": "manager@example.com"
}
```

**Response:** `201 Created`

#### GET /api/schedules/:scheduleId
Get schedule details.

**Authentication:** Required

#### PUT /api/schedules/:scheduleId
Update a schedule.

**Authentication:** Required

#### DELETE /api/schedules/:scheduleId
Delete a schedule.

**Authentication:** Required

#### GET /api/schedules/:scheduleId/runs
List execution history for a schedule.

**Authentication:** Required

---

### Users

User management (ADMIN only).

#### GET /api/users
List all users.

**Authentication:** Required (ADMIN only)

#### POST /api/users
Create a user.

**Authentication:** Required (ADMIN only)

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "name": "New User",
  "password": "initial_password",
  "role": "USER"
}
```

#### PUT /api/users/:userId
Update user profile/role.

**Authentication:** Required (ADMIN or self)

#### DELETE /api/users/:userId
Delete a user (soft delete).

**Authentication:** Required (ADMIN only)

---

### Security

Row-level security policies.

#### GET /api/business-areas/:baId/security
List security policies for a business area.

**Authentication:** Required (ADMIN or EDIT grant)

#### POST /api/business-areas/:baId/security
Create a security policy.

**Authentication:** Required (ADMIN only)

**Request Body:**
```json
{
  "name": "Sales by Region",
  "description": "Users see only their region's data",
  "targetType": "FOLDER",
  "targetId": "550e8400-e29b-41d4-a716-446655440010",
  "predicate": "REGION = NVL2(SYS_CONTEXT('dn_user_context', 'region'), SYS_CONTEXT('dn_user_context', 'region'), REGION)",
  "isActive": true
}
```

#### PUT /api/business-areas/:baId/security/:policyId
Update a policy.

**Authentication:** Required (ADMIN only)

#### DELETE /api/business-areas/:baId/security/:policyId
Delete a policy.

**Authentication:** Required (ADMIN only)

---

### Audit Logs

System audit trail (ADMIN only).

#### GET /api/audit
List audit events.

**Authentication:** Required (ADMIN only)

**Query Parameters:**
- `limit` (optional, default: 100) — Number of entries
- `entityType` (optional) — Filter by entity type
- `action` (optional) — Filter by action (CREATE, UPDATE, DELETE, EXECUTE)
- `startDate` (optional) — Filter by date range start
- `endDate` (optional) — Filter by date range end

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440600",
      "timestamp": "2026-07-19T12:00:00Z",
      "userId": "550e8400-e29b-41d4-a716-446655440001",
      "userEmail": "user@example.com",
      "action": "CREATE",
      "entityType": "MAP",
      "entityId": "550e8400-e29b-41d4-a716-446655440300",
      "entityName": "Sales Report",
      "changes": { "name": "Sales Report", "mapType": "TABLE" }
    }
  ]
}
```

---

### Migration

EUL migration from Oracle Discoverer.

#### GET /api/migration/status
Get migration job status (ADMIN only).

**Authentication:** Required

#### POST /api/migration/import
Start EUL import.

**Authentication:** Required (ADMIN only)

**Request Body:**
```json
{
  "dataSourceId": "550e8400-e29b-41d4-a716-446655440200",
  "businessAreaId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Human-readable error message",
  "statusCode": 400,
  "kind": "ERROR_KIND"
}
```

### Common HTTP Status Codes

| Status | Meaning |
|--------|---------|
| `200 OK` | Success |
| `201 Created` | Resource created |
| `202 Accepted` | Async job queued |
| `400 Bad Request` | Invalid input or validation failure |
| `401 Unauthorized` | Missing or invalid JWT token |
| `403 Forbidden` | Insufficient permissions |
| `404 Not Found` | Resource not found |
| `409 Conflict` | Resource already exists or state conflict |
| `500 Internal Server Error` | Unexpected server error |
| `502 Bad Gateway` | Database or data source connection failed |
| `504 Gateway Timeout` | Query execution exceeded timeout |

---

**See Also:** [Authentication Guide](authentication.md), [Project README](../README.md)
