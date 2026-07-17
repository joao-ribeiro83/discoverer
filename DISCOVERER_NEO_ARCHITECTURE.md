# Discoverer Neo — Architecture & Technology Stack

> **Version:** 1.0  
> **Date:** 2026-06-22  
> **Status:** Design Phase  

---

## 1. Executive Summary

Discoverer Neo is a modern, open-source replacement for Oracle Discoverer 4, designed to replicate and enhance its core functionality: a metadata abstraction layer (like the EUL) over database tables, end-user query/map building with parameters, scheduling, and data export. The application is built with a **Node.js/TypeScript** backend, **React** frontend, **PostgreSQL** for configuration and cached results, and connects to Oracle via **node-oracledb** (thick mode for full Oracle feature support). Everything runs in **Docker** containers.

### Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Build vs. Extend** | Build from scratch | No existing open-source BI tool replicates the Discoverer paradigm (EUL abstraction layer + workbook/maps + scheduling + row-level security) closely enough. Superset and Metabase lack the folder/item abstraction and the specific map/workbook model. |
| **Backend** | Node.js + TypeScript + Fastify | Fast, modern, excellent Oracle driver support via node-oracledb, strong async I/O for long-running queries. Fastify chosen over Express for better performance and built-in TypeScript support. |
| **Frontend** | React 19 + TypeScript + TanStack Table/Query | Modern component-based UI, excellent data table libraries, strong ecosystem for drag-and-drop (dnd-kit) and visual query building. |
| **Oracle Connection** | node-oracledb thick mode | Thick mode enables full Oracle feature support (Advanced Queuing, TAF, etc.) and better compatibility with Oracle-specific SQL. Oracle Instant Client 19/21 in Docker. |
| **API Layer** | REST (primary) + GraphQL (optional metadata) | REST for data queries and CRUD operations. GraphQL considered but adds complexity without clear benefit for a primarily SQL-execution-based tool. REST is simpler and more direct. |
| **Job Scheduling** | BullMQ + Redis | Industry-standard Node.js job queue. Supports cron patterns, retries, rate limiting, and job schedulers natively. |
| **Export** | ExcelJS (xlsx) + fast-csv | ExcelJS supports streaming writes for large datasets. CSV via fast-csv for very large exports. Both support 1M+ rows. |
| **Config Storage** | PostgreSQL 16 | Stores all Discoverer Neo metadata (business areas, folders, items, maps, users, roles, permissions, schedules, cached results). |
| **Deployment** | Docker Compose (3-tier) | Backend API + Frontend + PostgreSQL + Redis, all containerized. |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Docker Network                                │
│                                                                      │
│  ┌──────────────┐    ┌──────────────────────────────────────────┐   │
│  │   Nginx       │    │         Backend API (Node.js/Fastify)    │   │
│  │   Reverse     │───▶│                                          │   │
│  │   Proxy       │    │  ┌─────────────┐  ┌──────────────────┐  │   │
│  │   :80/:443    │    │  │ REST API     │  │ Auth Middleware   │  │   │
│  └──────────────┘    │  │ Router       │  │ (JWT + RBAC)     │  │   │
│         │            │  └─────────────┘  └──────────────────┘  │   │
│         │            │  ┌─────────────┐  ┌──────────────────┐  │   │
│         │            │  │ Map/Query    │  │ Oracle Service    │  │   │
│         │            │  │ Builder      │  │ (node-oracledb)   │  │   │
│         │            │  └─────────────┘  └──────────────────┘  │   │
│         │            │  ┌─────────────┐  ┌──────────────────┐  │   │
│         │            │  │ Scheduler    │  │ Export Service    │  │   │
│         │            │  │ Service      │  │ (Excel/CSV)       │  │   │
│         │            │  └─────────────┘  └──────────────────┘  │   │
│         │            │  ┌─────────────┐  ┌──────────────────┐  │   │
│         │            │  │ Migration    │  │ Security Service  │  │   │
│         │            │  │ Service      │  │ (Row-level)       │  │   │
│         │            │  └─────────────┘  └──────────────────┘  │   │
│         │            └──────────────────────────────────────────┘   │
│         │                          │                     │          │
│  ┌──────┴──────┐    ┌──────────────┴──┐  ┌──────────────┴──┐      │
│  │  React 19    │    │   PostgreSQL 16  │  │   Redis 7        │      │
│  │  Frontend    │    │                  │  │                  │      │
│  │  (Vite)      │    │  - Config DB     │  │  - BullMQ Queue  │      │
│  │  :5173       │    │  - Cached Results│  │  - Session Store │      │
│  └─────────────┘    │  - Audit Log     │  │  - Result Cache  │      │
│                      └─────────────────┘  └─────────────────┘      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Oracle Database  │
                    │  (Source Data)    │
                    │  via Oracle       │
                    │  Instant Client   │
                    └──────────────────┘
```

---

## 3. Technology Stack Detail

### 3.1 Backend — Node.js + TypeScript + Fastify

| Component | Technology | Version | Purpose |
|---|---|---|---|
| Runtime | Node.js | 22 LTS (dev: v26.3.1) | JavaScript runtime |
| Language | TypeScript | 5.x | Type safety |
| Framework | Fastify | 5.x | HTTP server (faster than Express, built-in validation) |
| ORM | Drizzle ORM | Latest | Type-safe database access to PostgreSQL |
| Oracle Driver | node-oracledb | 6.x | Oracle database connectivity (thick mode) |
| Job Queue | BullMQ | 5.x | Scheduled job processing |
| Auth | jsonwebtoken + bcrypt | Latest | JWT authentication, password hashing |
| Validation | Zod | Latest | Runtime schema validation |
| Logging | Pino | Latest | Structured logging (Fastify default) |
| Excel Export | ExcelJS | Latest | .xlsx generation with streaming |
| CSV Export | fast-csv | Latest | CSV generation for large datasets |

### 3.2 Frontend — React + TypeScript

| Component | Technology | Version | Purpose |
|---|---|---|---|
| Framework | React | 19 | UI framework |
| Language | TypeScript | 5.x | Type safety |
| Build Tool | Vite | 6.x | Fast dev server and builds |
| UI Library | shadcn/ui + Radix UI | Latest | Accessible, customizable components |
| Styling | Tailwind CSS | 4.x | Utility-first CSS |
| Data Tables | TanStack Table v8 | Latest | Virtualized, sortable, filterable tables |
| State Management | Zustand | Latest | Lightweight global state |
| Server State | TanStack Query v5 | Latest | API data fetching, caching, mutations |
| Drag & Drop | dnd-kit | Latest | Drag-and-drop for query builder |
| Forms | React Hook Form + Zod | Latest | Form handling and validation |
| Charts | Recharts | Latest | Data visualization |
| Code Editor | Monaco Editor | Latest | SQL/formula editing |

### 3.3 Infrastructure

| Component | Technology | Version | Purpose |
|---|---|---|---|
| Config Database | PostgreSQL | 16 | All metadata, cached results, audit logs |
| Job Queue / Cache | Redis | 7 | BullMQ backend, session store, result cache |
| Reverse Proxy | Nginx | Latest | SSL termination, static file serving, load balancing |
| Containerization | Docker + Docker Compose | Latest | All services containerized |

---

## 4. Database Schema Design (PostgreSQL)

### 4.1 Core Metadata Tables (Discoverer Neo's "EUL")

These tables replicate the EUL metadata layer from Oracle Discoverer:

```sql
-- ============================================================
-- DISCOVERER NEO — PostgreSQL Schema
-- ============================================================

-- 1. BUSINESS AREAS (equivalent to EUL5_BA)
CREATE TABLE business_areas (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL UNIQUE,
    description     TEXT,
    created_by      VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_by      VARCHAR(100),
    updated_at      TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT TRUE
);

-- 2. DATA SOURCES (Oracle connection configurations)
CREATE TABLE data_sources (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL UNIQUE,
    description     TEXT,
    connection_type VARCHAR(20) DEFAULT 'oracle', -- 'oracle', 'postgres', etc.
    host            VARCHAR(255) NOT NULL,
    port            INTEGER DEFAULT 1521,
    service_name    VARCHAR(255),      -- Oracle service name
    sid             VARCHAR(255),      -- Oracle SID (legacy)
    username        VARCHAR(255) NOT NULL,
    password_enc    TEXT NOT NULL,     -- Encrypted password
    connection_string TEXT,            -- Full Oracle connection string
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

-- 3. FOLDERS (equivalent to EUL5_OBJS)
CREATE TABLE folders (
    id              SERIAL PRIMARY KEY,
    business_area_id INTEGER NOT NULL REFERENCES business_areas(id),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    folder_type     VARCHAR(20) NOT NULL DEFAULT 'TABLE', -- TABLE, VIEW, DERIVED, COMPLEX, JOIN, SUMMARY
    table_name      VARCHAR(200),      -- Underlying DB object name
    table_owner     VARCHAR(200),      -- Schema owner
    custom_sql      TEXT,              -- For COMPLEX folders
    data_source_id  INTEGER REFERENCES data_sources(id),
    display_order   INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    created_by      VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ,
    UNIQUE(business_area_id, name)
);

-- 4. ITEMS (equivalent to EUL5_EXPRESSIONS)
CREATE TABLE items (
    id              SERIAL PRIMARY KEY,
    folder_id       INTEGER NOT NULL REFERENCES folders(id),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    item_type       VARCHAR(20) NOT NULL DEFAULT 'CI', -- CI, CU, CO, JI, HI, SM, AG, FU
    column_name     VARCHAR(200),      -- Underlying DB column (for CI type)
    formula         TEXT,              -- SQL expression (for CU/CO/SM types)
    data_type       VARCHAR(30),       -- NUMBER, DATE, VARCHAR2, TIMESTAMP
    format_mask     VARCHAR(80),       -- Display format (e.g., '999,999.00', 'DD-MON-YYYY')
    agg_function    VARCHAR(30),       -- SUM, COUNT, AVG, MIN, MAX, NONE
    display_order   INTEGER DEFAULT 0,
    is_hidden       BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    parent_item_id  INTEGER REFERENCES items(id), -- For hierarchical items
    created_by      VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ,
    UNIQUE(folder_id, name)
);

-- 5. JOINS (equivalent to EUL5_JOINS + EUL5_JOI_COMP)
CREATE TABLE joins (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    join_type       VARCHAR(20) DEFAULT 'INNER', -- INNER, LEFT, RIGHT, FULL
    left_item_id    INTEGER NOT NULL REFERENCES items(id),
    right_item_id   INTEGER NOT NULL REFERENCES items(id),
    operator        VARCHAR(10) DEFAULT '=',
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

-- 6. HIERARCHIES (equivalent to EUL5_HIERARCHIES)
CREATE TABLE hierarchies (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    business_area_id INTEGER NOT NULL REFERENCES business_areas(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

-- 7. HIERARCHY LEVELS
CREATE TABLE hierarchy_levels (
    id              SERIAL PRIMARY KEY,
    hierarchy_id    INTEGER NOT NULL REFERENCES hierarchies(id),
    item_id         INTEGER NOT NULL REFERENCES items(id),
    level_order     INTEGER NOT NULL,
    UNIQUE(hierarchy_id, level_order)
);

-- 8. CUSTOM FUNCTIONS (equivalent to EUL5_FUNCTIONS)
CREATE TABLE custom_functions (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    function_type   VARCHAR(20) DEFAULT 'SQL', -- SQL, PL_SQL, PACKAGE
    return_type     VARCHAR(30),
    function_body   TEXT,              -- Function definition/SQL
    parameters      JSONB,             -- Parameter definitions
    is_active       BOOLEAN DEFAULT TRUE,
    created_by      VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);
```

### 4.2 Maps (Workbooks) Tables

```sql
-- 9. MAPS (equivalent to EUL5_DOCUMENTS / Workbooks)
CREATE TABLE maps (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    business_area_id INTEGER NOT NULL REFERENCES business_areas(id),
    map_type        VARCHAR(20) DEFAULT 'TABLE', -- TABLE, CROSSTAB, PAGE_DETAIL, CHART
    owner_id        INTEGER NOT NULL REFERENCES users(id),
    sharing_status  VARCHAR(20) DEFAULT 'PRIVATE', -- PRIVATE, PUBLIC, SELECTIVE
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ,
    UNIQUE(name, owner_id)
);

-- 10. MAP ITEMS (selected columns/fields in a map)
CREATE TABLE map_items (
    id              SERIAL PRIMARY KEY,
    map_id          INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
    item_id         INTEGER REFERENCES items(id),     -- Reference to EUL item
    custom_formula  TEXT,                              -- Ad-hoc calculated field
    display_name    VARCHAR(200),
    data_type       VARCHAR(30),
    format_mask     VARCHAR(80),
    agg_function    VARCHAR(30),
    sort_order      VARCHAR(10), -- ASC, DESC, NULL
    sort_priority   INTEGER,
    display_order   INTEGER DEFAULT 0,
    is_hidden       BOOLEAN DEFAULT FALSE,
    width           INTEGER  -- Column width in pixels
);

-- 11. MAP CONDITIONS (filters)
CREATE TABLE map_conditions (
    id              SERIAL PRIMARY KEY,
    map_id          INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
    item_id         INTEGER REFERENCES items(id),
    operator        VARCHAR(20) NOT NULL, -- =, <>, <, >, <=, >=, LIKE, IN, BETWEEN, IS NULL
    value           TEXT,                 -- Static value
    is_parameter    BOOLEAN DEFAULT FALSE, -- TRUE if this is a runtime parameter
    parameter_name  VARCHAR(200),         -- Name shown to user at runtime
    parameter_type  VARCHAR(30),          -- STRING, NUMBER, DATE, LIST
    default_value   TEXT,
    list_values     JSONB,                -- For IN-list parameters
    logic_operator  VARCHAR(5) DEFAULT 'AND', -- AND, OR (for compound conditions)
    condition_group INTEGER DEFAULT 0,    -- Grouping for complex AND/OR
    sort_order      INTEGER DEFAULT 0
);

-- 12. MAP PARAMETERS (runtime variables)
CREATE TABLE map_parameters (
    id              SERIAL PRIMARY KEY,
    map_id          INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    display_label   VARCHAR(200),
    parameter_type  VARCHAR(30) NOT NULL, -- STRING, NUMBER, DATE, LIST
    default_value   TEXT,
    list_values     JSONB,                -- For LIST type
    is_required     BOOLEAN DEFAULT TRUE,
    sort_order      INTEGER DEFAULT 0
);
```

### 4.3 Security Tables

```sql
-- 13. USERS
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(100) NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    full_name       VARCHAR(200),
    role            VARCHAR(20) DEFAULT 'USER', -- ADMIN, MANAGER, USER, VIEWER
    is_active       BOOLEAN DEFAULT TRUE,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

-- 14. USER GRANTS (Business Area access)
CREATE TABLE user_business_area_grants (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    business_area_id INTEGER NOT NULL REFERENCES business_areas(id),
    can_create_maps BOOLEAN DEFAULT TRUE,
    can_edit_maps   BOOLEAN DEFAULT TRUE,
    can_delete_maps BOOLEAN DEFAULT FALSE,
    can_export      BOOLEAN DEFAULT TRUE,
    can_schedule    BOOLEAN DEFAULT FALSE,
    granted_by      VARCHAR(100),
    granted_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, business_area_id)
);

-- 15. ROW-LEVEL SECURITY POLICIES (equivalent to Security Managers)
CREATE TABLE row_security_policies (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    folder_id       INTEGER REFERENCES folders(id),
    business_area_id INTEGER REFERENCES business_areas(id),
    predicate_sql   TEXT NOT NULL,       -- SQL WHERE clause fragment
    applies_to_users JSONB,              -- NULL = all users, or array of user IDs
    is_active       BOOLEAN DEFAULT TRUE,
    created_by      VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

-- 16. MAP SHARING (selective sharing)
CREATE TABLE map_shares (
    id              SERIAL PRIMARY KEY,
    map_id          INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    can_edit        BOOLEAN DEFAULT FALSE,
    can_export      BOOLEAN DEFAULT TRUE,
    UNIQUE(map_id, user_id)
);
```

### 4.4 Scheduling Tables

```sql
-- 17. MAP SCHEDULES
CREATE TABLE map_schedules (
    id              SERIAL PRIMARY KEY,
    map_id          INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL, -- Cron pattern
    timezone        VARCHAR(50) DEFAULT 'UTC',
    parameter_values JSONB,               -- Pre-set parameter values
    output_format   VARCHAR(10) DEFAULT 'XLSX', -- XLSX, CSV
    output_destination VARCHAR(20) DEFAULT 'STORE', -- STORE, EMAIL, BOTH
    email_recipients TEXT,                -- Comma-separated emails
    valid_from      TIMESTAMPTZ,
    valid_until     TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT TRUE,
    last_run_at     TIMESTAMPTZ,
    next_run_at     TIMESTAMPTZ,
    created_by      INTEGER NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

-- 18. SCHEDULED EXECUTION RESULTS (cached results)
CREATE TABLE scheduled_results (
    id              BIGSERIAL PRIMARY KEY,
    schedule_id     INTEGER NOT NULL REFERENCES map_schedules(id),
    map_id          INTEGER NOT NULL REFERENCES maps(id),
    executed_at     TIMESTAMPTZ DEFAULT NOW(),
    parameter_values JSONB,
    row_count       INTEGER,
    execution_time_ms INTEGER,
    status          VARCHAR(20) DEFAULT 'SUCCESS', -- SUCCESS, FAILED, RUNNING
    error_message   TEXT,
    result_data     JSONB,               -- For small results, store inline
    result_ref      TEXT,                -- Reference to external storage for large results
    file_path       TEXT,                -- Path to exported file
    created_by      INTEGER REFERENCES users(id)
);

-- 19. QUERY EXECUTION LOG (audit)
CREATE TABLE query_execution_log (
    id              BIGSERIAL PRIMARY KEY,
    map_id          INTEGER REFERENCES maps(id),
    user_id         INTEGER REFERENCES users(id),
    executed_at     TIMESTAMPTZ DEFAULT NOW(),
    execution_time_ms INTEGER,
    cpu_time_ms     INTEGER,
    rows_returned   INTEGER,
    sql_text        TEXT,                -- The generated SQL
    parameters      JSONB,
    status          VARCHAR(20) DEFAULT 'SUCCESS',
    error_message   TEXT
);
```

### 4.5 Migration Tracking

```sql
-- 20. MIGRATION LOG (tracks what was migrated from Discoverer 4)
CREATE TABLE migration_log (
    id              SERIAL PRIMARY KEY,
    source_type     VARCHAR(50) NOT NULL, -- 'BUSINESS_AREA', 'FOLDER', 'ITEM', 'MAP', etc.
    source_id       VARCHAR(100),         -- Original Discoverer EUL ID
    source_name     VARCHAR(200),
    target_id       INTEGER,              -- New Discoverer Neo ID
    target_name     VARCHAR(200),
    migration_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED, SKIPPED
    error_message   TEXT,
    migrated_at     TIMESTAMPTZ,
    migrated_by     VARCHAR(100)
);
```

---

## 5. API Design

### 5.1 REST API Endpoints

```
# Authentication
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/me

# Business Areas
GET    /api/business-areas
POST   /api/business-areas
GET    /api/business-areas/:id
PUT    /api/business-areas/:id
DELETE /api/business-areas/:id

# Folders
GET    /api/business-areas/:id/folders
POST   /api/folders
GET    /api/folders/:id
PUT    /api/folders/:id
DELETE /api/folders/:id

# Items
GET    /api/folders/:id/items
POST   /api/items
GET    /api/items/:id
PUT    /api/items/:id
DELETE /api/items/:id

# Joins
GET    /api/joins
POST   /api/joins
PUT    /api/joins/:id
DELETE /api/joins/:id

# Hierarchies
GET    /api/hierarchies
POST   /api/hierarchies
PUT    /api/hierarchies/:id
DELETE /api/hierarchies/:id

# Maps (Workbooks)
GET    /api/maps
POST   /api/maps
GET    /api/maps/:id
PUT    /api/maps/:id
DELETE /api/maps/:id
POST   /api/maps/:id/duplicate

# Map Execution
POST   /api/maps/:id/execute          # Execute with parameters
GET    /api/maps/:id/preview          # Preview (limited rows)
POST   /api/maps/:id/export          # Export to Excel/CSV

# Map Scheduling
GET    /api/maps/:id/schedules
POST   /api/maps/:id/schedules
PUT    /api/schedules/:id
DELETE /api/schedules/:id
GET    /api/schedules/:id/results

# Scheduled Results
GET    /api/scheduled-results
GET    /api/scheduled-results/:id
GET    /api/scheduled-results/:id/download

# Users & Security
GET    /api/users
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id
GET    /api/users/:id/grants
POST   /api/users/:id/grants
DELETE /api/users/:id/grants/:grantId

# Row Security Policies
GET    /api/security-policies
POST   /api/security-policies
PUT    /api/security-policies/:id
DELETE /api/security-policies/:id

# Data Sources
GET    /api/data-sources
POST   /api/data-sources
PUT    /api/data-sources/:id
DELETE /api/data-sources/:id
POST   /api/data-sources/:id/test

# Custom Functions
GET    /api/functions
POST   /api/functions
PUT    /api/functions/:id
DELETE /api/functions/:id

# Migration
POST   /api/migration/analyze          # Analyze Discoverer 4 EUL
POST   /api/migration/run              # Run migration
GET    /api/migration/status           # Migration progress
GET    /api/migration/log              # Migration log

# Query Log / Audit
GET    /api/audit/queries
GET    /api/audit/queries/:id
```

---

## 6. Docker Architecture

### 6.1 Docker Compose Structure

```yaml
# docker-compose.yml
version: '3.9'

services:
  # ---- PostgreSQL (Config DB + Cached Results) ----
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: discoverer_neo
      POSTGRES_USER: dn_admin
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dn_admin"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - discoverer-neo

  # ---- Redis (Job Queue + Cache) ----
  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory-policy noeviction
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - discoverer-neo

  # ---- Backend API ----
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://dn_admin:${POSTGRES_PASSWORD}@postgres:5432/discoverer_neo
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      ORACLE_HOST: ${ORACLE_HOST}
      ORACLE_PORT: ${ORACLE_PORT:-1521}
      ORACLE_SERVICE_NAME: ${ORACLE_SERVICE_NAME}
      ORACLE_USER: ${ORACLE_USER}
      ORACLE_PASSWORD: ${ORACLE_PASSWORD}
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - export_data:/app/exports
    networks:
      - discoverer-neo
    restart: unless-stopped

  # ---- Frontend ----
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - discoverer-neo
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  export_data:

networks:
  discoverer-neo:
    driver: bridge
```

### 6.2 Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build

FROM oraclelinux:9-slim AS oracle-client
RUN microdnf install -y oracle-instantclient-release-el9 && \
    microdnf install -y oracle-instantclient-basic oracle-instantclient-sqlplus && \
    microdnf clean all

FROM node:22-alpine AS production
# Copy Oracle Instant Client
COPY --from=oracle-client /usr/lib/oracle /usr/lib/oracle
COPY --from=oracle-client /etc/ld.so.conf.d/oracle-instantclient.conf /etc/ld.so.conf.d/
RUN ldconfig

ENV LD_LIBRARY_PATH=/usr/lib/oracle/21/client64/lib
ENV ORACLE_LIB_DIR=/usr/lib/oracle/21/client64/lib

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/exports

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### 6.3 Frontend Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 7. Oracle Connectivity Architecture

### 7.1 Connection Strategy

```
┌─────────────────────────────────────────────────────────┐
│                  Backend API Container                    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Oracle Connection Pool Manager           │   │
│  │                                                    │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │   │
│  │  │ Pool 1   │  │ Pool 2   │  │ Pool 3   │  ...  │   │
│  │  │ (EUL     │  │ (Finance │  │ (HR      │       │   │
│  │  │  Schema) │  │  Schema) │  │  Schema) │       │   │
│  │  └──────────┘  └──────────┘  └──────────┘       │   │
│  │                                                    │   │
│  │  • Each data source has its own connection pool    │   │
│  │  • Pools created on-demand, cached for reuse       │   │
│  │  • Max pool size: 10 connections per data source   │   │
│  │  • Connection timeout: 30 seconds                  │   │
│  │  • Idle timeout: 10 minutes                        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              SQL Generation Engine                 │   │
│  │                                                    │   │
│  │  • Translates map definitions → Oracle SQL         │   │
│  │  • Applies row-level security predicates           │   │
│  │  • Handles parameters, conditions, aggregations    │   │
│  │  • Supports Oracle-specific functions              │   │
│  │  • Query timeout enforcement                       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Why Not GraphQL

After careful analysis, **GraphQL is not recommended** for the data query layer:

1. **Discoverer's core function is SQL execution** — users build queries that translate directly to SQL. GraphQL adds an unnecessary abstraction layer between the user's query and the actual Oracle SQL.
2. **Dynamic SQL generation** — The SQL must be dynamically generated based on user-selected items, conditions, joins, and aggregations. GraphQL's typed schema conflicts with this dynamic nature.
3. **Performance** — For large dataset retrieval (100k+ rows), REST with streaming is more efficient than GraphQL's response parsing.
4. **Simplicity** — REST endpoints like `POST /api/maps/:id/execute` with parameter bodies are more straightforward for this use case.

**GraphQL may be considered later** for the metadata API (business areas, folders, items) if the frontend benefits from flexible querying, but it is not the primary API pattern.

### 7.3 Why node-oracledb Thick Mode

**Thick mode** is chosen over thin mode because:

1. **Full Oracle feature support** — Advanced Queuing, Transparent Application Failover (TAF), Oracle Advanced Security
2. **Better SQL compatibility** — Some Oracle-specific SQL syntax and functions only work with thick mode
3. **EUL compatibility** — The user's existing Discoverer setup likely uses Oracle-specific features (PL/SQL functions, packages)
4. **Oracle Instant Client in Docker** — Oracle provides official container images, making thick mode deployment straightforward

---

## 8. Map Execution Engine

### 8.1 SQL Generation Flow

```
User's Map Definition
        │
        ▼
┌───────────────────┐
│ 1. Resolve Items   │ ──▶ Look up each selected item in the items table
│    (columns)       │     Get column_name, formula, data_type, agg_function
└───────┬───────────┘
        ▼
┌───────────────────┐
│ 2. Resolve Joins   │ ──▶ Auto-detect joins between folders
│                    │     Use explicit joins table for custom joins
└───────┬───────────┘
        ▼
┌───────────────────┐
│ 3. Build SELECT    │ ──▶ SELECT item1, item2, SUM(item3), ...
│    clause          │     Include calculated fields with their formulas
└───────┬───────────┘
        ▼
┌───────────────────┐
│ 4. Build FROM      │ ──▶ FROM table1 [alias]
│    clause          │     JOIN table2 ON condition
└───────┬───────────┘
        ▼
┌───────────────────┐
│ 5. Apply Security  │ ──▶ AND (row_security_predicate)
│    Predicates      │     Injected transparently per folder
└───────┬───────────┘
        ▼
┌───────────────────┐
│ 6. Apply User      │ ──▶ AND (user_condition_1)
│    Conditions      │     AND (user_condition_2 OR user_condition_3)
└───────┬───────────┘
        ▼
┌───────────────────┐
│ 7. Apply           │ ──▶ GROUP BY non-aggregated items
│    Aggregation     │     HAVING post-aggregation filters
└───────┬───────────┘
        ▼
┌───────────────────┐
│ 8. Apply Sorting   │ ──▶ ORDER BY item1 ASC, item2 DESC
└───────┬───────────┘
        ▼
┌───────────────────┐
│ 9. Apply Row       │ ──▶ FETCH FIRST N ROWS ONLY (for preview)
│    Limits          │     No limit for full execution
└───────┬───────────┘
        ▼
   Final Oracle SQL
```

### 8.2 Example Generated SQL

```sql
-- Map: "Invoice Analysis by Supplier"
-- User selected: Supplier Name, Invoice Date, Invoice Amount (SUM)
-- Condition: Invoice Date >= :start_date (parameter)
-- Security: Org-level filter injected

SELECT
    pv.vendor_name                    AS "Supplier Name",
    ai.invoice_date                   AS "Invoice Date",
    SUM(ai.invoice_amount)            AS "Total Invoice Amount",
    COUNT(ai.invoice_id)              AS "Invoice Count"
FROM
    ap_invoices_all ai
    JOIN po_vendors pv ON ai.vendor_id = pv.vendor_id
WHERE
    -- Row-level security (injected)
    ai.org_id = TO_NUMBER(:org_id)
    -- User condition (parameter)
    AND ai.invoice_date >= TO_DATE(:start_date, 'YYYY-MM-DD')
    -- User condition (static)
    AND ai.invoice_status = 'APPROVED'
GROUP BY
    pv.vendor_name,
    ai.invoice_date
ORDER BY
    "Total Invoice Amount" DESC
```

---

## 9. Export System

### 9.1 Export Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Export Service                         │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Export Request                       │    │
│  │  POST /api/maps/:id/export                       │    │
│  │  { format: 'XLSX'|'CSV', parameters: {...} }    │    │
│  └──────────────────┬──────────────────────────────┘    │
│                     │                                    │
│                     ▼                                    │
│  ┌─────────────────────────────────────────────────┐    │
│  │         Background Job (BullMQ)                   │    │
│  │                                                   │    │
│  │  1. Execute query against Oracle                  │    │
│  │  2. Stream results row-by-row                     │    │
│  │  3. Write to file (streaming)                     │    │
│  │  4. Store file reference in PostgreSQL            │    │
│  │  5. Notify user (email or in-app)                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │         Excel Export (ExcelJS)                    │    │
│  │  • Streaming writer for large datasets            │    │
│  │  • Supports 1M+ rows in .xlsx format             │    │
│  │  • Formatting: dates, numbers, headers            │    │
│  │  • Multiple sheets for crosstab reports           │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │         CSV Export (fast-csv)                     │    │
│  │  • Streaming write                                │    │
│  │  • No row limit                                   │    │
│  │  • UTF-8 with BOM for Excel compatibility         │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 9.2 Export Limits Comparison

| Format | Old Discoverer | Discoverer Neo |
|---|---|---|
| .xls (old) | 65,536 rows | ❌ Not supported |
| .xlsx | ❌ Not supported | 1,048,576 rows (Excel limit) |
| CSV | Limited | Unlimited (streaming) |

---

## 10. Migration Strategy from Discoverer 4

### 10.1 Migration Phases

```
Phase 1: Assessment
├── Connect to Discoverer 4 Oracle EUL schema
├── Query EUL5_BA, EUL5_OBJS, EUL5_EXPRESSIONS, etc.
├── Generate inventory report
└── Identify active vs. orphaned objects

Phase 2: Schema Migration
├── Create Discoverer Neo PostgreSQL schema
├── Migrate data sources (Oracle connection configs)
├── Migrate business areas
├── Migrate folders (with table/view mappings)
├── Migrate items (columns, calculations, conditions)
├── Migrate joins
├── Migrate hierarchies
└── Migrate custom functions

Phase 3: Map/Workbook Migration
├── Query EUL5_DOCUMENTS for workbook definitions
├── Parse workbook XML content
├── Recreate maps in Discoverer Neo
├── Migrate parameters and conditions
└── Validate map definitions

Phase 4: Security Migration
├── Migrate user accounts
├── Migrate business area grants
├── Migrate row-level security policies
└── Migrate map sharing settings

Phase 5: Validation
├── Run side-by-side comparison
├── Execute migrated maps against Oracle
├── Compare results with original Discoverer
└── User acceptance testing
```

### 10.2 Migration Tool

A standalone CLI tool (`dn-migrate`) will be provided:

```bash
# Analyze existing Discoverer 4 EUL
docker run discoverer-neo/migrate analyze \
  --oracle-host=oracle-server \
  --oracle-port=1521 \
  --oracle-service=PROD \
  --eul-schema=EUL5_US

# Run migration
docker run discoverer-neo/migrate run \
  --oracle-host=oracle-server \
  --oracle-port=1521 \
  --oracle-service=PROD \
  --eul-schema=EUL5_US \
  --pg-host=postgres \
  --pg-database=discoverer_neo \
  --dry-run

# Validate migration
docker run discoverer-neo/migrate validate \
  --pg-host=postgres \
  --pg-database=discoverer_neo
```

---

## 11. Frontend Application Structure

### 11.1 Page Structure

```
Discoverer Neo (React SPA)
│
├── /login                          # Login page
├── /dashboard                      # User dashboard (recent maps, scheduled results)
│
├── /admin                          # Admin section
│   ├── /admin/business-areas       # Business area management
│   ├── /admin/folders              # Folder management
│   ├── /admin/joins                # Join management
│   ├── /admin/hierarchies          # Hierarchy management
│   ├── /admin/functions            # Custom function registration
│   ├── /admin/data-sources         # Data source configuration
│   ├── /admin/users                # User management
│   ├── /admin/security             # Security policies
│   └── /admin/migration            # Migration tool UI
│
├── /maps                           # Map (workbook) section
│   ├── /maps                       # Map list
│   ├── /maps/new                   # Create new map (wizard)
│   ├── /maps/:id                   # View/execute map
│   ├── /maps/:id/edit              # Edit map definition
│   ├── /maps/:id/results           # View cached results
│   └── /maps/:id/schedule          # Schedule management
│
├── /explorer                       # Ad-hoc data explorer
│   └── /explorer                   # Drag-and-drop query builder
│
└── /schedules                      # Global schedule management
    ├── /schedules                  # All schedules
    └── /schedules/:id/results      # Scheduled execution results
```

### 11.2 Key UI Components

```
Map Builder (the core UI)
│
├── Business Area Selector          # Left panel: tree of business areas → folders → items
├── Canvas Area                     # Center: drag items here to build query
│   ├── Selected Columns            # Items selected for the query
│   ├── Conditions Panel            # Filter conditions (WHERE clause)
│   ├── Sort Panel                  # Sort order configuration
│   ├── Aggregation Panel           # Group by / aggregate functions
│   └── Calculated Fields           # Add custom formula columns
├── Parameters Panel                # Runtime parameter configuration
├── Preview Panel                   # Live data preview (first 100 rows)
└── Toolbar
    ├── Run                         # Execute query
    ├── Save                        # Save map definition
    ├── Export                      # Export to Excel/CSV
    ├── Schedule                    # Set up scheduling
    └── Share                       # Share with other users
```

---

## 12. Security Architecture

### 12.1 Authentication

- **JWT-based authentication** with access + refresh tokens
- Access token expiry: 15 minutes
- Refresh token expiry: 7 days
- Passwords hashed with bcrypt (cost factor 12)
- Session tracking in Redis

### 12.2 Authorization (RBAC)

| Role | Permissions |
|---|---|
| **ADMIN** | Full access to all features, user management, migration |
| **MANAGER** | Create/edit maps, manage schedules, export data, view all business areas |
| **USER** | Create/edit own maps, export data, access granted business areas |
| **VIEWER** | View shared maps, export data, no map creation |

### 12.3 Row-Level Security

Row-level security policies are injected into every SQL query, exactly like Discoverer's Security Managers:

```sql
-- Original query
SELECT * FROM invoices WHERE status = 'APPROVED'

-- After security injection (user belongs to ORG_ID = 101)
SELECT * FROM invoices 
WHERE status = 'APPROVED'
AND org_id = 101  -- <-- Injected by row_security_policies table
```

Policies can be:
- **Per-folder**: Applied to all queries touching that folder
- **Per-business-area**: Applied to all folders in the area
- **Per-user or per-role**: Different predicates for different users
- **Multiple policies**: ANDed together (same as Discoverer behavior)

---

## 13. Project Structure

```
discoverer-neo/
├── docker-compose.yml
├── .env.example
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── drizzle.config.ts
│   ├── src/
│   │   ├── main.ts                    # Fastify app entry
│   │   ├── config.ts                  # Environment config
│   │   ├── plugins/                   # Fastify plugins
│   │   │   ├── database.ts            # Drizzle/PostgreSQL
│   │   │   ├── redis.ts               # Redis connection
│   │   │   ├── oracle.ts              # Oracle connection pool
│   │   │   ├── auth.ts                # JWT authentication
│   │   │   └── bullmq.ts              # BullMQ setup
│   │   ├── modules/                   # Feature modules
│   │   │   ├── auth/
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   └── auth.routes.ts
│   │   │   ├── business-areas/
│   │   │   ├── folders/
│   │   │   ├── items/
│   │   │   ├── joins/
│   │   │   ├── hierarchies/
│   │   │   ├── maps/
│   │   │   │   ├── maps.controller.ts
│   │   │   │   ├── maps.service.ts
│   │   │   │   ├── maps.routes.ts
│   │   │   │   └── sql-generator.ts   # SQL generation engine
│   │   │   ├── execution/
│   │   │   │   ├── execution.controller.ts
│   │   │   │   ├── execution.service.ts
│   │   │   │   └── oracle-runner.ts   # Oracle query execution
│   │   │   ├── export/
│   │   │   │   ├── export.controller.ts
│   │   │   │   ├── export.service.ts
│   │   │   │   ├── excel-exporter.ts
│   │   │   │   └── csv-exporter.ts
│   │   │   ├── scheduling/
│   │   │   │   ├── scheduling.controller.ts
│   │   │   │   ├── scheduling.service.ts
│   │   │   │   └── scheduler.worker.ts
│   │   │   ├── security/
│   │   │   │   ├── security.controller.ts
│   │   │   │   ├── security.service.ts
│   │   │   │   └── row-level-security.ts
│   │   │   ├── migration/
│   │   │   │   ├── migration.controller.ts
│   │   │   │   ├── migration.service.ts
│   │   │   │   ├── eul-reader.ts       # Read Discoverer EUL tables
│   │   │   │   └── transformers.ts    # EUL → DN Neo schema
│   │   │   ├── users/
│   │   │   ├── data-sources/
│   │   │   ├── functions/
│   │   │   └── audit/
│   │   ├── middleware/
│   │   │   ├── authenticate.ts
│   │   │   ├── authorize.ts
│   │   │   └── validate.ts
│   │   └── utils/
│   │       ├── logger.ts
│   │       └── errors.ts
│   ├── drizzle/                       # Database migrations
│   │   ├── migrations/
│   │   └── schema.ts
│   └── tests/
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── nginx.conf
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/                       # API client layer
│   │   │   ├── client.ts
│   │   │   └── endpoints/
│   │   ├── components/
│   │   │   ├── ui/                    # shadcn/ui components
│   │   │   ├── layout/                # App layout
│   │   │   ├── map-builder/           # Map builder components
│   │   │   │   ├── BusinessAreaTree.tsx
│   │   │   │   ├── SelectedColumns.tsx
│   │   │   │   ├── ConditionsPanel.tsx
│   │   │   │   ├── SortPanel.tsx
│   │   │   │   ├── CalculatedFieldDialog.tsx
│   │   │   │   └── PreviewTable.tsx
│   │   │   ├── admin/                 # Admin components
│   │   │   └── common/                # Shared components
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── MapList.tsx
│   │   │   ├── MapBuilder.tsx
│   │   │   ├── MapViewer.tsx
│   │   │   ├── AdminDashboard.tsx
│   │   │   └── ScheduleManager.tsx
│   │   ├── stores/                    # Zustand stores
│   │   │   ├── auth-store.ts
│   │   │   └── map-builder-store.ts
│   │   ├── hooks/                     # Custom React hooks
│   │   │   ├── use-maps.ts
│   │   │   ├── use-execution.ts
│   │   │   └── use-export.ts
│   │   └── utils/
│   │       ├── formatters.ts
│   │       └── validators.ts
│   └── tests/
│
└── migrate/                          # Migration CLI tool
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── index.ts
        ├── analyze.ts
        ├── migrate.ts
        └── validate.ts
```

---

## 14. Performance Considerations

### 14.1 Query Performance

| Strategy | Implementation |
|---|---|
| **Connection Pooling** | node-oracledb pool with min:2, max:10 per data source |
| **Query Timeout** | Configurable per map (default: 5 minutes, max: 30 minutes) |
| **Row Limit** | Preview: 100 rows, Full execution: configurable (default: 100k) |
| **Streaming** | Oracle result streaming for large datasets (no memory overflow) |
| **Result Caching** | Scheduled results stored in PostgreSQL for instant retrieval |
| **Indexes** | PostgreSQL indexes on all foreign keys and frequently queried columns |

### 14.2 Scalability

- **Horizontal scaling**: Multiple backend containers behind Nginx load balancer
- **Redis Cluster**: For BullMQ if job volume exceeds single Redis capacity
- **Read replicas**: PostgreSQL read replicas for query log and audit tables
- **Export offloading**: Large exports processed by dedicated worker containers

---

## 15. Monitoring & Observability

| Component | Tool | Purpose |
|---|---|---|
| Logging | Pino (structured JSON) | Application logs |
| Metrics | Prometheus + Grafana | System metrics, query performance |
| Health Checks | Fastify healthcheck | Docker health monitoring |
| Query Log | PostgreSQL query_execution_log | Audit trail, performance analysis |
| Error Tracking | Sentry (optional) | Error monitoring |

---

*End of Architecture Document*
