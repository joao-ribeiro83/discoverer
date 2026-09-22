# API Endpoints Reference

<!-- GENERATED FILE. Do not edit by hand — run `npm run generate-spec --workspace backend`.
     Source of truth: backend/src/routes/**, rendered via @fastify/swagger. -->

Reference for every Discoverer Neo REST API endpoint, generated directly from the live
OpenAPI spec. Endpoints marked **Public** need no token; every other endpoint requires the
`Authorization: Bearer <token>` header (see [Authentication Guide](authentication.md)).

## Base URL

- Development: `http://localhost:3000/api`
- Production: the deployed origin's `/api`

## Interactive documentation

The backend serves this same spec as interactive Swagger UI at `/api/docs` while running.

## Endpoints by category

### Health

#### GET /health — **Public**

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { status?: "ok" \| "degraded" version?: string uptime?: number database?: "connected" \| "disconnected" redis?: "connected" \| "disconnected" oracleClient?: "thin" \| "thick_ready" \| "thick_unavailable" timestamp?: string (date-time) } |
| 503 | { status?: "ok" \| "degraded" version?: string uptime?: number database?: "connected" \| "disconnected" redis?: "connected" \| "disconnected" oracleClient?: "thin" \| "thick_ready" \| "thick_unavailable" timestamp?: string (date-time) } |

#### GET /api/health — **Public**

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { status?: "ok" \| "degraded" version?: string uptime?: number database?: "connected" \| "disconnected" redis?: "connected" \| "disconnected" oracleClient?: "thin" \| "thick_ready" \| "thick_unavailable" timestamp?: string (date-time) } |
| 503 | { status?: "ok" \| "degraded" version?: string uptime?: number database?: "connected" \| "disconnected" redis?: "connected" \| "disconnected" oracleClient?: "thin" \| "thick_ready" \| "thick_unavailable" timestamp?: string (date-time) } |

#### GET /live — **Public**

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { status?: "ok" uptime?: number } |

#### GET /api/live — **Public**

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { status?: "ok" uptime?: number } |

### Auth

#### POST /api/auth/login — **Public**

**Request body:**
```
{
  email: string (email)
  password: string
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { token?: string refreshToken?: string user?: { id?: string email?: string name?: string role?: string locale?: string theme?: string colorPalette?: string mustChangePassword?: boolean } } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string } |
| 429 | { error?: string } |

#### POST /api/auth/refresh — **Public**

**Request body:**
```
{
  refreshToken: string
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### POST /api/auth/logout

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### GET /api/auth/me

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string email?: string name?: string role?: string locale?: string theme?: string colorPalette?: string } } |
| 401 | { error?: string } |

#### POST /api/auth/change-password

**Request body:**
```
{
  currentPassword: string
  newPassword: string
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

### Data Sources

#### GET /api/data-sources

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string name?: string description?: null,string connectionType?: "oracle" \| "postgres" host?: null,string port?: null,integer serviceName?: null,string sid?: null,string username?: null,string isActive?: boolean createdAt?: string updatedAt?: string hasPassword?: boolean hasConnectionString?: boolean }[] } |
| 401 | { error?: string } |
| 403 | { error?: string } |

#### POST /api/data-sources

**Request body:**
```
{
  name: string
  description?: string
  connectionType: "oracle" | "postgres"
  host?: string
  port?: integer
  serviceName?: string
  sid?: string
  username?: string
  passwordEnc?: string
  connectionString?: string
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 201 | { data?: { id?: string name?: string description?: null,string connectionType?: "oracle" \| "postgres" host?: null,string port?: null,integer serviceName?: null,string sid?: null,string username?: null,string isActive?: boolean createdAt?: string updatedAt?: string hasPassword?: boolean hasConnectionString?: boolean } } |
| 400 | { error?: string details?: any } |
| 409 | { error?: string } |

#### GET /api/data-sources/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string name?: string description?: null,string connectionType?: "oracle" \| "postgres" host?: null,string port?: null,integer serviceName?: null,string sid?: null,string username?: null,string isActive?: boolean createdAt?: string updatedAt?: string hasPassword?: boolean hasConnectionString?: boolean } } |
| 400 | { error?: string } |
| 404 | { error?: string } |

#### PUT /api/data-sources/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Request body:**
```
{
  name?: string
  description?: string
  connectionType?: "oracle" | "postgres"
  host?: string
  port?: integer
  serviceName?: string
  sid?: string
  username?: string
  passwordEnc?: string,null
  connectionString?: string,null
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string name?: string description?: null,string connectionType?: "oracle" \| "postgres" host?: null,string port?: null,integer serviceName?: null,string sid?: null,string username?: null,string isActive?: boolean createdAt?: string updatedAt?: string hasPassword?: boolean hasConnectionString?: boolean } } |
| 400 | { error?: string details?: any } |
| 404 | { error?: string } |

#### DELETE /api/data-sources/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { message?: string } } |
| 400 | { error?: string } |
| 404 | { error?: string } |

#### POST /api/data-sources/{id}/test

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { success?: boolean message?: string latencyMs?: integer } } |
| 400 | { error?: string } |
| 404 | { error?: string } |

### Business Areas

#### GET /api/business-areas

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string name?: string description?: null,string createdBy?: null,string createdAt?: string updatedBy?: null,string updatedAt?: string isActive?: boolean }[] } |
| 401 | { error?: string details?: any } |

#### POST /api/business-areas

**Request body:**
```
{
  name: string
  description?: string
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 201 | { data?: { id?: string name?: string description?: null,string createdBy?: null,string createdAt?: string updatedBy?: null,string updatedAt?: string isActive?: boolean } } |
| 400 | { error?: string details?: any } |
| 409 | { error?: string details?: any } |

#### GET /api/business-areas/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string name?: string description?: null,string createdBy?: null,string createdAt?: string updatedBy?: null,string updatedAt?: string isActive?: boolean grants?: { id?: string userId?: string userEmail?: string userName?: null,string permissionLevel?: "CREATE" \| "EDIT" \| "DELETE" \| "EXPORT" \| "SCHEDULE" \| "VIEW" grantedBy?: null,string grantedAt?: string }[] permissions?: string[] } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |

#### PUT /api/business-areas/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Request body:**
```
{
  name?: string
  description?: string,null
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string name?: string description?: null,string createdBy?: null,string createdAt?: string updatedBy?: null,string updatedAt?: string isActive?: boolean } } |
| 400 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |

#### DELETE /api/business-areas/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { message?: string } } |
| 400 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |

#### GET /api/business-areas/{id}/grants

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string userId?: string userEmail?: string userName?: null,string permissionLevel?: "CREATE" \| "EDIT" \| "DELETE" \| "EXPORT" \| "SCHEDULE" \| "VIEW" grantedBy?: null,string grantedAt?: string }[] } |
| 400 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |

#### POST /api/business-areas/{id}/grants

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Request body:**
```
{
  userId: string (uuid)
  permissionLevel: "CREATE" | "EDIT" | "DELETE" | "EXPORT" | "SCHEDULE" | "VIEW"
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 201 | { data?: { id?: string userId?: string userEmail?: string userName?: null,string permissionLevel?: "CREATE" \| "EDIT" \| "DELETE" \| "EXPORT" \| "SCHEDULE" \| "VIEW" grantedBy?: null,string grantedAt?: string } } |
| 400 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |

#### DELETE /api/business-areas/{id}/grants/{userId}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |
| `userId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { message?: string } } |
| 400 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |

#### GET /api/business-areas/{id}/users

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { userId?: string email?: string name?: null,string permissions?: "CREATE" \| "EDIT" \| "DELETE" \| "EXPORT" \| "SCHEDULE" \| "VIEW"[] }[] } |
| 400 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |

### Folders

#### GET /api/business-areas/{baId}/folders

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `baId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string businessAreaId?: string name?: string description?: null,string folderType?: "TABLE" \| "VIEW" \| "DERIVED" \| "COMPLEX" \| "JOIN" \| "SUMMARY" tableName?: null,string tableOwner?: null,string customSql?: null,string dataSourceId?: null,string displayOrder?: integer isActive?: boolean createdBy?: null,string createdAt?: string updatedAt?: string dataSourceName?: null,string isShared?: boolean }[] } |
| 400 | { error?: string } |
| 401 | { error?: string } |
| 403 | { error?: string } |

#### POST /api/business-areas/{baId}/folders

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `baId` | path | yes | string (uuid) |

**Request body:**
```
{
  name: string
  description?: string
  folderType: "TABLE" | "VIEW" | "DERIVED" | "COMPLEX" | "JOIN" | "SUMMARY"
  tableName?: string
  tableOwner?: string
  customSql?: string
  dataSourceId?: string (uuid)
  displayOrder?: integer
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 201 | { data?: { id?: string businessAreaId?: string name?: string description?: null,string folderType?: "TABLE" \| "VIEW" \| "DERIVED" \| "COMPLEX" \| "JOIN" \| "SUMMARY" tableName?: null,string tableOwner?: null,string customSql?: null,string dataSourceId?: null,string displayOrder?: integer isActive?: boolean createdBy?: null,string createdAt?: string updatedAt?: string dataSourceName?: null,string isShared?: boolean } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string } |
| 403 | { error?: string } |

#### GET /api/folders/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string businessAreaId?: string name?: string description?: null,string folderType?: "TABLE" \| "VIEW" \| "DERIVED" \| "COMPLEX" \| "JOIN" \| "SUMMARY" tableName?: null,string tableOwner?: null,string customSql?: null,string dataSourceId?: null,string displayOrder?: integer isActive?: boolean createdBy?: null,string createdAt?: string updatedAt?: string dataSourceName?: null,string isShared?: boolean } } |
| 400 | { error?: string } |
| 401 | { error?: string } |
| 404 | { error?: string } |

#### PUT /api/folders/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Request body:**
```
{
  name?: string
  description?: string,null
  folderType?: "TABLE" | "VIEW" | "DERIVED" | "COMPLEX" | "JOIN" | "SUMMARY"
  tableName?: string,null
  tableOwner?: string,null
  customSql?: string,null
  dataSourceId?: string,null
  displayOrder?: integer
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string businessAreaId?: string name?: string description?: null,string folderType?: "TABLE" \| "VIEW" \| "DERIVED" \| "COMPLEX" \| "JOIN" \| "SUMMARY" tableName?: null,string tableOwner?: null,string customSql?: null,string dataSourceId?: null,string displayOrder?: integer isActive?: boolean createdBy?: null,string createdAt?: string updatedAt?: string dataSourceName?: null,string isShared?: boolean } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string } |
| 403 | { error?: string details?: string } |
| 404 | { error?: string } |

#### DELETE /api/folders/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { message?: string } } |
| 400 | { error?: string } |
| 401 | { error?: string } |
| 403 | { error?: string details?: string } |
| 404 | { error?: string } |

#### GET /api/folders/{id}/business-areas

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### POST /api/folders/{id}/business-areas

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### DELETE /api/folders/{id}/business-areas/{baId}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |
| `baId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### POST /api/data-sources/{dsId}/introspect

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `tableOwner` | query | no | string |
| `dsId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { tables?: { tableName?: string tableOwner?: string objectType?: "TABLE" \| "VIEW" comments?: null,string columns?: { columnName?: string dataType?: string dataLength?: null,integer nullable?: boolean comments?: null,string }[] }[] count?: integer cached?: boolean } } |
| 400 | { error?: string } |
| 401 | { error?: string } |
| 403 | { error?: string } |
| 404 | { error?: string } |

#### GET /api/data-sources/{dsId}/tables

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `tableOwner` | query | no | string |
| `limit` | query | no | integer |
| `offset` | query | no | integer |
| `dsId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { tables?: { tableName?: string tableOwner?: string objectType?: "TABLE" \| "VIEW" comments?: null,string columns?: { columnName?: string dataType?: string dataLength?: null,integer nullable?: boolean comments?: null,string }[] }[] count?: integer total?: integer limit?: integer offset?: integer } } |
| 400 | { error?: string } |
| 401 | { error?: string } |
| 403 | { error?: string } |
| 404 | { error?: string } |

#### POST /api/data-sources/{dsId}/import

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `dsId` | path | yes | string (uuid) |

**Request body:**
```
{
  tableNames: string[]
  tableOwner: string
  businessAreaId: string (uuid)
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { created?: { folderId?: string name?: string tableName?: string }[] skipped?: { tableName?: string reason?: string }[] } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string } |
| 403 | { error?: string } |
| 404 | { error?: string } |

### Items

#### GET /api/folders/{folderId}/items

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `folderId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string folderId?: string name?: string description?: null,string itemType?: "CI" \| "CU" \| "CO" \| "JI" \| "HI" \| "AG" \| "FU" columnName?: null,string formula?: null,string dataType?: null,string formatMask?: null,string aggFunction?: null,string displayOrder?: integer isHidden?: boolean isActive?: boolean parentItemId?: null,string createdBy?: null,string createdAt?: string updatedAt?: string }[] } |
| 400 | { error?: string } |
| 401 | { error?: string } |
| 403 | { error?: string } |

#### POST /api/folders/{folderId}/items

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `folderId` | path | yes | string (uuid) |

**Request body:**
```
{
  name: string
  description?: string
  itemType: "CI" | "CU" | "CO" | "JI" | "HI" | "AG" | "FU"
  columnName?: string
  formula?: string
  dataType?: string
  formatMask?: string
  aggFunction?: string
  displayOrder?: integer
  isHidden?: boolean
  parentItemId?: string,null
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 201 | { data?: { id?: string folderId?: string name?: string description?: null,string itemType?: "CI" \| "CU" \| "CO" \| "JI" \| "HI" \| "AG" \| "FU" columnName?: null,string formula?: null,string dataType?: null,string formatMask?: null,string aggFunction?: null,string displayOrder?: integer isHidden?: boolean isActive?: boolean parentItemId?: null,string createdBy?: null,string createdAt?: string updatedAt?: string } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string } |
| 403 | { error?: string } |

#### GET /api/items/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string folderId?: string name?: string description?: null,string itemType?: "CI" \| "CU" \| "CO" \| "JI" \| "HI" \| "AG" \| "FU" columnName?: null,string formula?: null,string dataType?: null,string formatMask?: null,string aggFunction?: null,string displayOrder?: integer isHidden?: boolean isActive?: boolean parentItemId?: null,string createdBy?: null,string createdAt?: string updatedAt?: string } } |
| 400 | { error?: string } |
| 401 | { error?: string } |
| 404 | { error?: string } |

#### PUT /api/items/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Request body:**
```
{
  name?: string
  description?: string,null
  itemType?: "CI" | "CU" | "CO" | "JI" | "HI" | "AG" | "FU"
  columnName?: string,null
  formula?: string,null
  dataType?: string,null
  formatMask?: string,null
  aggFunction?: string,null
  displayOrder?: integer
  isHidden?: boolean
  parentItemId?: string,null
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string folderId?: string name?: string description?: null,string itemType?: "CI" \| "CU" \| "CO" \| "JI" \| "HI" \| "AG" \| "FU" columnName?: null,string formula?: null,string dataType?: null,string formatMask?: null,string aggFunction?: null,string displayOrder?: integer isHidden?: boolean isActive?: boolean parentItemId?: null,string createdBy?: null,string createdAt?: string updatedAt?: string } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string } |
| 403 | { error?: string } |
| 404 | { error?: string } |

#### DELETE /api/items/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { message?: string } } |
| 400 | { error?: string } |
| 401 | { error?: string } |
| 403 | { error?: string } |
| 404 | { error?: string } |

#### POST /api/folders/{folderId}/items/import

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `folderId` | path | yes | string (uuid) |

**Request body:**
```
{
  columns: {
    columnName: string
    dataType: string
    dataLength?: integer,null
    nullable?: boolean
  }[]
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { created?: { itemId?: string name?: string columnName?: string }[] skipped?: { columnName?: string reason?: string }[] } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string } |
| 403 | { error?: string } |

#### GET /api/items/{id}/values

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `search` | query | no | string |
| `limit` | query | no | integer |
| `offset` | query | no | integer |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { mode?: "values" \| "search" values?: string[] truncated?: boolean itemClassId?: null,string cardinality?: null,integer } } |
| 400 | { error?: string } |
| 401 | { error?: string } |
| 403 | { error?: string } |
| 404 | { error?: string } |
| 422 | { error?: string } |

#### GET /api/items/{id}/descendants

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string folderId?: string name?: string description?: null,string itemType?: "CI" \| "CU" \| "CO" \| "JI" \| "HI" \| "AG" \| "FU" columnName?: null,string formula?: null,string dataType?: null,string formatMask?: null,string aggFunction?: null,string displayOrder?: integer isHidden?: boolean isActive?: boolean parentItemId?: null,string createdBy?: null,string createdAt?: string updatedAt?: string }[] } |
| 400 | { error?: string } |
| 401 | { error?: string } |
| 404 | { error?: string } |

### Joins

#### GET /api/business-areas/{baId}/joins

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `baId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string name?: string leftFolderId?: string rightFolderId?: string leftItemId?: null,string rightItemId?: null,string joinType?: "INNER" \| "LEFT" \| "RIGHT" isActive?: boolean createdAt?: string leftFolderName?: string rightFolderName?: string leftItemName?: null,string rightItemName?: null,string businessAreaId?: string }[] } |
| 400 | { error?: string } |
| 401 | { error?: string } |
| 403 | { error?: string } |

#### POST /api/business-areas/{baId}/joins

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `baId` | path | yes | string (uuid) |

**Request body:**
```
{
  name: string
  leftFolderId: string (uuid)
  rightFolderId: string (uuid)
  leftItemId?: string,null
  rightItemId?: string,null
  joinType: "INNER" | "LEFT" | "RIGHT"
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 201 | { data?: { id?: string name?: string leftFolderId?: string rightFolderId?: string leftItemId?: null,string rightItemId?: null,string joinType?: "INNER" \| "LEFT" \| "RIGHT" isActive?: boolean createdAt?: string } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string } |
| 403 | { error?: string } |

#### GET /api/joins/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string name?: string leftFolderId?: string rightFolderId?: string leftItemId?: null,string rightItemId?: null,string joinType?: "INNER" \| "LEFT" \| "RIGHT" isActive?: boolean createdAt?: string leftFolderName?: string rightFolderName?: string leftItemName?: null,string rightItemName?: null,string businessAreaId?: string } } |
| 400 | { error?: string } |
| 401 | { error?: string } |
| 404 | { error?: string } |

#### PUT /api/joins/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Request body:**
```
{
  name?: string
  leftFolderId?: string (uuid)
  rightFolderId?: string (uuid)
  leftItemId?: string,null
  rightItemId?: string,null
  joinType?: "INNER" | "LEFT" | "RIGHT"
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string name?: string leftFolderId?: string rightFolderId?: string leftItemId?: null,string rightItemId?: null,string joinType?: "INNER" \| "LEFT" \| "RIGHT" isActive?: boolean createdAt?: string } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string } |
| 403 | { error?: string } |
| 404 | { error?: string } |

#### DELETE /api/joins/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { message?: string } } |
| 400 | { error?: string } |
| 401 | { error?: string } |
| 403 | { error?: string } |
| 404 | { error?: string } |

#### GET /api/folders/{folderId}/joins/suggestions

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `folderId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { leftFolderId?: string rightFolderId?: string leftItemId?: string rightItemId?: string leftColumnName?: string rightColumnName?: string suggestedJoinType?: "INNER" \| "LEFT" \| "RIGHT" reason?: string }[] } |
| 400 | { error?: string } |
| 401 | { error?: string } |
| 403 | { error?: string } |
| 404 | { error?: string } |

### Hierarchies

#### GET /api/business-areas/{baId}/hierarchies

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `baId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string name?: string description?: null,string businessAreaId?: string isActive?: boolean createdAt?: string updatedAt?: string }[] } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |

#### POST /api/business-areas/{baId}/hierarchies

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `baId` | path | yes | string (uuid) |

**Request body:**
```
{
  name: string
  description?: string
  levels: {
    levelName: string
    itemId: string (uuid)
    levelNumber: integer
  }[]
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 201 | { data?: { id?: string name?: string description?: null,string businessAreaId?: string isActive?: boolean createdAt?: string updatedAt?: string levels?: { id?: string hierarchyId?: string levelName?: string itemId?: string levelNumber?: integer createdAt?: string }[] } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |

#### GET /api/hierarchies/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string name?: string description?: null,string businessAreaId?: string isActive?: boolean createdAt?: string updatedAt?: string levels?: { id?: string hierarchyId?: string levelName?: string itemId?: string levelNumber?: integer createdAt?: string }[] } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |

#### PUT /api/hierarchies/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Request body:**
```
{
  name?: string
  description?: string,null
  levels?: {
    levelName: string
    itemId: string (uuid)
    levelNumber: integer
  }[]
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string name?: string description?: null,string businessAreaId?: string isActive?: boolean createdAt?: string updatedAt?: string levels?: { id?: string hierarchyId?: string levelName?: string itemId?: string levelNumber?: integer createdAt?: string }[] } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |

#### DELETE /api/hierarchies/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { message?: string } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |

#### POST /api/business-areas/{baId}/hierarchies/validate-levels

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `baId` | path | yes | string (uuid) |

**Request body:**
```
{
  levels: {
    levelName: string
    itemId: string (uuid)
    levelNumber: integer
  }[]
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { valid?: boolean } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |

### Custom Functions

#### GET /api/custom-functions

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string name?: string description?: null,string functionType?: "SQL" \| "PLSQL" \| "PACKAGE" parameters?: any returnType?: null,string extOwner?: null,string extPackage?: null,string extName?: null,string extDbLink?: null,string dataSourceId?: null,string isActive?: boolean createdAt?: string }[] } |
| 401 | { error?: string details?: any } |

#### POST /api/custom-functions

**Request body:**
```
{
  name: string
  description?: string
  functionType: "SQL" | "PLSQL" | "PACKAGE"
  parameters?: {
    name: string
    type: string
    required?: boolean
    defaultValue?: any
    position?: integer
  }[]
  returnType?: string
  extOwner?: string,null
  extPackage?: string,null
  extName?: string,null
  extDbLink?: string,null
  dataSourceId?: string,null
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 201 | { data?: { id?: string name?: string description?: null,string functionType?: "SQL" \| "PLSQL" \| "PACKAGE" parameters?: any returnType?: null,string extOwner?: null,string extPackage?: null,string extName?: null,string extDbLink?: null,string dataSourceId?: null,string isActive?: boolean createdAt?: string } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |

#### GET /api/custom-functions/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string name?: string description?: null,string functionType?: "SQL" \| "PLSQL" \| "PACKAGE" parameters?: any returnType?: null,string extOwner?: null,string extPackage?: null,string extName?: null,string extDbLink?: null,string dataSourceId?: null,string isActive?: boolean createdAt?: string } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |

#### PUT /api/custom-functions/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Request body:**
```
{
  name?: string
  description?: string,null
  functionType?: "SQL" | "PLSQL" | "PACKAGE"
  parameters?: array,null
  returnType?: string,null
  extOwner?: string,null
  extPackage?: string,null
  extName?: string,null
  extDbLink?: string,null
  dataSourceId?: string,null
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string name?: string description?: null,string functionType?: "SQL" \| "PLSQL" \| "PACKAGE" parameters?: any returnType?: null,string extOwner?: null,string extPackage?: null,string extName?: null,string extDbLink?: null,string dataSourceId?: null,string isActive?: boolean createdAt?: string } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |

#### DELETE /api/custom-functions/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { message?: string } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |

#### GET /api/data-sources/{dsId}/functions

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `owner` | query | no | string |
| `search` | query | no | string |
| `dsId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { owner?: string truncated?: boolean functions?: { owner?: string packageName?: null,string name?: string overload?: null,string returnType?: string parameters?: any callableFromSql?: boolean reason?: null,string }[] } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |

### Users

#### GET /api/users/search

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `q` | query | no | string |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string name?: string email?: string }[] } |
| 401 | { error?: string details?: any } |

#### GET /api/users

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string email?: string name?: string role?: "ADMIN" \| "MANAGER" \| "USER" \| "VIEWER" isActive?: boolean createdAt?: string updatedAt?: string }[] } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |

#### POST /api/users

**Request body:**
```
{
  email: string (email)
  password: string
  name: string
  role?: "ADMIN" | "MANAGER" | "USER" | "VIEWER"
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 201 | { data?: { id?: string email?: string name?: string role?: "ADMIN" \| "MANAGER" \| "USER" \| "VIEWER" isActive?: boolean createdAt?: string updatedAt?: string } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
| 409 | { error?: string details?: any } |

#### POST /api/users/credentials

**Request body:**
```
{
  userIds?: string (uuid)[]
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 400 | — |
| 401 | — |
| 403 | — |

#### GET /api/users/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string email?: string name?: string role?: "ADMIN" \| "MANAGER" \| "USER" \| "VIEWER" isActive?: boolean createdAt?: string updatedAt?: string } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |

#### PUT /api/users/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Request body:**
```
{
  email?: string (email)
  password?: string
  name?: string
  role?: "ADMIN" | "MANAGER" | "USER" | "VIEWER"
  isActive?: boolean
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string email?: string name?: string role?: "ADMIN" \| "MANAGER" \| "USER" \| "VIEWER" isActive?: boolean createdAt?: string updatedAt?: string } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |
| 409 | { error?: string details?: any } |

#### DELETE /api/users/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { message?: string } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |

### User Preferences

#### GET /api/users/me/preferences

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { locale?: "en" \| "pt-PT" \| "fr-FR" \| "es-ES" theme?: "light" \| "dark" \| "high-contrast" colorPalette?: "default" \| "navy" \| "forest" \| "wine" \| "ocean" \| "ochre" } } |
| 401 | { error?: string details?: any } |

#### PATCH /api/users/me/preferences

**Request body:**
```
{
  locale?: "en" | "pt-PT" | "fr-FR" | "es-ES"
  theme?: "light" | "dark" | "high-contrast"
  colorPalette?: "default" | "navy" | "forest" | "wine" | "ocean" | "ochre"
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { locale?: "en" \| "pt-PT" \| "fr-FR" \| "es-ES" theme?: "light" \| "dark" \| "high-contrast" colorPalette?: "default" \| "navy" \| "forest" \| "wine" \| "ocean" \| "ochre" } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |

### Maps

#### GET /api/business-areas/{baId}/maps

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `baId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### POST /api/business-areas/{baId}/maps

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `baId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### GET /api/maps

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `scope` | query | no | "owned" \| "all" |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### GET /api/maps/shared-with-me

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### GET /api/maps/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### PUT /api/maps/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### DELETE /api/maps/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### POST /api/maps/{id}/duplicate

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### GET /api/maps/{id}/export

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### GET /api/maps/{id}/conditional-formats

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### POST /api/maps/{id}/conditional-formats

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### PUT /api/maps/{id}/conditional-formats/{formatId}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |
| `formatId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### DELETE /api/maps/{id}/conditional-formats/{formatId}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |
| `formatId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

### Export

#### POST /api/maps/{id}/export

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### GET /api/exports

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `limit` | query | no | integer |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### GET /api/exports/{jobId}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `jobId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### GET /api/exports/{jobId}/download

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `jobId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

### Workbooks

#### GET /api/workbooks

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### GET /api/workbooks/{id}/shares

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### POST /api/workbooks/{id}/shares

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Request body:**
```
{
  userId: string (uuid)
  permissionLevel: "VIEW" | "EDIT" | "EXPORT"
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### DELETE /api/workbooks/{id}/shares/{userId}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |
| `userId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

### Dashboard

#### GET /api/dashboard/stats

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

### Map Shares

#### GET /api/maps/{id}/shares

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### POST /api/maps/{id}/shares

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### PUT /api/maps/{id}/shares/{userId}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |
| `userId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### DELETE /api/maps/{id}/shares/{userId}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |
| `userId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

### Map Execution

#### POST /api/maps/plan

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### POST /api/maps/{id}/execute

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### POST /api/maps/{id}/drill-to-detail

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### POST /api/maps/{id}/execute-async

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### GET /api/maps/{id}/executions/{jobId}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |
| `jobId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### DELETE /api/maps/{id}/executions/{jobId}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |
| `jobId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### POST /api/maps/{id}/explain

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### GET /api/maps/{id}/history

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `limit` | query | no | integer |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

### Schedules

#### GET /api/maps/{mapId}/schedules

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `mapId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### POST /api/maps/{mapId}/schedules

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `mapId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### GET /api/schedules

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### GET /api/schedules/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### PUT /api/schedules/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### DELETE /api/schedules/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### POST /api/schedules/{id}/toggle

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### POST /api/schedules/{id}/trigger

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### GET /api/schedules/{id}/history

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `limit` | query | no | integer |
| `id` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

#### GET /api/schedules/{id}/results/{resultId}/download

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string (uuid) |
| `resultId` | path | yes | string (uuid) |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | — |

### Security

#### GET /api/security/policies

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string name?: string description?: string policyType?: string isActive?: boolean createdAt?: string ruleCount?: number assignmentCount?: number rules?: { id?: string policyId?: string targetId?: string targetType?: "BUSINESS_AREA" \| "FOLDER" sqlPredicate?: string createdAt?: string }[] }[] } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |

#### POST /api/security/policies

**Responses:**

| Status | Body |
| --- | --- |
| 201 | { data?: { id?: string name?: string description?: string policyType?: string isActive?: boolean createdAt?: string ruleCount?: number assignmentCount?: number rules?: { id?: string policyId?: string targetId?: string targetType?: "BUSINESS_AREA" \| "FOLDER" sqlPredicate?: string createdAt?: string }[] } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |
| 409 | { error?: string details?: any } |

#### GET /api/security/policies/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string name?: string description?: string policyType?: string isActive?: boolean createdAt?: string ruleCount?: number assignmentCount?: number rules?: { id?: string policyId?: string targetId?: string targetType?: "BUSINESS_AREA" \| "FOLDER" sqlPredicate?: string createdAt?: string }[] } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |

#### PUT /api/security/policies/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string name?: string description?: string policyType?: string isActive?: boolean createdAt?: string ruleCount?: number assignmentCount?: number rules?: { id?: string policyId?: string targetId?: string targetType?: "BUSINESS_AREA" \| "FOLDER" sqlPredicate?: string createdAt?: string }[] } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |
| 409 | { error?: string details?: any } |

#### DELETE /api/security/policies/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { deleted?: boolean } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |

#### GET /api/security/policies/{id}/assignments

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string policyId?: string userId?: string roleName?: string userEmail?: string userName?: string }[] } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |

#### POST /api/security/policies/{id}/assignments

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string |

**Responses:**

| Status | Body |
| --- | --- |
| 201 | { data?: { id?: string policyId?: string userId?: string roleName?: string userEmail?: string userName?: string } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |
| 409 | { error?: string details?: any } |

#### DELETE /api/security/policies/{id}/assignments/{assignmentId}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string |
| `assignmentId` | path | yes | string |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { deleted?: boolean } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |

#### POST /api/security/policies/test

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { originalSql?: string securedSql?: string predicates?: string[] } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
| 404 | { error?: string details?: any } |

### Migration

#### POST /api/migration/detect

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: object } |
| 400 | { error?: string } |
| 401 | { error?: string } |
| 403 | { error?: string } |
| 404 | { error?: string } |
| 409 | { error?: string } |

#### POST /api/migration/analyze

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: object } |
| 400 | { error?: string } |
| 401 | { error?: string } |
| 403 | { error?: string } |
| 404 | { error?: string } |
| 409 | { error?: string } |

#### POST /api/migration/run

**Responses:**

| Status | Body |
| --- | --- |
| 202 | { data?: object } |
| 400 | { error?: string } |
| 401 | { error?: string } |
| 403 | { error?: string } |
| 404 | { error?: string } |
| 409 | { error?: string } |

#### POST /api/migration/reimport-maps

**Responses:**

| Status | Body |
| --- | --- |
| 202 | { data?: object } |
| 400 | { error?: string } |
| 401 | { error?: string } |
| 403 | { error?: string } |
| 404 | { error?: string } |
| 409 | { error?: string } |

#### POST /api/migration/delta

**Responses:**

| Status | Body |
| --- | --- |
| 202 | { data?: object } |
| 400 | { error?: string } |
| 401 | { error?: string } |
| 403 | { error?: string } |
| 404 | { error?: string } |
| 409 | { error?: string } |

#### GET /api/migration/jobs

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: object[] } |
| 401 | { error?: string } |
| 403 | { error?: string } |

#### GET /api/migration/jobs/{jobId}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `jobId` | path | yes | string |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: object } |
| 400 | { error?: string } |
| 401 | { error?: string } |
| 403 | { error?: string } |
| 404 | { error?: string } |
| 409 | { error?: string } |

### Audit

#### GET /api/audit

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string userId?: string userName?: string userEmail?: string action?: string entityType?: string entityId?: string details?: any ipAddress?: string createdAt?: string }[] total?: number limit?: number offset?: number } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |

#### GET /api/audit/stats

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { totalActions?: number byDay?: { date?: string count?: number }[] byUser?: { userId?: string userName?: string count?: number }[] byActionType?: { action?: string count?: number }[] } } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |

#### GET /api/audit/entity/{type}/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `type` | path | yes | string |
| `id` | path | yes | string |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string userId?: string userName?: string userEmail?: string action?: string entityType?: string entityId?: string details?: any ipAddress?: string createdAt?: string }[] } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |

#### GET /api/audit/user/{id}

**Parameters:**

| Name | In | Required | Type |
| --- | --- | --- | --- |
| `id` | path | yes | string |

**Responses:**

| Status | Body |
| --- | --- |
| 200 | { data?: { id?: string userId?: string userName?: string userEmail?: string action?: string entityType?: string entityId?: string details?: any ipAddress?: string createdAt?: string }[] } |
| 400 | { error?: string details?: any } |
| 401 | { error?: string details?: any } |
| 403 | { error?: string details?: any } |
