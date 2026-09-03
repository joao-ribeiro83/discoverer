DISCOVERER_NEO_SUMMARY.md content:
# Discoverer Neo — Project Summary

## What is Discoverer Neo?

**Discoverer Neo** is a modern, open-source replacement for Oracle Discoverer 4, built with current technologies and designed to run entirely in Docker containers. It replicates all the features you currently use in Discoverer while removing the limitations (like the 65,000-row Excel limit).

## Key Improvements Over Discoverer 4

| Feature | Discoverer 4 | Discoverer Neo |
|---|---|---|
| **Platform** | Windows XP (fat client) | Web browser (any OS) |
| **Excel Export** | .xls format, max 65,536 rows | .xlsx format, 1,000,000+ rows |
| **CSV Export** | Limited | Unlimited rows, streaming |
| **Architecture** | Client-server | 3-tier web (React + Node.js + PostgreSQL) |
| **Deployment** | Windows installation | Docker Compose (single command) |
| **Oracle Connection** | Oracle Client on Windows | Oracle Instant Client in Docker |
| **Scheduling** | Built-in scheduler | BullMQ (more flexible, cron-based) |
| **User Management** | Oracle DB users | Internal user database with RBAC |
| **Status** | Desupported since 2012 | Modern, actively maintainable |

## Architecture at a Glance

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│  React 19    │────▶│  Node.js     │
│   (any OS)   │     │  Frontend    │     │  Backend     │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                                          ┌──────┴───────┐
                                          │              │
                                    ┌─────▼─────┐ ┌─────▼─────┐
                                    │ PostgreSQL │ │   Redis    │
                                    │ (config +  │ │ (job queue │
                                    │  results)  │ │  + cache)  │
                                    └───────────┘ └───────────┘
                                          │
                                    ┌─────▼─────┐
                                    │   Oracle   │
                                    │  Database  │
                                    │ (source)   │
                                    └───────────┘
```

## Technology Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, shadcn/ui, TanStack Table
- **Backend:** Node.js 22, TypeScript, Fastify, Drizzle ORM
- **Databases:** PostgreSQL 16 (config + results), Redis 7 (job queue)
- **Oracle:** node-oracledb 6 (thick mode) with Oracle Instant Client in Docker
- **Jobs:** BullMQ for scheduling and export processing
- **Export:** ExcelJS (.xlsx), fast-csv (CSV)
- **Deployment:** Docker Compose (4 containers)

## Feature Parity with Your Current Discoverer Usage

### What You Use Today → What Discoverer Neo Provides

**Discoverer Administrator:**
- ✅ Business Areas → Business Areas (same concept)
- ✅ Folders (tables/views) → Folders (same types: TABLE, VIEW, COMPLEX, etc.)
- ✅ User privileges → RBAC (ADMIN, MANAGER, USER, VIEWER)
- ✅ Registered functions → Custom function registration
- ✅ Security conditions → Row-level security policies (SQL injection, same as Security Managers)

**Discoverer User Edition:**
- ✅ Maps (workbooks) → Maps (same concept, web-based builder)
- ✅ Variables before execution → Runtime parameters (same concept)
- ✅ Function columns → Custom function items in maps
- ✅ Aggregations → SUM, COUNT, AVG, MIN, MAX with GROUP BY
- ✅ Sorting → Multi-column sort configuration
- ✅ Calculation fields → Calculated fields with formula editor
- ✅ Scheduling with time validity → Cron-based scheduling with validity windows
- ✅ Excel export → .xlsx export (1M+ rows, not 65k!)
- ✅ CSV export for large data → Streaming CSV (unlimited rows)
- ✅ User-specific map sharing → Map sharing (private, public, selective)

## Migration Path

A dedicated migration tool will:
1. **Analyze** your existing Discoverer 4 EUL (read EUL5_* tables)
2. **Extract** all business areas, folders, items, joins, functions, maps, and security settings
3. **Transform** the metadata into Discoverer Neo's PostgreSQL schema
4. **Validate** the migration by comparing results

```bash
# Run migration in one command:
docker run discoverer-neo/migrate run \
  --oracle-host=your-oracle-server \
  --eul-schema=EUL5_US \
  --pg-host=postgres
```

## Execution Plan (16-20 weeks)

| Phase | Duration | What Gets Built |
|---|---|---|
| **Phase 0** | Week 1-2 | Docker infrastructure, project setup, database schema |
| **Phase 1** | Week 3-5 | Metadata management (business areas, folders, items, joins, auth) |
| **Phase 2** | Week 6-9 | Map builder engine (SQL generation, execution, parameters) |
| **Phase 3** | Week 8-12 | Frontend UI (map builder, admin panel, dashboard) |
| **Phase 4** | Week 11-14 | Export (Excel/CSV) and scheduling (BullMQ) |
| **Phase 5** | Week 13-16 | Security policies and Discoverer 4 migration tool |
| **Phase 6** | Week 17-20 | Testing, optimization, documentation, production deployment |

## Getting Started

All the detailed documentation is in this repository:

- **`DISCOVERER_NEO_ARCHITECTURE.md`** — Full technical architecture (database schema, API design, Docker config, security)
- **`DISCOVERER_NEO_EXECUTION_PLAN.md`** — Detailed phased execution plan with tasks and timeline

---

*Discoverer Neo — The modern replacement for Oracle Discoverer*

DISCOVERER_NEO_ARCHITECTURE.md content:
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

DISCOVERER_NEO_PLAN_REVIEW.md content:
# Discoverer Neo — Plan Review & Status Assessment

> **Version:** 1.0
> **Date:** 2026-07-12
> **Reviewed by:** Claude Fable 5
> **Scope:** Verification of actual project status against the planning documents, critique of the plan, and recommended course corrections.

---

## 1. Current Status (verified against the code, not the docs)

| Phase | Sessions | Planned Deliverable | Actual Status |
|---|---|---|---|
| **Phase 0** — Setup & Infrastructure | 0.1–0.6 (6) | Docker stack, scaffolding, DB schema | ✅ **Complete** (verified by `INTEGRATION_TEST_REPORT.md`, 2026-06-24 — all services ran, 25 tables migrated, seed applied) |
| **Phase 1** — Metadata Backend | 1.1–1.7 (7) | Auth, data sources, business areas, folders, items, joins, hierarchies, custom functions, Swagger, tests | ✅ **Complete in code** — 8 route modules, 8 services, RBAC middleware, 9 unit + 9 integration test files. `tsc --noEmit` passes (verified 2026-07-12) |
| **Phase 2** — Query Engine | 2.1–2.5 (5) | Maps CRUD, SQL generator, execution service | ❌ **Not started** |
| **Phase 3** — Map Builder UI | 3.1–3.6 (6) | React admin + map builder | ❌ **Not started** (only a 2-file health-check placeholder in `discoverer-neo/frontend/src/`) |
| **Phase 4** — Export & Scheduling | 4.1–4.3 (3) | ExcelJS/CSV export, BullMQ schedules | ❌ Not started |
| **Phase 5** — Security & Migration | 5.1–5.7 (7) | Row security, EUL migration tool | ❌ Not started (`migrate/` contains only Dockerfiles + empty package) |
| **Phase 6** — Polish & Deploy | 6.1–6.4 (4) | Tests, docs, production readiness | ❌ Not started |

**Overall: 13 of 38 sessions complete (~34%).** The project is **not finished** — the two completed phases are foundation work; the application's core value (map builder + SQL engine + UI) has not been built yet.

> Note: `DISCOVERER_NEO_SESSION_PLAN.md` claims "Total Sessions: 28" in its header but actually defines 38.

## 2. Structural Defects Found

### 2.1 The Session 0.4 frontend was created in the wrong directory (HIGH)
The full frontend scaffolding (40 files: shadcn/ui components, layout, 12 placeholder pages, auth store, API client, Vite/Tailwind config) was created at **`E:\claude\discoverer\frontend\`** (the knowledge-base repo root) instead of **`E:\claude\discoverer\discoverer-neo\frontend\`**. During Session 0.6 integration testing, the (empty) monorepo frontend was "fixed" with a minimal placeholder (`App.tsx` + `main.tsx`) — the misplacement went unnoticed. The stray root `package-lock.json` is fallout from the same accident.

**Fix:** move the scaffolding into `discoverer-neo/frontend/`, rename the package to `@discoverer-neo/frontend`, and verify build.

### 2.2 Zero git commits (HIGH)
The repository has **no commits at all** — roughly two weeks of planning documents and working code exist only on disk. One `rm -rf`, disk failure, or misdirected cleanup destroys everything. The session plan never mandated commit checkpoints.

**Fix:** commit an initial baseline immediately; from then on, one commit per session minimum.

### 2.3 Oracle Instant Client is silently broken (MEDIUM)
The Docker build's Instant Client download 404s and was patched to be "best-effort" (Issue 5 in the integration report). Consequence: **thick-mode `node-oracledb` will not work at runtime**, and nothing in the code calls `initOracleClient` anyway. The problem is deferred, not solved — it will resurface the first time a real Oracle data source is tested.

**Fix (better design):** default to node-oracledb **thin mode** — pure JS driver, no Instant Client, no special Docker layers. It supports Oracle DB 12.1+. Keep thick mode as an opt-in env flag (`ORACLE_THICK_MODE=true` + `ORACLE_CLIENT_PATH`) for older databases.

**Caveat that the plan never addresses:** Discoverer 4-era source databases can be Oracle 9i/10g. Thin mode needs 12.1+; thick mode with a 19c client needs 11.2+. **Determine the actual Oracle DB version of the legacy EUL host before Phase 5** — if it is older than 11.2, the migration tool needs a different extraction path (e.g., DB export/upgrade or a JDBC-based extractor).

### 2.4 Tests require a live database but nothing manages that (MEDIUM)
Even the "unit" tests insert rows into a real PostgreSQL (`app.inject` + Drizzle against `localhost:5432`). With Docker Desktop stopped (as found today), the entire suite hangs. There is no CI, no testcontainers, no documented precondition.

**Fix:** document `docker compose up -d postgres redis` as a test precondition in the README, and add a CI workflow (GitHub Actions with a `postgres:16` + `redis:7` service container) running typecheck + lint + tests on every push.

## 3. Could the plan be improved? — Yes, in these specific ways

The existing plan is genuinely good: self-contained session prompts, correct Discoverer 4 → Neo concept mapping, a risk register, and an EUL3/4/5 version adapter (Session 5.3 + `EUL_VERSION_REFERENCE.md`). The technology choices (Fastify, Drizzle, React 19, BullMQ, ExcelJS streaming) are sound and current. **It should be amended, not rewritten.** The amendments:

### 3.1 Compile calculated fields into SQL — don't re-implement SQL in JavaScript
Session 2.4 as written evaluates calculated-field formulas **in JavaScript over the result rows**. That means re-implementing Oracle's `SUBSTR`/`TRUNC`/`CASE` semantics in JS — a permanent source of subtle divergence, and aggregates over calculated fields become impossible. Discoverer itself compiled calculations into the query.

**Better:** parse formulas with a small, strict expression grammar (tokenizer → AST → validation against an allowlisted function set + item references resolved from metadata) and **emit them as SQL expressions inside the generated SELECT**. One evaluation engine (Oracle's), correct aggregation, and the AST doubles as the injection-safety gate.

### 3.2 Harden the SQL generation contract
The plan says "bind variables for user values" (good) but also "static values (properly escaped)" (bad — escaping is how injections happen). Amended contract:
- **Every** runtime value — static or parameter — becomes a bind variable. No exceptions.
- Identifiers (owners, tables, columns) are never taken from request input; they are resolved from the metadata tables and validated against `^[A-Za-z][A-Za-z0-9_#$]*$` before being quoted into SQL.
- Formulas/custom SQL pass the AST allowlist described above; `COMPLEX` folder SQL is validated to be a single SELECT statement.

### 3.3 Deliver a vertical slice before finishing Phase 2/3 breadth
The plan builds the whole backend engine (Phase 2), then the whole UI (Phase 3). That is ~8 weeks with no user-visible product. Amended ordering: after Sessions 2.1–2.3, build a **minimal end-to-end slice** — login → pick a saved map → execute → results grid → CSV download. This de-risks the full stack integration early and gives the stakeholder something to react to.

### 3.4 Pull the EUL migration spike forward
The risk register itself rates "Complex EUL parsing" **High impact / High probability**, yet the migration tool is scheduled last (Phase 5). Amended: build the read-only `analyze` command (connect, detect EUL version, dump counts of business areas/folders/items/workbooks) as a spike right after the vertical slice. If the real EUL has surprises, better to learn while the schema can still adapt.

### 3.5 Engineering discipline additions
- Git: initial baseline commit now; a commit per session; move to the `main` branch.
- CI: GitHub Actions running typecheck + lint + tests with service containers.
- Secrets: the seed admin password (`admin123`) and JWT secret defaults must be flagged as dev-only; production checklist item to rotate.
- Session plan header corrected (38 sessions, not 28).

## 4. Work completed in the 2026-07-12 session

1. ✅ **Backend health verified** — `tsc --noEmit` clean; full unit suite run against Docker Postgres/Redis.
2. ✅ **Frontend consolidated** — the misplaced scaffolding moved into `discoverer-neo/frontend/` (package renamed `@discoverer-neo/frontend`, Vite config merged: Tailwind + `@/` alias + Docker-aware proxy without the `/api`-stripping rewrite, since the backend serves `/api/*` natively). Typecheck and production build verified. Stray root `frontend/`, `package-lock.json`, and an empty mangled-name directory removed. Backend now also serves `/api/health` alongside `/health`.
3. ✅ **Session 2.1 implemented** — `map.service.ts` (CRUD with items/conditions/parameters/calculated fields, duplicate, XML export, `canAccessMap` owner/share/public/grant logic), `routes/maps.ts` + `routes/map-shares.ts`, `maps.is_active` migration (0002). 24 new tests, all passing.
4. ✅ **Session 2.2 implemented** — SQL generation engine in `lib/sql/` (identifiers, AST-based formula parser with function allowlist, select/from/where/group-by/order-by/pagination builders, `GenerationContext`) + `services/sql-generator.ts` (pure `generateSql` + DB-backed `generateSqlForMap`). Hardened contract from §3.2: every runtime value is a bind variable, identifiers validated+quoted, formulas re-emitted from a parsed AST, join paths computed via BFS over join metadata with LEFT/RIGHT flipping. Calculated fields compile into SQL (§3.1) rather than being evaluated in JS. 32 new tests, all passing — including injection-attempt, circular-formula, and disconnected-join cases.
5. ✅ **Pre-existing defects fixed** (found while verifying):
   - Global Fastify error handler was registered **after** routes, so it never applied (routes snapshot their error handler at registration time). Moved before registrations; validation errors now return descriptive messages instead of "Bad Request".
   - `custom-function.service.getById` and `hierarchy.service.getById` returned soft-deleted rows (DELETE→GET gave 200).
   - COMPLEX folders with empty custom SQL were accepted.
   - Creating a TABLE folder with Oracle unreachable returned 500 instead of 400.
   - Strict-null compile errors in two test suites; three auth tests registered routes on an already-listening app; folders suite left `Other BA` residue breaking reruns.
   - (Separately, via user-launched background task: entity-scoped route auth now resolves the owning business area — `business-area-entity-auth.test.ts`.)

   **Final result: 273/273 backend unit tests passing** (was 141/150 at session start; 56 tests added for the new map + SQL-generator code, plus the auth-fix regression suite).
6. ⬜ **Still recommended:** initial git baseline commit (repo has zero commits — awaiting owner approval), CI workflow, EUL assessment spike (§3.4), Oracle DB version check for the legacy source (§2.3), Session 2.3+ (map execution service — use node-oracledb thin mode).

---

*End of review.*


DISCOVERER_NEO_SESSION_PLAN.md content:
# Discoverer Neo — Session-by-Session Development Plan

> **Version:** 1.2
> **Date:** 2026-06-23 (updated 2026-07-14 — added per-session model & effort recommendations; updated 2026-07-20 — added Phase 7: Internationalization, Theming & User Preferences)
> **Based on:** `DISCOVERER_NEO_EXECUTION_PLAN.md` (v1.1) + `DISCOVERER_NEO_ARCHITECTURE.md` (v1.0)
> **Total Sessions:** 47 across 8 phases (Phase 0–7)
> **Estimated Duration:** 16–20 weeks (full-time, 2–3 developers) for Phases 0–6, +3–4 weeks for Phase 7

---

## How This Document Is Organized

Each phase contains:
- **Phase summary** — goal, duration, prerequisites
- **Sessions** — discrete, self-contained units of work
- Each session defines:
  - **Goal** — what this session accomplishes
  - **Scope** — files/modules touched
  - **Agents** — which agents to spawn (with coordination notes)
  - **Skills** — which skills to invoke
  - **Model / Effort** — recommended Claude model and reasoning-effort level for the session
  - **Prompt** — copy-paste-ready prompt for a fresh Claude Code session
  - **Deliverables** — acceptance criteria to verify before moving on
  - **Dependencies** — which sessions must complete first

---

## Model & Effort Recommendations

Each session's field table includes a **Model / Effort** row: the Claude model and reasoning-effort level to select (e.g., via `/model`) when starting that session in a fresh Claude Code instance.

| Model | Model ID | Use for |
|---|---|---|
| **Sonnet 5** | `claude-sonnet-5` | The workhorse — scaffolding, standard CRUD, tests, documentation, well-specified high-volume work |
| **Opus 4.8** | `claude-opus-4-8` | Security-sensitive code, complex async/streaming logic, complex interactive UI, performance work |
| **Fable 5** | `claude-fable-5` | The hardest reasoning — SQL generation engine, row-level security, legacy EUL schema reverse-engineering |

Effort levels trade speed and cost for reasoning depth:

- **Low** — mechanical, fully specified work (boilerplate, simple CRUD)
- **Medium** — the default for standard implementation and test writing
- **High** — where subtle correctness matters (security, crypto, SQL generation, streaming, debugging)

When a session mixes tiers of work, run the primary implementation agent at the listed model/effort; supporting review agents can run one tier lower.

---

## Pre-Session: Environment Verification

> **Date:** 2026-06-23
> **Verified by:** OWL (automated check)

### Environment Status

| Requirement | Expected | Actual | Status |
|---|---|---|---|
| Git repository | Exists | Exists (no commits yet) | ✅ Ready |
| Docker Desktop | Installed & running | v29.5.3, server v29.5.3 | ✅ Running |
| Node.js | 22 LTS | **v26.3.1** | ✅ Compatible (newer, backward-compatible) |
| npm | — | 11.16.0 | ✅ Ready |
| Architecture docs | Accessible | `DISCOVERER_NEO_ARCHITECTURE.md` found | ✅ Ready |

### Notes on Node.js Version

The architecture document specifies Node.js 22 LTS, but the installed version is **v26.3.1**. This is fully compatible — v26 supports all features used in the plan (ES2022, ESM, etc.). The Docker images in the plan use `node:22-alpine` which is intentional for production (smaller, LTS). For local development, v26 works without changes.

### Target Project Directory

The actual Discoverer Neo project will be created at:
```
E:\claude\discoverer\discoverer-neo\
```
This directory does **not** exist yet. Session 0.1 will create it. The knowledge base repository at `E:\claude\discoverer\` is separate and will not be modified by the development sessions.

---

Before starting Session 0.1, ensure:
- [x] Git repository tooling is available (git installed)
- [x] Docker Desktop is installed and running (v29.5.3)
- [x] Node.js is available (v26.3.1 — compatible with architecture's v22 requirement)
- [x] Access to the Discoverer Neo architecture and execution plan documents
- [ ] The `discoverer-neo/` project directory will be created in Session 0.1

---

# PHASE 0: Project Setup & Infrastructure

> **Goal:** Docker Compose stack runs locally. Backend responds to health check. Frontend loads with basic layout. Database schema is created.
> **Duration:** 1–2 weeks
> **Prerequisites:** None

---

## Session 0.1 — Monorepo & Tooling Initialization

| Field | Value |
|---|---|
| **Goal** | Create the monorepo structure with TypeScript, ESLint, Prettier, and Git configuration |
| **Scope** | Root directory structure, `backend/`, `frontend/`, `migrate/` directories. Package manifests, TS configs, linting configs |
| **Skills** | `typescript-docs`, `builder-smoke-test` |
| **Agents** | `implement` (primary), `auditor` (review) |
| **Model / Effort** | Sonnet 5 — low. Well-specified boilerplate config generation |
| **Dependencies** | None |

**Prompt:**
```
You are setting up the monorepo for Discoverer Neo, a modern open-source BI tool (open-source replacement for Oracle Discoverer).

Create the following structure in the current working directory:

```
discoverer-neo/
├── backend/          # Node.js + TypeScript + Fastify API
├── frontend/         # React 19 + TypeScript + Vite SPA
├── migrate/          # Discoverer 4 EUL migration tool
├── docker-compose.yml
├── docker-compose.dev.yml
├── .gitignore
├── .env.example
└── README.md
```

Requirements:
1. Root `package.json` with workspaces: backend, frontend, migrate
2. TypeScript strict mode config (tsconfig.json) at root, extended by each workspace
3. ESLint flat config with TypeScript support
4. Prettier config
5. .gitignore for Node.js projects (node_modules, dist, .env, etc.)
6. .env.example with all required env vars:
   - POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
   - REDIS_HOST, REDIS_PORT
   - JWT_SECRET
   - ORACLE_CLIENT_PATH (for Oracle Instant Client in Docker)
   - BACKEND_PORT (default 3000)
   - FRONTEND_PORT (default 5173)
7. README.md with project overview and quickstart instructions

Do NOT install dependencies yet. Just create the directory structure and config files.
```

**Deliverables:**
- ✅ Directory structure created (backend/, frontend/, migrate/)
- ✅ Root package.json with workspaces
- ✅ TypeScript strict mode config
- ✅ ESLint + Prettier configs
- ✅ .gitignore and .env.example
- ✅ README.md with project overview

---

## Session 0.2 — Docker Infrastructure

| Field | Value |
|---|---|
| **Goal** | Create all Dockerfiles and Docker Compose configurations for the full stack |
| **Scope** | `Dockerfile` (backend, frontend, migrate), `docker-compose.yml`, `docker-compose.dev.yml`, Nginx config, Oracle Instant Client setup |
| **Skills** | `docker`, `docker-compose`, `docker-deployment` |
| **Agents** | `docker-expert` (primary), `implement` (supporting) |
| **Model / Effort** | Sonnet 5 — high. Multi-stage builds and Oracle Instant Client setup are fiddly |
| **Dependencies** | Session 0.1 |

**Prompt:**
```
You are setting up Docker infrastructure for Discoverer Neo, a Node.js + React + PostgreSQL + Redis application that connects to Oracle databases.

The project root is the current working directory. It already has backend/, frontend/, and migrate/ directories (mostly empty from scaffolding).

Create the following files:

### 1. docker-compose.yml (production-like)
Services:
- **postgres**: postgres:16, port 5432, volume for data persistence, healthcheck
- **redis**: redis:7, port 6379, healthcheck
- **backend**: builds from backend/Dockerfile, port 3000, depends on postgres + redis, env vars from .env
- **frontend**: builds from frontend/Dockerfile, port 80 (Nginx), depends on backend
- **nginx**: reverse proxy (or use the frontend container with Nginx)

### 2. docker-compose.dev.yml (development)
Same services but:
- Hot reload for backend (tsx watch / nodemon)
- Hot reload for frontend (Vite dev server on port 5173)
- Volume mounts for source code
- Exposed ports for debugging

### 3. backend/Dockerfile
Multi-stage build:
- Stage 1: Install dependencies (including Oracle Instant Client)
- Stage 2: Build TypeScript
- Stage 3: Production image with node:22-slim + Oracle Instant Client
- Use non-root user

### 4. frontend/Dockerfile
Multi-stage build:
- Stage 1: Install dependencies and build with Vite
- Stage 2: Nginx to serve static files
- Include SPA fallback routing

### 5. migrate/Dockerfile
Simple Node.js image that runs migration scripts.

### 6. nginx/nginx.conf
Reverse proxy configuration:
- /api/* → backend:3000
- /* → frontend:80 (static files)
- WebSocket support for Vite HMR in dev mode

Important: The Oracle Instant Client should be installed in the backend image. Use the official Oracle Instant Client Linux binaries (19c or 21c). Include the LD_LIBRARY_PATH configuration.

Do NOT create any application code. Only Docker and infrastructure files.
```

**Deliverables:**
- ✅ `docker-compose.yml` with all services
- ✅ `docker-compose.dev.yml` with hot reload
- ✅ `backend/Dockerfile` (multi-stage with Oracle Instant Client)
- ✅ `frontend/Dockerfile` (multi-stage with Nginx)
- ✅ `migrate/Dockerfile`
- ✅ `nginx/nginx.conf`
- ✅ All services start with `docker compose up` (Oracle Instant Client download may require network)

---

## Session 0.3 — Backend Scaffolding (Fastify + Drizzle)

| Field | Value |
|---|---|
| **Goal** | Initialize the backend project with Fastify, TypeScript, Drizzle ORM, and all core plugins |
| **Scope** | `backend/` directory — package.json, tsconfig, Fastify app structure, Drizzle config, plugin registration, health check endpoint |
| **Skills** | `async-patterns`, `backend-api-patterns`, `drizzle-orm` |
| **Agents** | `backend-specialist` (primary), `api-scaffolding-backend-architect` (architecture guidance) |
| **Model / Effort** | Sonnet 5 — medium. Standard scaffolding from a detailed spec |
| **Dependencies** | Session 0.1 |

**Prompt:**
```
You are scaffolding the backend for Discoverer Neo, a modern BI tool built with Node.js 22 + TypeScript + Fastify.

The project root is the current working directory. The `backend/` directory exists but is mostly empty (just config files from monorepo setup).

Create the following in `backend/`:

### 1. package.json
Dependencies:
- fastify@5, @fastify/cors, @fastify/jwt, @fastify/helmet, @fastify/sensible
- drizzle-orm, pg (postgres driver)
- ioredis (Redis client)
- zod (validation)
- pino (logging, Fastify default)
- bcryptjs (password hashing)
- jsonwebtoken
- exceljs, fast-csv (export)
- node-oracledb (Oracle driver — may fail to install without Oracle Client libs; that's OK)

Dev dependencies:
- typescript, tsx, @types/node, @types/pg, @types/bcryptjs
- drizzle-kit
- jest, @types/jest, ts-jest
- eslint, prettier

### 2. tsconfig.json
Strict mode, ES2022 target, moduleResolution "node", outDir "dist", rootDir "src".

### 3. src/config.ts
Environment variable loading with Zod validation. Export a config object with:
- port, host
- postgres connection string
- redis connection string
- jwtSecret, jwtExpiresIn
- oracle client path
- log level

### 4. src/db/index.ts
Drizzle ORM connection to PostgreSQL. Export the db instance and schema (empty for now — tables will be added in later sessions).

### 5. src/db/schema.ts
Drizzle schema definitions. Start with just the users table:
```typescript
// users table
// id, email, passwordHash, name, role (ADMIN, MANAGER, USER, VIEWER), createdAt, updatedAt
```

### 6. src/plugins/
- `src/plugins/auth.ts` — JWT authentication plugin (decorate fastify with authenticate method)
- `src/plugins/cors.ts` — CORS configuration
- `src/plugins/helmet.ts` — Security headers
- `src/plugins/sensible.ts` — Sensible defaults
- `src/plugins/redis.ts` — Redis connection plugin

### 7. src/routes/health.ts
Health check endpoint: GET /health → returns { status: 'ok', timestamp: '...' }

### 8. src/app.ts
Fastify app factory function. Register all plugins, register routes, set up error handling. Export the app.

### 9. src/server.ts
Entry point: import app, start listening on configured port.

### 10. drizzle.config.ts
Drizzle Kit config for PostgreSQL migrations.

### 11. jest.config.js
Jest config for TypeScript testing.

Do NOT implement any business logic routes yet. Just the scaffolding. Run `npm install` in the backend directory after creating all files.
```

**Deliverables:**
- ✅ `backend/package.json` with all dependencies
- ✅ `backend/tsconfig.json` (strict mode)
- ✅ `backend/src/config.ts` (env validation with Zod)
- ✅ `backend/src/db/index.ts` + `db/schema.ts` (Drizzle connection + users table)
- ✅ `backend/src/plugins/` (auth, cors, helmet, sensible, redis)
- ✅ `backend/src/routes/health.ts`
- ✅ `backend/src/app.ts` + `server.ts`
- ✅ `backend/drizzle.config.ts`
- ✅ `backend/jest.config.js`
- ✅ `npm install` completes successfully

---

## Session 0.4 — Frontend Scaffolding (React + Vite + Tailwind)

| Field | Value |
|---|---|
| **Goal** | Initialize the frontend project with React 19, Vite, Tailwind CSS 4, shadcn/ui, and all core libraries |
| **Scope** | `frontend/` directory — package.json, Vite config, Tailwind setup, React app structure, routing, API client, Zustand store |
| **Skills** | `vite-expert`, `vite-shadcn-tailwind4`, `react`, `react-component-performance` |
| **Agents** | `application-performance-frontend-developer` (primary), `frontend-mobile-development-frontend-developer` (supporting) |
| **Model / Effort** | Sonnet 5 — medium. High-volume but well-specified boilerplate |
| **Dependencies** | Session 0.1 |

**Prompt:**
```
You are scaffolding the frontend for Discoverer Neo, a modern BI tool built with React 19 + TypeScript + Vite.

The project root is the current working directory. The `frontend/` directory exists but is mostly empty.

Create the following in `frontend/`:

### 1. package.json
Dependencies:
- react@19, react-dom@19
- react-router-dom@7
- @tanstack/react-query@5
- @tanstack/react-table@8
- zustand
- axios (API client)
- react-hook-form, @hookform/resolvers, zod
- @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
- recharts
- lucide-react (icons)
- clsx, tailwind-merge (utility for class merging)

Dev dependencies:
- vite@6, @vitejs/plugin-react
- typescript, @types/react, @types/react-dom
- tailwindcss@4, @tailwindcss/vite
- @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-select, @radix-ui/react-tabs, @radix-ui/react-toast, @radix-ui/react-tooltip, @radix-ui/react-popover, @radix-ui/react-checkbox, @radix-ui/react-label, @radix-ui/react-separator, @radix-ui/react-slot, @radix-ui/react-scroll-area
- class-variance-authority
- vitest, @testing-library/react, @testing-library/jest-dom, jsdom
- eslint, prettier, eslint-config-prettier, eslint-plugin-react-hooks, eslint-plugin-react-refresh

### 2. vite.config.ts
- React plugin
- Tailwind CSS plugin (@tailwindcss/vite)
- Path aliases: @/ → src/
- Dev server proxy: /api → http://localhost:3000

### 3. tsconfig.json
Strict mode, ES2022, JSX "react-jsx", moduleResolution "bundler", path aliases (@/* → src/*).

### 4. index.html
Standard Vite entry HTML.

### 5. src/main.tsx
React DOM render, wrap in BrowserRouter, QueryClientProvider.

### 6. src/App.tsx
Root component with React Router setup. Define routes:
- `/login` → LoginPage (placeholder)
- `/` → Layout (sidebar + main content) with nested routes:
  - `/dashboard` → DashboardPage (placeholder)
  - `/admin/business-areas` → BusinessAreasPage (placeholder)
  - `/admin/folders` → FoldersPage (placeholder)
  - `/admin/items` → ItemsPage (placeholder)
  - `/admin/data-sources` → DataSourcesPage (placeholder)
  - `/admin/users` → UsersPage (placeholder)
  - `/maps` → MapsListPage (placeholder)
  - `/maps/:id` → MapBuilderPage (placeholder)
  - `/maps/:id/view` → MapViewerPage (placeholder)
  - `/schedules` → SchedulesPage (placeholder)
  - `/admin/migration` → MigrationPage (placeholder)

### 7. src/lib/api.ts
Axios instance with:
- Base URL from VITE_API_URL env
- Request interceptor to add JWT token from localStorage
- Response interceptor for 401 handling (redirect to login)
- Typed API client methods (placeholder — actual endpoints added later)

### 8. src/lib/utils.ts
Utility functions:
- `cn(...classes)` — clsx + tailwind-merge helper
- `formatDate`, `formatNumber` — formatting utilities

### 9. src/store/auth.ts
Zustand store for auth state:
- user, token, isAuthenticated
- login(), logout()
- persist to localStorage

### 10. src/components/ui/
Initialize shadcn/ui by creating the following components (use New York style):
- button.tsx, input.tsx, label.tsx, card.tsx, dialog.tsx, dropdown-menu.tsx, select.tsx, tabs.tsx, toast.tsx, tooltip.tsx, popover.tsx, checkbox.tsx, separator.tsx, scroll-area.tsx, badge.tsx, table.tsx, skeleton.tsx

### 11. src/components/layout/
- Layout.tsx — Main layout with sidebar + header + main content area
- Sidebar.tsx — Navigation sidebar with links to all main pages
- Header.tsx — Top bar with user menu (logout)

### 12. src/index.css
Tailwind CSS v4 import with custom CSS variables for theming (light/dark mode support).

### 13. vitest.config.ts
Vitest config with jsdom environment, path aliases, setup file for @testing-library/jest-dom.

### 14. src/vite-env.d.ts
Vite client types reference.

Run `npm install` in the frontend directory after creating all files. Do NOT create any business logic yet.
```

**Deliverables:**
- ✅ `frontend/package.json` with all dependencies
- ✅ `frontend/vite.config.ts` (React + Tailwind + path aliases + proxy)
- ✅ `frontend/tsconfig.json` (strict mode)
- ✅ `frontend/index.html`
- ✅ `frontend/src/main.tsx`, `App.tsx` (with all route placeholders)
- ✅ `frontend/src/lib/api.ts` (Axios client with auth interceptor)
- ✅ `frontend/src/lib/utils.ts`
- ✅ `frontend/src/store/auth.ts` (Zustand auth store)
- ✅ `frontend/src/components/ui/` (shadcn/ui components)
- ✅ `frontend/src/components/layout/` (Layout, Sidebar, Header)
- ✅ `frontend/src/index.css` (Tailwind + theme variables)
- ✅ `frontend/vitest.config.ts`
- ✅ `npm install` completes successfully
- ✅ `npx tsc --noEmit` passes with no errors

---

## Session 0.5 — Database Schema & Migrations

| Field | Value |
|---|---|
| **Goal** | Define the full Drizzle ORM schema for all Discoverer Neo metadata tables and generate/apply migrations |
| **Scope** | `backend/src/db/schema.ts` — all tables from the architecture document, migration files |
| **Skills** | `drizzle-orm`, `drizzle-orm-patterns`, `database-schema-designer` |
| **Agents** | `db-expert` (primary), `postgres-expert` (review) |
| **Model / Effort** | Sonnet 5 — high. 25 interrelated tables; foreign-key and index correctness matters |
| **Dependencies** | Session 0.3 |

**Prompt:**
```
You are defining the database schema for Discoverer Neo, a modern BI tool. The backend uses Drizzle ORM with PostgreSQL 16.

The project root is the current working directory. The backend has Drizzle ORM set up with a db instance in `backend/src/db/index.ts`.

Update `backend/src/db/schema.ts` to include ALL tables from the architecture document. The full schema:

1. **users** — id, email (unique), passwordHash, name, role (ADMIN/MANAGER/USER/VIEWER), createdAt, updatedAt
2. **data_sources** — id, name (unique), description, connectionType (oracle/postgres), host, port, serviceName, sid, username, passwordEnc, connectionString, isActive, createdAt, updatedAt
3. **business_areas** — id, name (unique), description, createdBy, createdAt, updatedBy, updatedAt, isActive
4. **user_business_area_grants** — id, userId (FK users), businessAreaId (FK business_areas), permissionLevel (CREATE/EDIT/DELETE/EXPORT/SCHEDULE/VIEW), grantedBy, grantedAt
5. **folders** — id, businessAreaId (FK), name, description, folderType (TABLE/VIEW/DERIVED/COMPLEX/JOIN/SUMMARY), tableName, tableOwner, customSql, dataSourceId (FK), displayOrder, isActive, createdBy, createdAt, updatedAt
6. **items** — id, folderId (FK), name, description, itemType (CI/CU/CO/JI/HI/AG/FU), columnName, formula, dataType, formatMask, aggFunction, displayOrder, isHidden, isActive, parentItemId (FK self-referential), createdBy, createdAt, updatedAt
7. **joins** — id, name, leftFolderId (FK folders), rightFolderId (FK folders), leftItemId (FK items), rightItemId (FK items), joinType (INNER/LEFT/RIGHT/FULL), isActive, createdAt
8. **hierarchies** — id, name, description, businessAreaId (FK), isActive, createdAt, updatedAt
9. **hierarchy_levels** — id, hierarchyId (FK), levelName, itemId (FK items), levelNumber, createdAt
10. **custom_functions** — id, name, description, functionType (SQL/PLSQL/PACKAGE), parameters (JSONB), returnType, isActive, createdAt
11. **maps** — id, name, description, mapType (TABLE/CROSSTAB/PAGE_DETAIL/CHART), businessAreaId (FK), createdBy (FK users), isPublic, createdAt, updatedAt
12. **map_items** — id, mapId (FK), itemId (FK items), displayOrder, displayName, formatMask, aggFunction, sortDirection (ASC/DESC/null), sortOrder, columnWidth, createdAt
13. **map_conditions** — id, mapId (FK), itemId (FK items), operator (=/<>/</>=/LIKE/IN/BETWEEN/IS_NULL), value, paramName, conditionType (PARAMETER/STATIC), groupId (for grouping), logicOperator (AND/OR), displayOrder, createdAt
14. **map_parameters** — id, mapId (FK), name, paramType (STRING/NUMBER/DATE/LIST), defaultValue, isRequired, createdAt
15. **map_calculated_fields** — id, mapId (FK), name, formula, displayOrder, createdAt
16. **map_shares** — id, mapId (FK), sharedWithUserId (FK users), permissionLevel (VIEW/EDIT/EXPORT), sharedBy, sharedAt
17. **query_execution_log** — id, mapId (FK), executedBy (FK users), executedAt, executionTimeMs, rowCount, sqlText, errorMessage, status (SUCCESS/FAILED/TIMEOUT)
18. **export_jobs** — id, mapId (FK), requestedBy (FK users), format (XLSX/CSV), status (PENDING/PROCESSING/COMPLETED/FAILED), progress, filePath, errorMessage, createdAt, completedAt
19. **schedules** — id, mapId (FK), name, cronExpression, timezone, validFrom, validUntil, outputFormat (XLSX/CSV), isActive, createdBy (FK users), createdAt, updatedAt
20. **schedule_parameters** — id, scheduleId (FK), paramName, paramValue
21. **scheduled_results** — id, scheduleId (FK), executedAt, rowCount, filePath, executionTimeMs, status, errorMessage
22. **security_policies** — id, name, description, policyType (ROW_LEVEL), isActive, createdAt
23. **security_policy_rules** — id, policyId (FK), targetId (businessAreaId or folderId), targetType (BUSINESS_AREA/FOLDER), sqlPredicate, createdAt
24. **security_policy_assignments** — id, policyId (FK), userId (FK users, nullable), roleName (nullable) — assign to user or role
25. **audit_log** — id, userId (FK, nullable), action, entityType, entityId, details (JSONB), ipAddress, createdAt

After defining the schema:
1. Run `npx drizzle-kit generate` to create the migration SQL
2. Verify the migration looks correct
3. Create a seed script in `backend/src/db/seed.ts` that inserts:
   - An admin user (admin@discoverer.local, admin123)
   - A sample business area
   - A sample data source (with placeholder connection info)

Use Drizzle ORM v0.30+ syntax with pgTable, proper foreign keys, indexes, and timestamps.
```

**Deliverables:**
- ✅ `backend/src/db/schema.ts` with all 25 tables
- ✅ Migration SQL files generated in `backend/drizzle/`
- ✅ `backend/src/db/seed.ts` with admin user + sample data
- ✅ Schema passes `npx drizzle-kit generate` without errors
- ✅ Seed script runs successfully against PostgreSQL in Docker

---

## Session 0.6 — Full Stack Integration Verification

| Field | Value |
|---|---|
| **Goal** | Verify the entire stack works together: Docker Compose up, backend health check, frontend loads, database accessible |
| **Scope** | All Docker services, integration verification |
| **Skills** | `docker-compose`, `docker` |
| **Agents** | `docker-expert` (primary), `implement` (fixes) |
| **Model / Effort** | Sonnet 5 — high. Iterative cross-service debugging |
| **Dependencies** | Sessions 0.2, 0.3, 0.4, 0.5 |

**Prompt:**
```
You are verifying the full-stack integration for Discoverer Neo. All previous sessions have created:
- Docker infrastructure (Session 0.2)
- Backend scaffolding with Fastify + Drizzle (Session 0.3)
- Frontend scaffolding with React + Vite (Session 0.4)
- Database schema with all tables (Session 0.5)

Your job is to:
1. Run `docker compose up -d` from the project root
2. Verify all services start successfully:
   - PostgreSQL on port 5432
   - Redis on port 6379
   - Backend on port 3000
   - Frontend on port 5173 (dev) or 80 (prod)
3. Test the backend health endpoint: `curl http://localhost:3000/health`
4. Run database migrations: `docker compose exec backend npx drizzle-kit push`
5. Run the seed script: `docker compose exec backend npx tsx src/db/seed.ts`
6. Verify the frontend loads in a browser (or use curl to check the HTML is served)
7. Check that the Vite dev server proxy works: `curl http://localhost:5173/api/health` should proxy to backend
8. Fix any issues found (port conflicts, missing env vars, Docker build errors, etc.)

Document any issues found and their fixes. The goal is a fully working development environment.
```

**Deliverables:**
- ✅ `docker compose up -d` starts all services
- ✅ Backend health check returns 200 OK
- ✅ Database migrations applied successfully
- ✅ Seed data inserted
- ✅ Frontend loads and serves HTML
- ✅ API proxy works (frontend → backend)
- ✅ All issues documented and resolved

---

# PHASE 1: Core Backend — Metadata Management

> **Goal:** Full metadata CRUD API. Oracle schema introspection. User authentication and authorization. Connection pool management.
> **Duration:** 2–3 weeks
> **Prerequisites:** Phase 0 complete

---

## Session 1.1 — Authentication Module

| Field | Value |
|---|---|
| **Goal** | Implement JWT authentication with login, logout, token refresh, and role-based authorization |
| **Scope** | `backend/src/routes/auth.ts`, `backend/src/plugins/auth.ts` (update), `backend/src/middleware/authorize.ts` |
| **Skills** | `auth-expert`, `auth-implementation-patterns`, `auth0-fastify-api` |
| **Agents** | `backend-api-security-backend-security-coder` (primary), `security-reviewer` (review) |
| **Model / Effort** | Opus 4.8 — high. Security-critical: JWT lifecycle, refresh flow, token blacklist |
| **Dependencies** | Session 0.3 (backend scaffolding), Session 0.5 (users table) |

**Prompt:**
```
You are implementing authentication for Discoverer Neo, a Node.js + Fastify + TypeScript backend using Drizzle ORM with PostgreSQL.

The project root is the current working directory. The backend has:
- Fastify app in `backend/src/app.ts`
- Drizzle ORM in `backend/src/db/index.ts` with schema in `backend/src/db/schema.ts`
- Users table: id, email (unique), passwordHash, name, role (ADMIN/MANAGER/USER/VIEWER), createdAt, updatedAt
- JWT plugin registered in `backend/src/plugins/auth.ts` (basic setup)
- Config in `backend/src/config.ts` with jwtSecret, jwtExpiresIn

Implement the following:

### 1. Password hashing utility (`backend/src/lib/password.ts`)
- `hashPassword(password: string): Promise<string>` using bcryptjs (12 rounds)
- `verifyPassword(password: string, hash: string): Promise<boolean>`

### 2. Auth routes (`backend/src/routes/auth.ts`)
- `POST /api/auth/login` — email + password → returns { token, user }
  - Verify password against hash
  - Generate JWT with { sub: userId, email, role }
  - Token expires per config (default 24h)
- `POST /api/auth/refresh` — takes current token → returns new token
  - Verify current token (allow expired tokens within 7 days)
  - Issue new token
- `POST /api/auth/logout` — invalidate token (add to blacklist in Redis)
- `GET /api/auth/me` — returns current user from JWT

### 3. Authorization middleware (`backend/src/middleware/authorize.ts`)
- `authorize(...roles)` — Fastify preHandler that checks JWT and user role
- Usage: `{ preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] }`
- Also export `authorizeAdmin` shortcut for admin-only routes

### 4. Update auth plugin (`backend/src/plugins/auth.ts`)
- Register @fastify/jwt with secret from config
- Decorate fastify with `authenticate` preHandler
- Decorate fastify with `authorize` decorator

### 5. Auth tests (`backend/src/__tests__/auth.test.ts`)
- Test login with valid credentials → 200 + token
- Test login with invalid password → 401
- Test accessing protected route without token → 401
- Test accessing admin route as non-admin → 403
- Test token refresh → new token works
- Test logout → token invalidated

Use Fastify's JSON schema validation for request/response. Use Zod for runtime validation. All responses should follow a consistent format: { data: T } for success, { error: string, details?: unknown } for errors.
```

**Deliverables:**
- ✅ `backend/src/lib/password.ts` (bcrypt hashing)
- ✅ `backend/src/routes/auth.ts` (login, refresh, logout, me)
- ✅ `backend/src/middleware/authorize.ts` (role-based authorization)
- ✅ `backend/src/plugins/auth.ts` (updated with JWT decoration)
- ✅ `backend/src/__tests__/auth.test.ts` (all tests pass)
- ✅ Login returns valid JWT
- ✅ Protected routes reject unauthenticated requests
- ✅ Admin routes reject non-admin users

---

## Session 1.2 — Data Source Management

| Field | Value |
|---|---|
| **Goal** | CRUD endpoints for data sources with encrypted password storage and Oracle connection testing |
| **Scope** | `backend/src/routes/data-sources.ts`, `backend/src/services/data-source.service.ts`, `backend/src/lib/encryption.ts` |
| **Skills** | `backend-api-patterns`, `backend-security-coder` |
| **Agents** | `backend-specialist` (primary), `backend-api-security-backend-security-coder` (security review) |
| **Model / Effort** | Opus 4.8 — high. Crypto correctness (AES-256-GCM) and secret handling |
| **Dependencies** | Session 1.1 (auth for route protection) |

**Prompt:**
```
You are implementing data source management for Discoverer Neo, a Node.js + Fastify + TypeScript backend.

The project root is the current working directory. The backend has:
- Fastify app with auth (JWT + role-based authorization)
- Drizzle ORM with schema including `data_sources` table:
  id, name (unique), description, connectionType (oracle/postgres), host, port, serviceName, sid, username, passwordEnc, connectionString, isActive, createdAt, updatedAt
- Config with all env vars

Implement the following:

### 1. Encryption utility (`backend/src/lib/encryption.ts`)
- `encrypt(plaintext: string): string` — AES-256-GCM encryption using ENCRYPTION_KEY from config
- `decrypt(ciphertext: string): string` — decryption
- Store IV alongside ciphertext (prepend IV to encrypted data)

### 2. Data source service (`backend/src/services/data-source.service.ts`)
- `create(data)` — encrypt password before storing
- `update(id, data)` — re-encrypt password if changed
- `getById(id)` — decrypt password for internal use (never return to API clients)
- `list()` — return all data sources (without decrypted passwords)
- `testConnection(id)` — attempt to connect to the data source:
  - For Oracle: use node-oracledb to create a connection, execute `SELECT 1 FROM DUAL`, close connection
  - For PostgreSQL: use pg to connect, execute `SELECT 1`, close connection
  - Return { success: boolean, message: string, latencyMs: number }
- `delete(id)` — soft delete (set isActive = false)

### 3. Data source routes (`backend/src/routes/data-sources.ts`)
All routes require authentication.
- `GET /api/data-sources` — list all data sources (admin/manager only)
- `GET /api/data-sources/:id` — get one data source (without password)
- `POST /api/data-sources` — create data source (admin only)
- `PUT /api/data-sources/:id` — update data source (admin only)
- `DELETE /api/data-sources/:id` — soft delete (admin only)
- `POST /api/data-sources/:id/test` — test connection (admin/manager)

### 4. Tests (`backend/src/__tests__/data-sources.test.ts`)
- CRUD operations work correctly
- Passwords are encrypted in database (not plaintext)
- Connection test succeeds with valid Oracle/Postgres (mock the driver)
- Non-admin users cannot create/update/delete
- Data source list excludes passwords

Use Fastify JSON schema validation. All responses follow { data: T } / { error: string } format.
```

**Deliverables:**
- ✅ `backend/src/lib/encryption.ts` (AES-256-GCM)
- ✅ `backend/src/services/data-source.service.ts`
- ✅ `backend/src/routes/data-sources.ts`
- ✅ `backend/src/__tests__/data-sources.test.ts`
- ✅ Passwords encrypted at rest
- ✅ Connection testing works (mocked)
- ✅ Authorization enforced

---

## Session 1.3 — Business Area & Grant Management

| Field | Value |
|---|---|
| **Goal** | CRUD for business areas and user grants (who can access which business area with what permissions) |
| **Scope** | `backend/src/routes/business-areas.ts`, `backend/src/services/business-area.service.ts` |
| **Skills** | `backend-api-patterns` |
| **Agents** | `backend-specialist` (primary), `implement` (supporting) |
| **Model / Effort** | Sonnet 5 — medium. Standard CRUD plus grant checks |
| **Dependencies** | Session 1.1 (auth) |

**Prompt:**
```
You are implementing business area management for Discoverer Neo, a Node.js + Fastify + TypeScript backend.

The project root is the current working directory. The backend has:
- Fastify app with JWT auth and role-based authorization
- Drizzle ORM with tables:
  - `business_areas`: id, name, description, createdBy, createdAt, updatedBy, updatedAt, isActive
  - `user_business_area_grants`: id, userId (FK users), businessAreaId (FK business_areas), permissionLevel (CREATE/EDIT/DELETE/EXPORT/SCHEDULE/VIEW), grantedBy, grantedAt

Implement the following:

### 1. Business area service (`backend/src/services/business-area.service.ts`)
- `create(data, createdBy)` — create business area
- `update(id, data)` — update business area
- `getById(id)` — get with grants
- `list()` — list all active business areas
- `delete(id)` — soft delete
- `grantAccess(businessAreaId, userId, permissionLevel, grantedBy)` — create/update grant
- `revokeAccess(businessAreaId, userId)` — remove grant
- `getUserGrants(userId)` — list user's grants
- `getBusinessAreaUsers(businessAreaId)` — list users with access

### 2. Business area routes (`backend/src/routes/business-areas.ts`)
All routes require authentication.
- `GET /api/business-areas` — list all (authenticated users see their granted; admins see all)
- `GET /api/business-areas/:id` — get one (requires VIEW grant or admin)
- `POST /api/business-areas` — create (admin only)
- `PUT /api/business-areas/:id` — update (admin or EDIT grant)
- `DELETE /api/business-areas/:id` — soft delete (admin only)
- `GET /api/business-areas/:id/grants` — list grants (admin or manager)
- `POST /api/business-areas/:id/grants` — grant access (admin only)
- `DELETE /api/business-areas/:id/grants/:userId` — revoke access (admin only)

### 3. Permission check helper (`backend/src/middleware/business-area-auth.ts`)
- `requireBusinessAreaAccess(permissionLevel)` — preHandler factory
- Checks if user has the required permission level for the business area
- Admins bypass all permission checks

### 4. Tests (`backend/src/__tests__/business-areas.test.ts`)
- CRUD operations
- Grant/revoke access
- Permission enforcement (user without grant cannot access)
- Admin bypass works

Use Fastify JSON schema validation. Consistent response format.
```

**Deliverables:**
- ✅ `backend/src/services/business-area.service.ts`
- ✅ `backend/src/routes/business-areas.ts`
- ✅ `backend/src/middleware/business-area-auth.ts`
- ✅ `backend/src/__tests__/business-areas.test.ts`
- ✅ CRUD works
- ✅ Grants enforced
- ✅ Permission middleware works

---

## Session 1.4 — Folder Management

| Field | Value |
|---|---|
| **Goal** | CRUD for folders with all 6 folder types, Oracle schema introspection, and custom SQL support |
| **Scope** | `backend/src/routes/folders.ts`, `backend/src/services/folder.service.ts`, `backend/src/services/oracle-introspection.ts` |
| **Skills** | `backend-api-patterns`, `01-sql-fundamentals` |
| **Agents** | `backend-specialist` (primary), `db-expert` (Oracle introspection) |
| **Model / Effort** | Sonnet 5 — high. Oracle introspection and custom SQL validation edge cases |
| **Dependencies** | Session 1.3 (business areas) |

**Prompt:**
```
You are implementing folder management for Discoverer Neo, a Node.js + Fastify + TypeScript backend.

The project root is the current working directory. The backend has:
- Fastify app with JWT auth and business area permission middleware
- Drizzle ORM with tables:
  - `folders`: id, businessAreaId (FK), name, description, folderType (TABLE/VIEW/DERIVED/COMPLEX/JOIN/SUMMARY), tableName, tableOwner, customSql, dataSourceId (FK), displayOrder, isActive, createdBy, createdAt, updatedAt
  - `data_sources`: id, name, connectionType, host, port, serviceName, sid, username, passwordEnc, connectionString

Implement the following:

### 1. Oracle introspection service (`backend/src/services/oracle-introspection.ts`)
- `introspectSchema(dataSourceId)` — connect to Oracle, query ALL_TABLES and ALL_TAB_COLUMNS to discover tables and their columns
  - Return: [{ tableName, tableOwner, columns: [{ columnName, dataType, dataLength, nullable }] }]
- `getTableInfo(dataSourceId, tableName, tableOwner)` — get detailed column info for a specific table
- `testTableExists(dataSourceId, tableName, tableOwner)` — check if a table exists
- Cache introspection results in Redis (TTL: 5 minutes) to avoid repeated Oracle queries
- Handle Oracle connection errors gracefully

### 2. Folder service (`backend/src/services/folder.service.ts`)
- `create(data)` — create folder. For TABLE/VIEW types, validate table exists via introspection
- `update(id, data)` — update folder
- `getById(id)` — get folder with data source info
- `listByBusinessArea(businessAreaId)` — list folders in a business area
- `listByDataSource(dataSourceId)` — list folders using a data source
- `delete(id)` — soft delete
- `importFromOracle(dataSourceId, tableNames, tableOwner)` — auto-create folders from Oracle table introspection
  - For each table, create a TABLE folder with items auto-discovered from columns
- `validateCustomSql(sql)` — basic SQL validation for COMPLEX folders (prevent DDL/DML)

### 3. Folder routes (`backend/src/routes/folders.ts`)
All routes require authentication + business area access.
- `GET /api/business-areas/:baId/folders` — list folders
- `GET /api/folders/:id` — get one folder
- `POST /api/business-areas/:baId/folders` — create folder
- `PUT /api/folders/:id` — update folder
- `DELETE /api/folders/:id` — soft delete
- `POST /api/data-sources/:dsId/introspect` — trigger Oracle introspection
- `GET /api/data-sources/:dsId/tables` — list available Oracle tables
- `POST /api/data-sources/:dsId/import` — import tables as folders

### 4. Tests (`backend/src/__tests__/folders.test.ts`)
- CRUD operations
- Folder type validation
- Oracle introspection (mock node-oracledb)
- Import from Oracle creates folders + items
- Permission enforcement

Use Fastify JSON schema validation. Consistent response format.
```

**Deliverables:**
- ✅ `backend/src/services/oracle-introspection.ts`
- ✅ `backend/src/services/folder.service.ts`
- ✅ `backend/src/routes/folders.ts`
- ✅ `backend/src/__tests__/folders.test.ts`
- ✅ Oracle introspection works (with mock)
- ✅ Folder import from Oracle tables
- ✅ All 6 folder types supported

---

## Session 1.5 — Item & Join Management

| Field | Value |
|---|---|
| **Goal** | CRUD for items (all 7 types) and joins, with auto-import from Oracle columns |
| **Scope** | `backend/src/routes/items.ts`, `backend/src/routes/joins.ts`, `backend/src/services/item.service.ts`, `backend/src/services/join.service.ts` |
| **Skills** | `backend-api-patterns`, `01-sql-fundamentals` |
| **Agents** | `backend-specialist` (primary), `implement` (supporting) |
| **Model / Effort** | Sonnet 5 — medium. Standard CRUD; join validation is contained |
| **Dependencies** | Session 1.4 (folders) |

**Prompt:**
```
You are implementing item and join management for Discoverer Neo, a Node.js + Fastify + TypeScript backend.

The project root is the current working directory. The backend has:
- Fastify app with JWT auth and business area permission middleware
- Drizzle ORM with tables:
  - `items`: id, folderId (FK), name, description, itemType (CI/CU/CO/JI/HI/AG/FU), columnName, formula, dataType, formatMask, aggFunction, displayOrder, isHidden, isActive, parentItemId (FK self), createdBy, createdAt, updatedAt
  - `joins`: id, name, leftFolderId (FK), rightFolderId (FK), leftItemId (FK), rightItemId (FK), joinType (INNER/LEFT/RIGHT/FULL), isActive, createdAt
  - `folders`: (already implemented)

Implement the following:

### 1. Item service (`backend/src/services/item.service.ts`)
- `create(data)` — create item. For CI type, columnName is required
- `update(id, data)` — update item
- `getById(id)` — get item with folder info
- `listByFolder(folderId)` — list items in a folder
- `listByBusinessArea(businessAreaId)` — list all items in a business area
- `delete(id)` — soft delete
- `importFromOracleColumns(folderId, columns)` — create CI items from Oracle column introspection
- `validateFormula(formula)` — validate CU item formulas (basic SQL expression validation)
- `getDescendants(itemId)` — get hierarchical descendants (for HI items)

### 2. Join service (`backend/src/services/join.service.ts`)
- `create(data)` — create join. Validate that items belong to correct folders
- `update(id, data)` — update join
- `getById(id)` — get join with folder and item details
- `listByFolder(folderId)` — list joins involving a folder
- `listByBusinessArea(businessAreaId)` — list all joins in a business area
- `delete(id)` — soft delete
- `autoSuggestJoins(folderId)` — suggest joins based on matching column names across folders
- `validateJoin(leftItemId, rightItemId)` — ensure items exist and belong to correct folders

### 3. Item routes (`backend/src/routes/items.ts`)
All routes require authentication + business area access.
- `GET /api/folders/:folderId/items` — list items
- `GET /api/items/:id` — get one item
- `POST /api/folders/:folderId/items` — create item
- `PUT /api/items/:id` — update item
- `DELETE /api/items/:id` — soft delete
- `POST /api/folders/:folderId/items/import` — import from Oracle columns
- `GET /api/items/:id/descendants` — get hierarchical descendants

### 4. Join routes (`backend/src/routes/joins.ts`)
All routes require authentication + business area access.
- `GET /api/business-areas/:baId/joins` — list joins
- `GET /api/joins/:id` — get one join
- `POST /api/business-areas/:baId/joins` — create join
- `PUT /api/joins/:id` — update join
- `DELETE /api/joins/:id` — soft delete
- `GET /api/folders/:folderId/joins/suggestions` — auto-suggest joins

### 5. Tests (`backend/src/__tests__/items.test.ts`, `joins.test.ts`)
- CRUD for all 7 item types
- Formula validation
- Join validation (items belong to correct folders)
- Auto-suggest joins
- Hierarchical item queries
- Permission enforcement

Use Fastify JSON schema validation. Consistent response format.
```

**Deliverables:**
- ✅ `backend/src/services/item.service.ts`
- ✅ `backend/src/services/join.service.ts`
- ✅ `backend/src/routes/items.ts`
- ✅ `backend/src/routes/joins.ts`
- ✅ `backend/src/__tests__/items.test.ts`
- ✅ `backend/src/__tests__/joins.test.ts`
- ✅ All 7 item types work
- ✅ Join auto-suggestion works
- ✅ Hierarchical items supported

---

## Session 1.6 — Hierarchy & Custom Function Management

| Field | Value |
|---|---|
| **Goal** | CRUD for hierarchies and custom function registration |
| **Scope** | `backend/src/routes/hierarchies.ts`, `backend/src/routes/custom-functions.ts`, `backend/src/services/hierarchy.service.ts`, `backend/src/services/custom-function.service.ts` |
| **Skills** | `backend-api-patterns` |
| **Agents** | `backend-specialist` (primary) |
| **Model / Effort** | Sonnet 5 — low. Simple CRUD |
| **Dependencies** | Session 1.5 (items) |

**Prompt:**
```
You are implementing hierarchy and custom function management for Discoverer Neo, a Node.js + Fastify + TypeScript backend.

The project root is the current working directory. The backend has:
- Fastify app with JWT auth and business area permission middleware
- Drizzle ORM with tables:
  - `hierarchies`: id, name, description, businessAreaId (FK), isActive, createdAt, updatedAt
  - `hierarchy_levels`: id, hierarchyId (FK), levelName, itemId (FK items), levelNumber, createdAt
  - `custom_functions`: id, name, description, functionType (SQL/PLSQL/PACKAGE), parameters (JSONB), returnType, isActive, createdAt

Implement the following:

### 1. Hierarchy service (`backend/src/services/hierarchy.service.ts`)
- `create(data, levels)` — create hierarchy with levels (ordered by levelNumber)
- `update(id, data, levels)` — update hierarchy and replace levels
- `getById(id)` — get hierarchy with all levels (ordered)
- `listByBusinessArea(businessAreaId)` — list hierarchies
- `delete(id)` — soft delete
- `validateLevels(levels)` — ensure each level references a valid item in the same business area

### 2. Custom function service (`backend/src/services/custom-function.service.ts`)
- `create(data)` — register a custom function
- `update(id, data)` — update function
- `getById(id)` — get function
- `listAll()` — list all custom functions
- `delete(id)` — soft delete
- `validateParameters(params)` — validate JSONB parameter definitions
- `validateFunctionType(type)` — ensure valid function type

### 3. Hierarchy routes (`backend/src/routes/hierarchies.ts`)
- `GET /api/business-areas/:baId/hierarchies` — list
- `GET /api/hierarchies/:id` — get one with levels
- `POST /api/business-areas/:baId/hierarchies` — create with levels
- `PUT /api/hierarchies/:id` — update with levels
- `DELETE /api/hierarchies/:id` — soft delete

### 4. Custom function routes (`backend/src/routes/custom-functions.ts`)
- `GET /api/custom-functions` — list all
- `GET /api/custom-functions/:id` — get one
- `POST /api/custom-functions` — register
- `PUT /api/custom-functions/:id` — update
- `DELETE /api/custom-functions/:id` — soft delete

### 5. Tests
- Hierarchy CRUD with levels
- Custom function CRUD
- Validation (levels reference valid items, parameters are valid JSONB)
- Permission enforcement

Use Fastify JSON schema validation. Consistent response format.
```

**Deliverables:**
- ✅ `backend/src/services/hierarchy.service.ts`
- ✅ `backend/src/services/custom-function.service.ts`
- ✅ `backend/src/routes/hierarchies.ts`
- ✅ `backend/src/routes/custom-functions.ts`
- ✅ Tests pass
- ✅ Hierarchies with levels work
- ✅ Custom functions with JSONB parameters work

---

## Session 1.7 — Backend Integration Testing & API Documentation

| Field | Value |
|---|---|
| **Goal** | Comprehensive integration tests for all metadata endpoints. OpenAPI documentation. |
| **Scope** | `backend/src/__tests__/integration/`, `backend/src/routes/index.ts` (add Swagger), API docs |
| **Skills** | `api-testing-observability-api-documenter`, `api-development-expert` |
| **Agents** | `api-testing-observability-api-documenter` (primary), `backend-development-tdd-orchestrator` (test orchestration) |
| **Model / Effort** | Sonnet 5 — medium. High-volume test and documentation work |
| **Dependencies** | All Session 1.1–1.6 |

**Prompt:**
```
You are writing integration tests and API documentation for Discoverer Neo's metadata management backend.

The project root is the current working directory. The backend has:
- All auth routes (login, refresh, logout, me)
- All data source routes (CRUD + connection test)
- All business area routes (CRUD + grants)
- All folder routes (CRUD + Oracle introspection + import)
- All item routes (CRUD + import + hierarchy)
- All join routes (CRUD + suggestions)
- All hierarchy routes
- All custom function routes

Implement the following:

### 1. Integration test suite (`backend/src/__tests__/integration/`)
Create a test helper that:
- Spins up the Fastify app in test mode
- Creates a test admin user and generates JWT
- Provides an `authenticatedRequest(method, url, data)` helper

Test files:
- `auth.integration.test.ts` — full auth flow
- `data-sources.integration.test.ts` — CRUD + connection test
- `business-areas.integration.test.ts` — CRUD + grants
- `folders.integration.test.ts` — CRUD + import
- `items.integration.test.ts` — CRUD + types
- `joins.integration.test.ts` — CRUD + suggestions
- `hierarchies.integration.test.ts` — CRUD + levels
- `custom-functions.integration.test.ts` — CRUD
- `rbac.integration.test.ts` — test all role-based access (ADMIN can do everything, VIEWER can only read, etc.)

### 2. OpenAPI documentation
- Add @fastify/swagger and @fastify/swagger-ui plugins
- Add JSON schemas to all routes (Fastify schema validation doubles as OpenAPI spec)
- Serve Swagger UI at /api/docs
- Document all endpoints, request bodies, response schemas, auth requirements

### 3. API health check enhancement
- Enhance GET /health to return:
  - status: 'ok'
  - version: from package.json
  - uptime: process.uptime()
  - database: 'connected' | 'disconnected' (test DB connection)
  - redis: 'connected' | 'disconnected' (test Redis connection)
  - timestamp: ISO string

Run all tests and ensure they pass. Generate the OpenAPI spec and verify Swagger UI loads.
```

**Deliverables:**
- ✅ Integration tests for all endpoints
- ✅ RBAC tests verify all role permissions
- ✅ OpenAPI/Swagger documentation at /api/docs
- ✅ Enhanced health check endpoint
- ✅ All tests pass (`npm test`)
- ✅ API documentation covers all endpoints

---

# PHASE 2: Map Builder — Core Query Engine

> **Goal:** Map builder API. SQL generation engine. Map execution against Oracle. Parameter support. Calculated fields.
> **Duration:** 3–4 weeks
> **Prerequisites:** Phase 1 complete

---

## Session 2.1 — Map Management

| Field | Value |
|---|---|
| **Goal** | CRUD for maps (workbooks) with all 4 map types and item selection |
| **Scope** | `backend/src/routes/maps.ts`, `backend/src/services/map.service.ts` |
| **Skills** | `backend-api-patterns` |
| **Agents** | `backend-specialist` (primary), `implement` (supporting) |
| **Model / Effort** | Sonnet 5 — high. Deep-copy semantics and XML export need care |
| **Dependencies** | Session 1.3 (business areas), Session 1.5 (items) |

**Prompt:**
```
You are implementing map (workbook) management for Discoverer Neo, a Node.js + Fastify + TypeScript backend.

The project root is the current working directory. The backend has:
- Full metadata API (business areas, folders, items, joins, hierarchies)
- Drizzle ORM with tables:
  - `maps`: id, name, description, mapType (TABLE/CROSSTAB/PAGE_DETAIL/CHART), businessAreaId (FK), createdBy (FK users), isPublic, createdAt, updatedAt
  - `map_items`: id, mapId (FK), itemId (FK items), displayOrder, displayName, formatMask, aggFunction, sortDirection (ASC/DESC/null), sortOrder, columnWidth, createdAt
  - `map_conditions`: id, mapId (FK), itemId (FK items), operator, value, paramName, conditionType (PARAMETER/STATIC), groupId, logicOperator (AND/OR), displayOrder, createdAt
  - `map_parameters`: id, mapId (FK), name, paramType (STRING/NUMBER/DATE/LIST), defaultValue, isRequired, createdAt
  - `map_calculated_fields`: id, mapId (FK), name, formula, displayOrder, createdAt

Implement the following:

### 1. Map service (`backend/src/services/map.service.ts`)
- `create(data, createdBy)` — create map with items, conditions, parameters, calculated fields
- `update(id, data)` — update map and replace all child entities
- `getById(id)` — get full map with items, conditions, parameters, calculated fields
- `listByUser(userId)` — list maps created by user
- `listByBusinessArea(businessAreaId)` — list maps in a business area
- `listSharedWithUser(userId)` — list maps shared with user
- `delete(id)` — soft delete
- `duplicate(id, newCreatedBy)` — deep copy a map with all items/conditions/parameters/calculated fields
- `validateMapItems(mapId)` — ensure all referenced items exist and belong to the map's business area
- `getMapAsEulXml(id)` — export map as XML (Discoverer 4 compatible format for migration)

### 2. Map routes (`backend/src/routes/maps.ts`)
All routes require authentication + business area access.
- `GET /api/business-areas/:baId/maps` — list maps
- `GET /api/maps/:id` — get full map
- `POST /api/business-areas/:baId/maps` — create map
- `PUT /api/maps/:id` — update map
- `DELETE /api/maps/:id` — soft delete
- `POST /api/maps/:id/duplicate` — duplicate map
- `GET /api/maps/:id/export` — export as XML

### 3. Map share routes (`backend/src/routes/map-shares.ts`)
- `GET /api/maps/:id/shares` — list shares
- `POST /api/maps/:id/shares` — share with user
- `PUT /api/maps/:id/shares/:userId` — update permission
- `DELETE /api/maps/:id/shares/:userId` — revoke share

### 4. Tests (`backend/src/__tests__/maps.test.ts`)
- CRUD with all child entities
- Deep copy (duplicate) preserves all data
- Validation (items belong to correct business area)
- Share management
- XML export generates valid XML
- Permission enforcement

Use Fastify JSON schema validation. Consistent response format.
```

**Deliverables:**
- ✅ `backend/src/services/map.service.ts`
- ✅ `backend/src/routes/maps.ts`
- ✅ `backend/src/routes/map-shares.ts`
- ✅ `backend/src/__tests__/maps.test.ts`
- ✅ All 4 map types supported
- ✅ Deep copy works
- ✅ XML export works

---

## Session 2.2 — SQL Generation Engine

| Field | Value |
|---|---|
| **Goal** | Build the SQL query generator that converts a map configuration into valid Oracle SQL |
| **Scope** | `backend/src/services/sql-generator.ts`, `backend/src/lib/sql/` (SQL building utilities) |
| **Skills** | `01-sql-fundamentals` |
| **Agents** | `db-expert` (primary), `backend-specialist` (integration) |
| **Model / Effort** | Fable 5 — high. Hardest core logic in the project: join-graph resolution and injection-safe SQL generation |
| **Dependencies** | Session 2.1 (maps), Session 1.5 (items, joins) |

**Prompt:**
```
You are building the SQL generation engine for Discoverer Neo, a BI tool that converts visual map configurations into Oracle SQL queries.

The project root is the current working directory. The backend has:
- Full metadata API (items, joins, folders, business areas)
- Map configuration: map_items, map_conditions, map_parameters, map_calculated_fields
- Joins table: leftFolderId, rightFolderId, leftItemId, rightItemId, joinType

Implement the following:

### 1. SQL builder utilities (`backend/src/lib/sql/`)
- `select-clause.ts` — Build SELECT from map_items
  - Handle aggregation (SUM, COUNT, AVG, MIN, MAX)
  - Handle calculated fields (map_calculated_fields)
  - Handle column aliases (displayName)
  - Handle DISTINCT
- `from-clause.ts` — Build FROM + JOINs
  - Resolve folders to their underlying tables
  - Apply joins from the joins table
  - Handle join types: INNER, LEFT, RIGHT, FULL
  - Handle table aliases
- `where-clause.ts` — Build WHERE from map_conditions
  - Handle operators: =, <>, <, >, <=, >=, LIKE, IN, BETWEEN, IS NULL
  - Handle compound conditions (AND/OR with grouping via groupId)
  - Handle parameter placeholders (`:param_name` for bind variables)
  - Handle static values (properly escaped)
- `group-by-clause.ts` — Build GROUP BY for aggregate queries
  - Auto-detect when GROUP BY is needed (any aggregate function present)
  - Include all non-aggregated SELECT columns
- `order-by-clause.ts` — Build ORDER BY from map_items sort configuration
  - Handle ASC/DESC
  - Handle sort order priority
- `pagination.ts` — Add pagination (OFFSET / FETCH FIRST for Oracle 12c+)
  - Row limit support

### 2. Main SQL generator (`backend/src/services/sql-generator.ts`)
- `generateSql(mapId, parameterValues?)` — main function
  - Fetch map configuration from DB
  - Build complete SQL: SELECT ... FROM ... WHERE ... GROUP BY ... ORDER BY
  - Return: { sql: string, bindParams: Record<string, unknown>, hasAggregates: boolean }
- `validateSql(sql)` — basic SQL validation (no DDL, no DROP, etc.)
- `explainSql(sql)` — generate EXPLAIN PLAN for Oracle (for debugging)
- `applyRowSecurity(sql, securityPredicates)` — inject security policy predicates into WHERE clause

### 3. Type definitions (`backend/src/types/sql.ts`)
- TypeScript types for SQL generation input/output
- Map to Discoverer Neo's map configuration types

### 4. Tests (`backend/src/__tests__/sql-generator.test.ts`)
Test SQL generation for:
- Simple SELECT with no joins
- SELECT with JOINs (all types)
- SELECT with aggregations (GROUP BY)
- SELECT with WHERE conditions (all operators)
- SELECT with compound conditions (AND/OR grouping)
- SELECT with parameters (bind variables)
- SELECT with calculated fields
- SELECT with ORDER BY
- SELECT with pagination
- Complex query: JOINs + aggregations + conditions + sorting + pagination
- Verify generated SQL is syntactically valid (use a SQL parser like node-sql-parser)

Important: Use parameterized queries (bind variables) for all user-provided values. NEVER concatenate user values into SQL strings.
```

**Deliverables:**
- ✅ `backend/src/lib/sql/` (all clause builders)
- ✅ `backend/src/services/sql-generator.ts`
- ✅ `backend/src/types/sql.ts`
- ✅ `backend/src/__tests__/sql-generator.test.ts`
- ✅ Generates valid Oracle SQL for all map types
- ✅ Uses bind variables for all user values
- ✅ Handles all 6 join types and all condition operators

---

## Session 2.3 — Map Execution Service

| Field | Value |
|---|---|
| **Goal** | Execute generated SQL against Oracle with connection pooling, timeouts, streaming, and logging |
| **Scope** | `backend/src/services/map-execution.service.ts`, `backend/src/routes/map-execution.ts`, `backend/src/services/oracle-connection-pool.ts` |
| **Skills** | `backend-api-patterns`, `backend-security-coder` |
| **Agents** | `backend-specialist` (primary), `backend-api-security-backend-security-coder` (security review) |
| **Model / Effort** | Opus 4.8 — high. Connection pooling, streaming, timeouts, and cancellation are subtle |
| **Dependencies** | Session 2.2 (SQL generator) |

**Prompt:**
```
You are implementing the map execution service for Discoverer Neo, a BI tool that executes SQL queries against Oracle databases.

The project root is the current working directory. The backend has:
- SQL generator that produces { sql, bindParams }
- Data source management with Oracle connection configs
- node-oracledb available (thick mode)
- Redis for caching
- Query execution log table: id, mapId, executedBy, executedAt, executionTimeMs, rowCount, sqlText, errorMessage, status

Implement the following:

### 1. Oracle connection pool service (`backend/src/services/oracle-connection-pool.ts`)
- Maintain a Map of connection pools (keyed by data_source_id)
- Pool configuration: min 2, max 10 connections, idle timeout 5 minutes
- `getConnection(dataSourceId)` — get a connection from the pool
- `releaseConnection(dataSourceId, connection)` — return to pool
- `closeAll()` — cleanup on shutdown
- Handle Oracle Instant Client initialization
- Thick mode: `oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_PATH })`

### 2. Map execution service (`backend/src/services/map-execution.service.ts`)
- `executeMap(mapId, parameterValues, userId)` — main execution flow:
  1. Fetch map configuration
  2. Generate SQL
  3. Apply row-level security predicates
  4. Get connection from pool
  5. Execute with timeout (default 30s, configurable per map)
  6. Stream results for large datasets
  7. Log execution to query_execution_log
  8. Return: { columns, rows, rowCount, executionTimeMs }
- `executeMapAsync(mapId, parameterValues, userId)` — for large result sets:
  1. Create export job record
  2. Queue execution via BullMQ
  3. Return { jobId: string }
- `getExecutionStatus(jobId)` — check async execution status
- `cancelExecution(jobId)` — cancel running query
- `getExecutionHistory(mapId, limit)` — recent executions for a map

### 3. Map execution routes (`backend/src/routes/map-execution.ts`)
All routes require authentication.
- `POST /api/maps/:id/execute` — execute map synchronously
  - Body: { parameters: Record<string, unknown> }
  - Returns: { columns, rows (first 1000), rowCount, executionTimeMs, truncated: boolean }
- `POST /api/maps/:id/execute-async` — execute asynchronously (for large datasets)
  - Returns: { jobId }
- `GET /api/maps/:id/executions/:jobId` — get async execution status
- `DELETE /api/maps/:id/executions/:jobId` — cancel execution
- `GET /api/maps/:id/history` — execution history

### 4. Execution safeguards
- Maximum rows returned synchronously: 1000
- Maximum execution time: 30 seconds (configurable)
- SQL validation before execution (no DDL, no DROP, etc.)
- Connection timeout: 10 seconds
- Query timeout: statement-level timeout via node-oracledb

### 5. Tests (`backend/src/__tests__/map-execution.test.ts`)
- Mock node-oracledb for tests
- Test successful execution
- Test timeout handling
- Test parameter binding
- Test async execution flow
- Test execution logging
- Test cancellation

Use Fastify JSON schema validation. Consistent response format.
```

**Deliverables:**
- ✅ `backend/src/services/oracle-connection-pool.ts`
- ✅ `backend/src/services/map-execution.service.ts`
- ✅ `backend/src/routes/map-execution.ts`
- ✅ `backend/src/__tests__/map-execution.test.ts`
- ✅ Synchronous execution returns results
- ✅ Async execution creates job
- ✅ Timeout and cancellation work
- ✅ Execution logging works

---

## Session 2.4 — Map Parameters & Calculated Fields

| Field | Value |
|---|---|
| **Goal** | Runtime parameter resolution and calculated field evaluation |
| **Scope** | `backend/src/services/parameter-resolver.ts`, `backend/src/services/calculated-field-evaluator.ts` |
| **Skills** | `01-sql-fundamentals` |
| **Agents** | `backend-specialist` (primary) |
| **Model / Effort** | Opus 4.8 — high. Formula parsing and parameter binding are an injection surface |
| **Dependencies** | Session 2.3 (execution service) |

**Prompt:**
```
You are implementing parameter resolution and calculated field evaluation for Discoverer Neo.

The project root is the current working directory. The backend has:
- Map execution service
- Map parameters table: id, mapId, name, paramType (STRING/NUMBER/DATE/LIST), defaultValue, isRequired
- Map calculated fields table: id, mapId, name, formula, displayOrder

Implement the following:

### 1. Parameter resolver (`backend/src/services/parameter-resolver.ts`)
- `resolveParameters(mapId, providedValues)` — resolve all parameters for a map:
  1. Fetch map_parameters from DB
  2. For each parameter:
     - If provided in providedValues, use it
     - Else if defaultValue exists, use default
     - Else if isRequired, throw error
  3. Type-cast values based on paramType:
     - STRING: as-is
     - NUMBER: parse as number, validate
     - DATE: parse as ISO date, convert to Oracle TO_DATE format
     - LIST: split by comma, return as array for IN clause
  4. Return: { resolved: Record<string, unknown>, missing: string[] }
- `validateParameterValue(param, value)` — type validation
- `buildPromptParameters(mapId)` — return parameter definitions for UI prompt dialog

### 2. Calculated field evaluator (`backend/src/services/calculated-field-evaluator.ts`)
- `evaluateCalculatedFields(rows, calculatedFields)` — add calculated columns to result rows:
  1. For each calculated field:
     2. Parse the formula (supports: arithmetic + -, string functions SUBSTR/ LENGTH/ UPPER/ LOWER, date functions TRUNC/ TO_CHAR, conditional CASE WHEN, references to other items by name)
     3. Evaluate for each row
     4. Add result as new column
  3. Return modified rows with calculated columns
- `validateFormula(formula)` — validate formula syntax before saving
  - Check for balanced parentheses
  - Check for valid function names
  - Check for valid item references
  - Reject dangerous operations (no EXECUTE, no PL/SQL blocks)

### 3. Integration with execution service
- Update map-execution.service.ts to:
  1. Resolve parameters before SQL generation
  2. Inject parameter values into SQL bind params
  3. Evaluate calculated fields on result rows before returning

### 4. Tests (`backend/src/__tests__/parameters.test.ts`, `calculated-fields.test.ts`)
- Parameter resolution with all types
- Default values work
- Required parameter validation
- Type casting (NUMBER, DATE, LIST)
- Calculated field evaluation (arithmetic, string, date, conditional)
- Formula validation (valid and invalid formulas)
- Integration with execution service

Use Fastify JSON schema validation. Consistent response format.
```

**Deliverables:**
- ✅ `backend/src/services/parameter-resolver.ts`
- ✅ `backend/src/services/calculated-field-evaluator.ts`
- ✅ Updated execution service with parameter + calculated field support
- ✅ Tests pass
- ✅ All 4 parameter types work
- ✅ Calculated fields evaluate correctly
- ✅ Formula validation rejects invalid input

---

## Session 2.5 — Query Engine Integration Testing

| Field | Value |
|---|---|
| **Goal** | End-to-end testing of the full query engine: map → SQL → execution → results |
| **Scope** | `backend/src/__tests__/integration/query-engine.test.ts` |
| **Skills** | `backend-development-tdd-orchestrator` |
| **Agents** | `backend-development-tdd-orchestrator` (primary), `backend-specialist` (fixes) |
| **Model / Effort** | Sonnet 5 — medium. Integration tests over existing code |
| **Dependencies** | All Session 2.1–2.4 |

**Prompt:**
```
You are writing end-to-end integration tests for Discoverer Neo's query engine.

The project root is the current working directory. The backend has:
- Map management (CRUD with items, conditions, parameters, calculated fields)
- SQL generation engine (produces Oracle SQL with bind variables)
- Map execution service (executes against Oracle via node-oracledb)
- Parameter resolver and calculated field evaluator

Write comprehensive integration tests in `backend/src/__tests__/integration/query-engine.test.ts`:

### Test scenarios:
1. **Simple table map**: Create a map with 3 items, no conditions → generate SQL → execute → verify results
2. **Map with JOINs**: Create a map with items from 2 folders joined → verify SQL has correct JOIN clause
3. **Map with aggregations**: Create a map with SUM/COUNT → verify GROUP BY in SQL
4. **Map with conditions**: Create a map with WHERE conditions → verify conditions in SQL
5. **Map with parameters**: Create a map with a parameter → execute with provided value → verify bind variable used
6. **Map with calculated fields**: Create a map with a calculated field → verify calculated column in results
7. **Complex map**: JOINs + aggregations + conditions + parameters + calculated fields → full pipeline
8. **Map execution logging**: Verify each execution is logged to query_execution_log
9. **Async execution**: Create a map → execute async → poll status → get results
10. **Error handling**: Execute map with invalid parameter → verify error message
11. **Timeout**: Execute map that takes too long → verify timeout error
12. **Row security**: Execute map with security policies → verify predicates injected

### Test setup:
- Mock node-oracledb (create a mock that returns predictable test data)
- Use a real PostgreSQL test database for metadata (maps, items, etc.)
- Oracle execution should be mocked (we can't require a real Oracle DB in tests)
- Create test fixtures: business area, data source, folders with items, joins

### Test helpers:
- `createTestMap(config)` — helper to create a map with all child entities
- `executeTestMap(mapId, params)` — helper to execute and assert results
- `assertSqlContains(sql, expected)` — helper to verify SQL structure

Run all tests and ensure they pass.
```

**Deliverables:**
- ✅ `backend/src/__tests__/integration/query-engine.test.ts`
- ✅ All 12 test scenarios pass
- ✅ Mock Oracle driver works correctly
- ✅ Test fixtures are reusable for future tests

---

# PHASE 3: Frontend — Map Builder UI

> **Goal:** Admin UI, interactive map builder with drag-and-drop, data preview, parameter prompts, dashboard.
> **Duration:** 4–5 weeks (overlaps with Phase 2)
> **Prerequisites:** Phase 0 complete (frontend scaffolding). Phase 1 complete (backend API). Phase 2 in progress.

---

## Session 3.1 — Authentication UI & Route Protection

| Field | Value |
|---|---|
| **Goal** | Login page, auth flow, route protection, token refresh |
| **Scope** | `frontend/src/pages/LoginPage.tsx`, `frontend/src/components/auth/`, `frontend/src/hooks/useAuth.ts` |
| **Skills** | `react`, `react-forms`, `auth-implementation-patterns` |
| **Agents** | `application-performance-frontend-developer` (primary), `frontend-security-coder` (security review) |
| **Model / Effort** | Sonnet 5 — medium. Standard auth UI patterns |
| **Dependencies** | Session 0.4 (frontend scaffolding) |

**Prompt:**
```
You are implementing the authentication UI for Discoverer Neo, a React 19 + TypeScript SPA with Vite.

The project root is the current working directory. The frontend has:
- React Router with routes defined in App.tsx
- Zustand auth store in src/store/auth.ts (user, token, isAuthenticated, login(), logout())
- Axios API client in src/lib/api.ts (with JWT interceptor)
- shadcn/ui components in src/components/ui/

Implement the following:

### 1. Login page (`frontend/src/pages/LoginPage.tsx`)
- Clean, centered login form
- Email + password fields
- Submit button with loading state
- Error message display (invalid credentials, server error)
- "Remember me" checkbox (extend token expiry)
- On success: store token + user in Zustand store, redirect to /dashboard

### 2. Auth hook (`frontend/src/hooks/useAuth.ts`)
- `useAuth()` — returns { user, isAuthenticated, login, logout, isLoading }
- `useRequireAuth()` — hook that redirects to /login if not authenticated
- Token refresh logic: before token expires (check JWT exp claim), call refresh endpoint
- Auto-logout when refresh fails

### 3. Protected route component (`frontend/src/components/auth/ProtectedRoute.tsx`)
- Wraps routes that require authentication
- Redirects to /login with return URL if not authenticated
- Shows loading spinner while checking auth state

### 4. Auth layout (`frontend/src/components/auth/AuthLayout.tsx`)
- Minimal layout for login/register pages (no sidebar/header)

### 5. Update App.tsx
- Use ProtectedRoute for all authenticated routes
- Show login page for unauthenticated users
- Add route: `/login` → LoginPage

### 6. Token refresh mechanism
- Set up an interval that checks token expiry every 60 seconds
- If token expires in < 5 minutes, attempt refresh
- If refresh fails, redirect to login with session expired message

### 7. Tests (`frontend/src/__tests__/auth.test.tsx`)
- Login form renders correctly
- Submit with valid credentials → redirects to dashboard
- Submit with invalid credentials → shows error
- Protected route redirects unauthenticated user
- Token refresh works

Use shadcn/ui components. Use React Hook Form + Zod for form validation. Use Tailwind CSS for styling.
```

**Deliverables:**
- ✅ `frontend/src/pages/LoginPage.tsx`
- ✅ `frontend/src/hooks/useAuth.ts`
- ✅ `frontend/src/components/auth/ProtectedRoute.tsx`
- ✅ `frontend/src/components/auth/AuthLayout.tsx`
- ✅ Updated `App.tsx` with protected routes
- ✅ Token refresh mechanism
- ✅ Tests pass

---

## Session 3.2 — Admin UI — Metadata Management Pages

| Field | Value |
|---|---|
| **Goal** | All admin pages for managing business areas, folders, items, joins, hierarchies, data sources, users, and custom functions |
| **Scope** | `frontend/src/pages/admin/` — 8 pages, `frontend/src/components/admin/` — shared admin components |
| **Skills** | `react`, `react-forms`, `react-state-management` |
| **Agents** | `application-performance-frontend-developer` (primary), `component-create` (component generation) |
| **Model / Effort** | Sonnet 5 — medium. Eight repetitive admin pages — volume over depth |
| **Dependencies** | Session 3.1 (auth), Phase 1 backend API |

**Prompt:**
```
You are implementing the admin UI pages for Discoverer Neo, a React 19 + TypeScript SPA.

The project root is the current working directory. The frontend has:
- Auth system (login, protected routes)
- shadcn/ui components
- Axios API client with JWT interceptor
- React Router

The backend API provides:
- GET/POST/PUT/DELETE /api/business-areas
- GET/POST/PUT/DELETE /api/business-areas/:id/grants
- GET/POST/PUT/DELETE /api/folders
- POST /api/data-sources/:id/introspect
- GET /api/data-sources/:id/tables
- POST /api/data-sources/:id/import
- GET/POST/PUT/DELETE /api/items
- GET/POST/PUT/DELETE /api/joins
- GET/POST/PUT/DELETE /api/hierarchies
- GET/POST/PUT/DELETE /api/custom-functions
- GET/POST/PUT/DELETE /api/data-sources
- GET/POST/PUT/DELETE /api/users

Implement the following admin pages:

### 1. Business Areas page (`frontend/src/pages/admin/BusinessAreasPage.tsx`)
- Table list of all business areas (TanStack Table)
- Create/Edit dialog with form: name, description
- Delete confirmation
- Manage grants button → opens grant management modal
- Grant management: add user, set permission level, revoke

### 2. Data Sources page (`frontend/src/pages/admin/DataSourcesPage.tsx`)
- Table list of all data sources
- Create/Edit form: name, connectionType (oracle/postgres), host, port, serviceName, sid, username, password
- "Test Connection" button → calls test endpoint, shows result
- "Introspect" button → triggers Oracle schema introspection
- Import tables modal: show discovered tables, select tables to import as folders

### 3. Folders page (`frontend/src/pages/admin/FoldersPage.tsx`)
- Filter by business area (dropdown)
- Table list with columns: name, type, table name, data source
- Create/Edit form: name, business area, folder type (dropdown), data source, table name, custom SQL
- Auto-discovery: select data source → "Discover Tables" → pick table → auto-fill

### 4. Items page (`frontend/src/pages/admin/ItemsPage.tsx`)
- Filter by business area → folder
- Table list: name, type, column, data type, aggregation
- Create/Edit form: name, folder, item type, column name, formula, data type, format mask, aggregation
- Type-specific fields: CI shows column selector, CU shows formula editor

### 5. Joins page (`frontend/src/pages/admin/JoinsPage.tsx`)
- Table list: name, left folder, right folder, join type
- Create/Edit form: name, left folder, right folder, left item, right item, join type
- "Suggest Joins" button → shows auto-suggested joins based on matching column names

### 6. Hierarchies page (`frontend/src/pages/admin/HierarchiesPage.tsx`)
- Table list of hierarchies
- Create/Edit form: name, business area
- Level management: add/remove levels, link each level to an item
- Drag-and-drop reordering of levels

### 7. Users page (`frontend/src/pages/admin/UsersPage.tsx`)
- Table list: name, email, role
- Create/Edit form: name, email, password (create only), role
- Role-based actions: only admin can create users

### 8. Custom Functions page (`frontend/src/pages/admin/CustomFunctionsPage.tsx`)
- Table list: name, type, parameters
- Create/Edit form: name, description, function type, parameters (JSON editor), return type

### Shared components (`frontend/src/components/admin/`)
- `AdminPageWrapper.tsx` — consistent page layout with title, action button
- `CreateEditDialog.tsx` — reusable dialog for create/edit operations
- `DeleteConfirmDialog.tsx` — reusable delete confirmation
- `DataTable.tsx` — reusable TanStack Table wrapper with pagination

All pages should use TanStack Query for data fetching/caching. Use React Hook Form + Zod for forms. Use shadcn/ui components. Use Tailwind CSS for styling.
```

**Deliverables:**
- ✅ 8 admin pages in `frontend/src/pages/admin/`
- ✅ Shared admin components in `frontend/src/components/admin/`
- ✅ All CRUD operations work via API
- ✅ TanStack Query for data fetching
- ✅ Forms with validation
- ✅ Oracle introspection + import works

---

## Session 3.3 — Map Builder UI — Core Layout & Business Area Tree

| Field | Value |
|---|---|
| **Goal** | The main map builder layout with business area tree panel, canvas, and all side panels |
| **Scope** | `frontend/src/pages/MapBuilderPage.tsx`, `frontend/src/components/map-builder/` — tree panel, canvas, toolbar |
| **Skills** | `react`, `react-component-performance`, `react-state-management` |
| **Agents** | `application-performance-frontend-developer` (primary), `ui-designer` (layout design) |
| **Model / Effort** | Opus 4.8 — high. Flagship UI: drag-and-drop and complex state management |
| **Dependencies** | Session 3.1 (auth), Phase 2 backend API (maps) |

**Prompt:**
```
You are implementing the core map builder UI for Discoverer Neo, a React 19 + TypeScript SPA.

The project root is the current working directory. The frontend has:
- Auth system, admin pages
- shadcn/ui components, Tailwind CSS
- React Router, TanStack Query, Zustand, dnd-kit

The backend API provides:
- GET /api/business-areas — list business areas
- GET /api/business-areas/:baId/folders — list folders
- GET /api/folders/:folderId/items — list items
- GET /api/maps/:id — get map with all config
- POST/PUT /api/maps — create/update map
- POST /api/maps/:id/execute — execute map

Implement the following:

### 1. Map builder page (`frontend/src/pages/MapBuilderPage.tsx`)
Three-panel layout:
- **Left panel (250px)**: Business area tree
- **Center**: Map canvas (flexible)
- **Right panel (300px)**: Properties/conditions/sort (collapsible tabs)
- **Top toolbar**: Map name, Run, Save, Export, Schedule, Share buttons

### 2. Business area tree (`frontend/src/components/map-builder/BusinessAreaTree.tsx`)
- Tree structure: Business Area → Folder → Items
- Expandable/collapsible nodes
- Search/filter items at the top
- Item type icons (dimension vs measure)
- Drag items from tree to canvas (dnd-kit drag source)
- Show item count per folder

### 3. Map canvas (`frontend/src/components/map-builder/MapCanvas.tsx`)
- Drop zone for items (dnd-kit drop target)
- Selected columns area: shows dropped items as chips/cards
- Each column chip shows: name, aggregation badge, sort indicator
- Drag-and-drop reordering within canvas
- Click column → opens column config dialog
- Remove column (X button)
- Empty state: "Drag items here to build your map"

### 4. Column config dialog (`frontend/src/components/map-builder/ColumnConfigDialog.tsx`)
- Display name (text input)
- Aggregation (dropdown: SUM, COUNT, AVG, MIN, MAX, NONE)
- Format mask (text input with presets)
- Sort direction (ASC/DESC/none)
- Sort order (number input)
- Column width (number input)

### 5. Toolbar (`frontend/src/components/map-builder/MapToolbar.tsx`)
- Map name (editable text)
- Map type selector (TABLE/CROSSTAB/PAGE_DETAIL/CHART)
- Run button (execute map, show loading)
- Save button (save map config)
- Export dropdown (Excel, CSV)
- Schedule button (opens schedule dialog)
- Share button (opens share dialog)

### 6. Map builder store (`frontend/src/store/mapBuilder.ts`)
Zustand store for map builder state:
- currentMap (null | map object)
- selectedItems (array of map_items)
- conditions (array of map_conditions)
- parameters (array of map_parameters)
- calculatedFields (array of map_calculated_fields)
- isDirty (unsaved changes)
- Actions: addItem, removeItem, reorderItems, updateItem, loadMap, clearMap

### 7. Tests (`frontend/src/__tests__/map-builder.test.tsx`)
- Tree renders business areas → folders → items
- Drag item to canvas adds it to selected items
- Reorder items in canvas
- Column config dialog saves changes
- Save map calls API

Use dnd-kit for drag-and-drop. Use TanStack Query for API calls. Use shadcn/ui components. Use Tailwind CSS for styling.
```

**Deliverables:**
- ✅ `frontend/src/pages/MapBuilderPage.tsx`
- ✅ `frontend/src/components/map-builder/BusinessAreaTree.tsx`
- ✅ `frontend/src/components/map-builder/MapCanvas.tsx`
- ✅ `frontend/src/components/map-builder/ColumnConfigDialog.tsx`
- ✅ `frontend/src/components/map-builder/MapToolbar.tsx`
- ✅ `frontend/src/store/mapBuilder.ts`
- ✅ Tests pass
- ✅ Drag-and-drop works
- ✅ Tree shows business area hierarchy

---

## Session 3.4 — Map Builder UI — Conditions, Sort, Parameters, Calculated Fields

| Field | Value |
|---|---|
| **Goal** | All secondary panels: conditions builder, sort panel, parameter config, calculated field editor |
| **Scope** | `frontend/src/components/map-builder/panels/` — ConditionsPanel, SortPanel, ParametersPanel, CalculatedFieldsPanel |
| **Skills** | `react`, `react-forms`, `react-state-management` |
| **Agents** | `application-performance-frontend-developer` (primary), `component-create` (dialog generation) |
| **Model / Effort** | Sonnet 5 — high. AND/OR condition-grouping logic is subtle |
| **Dependencies** | Session 3.3 (core layout) |

**Prompt:**
```
You are implementing the secondary panels for the map builder UI in Discoverer Neo, a React 19 + TypeScript SPA.

The project root is the current working directory. The frontend has:
- Map builder page with tree, canvas, and toolbar
- Zustand store for map builder state
- dnd-kit for drag-and-drop

Implement the following panels (in the right side panel of the map builder):

### 1. Conditions panel (`frontend/src/components/map-builder/panels/ConditionsPanel.tsx`)
- List of current conditions
- "Add Condition" button → adds new condition row
- Each condition row:
  - Item selector (dropdown of items in the map)
  - Operator selector (=, <>, <, >, <=, >=, LIKE, IN, BETWEEN, IS NULL)
  - Value field (text input) OR parameter selector (toggle between static/parameter)
  - If parameter: parameter name input, type selector
  - AND/OR selector (first row shows nothing, subsequent rows show AND/OR)
  - Group conditions (select multiple → "Group" button creates parenthesized group)
  - Delete button
- Compound conditions: support AND/OR with grouping (visual indentation)
- Parameter-driven conditions: toggle between "Static value" and "Prompt at runtime"

### 2. Sort panel (`frontend/src/components/map-builder/panels/SortPanel.tsx`)
- List of sorted columns
- Each: column name, ASC/DESC toggle, sort order number
- Drag-and-drop reordering of sort priority
- "Add Sort" → select column from map items
- Multi-column sort support

### 3. Parameters panel (`frontend/src/components/map-builder/panels/ParametersPanel.tsx`)
- List of parameters for the map
- "Add Parameter" button
- Each parameter:
  - Name (text input)
  - Type (dropdown: STRING, NUMBER, DATE, LIST)
  - Default value (type-appropriate input)
  - Required checkbox
- Parameter preview: show how the prompt dialog will look

### 4. Calculated fields panel (`frontend/src/components/map-builder/panels/CalculatedFieldsPanel.tsx`)
- List of calculated fields
- "Add Calculated Field" button
- Each:
  - Name (text input)
  - Formula (Monaco Editor or code input)
  - Display order
- Formula editor dialog:
  - Monaco Editor for formula input
  - Function reference sidebar (arithmetic, string, date, conditional)
  - Item reference (click to insert item name)
  - Syntax validation (show errors inline)
  - Test formula button (execute with sample data)

### 5. Right panel tabs container (`frontend/src/components/map-builder/panels/RightPanelTabs.tsx`)
- Tab container with: Conditions, Sort, Parameters, Calculated Fields
- Each tab shows the corresponding panel
- Badge showing count (e.g., "Conditions (3)")

### 6. Integration
- Update MapBuilderPage to include RightPanelTabs
- Update mapBuilder store to manage conditions, sort, parameters, calculated fields
- Ensure all changes are tracked in isDirty state

### 7. Tests
- Add/remove conditions
- Compound conditions with AND/OR
- Parameter configuration
- Calculated field formula editing
- Sort configuration

Use shadcn/ui components. Use React Hook Form + Zod for validation. Use Monaco Editor for formula editing.
```

**Deliverables:**
- ✅ `frontend/src/components/map-builder/panels/ConditionsPanel.tsx`
- ✅ `frontend/src/components/map-builder/panels/SortPanel.tsx`
- ✅ `frontend/src/components/map-builder/panels/ParametersPanel.tsx`
- ✅ `frontend/src/components/map-builder/panels/CalculatedFieldsPanel.tsx`
- ✅ `frontend/src/components/map-builder/panels/RightPanelTabs.tsx`
- ✅ Updated MapBuilderPage with right panel
- ✅ Tests pass
- ✅ Compound conditions work
- ✅ Formula editor with validation works

---

## Session 3.5 — Map Execution & Data Preview

| Field | Value |
|---|---|
| **Goal** | Execute maps from the UI, show results in a data table, handle parameters at runtime |
| **Scope** | `frontend/src/components/map-builder/`, `frontend/src/components/data-table/`, `frontend/src/components/parameters/` |
| **Skills** | `react`, `react-component-performance` |
| **Agents** | `application-performance-frontend-developer` (primary), `frontend-verifier` (verification) |
| **Model / Effort** | Sonnet 5 — high. Virtualized large-result table and runtime parameter flow |
| **Dependencies** | Session 3.4 (all panels), Phase 2 backend API (execution) |

**Prompt:**
```
You are implementing the map execution and data preview for Discoverer Neo, a React 19 + TypeScript SPA.

The project root is the current working directory. The frontend has:
- Map builder with all panels (tree, canvas, conditions, sort, parameters, calculated fields)
- Zustand store for map builder state

The backend API provides:
- POST /api/maps/:id/execute — synchronous execution (returns first 1000 rows)
- POST /api/maps/:id/execute-async — async execution (returns jobId)
- GET /api/maps/:id/executions/:jobId — check async status
- POST /api/maps/:id/export — export to Excel/CSV

Implement the following:

### 1. Parameter prompt dialog (`frontend/src/components/parameters/ParameterPromptDialog.tsx`)
- Shown when executing a map that has parameters
- Form with all required parameters
- Each parameter: label, input (type-appropriate), required indicator
- Validation before execution
- Returns parameter values to execution flow

### 2. Data table (`frontend/src/components/data-table/ResultsTable.tsx`)
- TanStack Table v8 with:
  - Column sorting (click header)
  - Column filtering (text search per column)
  - Pagination (server-side for large datasets)
  - Column resizing
  - Virtual scrolling for large datasets
  - Row count display
  - Loading skeleton
  - Empty state
- Format columns based on data type (dates, numbers)
- Highlight null values

### 3. Execution panel (`frontend/src/components/map-builder/ExecutionPanel.tsx`)
- Shown after clicking "Run" in toolbar
- Shows: row count, execution time, SQL query (collapsible)
- Results table below
- Export buttons (Excel, CSV)
- "Load More" button for pagination
- Error display (SQL errors, timeout errors)
- Loading state with progress indicator

### 4. Export functionality
- "Export" dropdown in toolbar → Excel / CSV
- For small datasets (< 10000 rows): direct download
- For large datasets: show "Export queued" toast, poll for completion
- Download link when ready

### 5. Map viewer page (`frontend/src/pages/MapViewerPage.tsx`)
- Read-only view of a map
- Execute with parameter prompt
- Results table with pagination
- Export buttons
- Schedule management link

### 6. Dashboard page (`frontend/src/pages/DashboardPage.tsx`)
- Welcome message with user name
- Recent maps (last 5, clickable)
- Quick stats: total maps, total executions, scheduled maps
- Scheduled results overview (last 5 scheduled runs)

### 7. Tests
- Parameter prompt shows for maps with parameters
- Execution displays results
- Data table sorting and filtering work
- Export triggers download
- Dashboard shows recent activity

Use shadcn/ui components. Use TanStack Table for the data table. Use TanStack Query for API calls.
```

**Deliverables:**
- ✅ `frontend/src/components/parameters/ParameterPromptDialog.tsx`
- ✅ `frontend/src/components/data-table/ResultsTable.tsx`
- ✅ `frontend/src/components/map-builder/ExecutionPanel.tsx`
- ✅ `frontend/src/pages/MapViewerPage.tsx`
- ✅ `frontend/src/pages/DashboardPage.tsx`
- ✅ Export functionality
- ✅ Tests pass
- ✅ End-to-end: build map → execute → see results → export

---

## Session 3.6 — Frontend Integration Testing & Polish

| Field | Value |
|---|---|
| **Goal** | E2E tests with Playwright, accessibility audit, performance optimization |
| **Scope** | `frontend/e2e/`, accessibility fixes, performance tuning |
| **Skills** | `accessibility`, `react-performance`, `react-component-performance` |
| **Agents** | `playwright` (E2E tests), `accessibility-expert` (a11y audit), `ui-visual-validator` (visual verification) |
| **Model / Effort** | Sonnet 5 — medium. E2E tests, a11y fixes, and polish |
| **Dependencies** | All Session 3.1–3.5 |

**Prompt:**
```
You are writing E2E tests and performing accessibility/performance audits for Discoverer Neo's frontend.

The project root is the current working directory. The frontend has:
- Login page
- Dashboard
- Admin pages (business areas, data sources, folders, items, joins, hierarchies, users, custom functions)
- Map builder (tree, canvas, conditions, sort, parameters, calculated fields)
- Map viewer
- Data table with results

Implement the following:

### 1. Playwright E2E tests (`frontend/e2e/`)
- `login.spec.ts` — login flow, invalid credentials, redirect
- `admin-business-areas.spec.ts` — CRUD operations
- `admin-data-sources.spec.ts` — create, test connection
- `map-builder.spec.ts` — full flow: create map, drag items, add conditions, execute, verify results
- `map-viewer.spec.ts` — view saved map, execute with parameters
- `export.spec.ts` — export to Excel/CSV

### 2. Accessibility audit
- Run axe-core on all pages
- Fix any WCAG 2.1 AA violations
- Ensure keyboard navigation works in map builder
- Screen reader announcements for dynamic content (execution results, drag-and-drop)

### 3. Performance optimization
- Code splitting with React.lazy for admin pages
- Virtual scrolling in data table for large datasets
- Debounced search in tree panel
- Memoized components where appropriate
- Bundle analysis (vite-bundle-visualizer)

### 4. Visual validation
- Screenshot comparison for key pages
- Responsive design check (1280px, 1920px widths)
- Dark mode verification (if implemented)

Run all E2E tests and ensure they pass. Fix any accessibility issues found.
```

**Deliverables:**
- ✅ Playwright E2E tests for all critical flows
- ✅ Accessibility audit complete, violations fixed
- ✅ Performance optimizations applied
- ✅ Visual validation passes
- ✅ All E2E tests pass

---

# PHASE 4: Export & Scheduling

> **Goal:** Excel/CSV export with streaming. BullMQ-based scheduling. Result caching.
> **Duration:** 2–3 weeks
> **Prerequisites:** Phase 2 complete (query engine), Phase 3 in progress

---

## Session 4.1 — Export Service (Excel + CSV)

| Field | Value |
|---|---|
| **Goal** | Implement streaming Excel (.xlsx) and CSV export for large datasets (1M+ rows) |
| **Scope** | `backend/src/services/export.service.ts`, `backend/src/routes/export.ts`, BullMQ export worker |
| **Skills** | `async-patterns`, `backend-api-patterns` |
| **Agents** | `backend-specialist` (primary), `implement` (BullMQ integration) |
| **Model / Effort** | Opus 4.8 — high. Streaming 1M+ rows: memory and backpressure correctness |
| **Dependencies** | Session 2.3 (map execution) |

**Prompt:**
```
You are implementing the export service for Discoverer Neo, a Node.js + Fastify + TypeScript backend.

The project root is the current working directory. The backend has:
- Map execution service (executes SQL against Oracle)
- BullMQ + Redis for job processing
- Export jobs table: id, mapId, requestedBy, format (XLSX/CSV), status (PENDING/PROCESSING/COMPLETED/FAILED), progress, filePath, errorMessage, createdAt, completedAt

Implement the following:

### 1. Export service (`backend/src/services/export.service.ts`)
- `createExportJob(mapId, format, parameterValues, requestedBy)` — create export job record, queue BullMQ job
- `getExportJob(jobId)` — get job status and progress
- `downloadExport(jobId)` — stream the exported file
- `cleanupOldExports()` — delete exports older than configurable retention (default 7 days)

### 2. Excel export (`backend/src/services/exporters/excel-exporter.ts`)
- Use ExcelJS with streaming writer (`ExcelJS.stream.xlsx`)
- Stream rows from Oracle query results directly to xlsx
- Support 1M+ rows without memory issues
- Column headers from map configuration
- Apply column formatting (dates, numbers)
- Multiple sheets for crosstab maps
- Auto-size columns
- File stored in Docker volume: `/app/exports/`

### 3. CSV export (`backend/src/services/exporters/csv-exporter.ts`)
- Use fast-csv with streaming
- UTF-8 with BOM for Excel compatibility
- No row limit
- Proper escaping for commas, quotes, newlines
- Column headers from map configuration

### 4. Export worker (BullMQ)
- Queue: 'exports'
- Process job: fetch map config, generate SQL, execute against Oracle, stream results to file
- Update progress (0-100%) as rows are written
- On completion: update job status, store file path
- On failure: update job status with error message
- Retry failed jobs (max 3 attempts)

### 5. Export routes (`backend/src/routes/export.ts`)
All routes require authentication.
- `POST /api/maps/:id/export` — create export job
  - Body: { format: 'xlsx' | 'csv', parameters?: Record<string, unknown> }
  - Returns: { jobId, status: 'PENDING' }
- `GET /api/exports/:jobId` — check status
  - Returns: { jobId, status, progress, rowCount?, completedAt? }
- `GET /api/exports/:jobId/download` — download file
  - Returns: file stream with correct Content-Type and Content-Disposition
- `GET /api/exports` — list user's export jobs

### 6. Tests (`backend/src/__tests__/export.test.ts`)
- Create export job → returns jobId
- Excel export produces valid .xlsx file (verify with ExcelJS reader)
- CSV export produces valid CSV (verify with fast-csv reader)
- Progress tracking works
- Download returns file
- Cleanup deletes old files
- Worker retries on failure

Use streaming throughout. Never load entire dataset into memory.
```

**Deliverables:**
- ✅ `backend/src/services/export.service.ts`
- ✅ `backend/src/services/exporters/excel-exporter.ts`
- ✅ `backend/src/services/exporters/csv-exporter.ts`
- ✅ BullMQ export worker
- ✅ `backend/src/routes/export.ts`
- ✅ `backend/src/__tests__/export.test.ts`
- ✅ Excel export handles 1M+ rows (streaming)
- ✅ CSV export handles unlimited rows
- ✅ Progress tracking works

---

## Session 4.2 — Scheduling Service

| Field | Value |
|---|---|
| **Goal** | BullMQ-based cron scheduling for maps with parameter presets, result storage, and email notifications |
| **Scope** | `backend/src/services/scheduler.service.ts`, `backend/src/routes/schedules.ts`, scheduler worker |
| **Skills** | `async-patterns`, `backend-api-patterns` |
| **Agents** | `backend-specialist` (primary), `implement` (worker) |
| **Model / Effort** | Sonnet 5 — high. Cron/timezone handling and worker lifecycle |
| **Dependencies** | Session 4.1 (export), Session 2.3 (execution) |

**Prompt:**
```
You are implementing the scheduling service for Discoverer Neo, a Node.js + Fastify + TypeScript backend.

The project root is the current working directory. The backend has:
- Map execution service
- Export service
- BullMQ + Redis
- Schedules table: id, mapId, name, cronExpression, timezone, validFrom, validUntil, outputFormat (XLSX/CSV), isActive, createdBy, createdAt, updatedAt
- Schedule parameters table: id, scheduleId, paramName, paramValue
- Scheduled results table: id, scheduleId, executedAt, rowCount, filePath, executionTimeMs, status, errorMessage

Implement the following:

### 1. Scheduler service (`backend/src/services/scheduler.service.ts`)
- `createSchedule(data)` — create schedule with cron expression
- `updateSchedule(id, data)` — update schedule
- `getSchedule(id)` — get schedule with parameters
- `listSchedules(mapId)` — list schedules for a map
- `listUserSchedules(userId)` — list all user's schedules
- `deleteSchedule(id)` — delete schedule
- `toggleSchedule(id, isActive)` — enable/disable
- `triggerNow(id)` — manually trigger a schedule immediately
- `validateCronExpression(expr)` — validate cron expression (using cron-parser)
- `getNextRunTime(id)` — calculate next execution time
- `getExecutionHistory(scheduleId, limit)` — recent execution results

### 2. Scheduler worker (BullMQ)
- Queue: 'scheduler'
- Use cron-parser to parse expressions
- On trigger:
  1. Fetch schedule with parameters
  2. Check validity window (validFrom/validUntil)
  3. Execute map with preset parameters
  4. Generate export file
  5. Store result in scheduled_results table
  6. (Optional) Send email notification with result link
  7. Log execution

### 3. Schedule routes (`backend/src/routes/schedules.ts`)
All routes require authentication.
- `GET /api/maps/:mapId/schedules` — list schedules for a map
- `GET /api/schedules/:id` — get one schedule
- `POST /api/maps/:mapId/schedules` — create schedule
- `PUT /api/schedules/:id` — update schedule
- `DELETE /api/schedules/:id` — delete schedule
- `POST /api/schedules/:id/toggle` — enable/disable
- `POST /api/schedules/:id/trigger` — manual trigger
- `GET /api/schedules/:id/history` — execution history
- `GET /api/schedules/:id/results/:resultId/download` — download scheduled result

### 4. Schedule management UI (frontend, `frontend/src/pages/SchedulesPage.tsx`)
- List of all user's schedules
- Create/edit schedule dialog:
  - Name, cron expression (with presets: daily, weekly, monthly, custom)
  - Timezone selector
  - Validity window (from/to dates)
  - Output format (XLSX/CSV)
  - Parameter values (pre-set)
  - Enable/disable toggle
- Execution history table
- Manual trigger button
- Download result links

### 5. Tests (`backend/src/__tests__/scheduler.test.ts`)
- Schedule CRUD
- Cron expression validation
- Next run time calculation
- Manual trigger executes map
- Execution history recorded
- Validity window enforcement
- Disable prevents execution

Use BullMQ with cron expressions. Use cron-parser for validation. Use Luxon or date-fns-timezone for timezone handling.
```

**Deliverables:**
- ✅ `backend/src/services/scheduler.service.ts`
- ✅ BullMQ scheduler worker
- ✅ `backend/src/routes/schedules.ts`
- ✅ `frontend/src/pages/SchedulesPage.tsx`
- ✅ `backend/src/__tests__/scheduler.test.ts`
- ✅ Cron scheduling works
- ✅ Manual trigger works
- ✅ Execution history recorded
- ✅ Frontend schedule management works

---

## Session 4.3 — Export & Scheduling Integration Testing

| Field | Value |
|---|---|
| **Goal** | End-to-end testing of export and scheduling pipelines |
| **Scope** | `backend/src/__tests__/integration/export-scheduling.test.ts` |
| **Skills** | `backend-development-tdd-orchestrator` |
| **Agents** | `backend-development-tdd-orchestrator` (primary) |
| **Model / Effort** | Sonnet 5 — medium. Integration tests over existing pipelines |
| **Dependencies** | Session 4.1, 4.2 |

**Prompt:**
```
You are writing integration tests for Discoverer Neo's export and scheduling systems.

The project root is the current working directory. The backend has:
- Export service (Excel + CSV, streaming, BullMQ worker)
- Scheduling service (cron, BullMQ worker, execution history)
- Map execution service (mock for tests)

Write comprehensive integration tests:

### Export tests:
1. Create export job → job status is PENDING
2. Worker processes job → job status becomes PROCESSING → COMPLETED
3. Download completed export → file is valid
4. Excel export: verify file can be read by ExcelJS, correct number of rows/columns
5. CSV export: verify file can be parsed by fast-csv, correct number of rows/columns
6. Failed export: job status becomes FAILED with error message
7. Retry: failed job retried up to 3 times
8. Cleanup: old exports deleted after retention period

### Scheduling tests:
1. Create schedule → next run time calculated correctly
2. Cron expression validation rejects invalid expressions
3. Manual trigger → map executed → result stored
4. Disabled schedule does not execute
5. Expired schedule (past validUntil) does not execute
6. Execution history recorded for each run
7. Download scheduled result returns correct file

### Combined tests:
1. Schedule with export → scheduled run produces export file
2. Large export (100k+ rows) → streaming works, no memory issues
3. Concurrent exports → both complete successfully

Mock Oracle driver. Use real PostgreSQL for metadata. Use real Redis for BullMQ (or mock BullMQ).
```

**Deliverables:**
- ✅ `backend/src/__tests__/integration/export-scheduling.test.ts`
- ✅ All export tests pass
- ✅ All scheduling tests pass
- ✅ Combined tests pass

---

# PHASE 5: Security & Migration

> **Goal:** Row-level security. Map sharing. Discoverer 4 migration tool. Audit logging.
> **Duration:** 3–4 weeks
> **Prerequisites:** Phase 1 complete, Phase 2 complete

---

## Session 5.1 — Row-Level Security

| Field | Value |
|---|---|
| **Goal** | Implement row-level security policies with SQL predicate injection |
| **Scope** | `backend/src/services/security.service.ts`, `backend/src/routes/security.ts`, update SQL generator |
| **Skills** | `backend-security-coder`, `comprehensive-review-security-auditor` |
| **Agents** | `security-engineer` (primary), `comprehensive-review-security-auditor` (review) |
| **Model / Effort** | Fable 5 — high. Security-critical predicate injection into the SQL generator; a bug here leaks data across users |
| **Dependencies** | Session 2.2 (SQL generator) |

**Prompt:**
```
You are implementing row-level security for Discoverer Neo, a Node.js + Fastify + TypeScript backend.

The project root is the current working directory. The backend has:
- SQL generator that produces Oracle SQL
- Security policies table: id, name, description, policyType (ROW_LEVEL), isActive, createdAt
- Security policy rules table: id, policyId, targetId (businessAreaId or folderId), targetType (BUSINESS_AREA/FOLDER), sqlPredicate, createdAt
- Security policy assignments table: id, policyId, userId (nullable), roleName (nullable)

Implement the following:

### 1. Security service (`backend/src/services/security.service.ts`)
- `createPolicy(data)` — create policy with rules
- `updatePolicy(id, data)` — update policy and rules
- `getPolicy(id)` — get policy with rules
- `listPolicies()` — list all policies
- `deletePolicy(id)` — delete policy
- `assignPolicy(policyId, userId?, roleName?)` — assign to user or role
- `unassignPolicy(policyId, userId?, roleName?)` — remove assignment
- `getUserPolicies(userId, userRole)` — get all applicable policies for a user
- `validatePredicate(predicate)` — validate SQL predicate syntax (prevent injection, ensure it's a valid WHERE clause fragment)

### 2. SQL predicate injection
- Update `backend/src/services/sql-generator.ts`:
  - After generating base SQL, call `applyRowSecurity(sql, userId, userRole)`
  - Fetch applicable security policies for the user
  - Inject policy predicates into WHERE clause (ANDed together)
  - If multiple policies apply, combine with AND
- The injection must:
  - Not break existing SQL
  - Handle queries with and without existing WHERE clause
  - Use bind variables for any policy parameter values

### 3. Security routes (`backend/src/routes/security.ts`)
All routes require ADMIN role.
- `GET /api/security/policies` — list policies
- `GET /api/security/policies/:id` — get one with rules
- `POST /api/security/policies` — create policy
- `PUT /api/security/policies/:id` — update policy
- `DELETE /api/security/policies/:id` — delete policy
- `GET /api/security/policies/:id/assignments` — list assignments
- `POST /api/security/policies/:id/assignments` — assign
- `DELETE /api/security/policies/:id/assignments/:assignmentId` — unassign
- `POST /api/security/policies/test` — test policy against a sample query

### 4. Security policy management UI (frontend, `frontend/src/pages/admin/SecurityPage.tsx`)
- List policies with status (active/inactive)
- Create/edit policy:
  - Name, description
  - Rules: add multiple rules, each targeting a business area or folder
  - SQL predicate editor with syntax validation
- Assignments: assign to users or roles
- Test: enter a sample query, see the modified query with security predicates

### 5. Tests (`backend/src/__tests__/security.test.ts`)
- Policy CRUD
- SQL predicate injection:
  - Simple query → predicate added to WHERE
  - Query with existing WHERE → predicate ANDed
  - Query with GROUP BY → predicate in WHERE, not HAVING
  - Multiple policies → all predicates ANDed
- Assignment management
- Policy enforcement: user A sees different rows than user B based on policies
- Predicate validation rejects malicious input

Critical security: Policy predicates must be validated to prevent SQL injection. Only allow SELECT predicates (no DDL, no DML, no subqueries that modify data).
```

**Deliverables:**
- ✅ `backend/src/services/security.service.ts`
- ✅ Updated SQL generator with security injection
- ✅ `backend/src/routes/security.ts`
- ✅ `frontend/src/pages/admin/SecurityPage.tsx`
- ✅ `backend/src/__tests__/security.test.ts`
- ✅ Row-level security works (different users see different data)
- ✅ SQL injection prevention validated
- ✅ Policy management UI works

---

## Session 5.2 — Map Sharing

| Field | Value |
|---|---|
| **Goal** | Map sharing between users with permission levels (VIEW, EDIT, EXPORT) |
| **Scope** | `backend/src/routes/map-shares.ts` (update from Session 2.1), `backend/src/services/map-share.service.ts` |
| **Skills** | `backend-api-patterns` |
| **Agents** | `backend-specialist` (primary) |
| **Model / Effort** | Sonnet 5 — low. Simple share CRUD |
| **Dependencies** | Session 2.1 (maps) |

**Prompt:**
```
You are implementing map sharing for Discoverer Neo, a Node.js + Fastify + TypeScript backend.

The project root is the current working directory. The backend has:
- Map CRUD (from Session 2.1)
- Map shares table: id, mapId, sharedWithUserId, permissionLevel (VIEW/EDIT/EXPORT), sharedBy, sharedAt
- User and role system

Implement the following:

### 1. Map share service (`backend/src/services/map-share.service.ts`)
- `shareMap(mapId, sharedWithUserId, permissionLevel, sharedBy)` — create share
- `updateShare(mapId, userId, permissionLevel)` — update permission
- `revokeShare(mapId, userId)` — remove share
- `getSharedUsers(mapId)` — list users with access
- `getMapsSharedWithUser(userId)` — list maps shared with a user
- `getMapPermissions(mapId, userId)` — get user's permission level for a map
- `canView(mapId, userId)` — check view access
- `canEdit(mapId, userId)` — check edit access
- `canExport(mapId, userId)` — check export access

### 2. Update map access control
- Map creator has full control (owner)
- Admin has full control
- Shared users have permission-level access
- Unauthenticated users have no access
- Public maps (isPublic=true) can be viewed by anyone

### 3. Map share routes (`backend/src/routes/map-shares.ts`)
All routes require authentication.
- `GET /api/maps/:id/shares` — list shares (owner or admin)
- `POST /api/maps/:id/shares` — share with user
- `PUT /api/maps/:id/shares/:userId` — update permission
- `DELETE /api/maps/:id/shares/:userId` — revoke share
- `GET /api/maps/shared-with-me` — list maps shared with current user

### 4. Share dialog (frontend, `frontend/src/components/map-builder/ShareDialog.tsx`)
- Search users by name/email
- Select user → choose permission level (VIEW/EDIT/EXPORT)
- List current shares with permission level
- Revoke access
- Copy shareable link (for public maps)

### 5. Tests
- Share map with user
- Update permission
- Revoke access
- Access control enforcement (user with VIEW cannot edit)
- Public map access
- List shared maps

Use Fastify JSON schema validation. Consistent response format.
```

**Deliverables:**
- ✅ `backend/src/services/map-share.service.ts`
- ✅ Updated `backend/src/routes/map-shares.ts`
- ✅ `frontend/src/components/map-builder/ShareDialog.tsx`
- ✅ Tests pass
- ✅ Sharing works with all permission levels
- ✅ Access control enforced

---

## Session 5.3 — EUL Version Detection & Schema Adapter

| Field | Value |
|---|---|
| **Goal** | Detect which EUL version the source database uses (EUL3/EUL4/EUL5) and provide a unified schema adapter that works across all versions |
| **Scope** | `migrate/src/services/eul-version-detector.ts`, `migrate/src/services/eul-schema-adapter.ts`, `migrate/src/types/eul-versions.ts` |
| **Skills** | `01-sql-fundamentals`, `oracle` |
| **Agents** | `db-expert` (primary), `backend-specialist` (integration) |
| **Model / Effort** | Fable 5 — high. Reverse-engineering three legacy EUL schema versions with sparse documentation |
| **Dependencies** | Session 1.2 (data sources, Oracle connection) |

**Prompt:**
```
You are building the EUL version detection and schema adapter layer for Discoverer Neo's migration tool. This is the critical foundation that allows migration from ANY Discoverer version (EUL3, EUL4, or EUL5).

The project root is the current working directory. The `migrate/` directory exists (scaffolded in Phase 0). The backend has Oracle connection pooling via node-oracledb.

## Background

Oracle Discoverer has used three major EUL schema versions across its lifetime:
- **EUL_** prefix (no number) — Discoverer 3.x (very old, rarely encountered)
- **EUL4_** prefix — Discoverer 4.x / 9i (legacy, EOL)
- **EUL5_** prefix — Discoverer 10g, 11g (most common in EBS environments)

### Key schema differences:

**1. Table prefix**: Tables are named EUL4_* vs EUL5_* (mostly identical except for prefix)

**2. EUL version identity table**:
- EUL4: `EUL4_EUL` (EU_ID, EU_NAME, EU_CREATED_DATE, EU_LANGUAGE, EU_VERSION)
- EUL5: `EUL5_EUL` (same + EU_DISC_VERSION)
- Version stored as VARCHAR2 like '5.1.0.0.0'

**3. Tables new in EUL5** (don't exist in EUL4):
- `EUL5_LOCK` — admin session locks
- `EUL5_TRANSLATIONS` — multi-language labels
- `EUL5_QPP_QUERY` — scheduled query definitions
- `EUL5_BA_ROLES`, `EUL5_OBJ_ROLES`, `EUL5_APP_ROLES` — role-based grants (in EUL4 these may be in different tables or consolidated differently)

**4. Column differences in same-named tables**:

| Table | EUL5 columns NOT in EUL4 |
|---|---|
| BA (Business Areas) | BA_LANGUAGE (VARCHAR2(30)), BA_DEVELOPER_KEY (VARCHAR2(200)) |
| OBJS (Folders) | OBJ_DESCRIPTION, OBJ_UPDATED_BY, OBJ_UPDATED_DATE |
| EXPRESSIONS (Items) | EXP_DESCRIPTION, EXP_NULLS_ALLOWED (Y/N), IT_EXP_ID (self-FK for hierarchy), EXP_UPDATED_BY, EXP_UPDATED_DATE, EXP_TYPE supports 'SM' and 'AG' |
| JOINS | JOI_DESCRIPTION |
| DOCUMENTS (Workbooks) | DOC_DESCRIPTION, DOC_DEVELOPER_KEY, DOC_WORKBOOK_OWNER |
| QPP_STATS (Query log) | ES_STATEMENT_ID (VARCHAR2(50)), ES_SESSION_ID (NUMBER) |

**5. Hierarchy structure difference**:
- EUL4: Hierarchy levels in separate EUL4_HIER_LEVELS table
- EUL5: Hierarchy levels also use IT_EXP_ID self-referencing FK in EUL5_EXPRESSIONS

**6. Folder type support**:
- EUL4 supports: TABLE, VIEW, COMPLEX, JOIN
- EUL5 adds: DERIVED, SUMMARY

**7. Security model**:
- EUL4: May use EUL4_USERS/EUL4_ROLES tables differently
- EUL5: Consolidated into EUL5_BA_ROLES, EUL5_OBJ_ROLES, EUL5_APP_ROLES
- In EUL5, Security Manager conditions stored in EUL5_EXPRESSIONS with EXP_TYPE='SM'

Implement the following:

### 1. Version detector (`migrate/src/services/eul-version-detector.ts`)
```
interface EulVersionInfo {
  version: 'EUL3' | 'EUL4' | 'EUL5';
  prefix: 'EUL_' | 'EUL4_' | 'EUL5_';
  discovererVersion: string;  // e.g., '4.1.0', '10.1.2.0.0'
  schemaVersion: string;      // from EUL*_EUL.EU_VERSION
  tableNames: string[];       // actual table names found in DB
  supported: boolean;         // whether this version can be migrated
  warnings: string[];         // any compatibility warnings
}

async function detectEulVersion(connectionConfig): Promise<EulVersionInfo>
```
Detection strategy:
1. Query `ALL_TABLES` for tables matching 'EUL%_BA' pattern
2. If EUL5_BA exists → EUL5
3. Else if EUL4_BA exists → EUL4
4. Else if EUL_BA exists → EUL3
5. Else → unknown/unsupported
6. Read the EUL*_EUL table to get version details
7. Scan for version-specific tables to confirm

### 2. Schema adapter (`migrate/src/services/eul-schema-adapter.ts`)
```
interface EulSchemaAdapter {
  version: EulVersionInfo;
  
  // Table name resolution
  getTableName(baseName: string): string;  // e.g., 'BA' → 'EUL5_BA' or 'EUL4_BA'
  
  // Column resolution with fallbacks for missing columns
  getBusinessAreaColumns(): ColumnMapping;
  getFolderColumns(): ColumnMapping;
  getExpressionColumns(): ColumnMapping;
  getJoinColumns(): ColumnMapping;
  getHierarchyColumns(): ColumnMapping;
  getDocumentColumns(): ColumnMapping;
  getUserColumns(): ColumnMapping;
  getGrantColumns(): ColumnMapping;
  
  // Feature detection
  supportsMultiLanguage(): boolean;
  supportsDerivedFolders(): boolean;
  supportsSummaryFolders(): boolean;
  hasSeparateHierarchyLevelsTable(): boolean;
  hasSecurityManagerInExpressions(): boolean;
  hasRoleBasedGrants(): boolean;
}

interface ColumnMapping {
  name: string;           // actual column name in source DB
  type: 'string' | 'number' | 'date' | 'boolean' | 'clob';
  required: boolean;
  defaultValue?: any;      // default when column doesn't exist in older version
  mapsTo: string;         // maps to which Discoverer Neo column
}
```

### 3. Unified read functions
```
async function readBusinessAreas(adapter, connectionConfig): Promise<BusinessArea[]>
async function readFolders(adapter, connectionConfig): Promise<Folder[]>
async function readItems(adapter, connectionConfig): Promise<Item[]>
async function readJoins(adapter, connectionConfig): Promise<Join[]>
async function readHierarchies(adapter, connectionConfig): Promise<Hierarchy[]>
async function readCustomFunctions(adapter, connectionConfig): Promise<CustomFunction[]>
async function readWorkbooks(adapter, connectionConfig): Promise<Workbook[]>
async function readUsers(adapter, connectionConfig): Promise<User[]>
async function readGrants(adapter, connectionConfig): Promise<Grant[]>
```

Each function:
1. Uses the adapter to get the correct table name
2. Uses the adapter to get column mappings
3. Handles missing columns gracefully (uses defaults from ColumnMapping)
4. Returns normalized data regardless of source version

### 4. Type definitions (`migrate/src/types/eul-versions.ts`)
- TypeScript types for EulVersionInfo, EulSchemaAdapter, ColumnMapping
- Constants for known version-specific features
- Type guards for version checking

### 5. Tests (`migrate/src/__tests__/eul-version-detector.test.ts`, `eul-schema-adapter.test.ts`)
- Test version detection with mock table listings
- Test schema adapter for EUL4 and EUL5
- Test column mappings include fallbacks
- Test each read function with mock data for both EUL4 and EUL5
- Test edge case: mixed schema (some EUL4 tables, some EUL5 — upgrade in progress)

Use node-oracledb for Oracle connection. Use a connection pool. Handle Oracle errors gracefully (ORA-00942 table does not exist, etc.).
```

**Deliverables:**
- ✅ `migrate/src/services/eul-version-detector.ts`
- ✅ `migrate/src/services/eul-schema-adapter.ts`
- ✅ `migrate/src/types/eul-versions.ts`
- ✅ `migrate/src/__tests__/eul-version-detector.test.ts`
- ✅ `migrate/src/__tests__/eul-schema-adapter.test.ts`
- ✅ Detects EUL3/EUL4/EUL5 correctly
- ✅ Schema adapter handles missing columns with defaults
- ✅ Read functions work for both EUL4 and EUL5 source databases
- ✅ Tests pass with mock data for both versions

---

## Session 5.4 — EUL Reader & Assessment Service

| Field | Value |
|---|---|
| **Goal** | Read any EUL version's schema using the version detector + adapter, and generate assessment reports |
| **Scope** | `migrate/src/services/eul-reader.ts`, `migrate/src/services/assessment.ts`, `migrate/src/cli.ts` |
| **Skills** | `01-sql-fundamentals`, `oracle` |
| **Agents** | `db-expert` (primary), `backend-specialist` (integration) |
| **Model / Effort** | Opus 4.8 — high. Domain-heavy EUL reading and assessment logic |
| **Dependencies** | Session 5.3 (version detector + schema adapter) |

**Prompt:**
```
You are building the EUL reader and assessment service for Discoverer Neo's migration tool. This tool must work with EUL3, EUL4, and EUL5 source databases.

The project root is the current working directory. The `migrate/` directory has:
- EUL version detector (detects EUL3/EUL4/EUL5)
- EUL schema adapter (handles column differences between versions)
- Unified read functions (readBusinessAreas, readFolders, readItems, etc.)

Implement the following:

### 1. EUL reader service (`migrate/src/services/eul-reader.ts`)
- `readEulSchema(connectionConfig)` — connect to Oracle, detect version, create adapter, read all metadata
  - Returns: { version: EulVersionInfo, data: EulFullData }
- `readBusinessAreas(connectionConfig)` — read business areas using adapter
- `readFolders(connectionConfig)` — read folders using adapter
- `readItems(connectionConfig)` — read items/expressions using adapter
- `readJoins(connectionConfig)` — read joins using adapter
- `readHierarchies(connectionConfig)` — read hierarchies using adapter
  - Handle both EUL4 (separate levels table) and EUL5 (IT_EXP_ID in expressions)
- `readCustomFunctions(connectionConfig)` — read custom functions using adapter
- `readUsers(connectionConfig)` — read users using adapter
  - Handle EUL4_USERS vs EUL5 security model differences
- `readGrants(connectionConfig)` — read grants using adapter
  - Handle EUL4 grant tables vs EUL5_BA_ROLES/EUL5_OBJ_ROLES/EUL5_APP_ROLES
- `readWorkbooks(connectionConfig)` — read workbooks using adapter
  - Parse DOC_CONTENT XML (handle both EUL4 and EUL5 XML formats)

### 2. Assessment service (`migrate/src/services/assessment.ts`)
- `generateAssessmentReport(eulData)` — analyze EUL and produce report:
  - EUL version detected
  - Count of business areas, folders, items, joins, hierarchies, functions
  - List of orphaned objects (items without folders, joins without items)
  - Workbook usage statistics (if query log data available)
  - Complexity score (simple/medium/complex) based on:
    - Number of business areas and folders
    - Number of joins and hierarchies
    - Use of calculated items, conditions, custom functions
    - Workbook complexity
  - Migration warnings:
    - EUL4-specific: missing columns that will use defaults
    - EUL3-specific: very old format, limited support
    - Unsupported folder types (DERIVED/SUMMARY from EUL5 — these are supported, but warn if EUL4 source has them somehow)
    - Security model differences
  - Estimated migration time based on object counts

### 3. CLI tool (`migrate/src/cli.ts`)
Commands:
- `dn-migrate analyze --connection <config>` — detect version, read EUL, output assessment report
  - Output includes: version detected, object counts, warnings, migration readiness score
- `dn-migrate export --connection <config> --output <file>` — export EUL data as JSON
  - Output includes: version info, all metadata as normalized JSON
- `dn-migrate validate --connection <config>` — validate EUL data integrity
  - Check for orphaned objects, broken joins, missing references
  - Report version-specific issues

### 4. Tests
- Mock EUL data for both EUL4 and EUL5 (create fixtures)
- Test version detection with mock table listings
- Test each reader function with both EUL4 and EUL5 fixtures
- Test assessment report generation
- Test CLI commands
- Test edge case: mixed schema (upgrade in progress — both EUL4 and EUL5 tables exist)

Use node-oracledb for Oracle connection. Use xml2js for parsing DOC_CONTENT XML. Use commander or yargs for CLI.
```

**Deliverables:**
- ✅ `migrate/src/services/eul-reader.ts`
- ✅ `migrate/src/services/assessment.ts`
- ✅ `migrate/src/cli.ts`
- ✅ Tests pass with both EUL4 and EUL5 fixtures
- ✅ Can read EUL from any version (EUL3/EUL4/EUL5)
- ✅ Assessment report includes version-specific warnings
- ✅ CLI works for analyze, export, validate

---

## Session 5.5 — Data Transformers & Migration Runner

| Field | Value |
|---|---|
| **Goal** | Transform EUL data (from any version) into Discoverer Neo schema and migrate |
| **Scope** | `migrate/src/services/transformers/`, `migrate/src/services/migration-runner.ts`, update CLI with `run` command |
| **Skills** | `database-migration`, `database-schema-designer` |
| **Agents** | `db-expert` (primary), `backend-specialist` (integration) |
| **Model / Effort** | Opus 4.8 — high. Lossy legacy-to-new mapping decisions affect data integrity |
| **Dependencies** | Session 5.4 (EUL reader + assessment) |

**Prompt:**
```
You are implementing the data transformation layer for the Discoverer migration tool. This must handle data from EUL3, EUL4, or EUL5 source databases and transform it into Discoverer Neo's PostgreSQL schema.

The project root is the current working directory. The migrate/ directory has:
- EUL version detector (detects EUL3/EUL4/EUL5)
- EUL schema adapter (handles column differences)
- EUL reader (reads from any version)
- Assessment service

The Discoverer Neo backend has PostgreSQL schema with:
- business_areas, folders, items, joins, hierarchies, hierarchy_levels, custom_functions, maps, map_items, etc.

Implement the following:

### 1. Data transformers (`migrate/src/services/transformers/`)
Each transformer accepts normalized data (from the adapter) and produces Discoverer Neo schema rows:

- `transformBusinessArea(eulBa, version)` → business_areas row
  - Handle missing BA_LANGUAGE/BA_DEVELOPER_KEY (EUL4 doesn't have these)
- `transformFolder(eulObj, version)` → folders row
  - Handle missing OBJ_DESCRIPTION (EUL4)
  - Map folder types: EUL4 has TABLE/VIEW/COMPLEX/JOIN; EUL5 adds DERIVED/SUMMARY
  - Handle unknown folder types gracefully
- `transformItem(eulExpr, version)` → items row
  - Map EXP_TYPE values: CI, CU, CO, JI, HI, AG, FU, SM
  - Handle missing EXP_NULLS_ALLOWED (EUL4)
  - Handle missing IT_EXP_ID (EUL4 uses separate hierarchy levels table)
- `transformJoin(eulJoin, version)` → joins row
  - Handle missing JOI_DESCRIPTION (EUL4)
- `transformHierarchy(eulHier, eulHierLevels, version)` → hierarchies + hierarchy_levels rows
  - Handle both EUL4 (separate levels table) and EUL5 (IT_EXP_ID in expressions)
- `transformCustomFunction(eulFunc, version)` → custom_functions row
- `transformWorkbook(eulDoc, version)` → maps + map_items rows
  - Parse DOC_CONTENT XML (handle both EUL4 and EUL5 XML formats)
  - EUL5 DOC_CONTENT may have DOC_DEVELOPER_KEY and DOC_WORKBOOK_OWNER
- `transformUser(eulUser, version)` → users row
  - Handle EUL4_USERS vs EUL5 security model
- `transformGrants(eulGrants, version)` → user_business_area_grants
  - Handle EUL4 grant tables vs EUL5_BA_ROLES/EUL5_OBJ_ROLES/EUL5_APP_ROLES

### 2. Version-aware type mapping
```
const FOLDER_TYPE_MAP_EUL4 = { TABLE: 'TABLE', VIEW: 'VIEW', COMPLEX: 'COMPLEX', JOIN: 'JOIN' };
const FOLDER_TYPE_MAP_EUL5 = { ...FOLDER_TYPE_MAP_EUL4, DERIVED: 'DERIVED', SUMMARY: 'SUMMARY' };
const ITEM_TYPE_MAP = { CI: 'CI', CU: 'CU', CO: 'CO', JI: 'JI', HI: 'HI', AG: 'AG', FU: 'FU', SM: 'SM' };
const JOIN_TYPE_MAP = { INNER: 'INNER', OUTER: 'LEFT' /* EUL4 OUTER → LEFT */ };
```

### 3. Migration runner (`migrate/src/services/migration-runner.ts`)
- `runMigration(options)` — full migration pipeline:
  1. Detect EUL version
  2. Create schema adapter
  3. Read all EUL data
  4. Transform to Discoverer Neo schema
  5. Validate transformed data
  6. Insert into PostgreSQL (in order: users → business_areas → folders → items → joins → hierarchies → custom_functions → maps → map_items → grants)
  7. Log progress and errors
- `dryRun(options)` — validate without inserting
- `validateMigration()` — post-migration validation (counts match, no orphans)

### 4. Update CLI
- `dn-migrate run --connection <config> --target <postgres> [--dry-run] [--version eul4|eul5|auto]`
  - `--version` flag to override auto-detection
- `dn-migrate validate --connection <config> --target <postgres>` — validate migration
- Progress reporting: show current table being migrated, rows processed
- Error logging: write to migration_log table
- Version display: show detected EUL version before starting

### 5. Migration UI (frontend, `frontend/src/pages/admin/MigrationPage.tsx`)
- Connection configuration (source Oracle, target PostgreSQL)
- "Detect Version" button → shows detected EUL version with details
- "Analyze" button → shows assessment report
- "Run Migration" button → progress bar + log viewer
- Show detected version prominently (EUL4 or EUL5)
- Migration log viewer
- Error report
- Post-migration summary with version-specific notes

### 6. Tests
- Transform each entity type for both EUL4 and EUL5 input
- Type mapping correctness for both versions
- Folder type mapping (EUL4 doesn't have DERIVED/SUMMARY)
- Join type mapping (EUL4 OUTER → LEFT)
- Dry run validates without inserting
- Full migration end-to-end with sample EUL4 data
- Full migration end-to-end with sample EUL5 data
- Post-migration validation
- Version override flag works

Use Drizzle ORM for PostgreSQL writes. Use node-oracledb for Oracle reads.
```

**Deliverables:**
- ✅ `migrate/src/services/transformers/` (all entity transformers, version-aware)
- ✅ `migrate/src/services/migration-runner.ts`
- ✅ Updated CLI with `run` and `validate` commands + `--version` flag
- ✅ `frontend/src/pages/admin/MigrationPage.tsx`
- ✅ Tests pass with both EUL4 and EUL5 fixtures
- ✅ Full migration works end-to-end for both EUL4 and EUL5 sources
- ✅ Progress reporting shows version being migrated
- ✅ Version override flag works

---

## Session 5.6 — Audit Logging

| Field | Value |
|---|---|
| **Goal** | Comprehensive audit logging for all user actions |
| **Scope** | `backend/src/services/audit.service.ts`, `backend/src/plugins/audit.ts`, `backend/src/routes/audit.ts` |
| **Skills** | `backend-api-patterns` |
| **Agents** | `backend-specialist` (primary) |
| **Model / Effort** | Sonnet 5 — medium. Straightforward hook-based logging |
| **Dependencies** | All previous sessions |

**Prompt:**
```
You are implementing audit logging for Discoverer Neo, a Node.js + Fastify + TypeScript backend.

The project root is the current working directory. The backend has:
- All API routes implemented
- Audit log table: id, userId (nullable), action, entityType, entityId, details (JSONB), ipAddress, createdAt

Implement the following:

### 1. Audit service (`backend/src/services/audit.service.ts`)
- `log(entry)` — write audit entry
  - entry: { userId, action, entityType, entityId, details, ipAddress }
- `query(filters)` — query audit log with filters:
  - userId, action, entityType, dateFrom, dateTo, limit, offset
- `getEntityHistory(entityType, entityId)` — all actions on a specific entity
- `getUserActivity(userId, limit)` — recent actions by a user
- `getStats(dateFrom, dateTo)` — aggregate stats (actions per day, per user, per type)

### 2. Audit plugin (`backend/src/plugins/audit.ts`)
- Fastify hook that automatically logs:
  - All mutating requests (POST, PUT, DELETE)
  - Authentication events (login, logout, refresh)
  - Export events
  - Migration events
- Configurable: can exclude certain routes (e.g., health check)
- Captures: userId from JWT, action from HTTP method + route, entityType/EntityId from params/body, details from response, IP from request

### 3. Audit routes (`backend/src/routes/audit.ts`)
All routes require ADMIN role.
- `GET /api/audit` — query audit log (with filters)
- `GET /api/audit/stats` — aggregate stats
- `GET /api/audit/entity/:type/:id` — entity history
- `GET /api/audit/user/:id` — user activity

### 4. Audit log viewer (frontend, `frontend/src/pages/admin/AuditLogPage.tsx`)
- Filterable table: date range, user, action type, entity type
- Detail view: show full JSON details
- Export audit log to CSV
- Stats dashboard: actions per day chart (Recharts)

### 5. Tests
- Audit entries created for all mutating operations
- Query filters work
- Entity history shows all changes
- Stats aggregation correct
- Plugin captures all events

Use Fastify JSON schema validation. Consistent response format.
```

**Deliverables:**
- ✅ `backend/src/services/audit.service.ts`
- ✅ `backend/src/plugins/audit.ts`
- ✅ `backend/src/routes/audit.ts`
- ✅ `frontend/src/pages/admin/AuditLogPage.tsx`
- ✅ Tests pass
- ✅ All actions logged
- ✅ Audit viewer works

---

## Session 5.7 — Security & Migration Integration Testing

| Field | Value |
|---|---|
| **Goal** | End-to-end testing of security policies, sharing, migration, and audit |
| **Scope** | `backend/src/__tests__/integration/security-migration.test.ts` |
| **Skills** | `backend-development-tdd-orchestrator` |
| **Agents** | `backend-development-tdd-orchestrator` (primary) |
| **Model / Effort** | Sonnet 5 — medium. Integration tests over existing features |
| **Dependencies** | All Session 5.1–5.5 |

**Prompt:**
```
You are writing integration tests for Discoverer Neo's security and migration features.

The project root is the current working directory. The backend has:
- Row-level security with SQL predicate injection
- Map sharing with permission levels
- Migration tool (EUL reader + transformers + runner)
- Audit logging

Write comprehensive integration tests:

### Security tests:
1. Create security policy with predicate
2. Execute map as user with policy → verify only allowed rows returned
3. Execute map as different user with different policy → verify different rows
4. Execute map as admin → verify all rows (admin bypass)
5. Multiple policies for same user → all predicates ANDED
6. Policy on business area level → all queries against that BA are filtered
7. Policy on folder level → only queries using that folder are filtered
8. SQL injection attempt in policy predicate → rejected

### Sharing tests:
1. User A creates map, shares with User B (VIEW)
2. User B can view but not edit
3. User A upgrades to EDIT → User B can edit
4. User A revokes → User B cannot access
5. Public map → any user can view

### Migration tests:
1. Read EUL from mock Oracle → all entities parsed
2. Transform EUL data → matches Discoverer Neo schema
3. Dry run → validates without inserting
4. Full migration → all data in PostgreSQL
5. Post-migration validation → counts match
6. Re-migration is idempotent (can run twice without duplicates)

### Audit tests:
1. All mutating operations logged
2. Login/logout logged
3. Export logged
4. Migration logged
5. Query filters work
6. Entity history shows all changes

Mock Oracle driver. Use real PostgreSQL for metadata.
```

**Deliverables:**
- ✅ `backend/src/__tests__/integration/security-migration.test.ts`
- ✅ All security tests pass
- ✅ All sharing tests pass
- ✅ All migration tests pass
- ✅ All audit tests pass

---

# PHASE 6: Polish, Testing & Deployment

> **Goal:** Comprehensive testing. Performance optimization. Documentation. Production deployment.
> **Duration:** 3–4 weeks
> **Prerequisites:** All previous phases complete

---

## Session 6.1 — Comprehensive Backend Testing

| Field | Value |
|---|---|
| **Goal** | Achieve >80% code coverage on backend with unit + integration tests |
| **Scope** | `backend/src/__tests__/`, test configuration updates |
| **Skills** | `backend-development-tdd-orchestrator` |
| **Agents** | `backend-development-tdd-orchestrator` (primary), `auditor` (coverage review) |
| **Model / Effort** | Sonnet 5 — medium. High-volume test writing to a coverage target |
| **Dependencies** | All backend sessions (1.x, 2.x, 4.x, 5.x) |

**Prompt:**
```
You are writing comprehensive tests for Discoverer Neo's backend to achieve >80% code coverage.

The project root is the current working directory. The backend has:
- Auth module (JWT, password hashing, authorization)
- Data source management (CRUD, connection testing, Oracle introspection)
- Business area management (CRUD, grants)
- Folder management (CRUD, Oracle import)
- Item management (all 7 types)
- Join management (CRUD, auto-suggest)
- Hierarchy management
- Custom function registration
- Map management (CRUD, sharing)
- SQL generation engine (SELECT, FROM, WHERE, GROUP BY, ORDER BY)
- Map execution service (sync/async, Oracle via node-oracledb)
- Export service (Excel, CSV, streaming, BullMQ worker)
- Scheduling service (cron, BullMQ worker, result storage)
- Security policies (row-level, SQL predicate injection)
- Audit logging (plugin, query, stats)
- Migration tool (EUL reader, transformers, runner)

Write/reach coverage targets:

### Unit tests (per module):
- `auth.test.ts` — password hashing, token generation/verification
- `encryption.test.ts` — encrypt/decrypt roundtrip
- `parameter-resolver.test.ts` — all parameter types, validation
- `calculated-field-evaluator.test.ts` — formula evaluation, validation
- `sql-generator.test.ts` — all query patterns (already partially done in Phase 2)
- `oracle-introspection.test.ts` — schema discovery (mocked)
- `security.test.ts` — predicate validation, injection prevention
- `audit.service.test.ts` — logging, querying, stats

### Integration tests (end-to-end):
- `query-engine.test.ts` — full pipeline (already done in Phase 2)
- `export-scheduling.test.ts` — export + scheduling (already done in Phase 4)
- `security-migration.test.ts` — security + migration (already done in Phase 5)
- `metadata-crud.test.ts` — all metadata CRUD operations end-to-end
- `map-execution-flow.test.ts` — create map → execute → verify results → export
- `e2e-workflow.test.ts` — full user workflow: login → create business area → import from Oracle → create map → execute → export → schedule

### Coverage target:
- Statements: >80%
- Branches: >75%
- Functions: >80%
- Lines: >80%

Run `jest --coverage` and verify all targets are met. Add tests for any gaps.
```

**Deliverables:**
- ✅ Unit tests for all modules
- ✅ Integration tests for all workflows
- ✅ Code coverage >80%
- ✅ All tests pass (`npm test`)
- ✅ Coverage report generated

---

## Session 6.2 — Performance Optimization

| Field | Value |
|---|---|
| **Goal** | Profile and optimize backend and frontend performance |
| **Scope** | Backend profiling, frontend bundle optimization, database indexing, Redis caching |
| **Skills** | `application-performance-performance-optimization`, `react-performance`, `react-performance-optimizer` |
| **Agents** | `application-performance-frontend-developer` (frontend), `backend-specialist` (backend) |
| **Model / Effort** | Opus 4.8 — high. Profiling and subtle performance diagnosis |
| **Dependencies** | All previous sessions |

**Prompt:**
```
You are optimizing the performance of Discoverer Neo.

The project root is the current working directory. The backend has been fully implemented. The frontend has been fully implemented.

### Backend optimization:
1. **Oracle connection pooling**: Profile pool usage under concurrent load. Adjust pool size (min/max) based on expected concurrent users.
2. **Query execution**: Add indexes to PostgreSQL metadata tables (business_areas, folders, items, maps, map_items). Analyze slow queries with EXPLAIN ANALYZE.
3. **Redis caching**: Cache frequently accessed metadata (business areas, folders, items) in Redis with appropriate TTL. Reduce PostgreSQL queries.
4. **SQL generation**: Profile the SQL generator. Ensure it handles complex maps efficiently.
5. **Export streaming**: Verify streaming doesn't cause memory issues with 1M+ row exports. Monitor heap usage.
6. **Concurrent execution**: Test with 10+ simultaneous map executions. Identify bottlenecks.

### Frontend optimization:
1. **Bundle analysis**: Run `vite-bundle-visualizer` to identify large dependencies.
2. **Code splitting**: Use React.lazy for all page components. Load Monaco Editor only when needed.
3. **Virtual scrolling**: Ensure data table virtualizes properly for large datasets.
4. **Tree virtualization**: Virtualize the business area tree for large metadata sets.
5. **Debouncing**: Add debounce to search inputs in tree and item selectors.
6. **Memoization**: Add React.memo to expensive components (tree nodes, table cells).
7. **Image optimization**: Optimize any static assets.
8. **Tree shaking**: Ensure unused dependencies are not bundled.

### Performance targets:
- Backend health check: <50ms response
- Metadata API endpoints: <200ms response (p95)
- Map execution (simple): <2s for 1000 rows
- Map execution (complex): <10s for 10000 rows
- SQL generation: <100ms
- Frontend initial load: <3s
- Frontend time-to-interactive: <5s
- Export 100k rows: <30s

Document all optimizations applied and their impact.
```

**Deliverables:**
- ✅ Backend connection pool tuned
- ✅ PostgreSQL indexes added
- ✅ Redis caching implemented
- ✅ Frontend bundle optimized (<500KB initial)
- ✅ Code splitting for all routes
- ✅ Virtual scrolling in tree and table
- ✅ All performance targets met

---

## Session 6.3 — Documentation

| Field | Value |
|---|---|
| **Goal** | Comprehensive documentation for users, administrators, and developers |
| **Scope** | `docs/` directory — API docs, user guide, admin guide, developer guide, deployment guide |
| **Skills** | `api-testing-observability-api-documenter`, `technical-writer` |
| **Agents** | `docs-master` (primary), `api-testing-observability-api-documenter` (API docs) |
| **Model / Effort** | Sonnet 5 — medium. Documentation writing (Haiku 4.5 is a viable budget option) |
| **Dependencies** | All features implemented |

**Prompt:**
```
You are writing documentation for Discoverer Neo, a modern open-source BI tool.

The project root is the current working directory. The application is fully implemented with:
- Backend API (Node.js + Fastify + TypeScript)
- Frontend SPA (React 19 + Vite)
- PostgreSQL metadata database
- Redis for caching and job queue
- Oracle connectivity via node-oracledb
- Excel/CSV export
- Scheduling with BullMQ
- Row-level security
- Discoverer 4 migration tool

Create the following documentation in a `docs/` directory:

### 1. `docs/README.md` — Project overview
- What is Discoverer Neo
- Feature list
- Screenshots (placeholders)
- Quick start (Docker Compose)
- License

### 2. `docs/api/` — API documentation
- OpenAPI/Swagger spec is already available at /api/docs
- Export the spec to `docs/api/openapi.yaml`
- Add authentication guide
- Add examples for all endpoints

### 3. `docs/user-guide/` — End-user guide
- `getting-started.md` — Logging in, navigating the interface
- `building-maps.md` — Creating maps, dragging items, conditions, parameters
- `executing-maps.md` — Running maps, viewing results, pagination
- `exporting-data.md` — Excel and CSV export
- `scheduling.md` — Scheduled map execution
- `dashboards.md` — Using the dashboard

### 4. `docs/admin-guide/` — Administrator guide
- `metadata-management.md` — Business areas, folders, items, joins, hierarchies
- `oracle-introspection.md` — Importing tables from Oracle
- `data-sources.md` — Managing Oracle connections
- `security.md` — Row-level security policies
- `user-management.md` — Users, roles, grants

### 5. `docs/developer-guide/` — Developer guide
- `architecture.md` — System architecture overview
- `development.md` — Setting up development environment
- `backend.md` — Backend code structure, key modules
- `frontend.md` — Frontend code structure, key components
- `testing.md` — How to run tests
- `contributing.md` — Contribution guidelines

### 6. `docs/deployment/` — Deployment guide
- `docker.md` — Docker Compose deployment
- `configuration.md` — Environment variables reference
- `ssl.md` — SSL/TLS configuration with Nginx
- `backup.md` — Backup and restore strategy
- `monitoring.md` — Prometheus + Grafana setup

### 7. `docs/migration/` — Migration guide
- `from-discoverer4.md` — Migrating from Oracle Discoverer 4
- `migration-tool.md` — Using the migration CLI
- `troubleshooting.md` — Common migration issues

Write in clear, technical English. Use markdown with proper headings, code blocks, and tables.
```

**Deliverables:**
- ✅ `docs/README.md`
- ✅ `docs/api/` (OpenAPI spec + auth guide)
- ✅ `docs/user-guide/` (6 guides)
- ✅ `docs/admin-guide/` (5 guides)
- ✅ `docs/developer-guide/` (6 guides)
- ✅ `docs/deployment/` (5 guides)
- ✅ `docs/migration/` (3 guides)

---

## Session 6.4 — Production Readiness & Final Verification

| Field | Value |
|---|---|
| **Goal** | Production-ready Docker deployment, health checks, graceful shutdown, monitoring, final verification |
| **Scope** | Production Docker config, Nginx SSL, health endpoints, shutdown handlers |
| **Skills** | `docker-deployment`, `cloud-monitoring-alert` |
| **Agents** | `docker-expert` (deployment), `cicd-automation-deployment-engineer` (CI/CD) |
| **Model / Effort** | Sonnet 5 — high. Production config and careful final verification |
| **Dependencies** | All previous sessions |

**Prompt:**
```
You are making Discoverer Neo production-ready.

The project root is the current working directory. All features are implemented. All tests pass. Documentation is complete.

Implement production readiness:

### 1. Production Docker Compose (`docker-compose.prod.yml`)
- Optimized for production (no volume mounts, no dev tools)
- Resource limits for containers
- Restart policies: `unless-stopped`
- Health checks for all services
- Logging configuration (JSON driver, max size)
- Environment variables from `.env` (not `.env.example`)
- Separate Nginx container for reverse proxy + SSL termination

### 2. Nginx SSL configuration (`nginx/nginx-ssl.conf`)
- SSL/TLS with modern ciphers
- HTTP → HTTPS redirect
- HSTS header
- OCSP stapling
- Gzip compression
- Static file caching (hashed assets)

### 3. Health check enhancements
- Backend: GET /health — enhanced (from Phase 1)
  - Check DB connection
  - Check Redis connection
  - Check Oracle client initialization
  - Return version, uptime, service status
- Frontend: Serve a simple health endpoint from Nginx

### 4. Graceful shutdown
- Backend: Handle SIGTERM/SIGINT
  - Stop accepting new connections
  - Wait for in-flight requests to complete (max 10s)
  - Close database connections
  - Close Redis connections
  - Close Oracle connections
  - Log shutdown complete

### 5. Backup strategy
- PostgreSQL: `pg_dump` cron job (daily)
- Export files: backup Docker volume
- Redis: RDB persistence (already configured)
- Script: `scripts/backup.sh`
- Script: `scripts/restore.sh`

### 6. Monitoring metrics (optional but recommended)
- Backend: Expose Prometheus-compatible metrics at GET /metrics
  - Request count, latency, error rate
  - DB query count and duration
  - Redis cache hit/miss rate
  - Export job count and duration
  - Schedule execution count
- Frontend: No metrics needed (SPA)

### 7. CI/CD pipeline (`.github/workflows/`)
- `ci.yml` — Run tests on every push
  - Backend tests
  - Frontend tests
  - Lint + type check
- `docker.yml` — Build and push Docker images on release
  - Tag with version and `latest`
  - Push to container registry

### 8. Final verification
- [ ] All tests pass (`npm test` in backend, frontend, migrate)
- [ ] Docker Compose starts all services
- [ ] Frontend loads in browser
- [ ] Login works
- [ ] Create business area → import from Oracle → create map → execute → export
- [ ] Admin pages all work
- [ ] Security policies work
- [ ] Scheduling works
- [ ] Audit logging captures all events
- [ ] Documentation is complete
- [ ] Production Docker Compose starts
- [ ] SSL redirect works

Run the full verification checklist. Fix any issues found.
```

**Deliverables:**
- ✅ `docker-compose.prod.yml`
- ✅ `nginx/nginx-ssl.conf`
- ✅ Enhanced health checks
- ✅ Graceful shutdown handlers
- ✅ Backup/restore scripts
- ✅ Monitoring metrics
- ✅ GitHub Actions CI/CD
- ✅ Full verification checklist passed
- ✅ Production deployment ready

---

# PHASE 7: Internationalization, Theming & User Preferences

> **Goal:** Users can select a UI language (English, European Portuguese, France French, European Spanish) and a visual theme (Light, Dark, High Contrast) per-account, from a new Settings page. All UI strings and user-facing documentation are translated into the three added languages, with BI terminology consistent with Power BI/Tableau's localized editions.
> **Duration:** 3–4 weeks
> **Prerequisites:** Session 1.1 (Authentication), Phase 3 (Frontend UI complete), Session 6.3 (Documentation)

---

## Session 7.1 — User Preferences Backend (Locale & Theme)

| Field | Value |
|---|---|
| **Goal** | Per-user language and theme preference, stored in the database and exposed via a preferences API |
| **Scope** | `backend/src/db/schema.ts`, new Drizzle migration, `backend/src/services/user-preferences.service.ts`, `backend/src/routes/user-preferences.ts` |
| **Skills** | `backend-api-patterns`, `drizzle-orm-patterns` |
| **Agents** | `backend-specialist` (primary), `db-expert` (migration) |
| **Model / Effort** | Sonnet 5 — medium. Standard CRUD plus enum validation |
| **Dependencies** | Session 1.1 (Authentication Module) |

**Prompt:**
```
You are adding per-user language and theme preferences to Discoverer Neo's backend.

The project root is discoverer-neo/ (current working directory). The backend is Node.js + Fastify + TypeScript + Drizzle ORM + PostgreSQL. The `users` table is defined in `backend/src/db/schema.ts`.

Implement the following:

### 1. Schema changes (`backend/src/db/schema.ts`)
- Add a `localeEnum` Drizzle pgEnum: `['en', 'pt-PT', 'fr-FR', 'es-ES']`
- Add a `themeEnum` Drizzle pgEnum: `['light', 'dark', 'high-contrast']`
- Add `locale` column to `users`: `localeEnum('locale').notNull().default('en')`
- Add `theme` column to `users`: `themeEnum('theme').notNull().default('light')`
- Generate the Drizzle migration (`drizzle-kit generate`)

### 2. Preferences service (`backend/src/services/user-preferences.service.ts`)
- `getPreferences(userId)` — returns `{ locale, theme }`
- `updatePreferences(userId, { locale?, theme? })` — partial update, validates against the enums, updates `updated_at`

### 3. Preferences routes (`backend/src/routes/user-preferences.ts`)
- `GET /api/users/me/preferences` — returns the current user's `{ locale, theme }` (auth required)
- `PATCH /api/users/me/preferences` — Zod-validated body `{ locale?: 'en'|'pt-PT'|'fr-FR'|'es-ES', theme?: 'light'|'dark'|'high-contrast' }`, at least one field required
- Register the route in `backend/src/app.ts`
- Include `locale` and `theme` in the `/api/auth/login` and `/api/auth/me` response payloads so the frontend can apply them immediately on load, without a second round trip

### 4. Tests (`backend/src/__tests__/user-preferences.test.ts`)
- Default values for a newly created user (`en` / `light`)
- Update locale only, update theme only, update both
- Reject invalid locale/theme values (400)
- Reject empty body (400)
- Unauthenticated request rejected (401)
- Preferences persist across requests

Follow the existing service/route/test structure used by `backend/src/services/business-area.service.ts` and `backend/src/routes/business-areas.ts` for consistency.
```

**Deliverables:**
- ✅ `locale` and `theme` columns on `users`, migrated
- ✅ `GET`/`PATCH /api/users/me/preferences`
- ✅ Preferences included in login/`me` responses
- ✅ Tests passing

---

## Session 7.2 — i18n Frontend Infrastructure & String Extraction

| Field | Value |
|---|---|
| **Goal** | react-i18next wired end-to-end; every hardcoded UI string extracted into an `en` baseline resource set |
| **Scope** | `frontend/src/i18n/`, `frontend/src/locales/en/*.json`, every existing page/component (string extraction) |
| **Skills** | `i18n`, `i18n-localization`, `react` |
| **Agents** | `application-performance-frontend-developer` (primary), `frontend-mobile-development-frontend-developer` (parallel string extraction across page groups) |
| **Model / Effort** | Opus 4.8 — high. Touches nearly every file in the frontend; a missed string silently breaks every non-English locale |
| **Dependencies** | Session 7.1; all of Phase 3 (frontend UI complete) |

**Prompt:**
```
You are wiring internationalization (i18n) infrastructure into Discoverer Neo's React frontend and extracting every hardcoded UI string into translation resources.

The project root is discoverer-neo/ (current working directory). The frontend is React 19 + Vite + TypeScript + Tailwind CSS 4 + shadcn/ui + Zustand + TanStack Query. It currently has:
- Login page, dashboard
- Admin pages: business areas, data sources, folders, items, joins, hierarchies, users, custom functions
- Map builder: business area tree, map canvas, conditions/sort/parameters/calculated-fields panels, toolbar
- Map viewer, results table, export
- Schedules page, security page, migration page, audit log page

None of this UI is currently internationalized — all strings are hardcoded English JSX text.

### 1. Install & configure
- `react-i18next`, `i18next`, `i18next-browser-languagedetector`
- `frontend/src/i18n/index.ts` — i18next init: supported locales `['en', 'pt-PT', 'fr-FR', 'es-ES']`, fallback `'en'`, namespaced resources, interpolation escaping off (React already escapes)

### 2. Resource namespace structure (`frontend/src/locales/en/*.json`)
Create one JSON file per namespace, all under `frontend/src/locales/en/`:
- `common.json` — generic actions/labels (Save, Cancel, Delete, Edit, Search, Loading, Yes, No, Confirm, Back, Next, etc.)
- `auth.json` — login page
- `nav.json` — sidebar/navigation labels
- `admin.json` — all 8 admin CRUD pages
- `mapBuilder.json` — tree, canvas, toolbar, all four right-panel tabs
- `mapViewer.json` — viewer page, results table, export dialog
- `schedules.json`
- `security.json`
- `migration.json`
- `audit.json`
- `settings.json` — placeholder for Session 7.4's Settings page
- `errors.json` — API/validation error messages, keyed by backend error code where one exists

### 3. Extraction rules
- Every user-visible string becomes a `t('namespace:key')` call — no hardcoded English text left in JSX
- Interpolated values use i18next placeholder syntax: `t('key', { count })` → `"key": "{{count}} rows selected"`
- Pluralization uses i18next's `_one`/`_other` key suffixes where applicable (e.g., row counts, error counts)
- Keys are namespaced and hierarchical (e.g., `admin:businessAreas.createButton`, not a flat dump)
- Do not translate log messages, internal error codes, or developer-facing console output — only user-visible UI text

### 4. Locale resolution & switching
- Resolution order: authenticated user's saved `locale` preference (from `/api/auth/me`) → browser `navigator.language` via `i18next-browser-languagedetector` → `en` fallback
- `frontend/src/hooks/useLocale.ts` — reads/sets the active locale, syncs to `PATCH /api/users/me/preferences` when the user changes it (Session 7.4 will call this)
- Switching locale updates the UI immediately without a full page reload

### 5. Locale-aware formatting (`frontend/src/lib/format.ts`)
- `formatDate(date, locale)` / `formatNumber(n, locale)` / `formatCurrency` using `Intl.DateTimeFormat` / `Intl.NumberFormat`, replacing any ad-hoc date/number formatting currently in the codebase
- Wire into the results table and export preview

### 6. Tests
- `frontend/src/__tests__/i18n.test.tsx` — fallback to `en` when a key is missing in another locale, interpolation renders correctly, locale switch re-renders translated text

Do NOT write pt-PT/fr-FR/es-ES translations in this session — only the `en` baseline and the infrastructure. Sessions 7.5–7.7 handle translation content. Empty locale JSON files (`frontend/src/locales/pt-PT/`, `fr-FR/`, `es-ES/`) with the same keys as `en` but placeholder/untranslated values are acceptable scaffolding for this session so the app doesn't crash if a locale is selected early.
```

**Deliverables:**
- ✅ react-i18next configured with 4 supported locales
- ✅ Every existing hardcoded string extracted into namespaced `en` JSON resources
- ✅ Locale resolution order implemented and tested
- ✅ Locale-aware date/number formatting
- ✅ Scaffolded (untranslated) locale files for pt-PT/fr-FR/es-ES

---

## Session 7.3 — Theming Infrastructure

| Field | Value |
|---|---|
| **Goal** | Multiple selectable themes (Light, Dark, High Contrast) via CSS custom-property tokens, applied instantly and persisted per-user |
| **Scope** | `frontend/src/styles/themes/`, `frontend/src/providers/ThemeProvider.tsx`, Tailwind theme config, shadcn component tokens |
| **Skills** | `tailwindcss-advanced-design-systems`, `tailwindcss-responsive-darkmode`, `dark-mode-design-expert` |
| **Agents** | `application-performance-frontend-developer` (primary), `ui-designer` (token/palette design) |
| **Model / Effort** | Sonnet 5 — medium. Well-specified token system; the shadcn theming pattern is a known recipe |
| **Dependencies** | Session 7.1 |

**Prompt:**
```
You are implementing a multi-theme system for Discoverer Neo's React frontend.

The project root is discoverer-neo/ (current working directory). The frontend uses Tailwind CSS 4 + shadcn/ui, which already themes via CSS custom properties on `:root` (e.g. `--background`, `--foreground`, `--primary`, `--border`, etc., consumed by `tailwind.config`/`@theme`).

Implement three built-in themes:

### 1. Theme token files (`frontend/src/styles/themes/`)
- `light.css` — current default palette, extracted into a `[data-theme="light"]` block if not already token-based
- `dark.css` — `[data-theme="dark"]` block, WCAG AA contrast against `light`
- `high-contrast.css` — `[data-theme="high-contrast"]` block, maximized contrast (near-black/near-white, no low-contrast grays), for accessibility
- Each file defines the same full set of CSS custom properties so no theme is missing a token the components rely on

### 2. ThemeProvider (`frontend/src/providers/ThemeProvider.tsx`)
- React context exposing `{ theme, setTheme }`
- Applies the active theme by setting `data-theme` on `<html>`
- On first load with no saved preference, defaults to the OS `prefers-color-scheme` (light/dark), falling back to `light`
- Once a user has an explicit saved preference (from `/api/auth/me`), it always wins over `prefers-color-scheme`
- Persists changes via `PATCH /api/users/me/preferences` (same endpoint pattern as locale in Session 7.2) and to `localStorage` for instant paint on next load before the API responds

### 3. Component audit
- Verify every existing page and component (admin pages, map builder, map viewer, dialogs, tables, toasts) renders correctly in all three themes — no hardcoded Tailwind colors (e.g. `bg-white`, `text-gray-900`) that bypass the token system. Replace any with the appropriate token-based utility class.

### 4. Tests
- `frontend/src/__tests__/theme.test.tsx` — theme switch updates `data-theme`, defaults to `prefers-color-scheme` when unset, saved preference overrides OS setting

Do not build the theme picker UI in this session — that is Session 7.4. This session is the token system and provider only.
```

**Deliverables:**
- ✅ Light, Dark, High Contrast theme token sets
- ✅ `ThemeProvider` with `prefers-color-scheme` default and saved-preference override
- ✅ Every existing component verified theme-safe (no hardcoded colors)
- ✅ Theme choice persisted to backend + localStorage

---

## Session 7.4 — Settings Page (Language & Theme)

| Field | Value |
|---|---|
| **Goal** | A user-facing Settings page where language and theme preferences are viewed, previewed, and saved |
| **Scope** | `frontend/src/pages/SettingsPage.tsx`, navigation, routing |
| **Skills** | `react-forms`, `i18n`, `tailwindcss-responsive-darkmode` |
| **Agents** | `application-performance-frontend-developer` (primary), `component-create` (form components) |
| **Model / Effort** | Sonnet 5 — medium. Standard form page following the existing admin-page pattern |
| **Dependencies** | Session 7.1, Session 7.2, Session 7.3 |

**Prompt:**
```
You are building a Settings page for Discoverer Neo. The frontend currently has no user-facing settings/profile page at all.

The project root is discoverer-neo/ (current working directory). Session 7.1 added `GET`/`PATCH /api/users/me/preferences` (`{ locale, theme }`). Session 7.2 added react-i18next with 4 supported locales. Session 7.3 added the `ThemeProvider` with 3 themes.

Implement:

### 1. Settings page (`frontend/src/pages/SettingsPage.tsx`)
- Route: `/settings`, accessible to any authenticated user (not admin-only)
- "Language" section: a dropdown/select listing English, Português (Portugal), Français (France), Español (España) — each option labeled in its own language (autonym), not translated into the current UI language
- "Theme" section: a visual picker (three swatch cards — Light, Dark, High Contrast) with a live preview that applies the theme immediately on click, before saving
- "Save" persists via `PATCH /api/users/me/preferences`; changing the dropdown/picker updates the live UI immediately (via the hooks from 7.2/7.3) regardless of whether the user has clicked Save — Save just persists it as the account default
- Loading and error states (e.g. save failure) using the existing toast component

### 2. Navigation
- Add a "Settings" entry to the sidebar/nav (`frontend/src/components/layout/`), visible to all authenticated users
- Add a link from the user profile menu/avatar dropdown if one exists

### 3. Use the extracted `settings.json` namespace from Session 7.2 for all strings on this page (fill in the real English text — Session 7.2 only scaffolded the namespace).

### 4. Tests (`frontend/src/__tests__/settings.test.tsx`)
- Renders current preferences on load
- Changing language updates displayed text immediately
- Changing theme updates `data-theme` immediately
- Save calls the preferences API and shows a success toast
- Save failure shows an error toast and does not lose the unsaved selection
```

**Deliverables:**
- ✅ `/settings` page with language and theme controls
- ✅ Live preview before save
- ✅ Persists to backend preferences API
- ✅ Reachable from navigation

---

## Session 7.5 — Portuguese (pt-PT) Translation Content

| Field | Value |
|---|---|
| **Goal** | Complete, enterprise-quality European Portuguese (pt-PT) translation of every UI string namespace |
| **Scope** | `frontend/src/locales/pt-PT/*.json`, `docs/i18n/glossary-pt-PT.md` |
| **Skills** | `i18n-localization`, `microcopy` |
| **Agents** | `general-purpose` (primary — translation), `docs-master` (glossary consistency review) |
| **Model / Effort** | Sonnet 5 — high. Terminology fidelity and tone consistency across ~11 namespaces |
| **Dependencies** | Session 7.2 (namespace structure + `en` baseline exist) |

**Prompt:**
```
You are producing the European Portuguese (pt-PT) translation for Discoverer Neo, an enterprise business-intelligence tool.

The project root is discoverer-neo/ (current working directory). Session 7.2 extracted every UI string into `frontend/src/locales/en/*.json` (namespaces: common, auth, nav, admin, mapBuilder, mapViewer, schedules, security, migration, audit, settings, errors) and scaffolded empty `frontend/src/locales/pt-PT/*.json` files with the same keys.

### Rules (apply to every string, no exceptions)
1. **Terminology** — Use the same terms European Portuguese localized editions of Power BI and Tableau use for BI concepts (report, dashboard, filter, measure, dimension, drill down/up, pivot table, data source, query, workbook/worksheet, etc.). Do not invent new Portuguese terminology for concepts these tools already localize. Where Discoverer Neo has a concept with no direct Power BI/Tableau equivalent (e.g. "Business Area", "Folder" as EUL concepts, "Map" as the Discoverer term for a saved query), translate it plainly and consistently rather than force-fitting a BI-tool term that means something different.
2. **Placeholders** — Preserve every placeholder exactly as written: `{{count}}`, `{{name}}`, `%s`, `{0}`, etc. Never translate, reorder, or drop a placeholder token. Word order may need to change around the placeholder to read naturally in Portuguese — the token itself must not.
3. **Conciseness** — Button and label strings must stay button/label length. Do not expand a 2-word English label into a Portuguese sentence. If the literal translation is much longer than the English source, prefer the shorter idiomatic BI term over a literal one.
4. **Tone** — Professional, neutral, enterprise register throughout (formal "você"/3rd-person address as used in enterprise software, not casual "tu"). No exclamation marks, no consumer-app friendliness, no humor.

### 1. Build the glossary first (`docs/i18n/glossary-pt-PT.md`)
Before translating, establish and document the pt-PT rendering of Discoverer Neo's core domain terms, cross-checked against how Power BI Desktop/Service and Tableau Desktop render the equivalent concept in their pt-PT UI: Business Area, Folder, Item, Join, Hierarchy, Map (workbook), Worksheet, Parameter, Condition, Calculated Field, Aggregation, Schedule, Export, Data Source, Role, Permission, Report, Dashboard, Filter, Sort, Drill Down, Drill Up, Crosstab/Pivot Table, Measure, Dimension, Column, Row, Query, Audit Log, Security Policy, Business Area Grant. Record the chosen Portuguese term, and if Power BI and Tableau disagree on a term, note both and state which one you followed and why (prefer Power BI's rendering as the primary reference, since Microsoft's pt-PT localization is the more widely deployed enterprise standard; fall back to Tableau's where Power BI has no equivalent concept).

### 2. Translate every namespace
Fill in `frontend/src/locales/pt-PT/common.json`, `auth.json`, `nav.json`, `admin.json`, `mapBuilder.json`, `mapViewer.json`, `schedules.json`, `security.json`, `migration.json`, `audit.json`, `settings.json`, `errors.json` — every key present in the corresponding `en/*.json` file must be present here with the same key, same placeholder tokens, and a pt-PT value that follows the glossary and the four rules above.

### 3. Language autonym
In `settings.json`, ensure the language's own display name (used in the Settings page language picker from Session 7.4) is the autonym `"Português (Portugal)"`, not translated into pt-PT itself (it already is pt-PT) nor into English.

### 4. Validation script (`scripts/i18n-check.mjs`)
Write (or extend if it already exists) a Node script that, for a given locale, verifies against `en`:
- Every key in `en/<namespace>.json` exists in `<locale>/<namespace>.json` and vice versa (no extra/missing keys)
- Every placeholder token (`{{...}}`, `%s`, `{N}`) present in the `en` value appears, unchanged, in the translated value
- No value is empty
Run it for `pt-PT` and fix every reported issue before finishing.

### 5. Spot-check readability
Read through `mapBuilder.json` and `admin.json` end-to-end as a native pt-PT speaker would encounter them in the UI (in context — these are button labels, panel headings, and short helper text, not prose) and fix anything that reads as machine-translated or overly literal.
```

**Deliverables:**
- ✅ `docs/i18n/glossary-pt-PT.md`
- ✅ Every namespace fully translated in `frontend/src/locales/pt-PT/`
- ✅ `scripts/i18n-check.mjs` passes for `pt-PT` with zero missing keys/placeholders
- ✅ No untranslated or English-leftover strings

---

## Session 7.6 — French (fr-FR) Translation Content

| Field | Value |
|---|---|
| **Goal** | Complete, enterprise-quality France French (fr-FR) translation of every UI string namespace |
| **Scope** | `frontend/src/locales/fr-FR/*.json`, `docs/i18n/glossary-fr-FR.md` |
| **Skills** | `i18n-localization`, `microcopy` |
| **Agents** | `general-purpose` (primary — translation), `docs-master` (glossary consistency review) |
| **Model / Effort** | Sonnet 5 — high. Terminology fidelity and tone consistency across ~11 namespaces |
| **Dependencies** | Session 7.2 (namespace structure + `en` baseline exist) |

**Prompt:**
```
You are producing the France French (fr-FR) translation for Discoverer Neo, an enterprise business-intelligence tool.

The project root is discoverer-neo/ (current working directory). Session 7.2 extracted every UI string into `frontend/src/locales/en/*.json` (namespaces: common, auth, nav, admin, mapBuilder, mapViewer, schedules, security, migration, audit, settings, errors) and scaffolded empty `frontend/src/locales/fr-FR/*.json` files with the same keys.

### Rules (apply to every string, no exceptions)
1. **Terminology** — Use the same terms France French localized editions of Power BI and Tableau use for BI concepts (rapport, tableau de bord, filtre, mesure, dimension, exploration ascendante/descendante, tableau croisé dynamique, source de données, requête, classeur/feuille, etc.). Do not invent new French terminology for concepts these tools already localize. Where Discoverer Neo has a concept with no direct Power BI/Tableau equivalent (e.g. "Business Area", "Folder" as EUL concepts, "Map" as the Discoverer term for a saved query), translate it plainly and consistently rather than force-fitting a BI-tool term that means something different.
2. **Placeholders** — Preserve every placeholder exactly as written: `{{count}}`, `{{name}}`, `%s`, `{0}`, etc. Never translate, reorder, or drop a placeholder token. Word order may need to change around the placeholder to read naturally in French — the token itself must not.
3. **Conciseness** — Button and label strings must stay button/label length. Do not expand a 2-word English label into a French sentence. If the literal translation is much longer than the English source, prefer the shorter idiomatic BI term over a literal one.
4. **Tone** — Professional, neutral, enterprise register throughout (formal "vous" address, as is standard in French enterprise software). No exclamation marks, no consumer-app friendliness, no humor.

### 1. Build the glossary first (`docs/i18n/glossary-fr-FR.md`)
Before translating, establish and document the fr-FR rendering of Discoverer Neo's core domain terms, cross-checked against how Power BI Desktop/Service and Tableau Desktop render the equivalent concept in their fr-FR UI: Business Area, Folder, Item, Join, Hierarchy, Map (workbook), Worksheet, Parameter, Condition, Calculated Field, Aggregation, Schedule, Export, Data Source, Role, Permission, Report, Dashboard, Filter, Sort, Drill Down, Drill Up, Crosstab/Pivot Table, Measure, Dimension, Column, Row, Query, Audit Log, Security Policy, Business Area Grant. Record the chosen French term, and if Power BI and Tableau disagree on a term, note both and state which one you followed and why (prefer Power BI's rendering as the primary reference, since Microsoft's fr-FR localization is the more widely deployed enterprise standard; fall back to Tableau's where Power BI has no equivalent concept).

### 2. Translate every namespace
Fill in `frontend/src/locales/fr-FR/common.json`, `auth.json`, `nav.json`, `admin.json`, `mapBuilder.json`, `mapViewer.json`, `schedules.json`, `security.json`, `migration.json`, `audit.json`, `settings.json`, `errors.json` — every key present in the corresponding `en/*.json` file must be present here with the same key, same placeholder tokens, and a fr-FR value that follows the glossary and the four rules above.

### 3. Language autonym
In `settings.json`, ensure the language's own display name (used in the Settings page language picker from Session 7.4) is the autonym `"Français (France)"`, not translated into fr-FR itself (it already is fr-FR) nor into English.

### 4. Validation script (`scripts/i18n-check.mjs`)
Reuse the script from Session 7.5 (it is locale-parameterized). Run it for `fr-FR` and fix every reported issue before finishing.

### 5. Spot-check readability
Read through `mapBuilder.json` and `admin.json` end-to-end as a native fr-FR speaker would encounter them in the UI (in context — these are button labels, panel headings, and short helper text, not prose) and fix anything that reads as machine-translated or overly literal.
```

**Deliverables:**
- ✅ `docs/i18n/glossary-fr-FR.md`
- ✅ Every namespace fully translated in `frontend/src/locales/fr-FR/`
- ✅ `scripts/i18n-check.mjs` passes for `fr-FR` with zero missing keys/placeholders
- ✅ No untranslated or English-leftover strings

---

## Session 7.7 — Spanish (es-ES) Translation Content

| Field | Value |
|---|---|
| **Goal** | Complete, enterprise-quality European Spanish (es-ES) translation of every UI string namespace |
| **Scope** | `frontend/src/locales/es-ES/*.json`, `docs/i18n/glossary-es-ES.md` |
| **Skills** | `i18n-localization`, `microcopy` |
| **Agents** | `general-purpose` (primary — translation), `docs-master` (glossary consistency review) |
| **Model / Effort** | Sonnet 5 — high. Terminology fidelity and tone consistency across ~11 namespaces |
| **Dependencies** | Session 7.2 (namespace structure + `en` baseline exist) |

**Prompt:**
```
You are producing the European Spanish (es-ES) translation for Discoverer Neo, an enterprise business-intelligence tool.

The project root is discoverer-neo/ (current working directory). Session 7.2 extracted every UI string into `frontend/src/locales/en/*.json` (namespaces: common, auth, nav, admin, mapBuilder, mapViewer, schedules, security, migration, audit, settings, errors) and scaffolded empty `frontend/src/locales/es-ES/*.json` files with the same keys.

### Rules (apply to every string, no exceptions)
1. **Terminology** — Use the same terms European Spanish localized editions of Power BI and Tableau use for BI concepts (informe, panel, filtro, medida, dimensión, profundizar/reducir detalle, tabla dinámica, origen de datos, consulta, libro/hoja de trabajo, etc.). Do not invent new Spanish terminology for concepts these tools already localize. Where Discoverer Neo has a concept with no direct Power BI/Tableau equivalent (e.g. "Business Area", "Folder" as EUL concepts, "Map" as the Discoverer term for a saved query), translate it plainly and consistently rather than force-fitting a BI-tool term that means something different.
2. **Placeholders** — Preserve every placeholder exactly as written: `{{count}}`, `{{name}}`, `%s`, `{0}`, etc. Never translate, reorder, or drop a placeholder token. Word order may need to change around the placeholder to read naturally in Spanish — the token itself must not.
3. **Conciseness** — Button and label strings must stay button/label length. Do not expand a 2-word English label into a Spanish sentence. If the literal translation is much longer than the English source, prefer the shorter idiomatic BI term over a literal one.
4. **Tone** — Professional, neutral, enterprise register throughout (formal "usted" address, as is standard in Spanish enterprise software). No exclamation marks, no consumer-app friendliness, no humor.

### 1. Build the glossary first (`docs/i18n/glossary-es-ES.md`)
Before translating, establish and document the es-ES rendering of Discoverer Neo's core domain terms, cross-checked against how Power BI Desktop/Service and Tableau Desktop render the equivalent concept in their es-ES UI: Business Area, Folder, Item, Join, Hierarchy, Map (workbook), Worksheet, Parameter, Condition, Calculated Field, Aggregation, Schedule, Export, Data Source, Role, Permission, Report, Dashboard, Filter, Sort, Drill Down, Drill Up, Crosstab/Pivot Table, Measure, Dimension, Column, Row, Query, Audit Log, Security Policy, Business Area Grant. Record the chosen Spanish term, and if Power BI and Tableau disagree on a term, note both and state which one you followed and why (prefer Power BI's rendering as the primary reference, since Microsoft's es-ES localization is the more widely deployed enterprise standard; fall back to Tableau's where Power BI has no equivalent concept).

### 2. Translate every namespace
Fill in `frontend/src/locales/es-ES/common.json`, `auth.json`, `nav.json`, `admin.json`, `mapBuilder.json`, `mapViewer.json`, `schedules.json`, `security.json`, `migration.json`, `audit.json`, `settings.json`, `errors.json` — every key present in the corresponding `en/*.json` file must be present here with the same key, same placeholder tokens, and an es-ES value that follows the glossary and the four rules above.

### 3. Language autonym
In `settings.json`, ensure the language's own display name (used in the Settings page language picker from Session 7.4) is the autonym `"Español (España)"`, not translated into es-ES itself (it already is es-ES) nor into English.

### 4. Validation script (`scripts/i18n-check.mjs`)
Reuse the script from Session 7.5 (it is locale-parameterized). Run it for `es-ES` and fix every reported issue before finishing.

### 5. Spot-check readability
Read through `mapBuilder.json` and `admin.json` end-to-end as a native es-ES speaker would encounter them in the UI (in context — these are button labels, panel headings, and short helper text, not prose) and fix anything that reads as machine-translated or overly literal.
```

**Deliverables:**
- ✅ `docs/i18n/glossary-es-ES.md`
- ✅ Every namespace fully translated in `frontend/src/locales/es-ES/`
- ✅ `scripts/i18n-check.mjs` passes for `es-ES` with zero missing keys/placeholders
- ✅ No untranslated or English-leftover strings

---

## Session 7.8 — i18n & Theming Integration Testing

| Field | Value |
|---|---|
| **Goal** | End-to-end verification that language and theme switching work correctly across the whole app, in every locale/theme combination |
| **Scope** | `frontend/e2e/i18n-theming.spec.ts`, CI wiring for the placeholder-integrity check |
| **Skills** | `accessibility`, `i18n-localization` |
| **Agents** | `playwright` (E2E), `accessibility-expert` (contrast audit), `ui-visual-validator` (visual regression) |
| **Model / Effort** | Sonnet 5 — medium. Verification over already-implemented features |
| **Dependencies** | Sessions 7.1–7.7 |

**Prompt:**
```
You are writing end-to-end tests that verify Discoverer Neo's language and theme features work correctly together, across the whole application.

The project root is discoverer-neo/ (current working directory). By this point:
- Users can set locale (en, pt-PT, fr-FR, es-ES) and theme (light, dark, high-contrast) in Settings (Session 7.4)
- All four locales have complete translations (Sessions 7.2, 7.5–7.7)
- Three themes exist as CSS token sets (Session 7.3)

### 1. Playwright E2E tests (`frontend/e2e/i18n-theming.spec.ts`)
- Log in, change language in Settings to each of pt-PT/fr-FR/es-ES in turn → verify key UI text (nav labels, a map builder panel heading, a button) changes to the expected translated string
- Log out and back in → verify the saved language persists (loaded from `/api/auth/me`, not reset to browser default)
- Change theme to each of dark/high-contrast → verify the `data-theme` attribute and a representative computed CSS color change; reload the page → theme persists
- New user with no saved preference and `prefers-color-scheme: dark` → verify the app opens in the dark theme
- Simulate a missing translation key (temporarily stub one) → verify the UI falls back to the English string rather than rendering the raw key or crashing

### 2. Placeholder & completeness check in CI
- Wire `scripts/i18n-check.mjs` (from Session 7.5) into the CI workflow (`.github/workflows/ci.yml` from Session 6.4) as a required step, run for pt-PT, fr-FR, and es-ES — the build fails if any locale is missing keys or placeholder tokens relative to `en`

### 3. Accessibility contrast audit
- For each of the three themes, run an automated contrast check (e.g. axe-core via Playwright) across the login page, dashboard, and map builder — every theme must meet WCAG AA (4.5:1 for normal text, 3:1 for large text/UI components)
- Fix any component whose hardcoded styling (not theme tokens) causes a failure

### 4. Visual regression
- Capture baseline screenshots for a representative set of pages (dashboard, map builder, a data table with results, Settings page) × (light, dark, high-contrast) × (en, pt-PT) — 4 pages × 3 themes × 2 locales = 24 baseline screenshots, enough to catch a broken theme/locale combination without an unbounded matrix (skip fr-FR/es-ES for visual regression; their layout risk is already covered by the placeholder-length check in 7.5–7.7, not by pixel screenshots)

Report and fix any failures found before finishing this session.
```

**Deliverables:**
- ✅ E2E tests covering language switch, theme switch, persistence, and fallback behavior
- ✅ CI blocks merges with incomplete translations
- ✅ WCAG AA contrast verified for all three themes
- ✅ Visual regression baseline established

---

## Session 7.9 — Documentation Update & Translation (pt-PT, fr-FR, es-ES)

| Field | Value |
|---|---|
| **Goal** | English documentation updated to cover the new Settings/language/theme features; user-guide and admin-guide translated into all three languages |
| **Scope** | `docs/user-guide/`, `docs/admin-guide/`, new `docs/pt-PT/`, `docs/fr-FR/`, `docs/es-ES/` |
| **Skills** | `technical-writer`, `microcopy`, `i18n-localization` |
| **Agents** | `docs-master` (primary — English updates + structure), `general-purpose` (parallel — one instance per target language) |
| **Model / Effort** | Sonnet 5 — medium. Documentation writing and translation of already-established English source |
| **Dependencies** | Session 6.3 (existing docs); Sessions 7.4–7.7 (feature complete, glossaries available) |

**Prompt:**
```
You are updating and translating Discoverer Neo's documentation, which was originally written (in English only) in Session 6.3.

The project root is discoverer-neo/ (current working directory). `docs/` currently has `user-guide/`, `admin-guide/`, `developer-guide/`, `deployment/`, `migration/`, and `api/`, all English-only.

### 1. Update the English source first
- `docs/user-guide/` — add a new `settings.md` covering how to change language and theme, and update `getting-started.md` to mention the Settings page
- `docs/admin-guide/` — note that language/theme are self-service, per-user settings with no admin configuration required (no changes needed unless you find otherwise)
- Do not touch `docs/developer-guide/`, `docs/deployment/`, `docs/migration/`, or `docs/api/` beyond fixing anything that's now inaccurate because of this feature — this session is scoped to user-facing docs, not a rewrite

### 2. Translate `docs/user-guide/` and `docs/admin-guide/` into pt-PT, fr-FR, and es-ES
- Mirror the exact directory/file structure under `docs/pt-PT/user-guide/`, `docs/pt-PT/admin-guide/`, and the equivalent `docs/fr-FR/` and `docs/es-ES/` trees
- Use the glossaries built in Sessions 7.5 (`docs/i18n/glossary-pt-PT.md`), 7.6 (`glossary-fr-FR.md`), and 7.7 (`glossary-es-ES.md`) so documentation terminology matches the translated UI exactly — a user reading the pt-PT admin guide should see the same term for "Business Area" that appears in the pt-PT app
- Keep code blocks, file paths, CLI commands, and environment variable names untranslated (only prose and headings are translated)
- Same tone rules as the UI translations: professional, neutral, enterprise register — these are technical guides, not marketing copy, so this should already be the natural register

### 3. Docs index / language switcher
- Add a top-level `docs/README.md` (or update it if Session 6.3 created one) with links to the English, pt-PT, fr-FR, and es-ES versions of the user guide and admin guide

### 4. Consistency check
- Grep each translated tree for any leftover English sentences accidentally left untranslated, and fix them
- Verify every internal link within a translated doc points to the translated version of the target page, not back to the English one
```

**Deliverables:**
- ✅ `docs/user-guide/settings.md` (English)
- ✅ `docs/pt-PT/`, `docs/fr-FR/`, `docs/es-ES/` — full user-guide + admin-guide translations
- ✅ `docs/README.md` with language links
- ✅ No leftover English text or cross-locale broken links in translated docs

---

# Summary

| Phase | Sessions | Key Deliverables |
|---|---|---|
| **Phase 0** | 0.1–0.6 | Monorepo, Docker, backend scaffolding, frontend scaffolding, database schema, full stack integration |
| **Phase 1** | 1.1–1.7 | Auth, data sources, business areas, folders, items, joins, hierarchies, custom functions, API docs |
| **Phase 2** | 2.1–2.5 | Maps, SQL generator, map execution, parameters, calculated fields |
| **Phase 3** | 3.1–3.6 | Login UI, admin pages, map builder, conditions/sort/params, data preview, E2E tests |
| **Phase 4** | 4.1–4.3 | Excel/CSV export, scheduling, integration tests |
| **Phase 5** | 5.1–5.7 | Row-level security, map sharing, EUL version detection, EUL reader, migration tool (EUL3/4/5), audit logging, security/migration integration testing |
| **Phase 6** | 6.1–6.4 | Comprehensive testing, performance optimization, documentation, production readiness |
| **Phase 7** | 7.1–7.9 | Per-user locale & theme preferences, i18n infrastructure, 3 built-in themes, Settings page, pt-PT/fr-FR/es-ES UI translation, translated documentation |

**Total: 47 sessions across 8 phases**

---

## Agent Usage by Phase

| Phase | Primary Agent | Supporting Agents | Review Agent |
|---|---|---|---|
| 0.1 | `implement` | — | `auditor` |
| 0.2 | `docker-expert` | `implement` | — |
| 0.3 | `backend-specialist` | `api-scaffolding-backend-architect` | — |
| 0.4 | `application-performance-frontend-developer` | `frontend-mobile-development-frontend-developer` | — |
| 0.5 | `db-expert` | `postgres-expert` | — |
| 0.6 | `docker-expert` | `implement` | — |
| 1.1 | `backend-api-security-backend-security-coder` | — | `security-reviewer` |
| 1.2 | `backend-specialist` | — | `backend-api-security-backend-security-coder` |
| 1.3 | `backend-specialist` | `implement` | — |
| 1.4 | `backend-specialist` | `db-expert` | — |
| 1.5 | `backend-specialist` | `implement` | — |
| 1.6 | `backend-specialist` | — | — |
| 1.7 | `api-testing-observability-api-documenter` | `backend-development-tdd-orchestrator` | — |
| 2.1 | `backend-specialist` | `implement` | — |
| 2.2 | `db-expert` | `backend-specialist` | — |
| 2.3 | `backend-specialist` | — | `backend-api-security-backend-security-coder` |
| 2.4 | `backend-specialist` | — | — |
| 2.5 | `backend-development-tdd-orchestrator` | `backend-specialist` | — |
| 3.1 | `application-performance-frontend-developer` | — | `frontend-security-coder` |
| 3.2 | `application-performance-frontend-developer` | `component-create` | — |
| 3.3 | `application-performance-frontend-developer` | `ui-designer` | — |
| 3.4 | `application-performance-frontend-developer` | `component-create` | — |
| 3.5 | `application-performance-frontend-developer` | — | `frontend-verifier` |
| 3.6 | `playwright` | `accessibility-expert` | `ui-visual-validator` |
| 4.1 | `backend-specialist` | `implement` | — |
| 4.2 | `backend-specialist` | `implement` | — |
| 4.3 | `backend-development-tdd-orchestrator` | — | — |
| 5.1 | `security-engineer` | — | `comprehensive-review-security-auditor` |
| 5.2 | `backend-specialist` | — | — |
| 5.3 | `db-expert` | `backend-specialist` | — |
| 5.4 | `db-expert` | `backend-specialist` | — |
| 5.5 | `db-expert` | `backend-specialist` | — |
| 5.6 | `backend-specialist` | — | — |
| 5.7 | `backend-development-tdd-orchestrator` | — | — |
| 6.1 | `backend-development-tdd-orchestrator` | — | `auditor` |
| 6.2 | `application-performance-frontend-developer` | `backend-specialist` | — |
| 6.3 | `docs-master` | `api-testing-observability-api-documenter` | — |
| 6.4 | `docker-expert` | `cicd-automation-deployment-engineer` | — |
| 7.1 | `backend-specialist` | `db-expert` | — |
| 7.2 | `application-performance-frontend-developer` | `frontend-mobile-development-frontend-developer` | — |
| 7.3 | `application-performance-frontend-developer` | `ui-designer` | — |
| 7.4 | `application-performance-frontend-developer` | `component-create` | — |
| 7.5 | `general-purpose` | — | `docs-master` |
| 7.6 | `general-purpose` | — | `docs-master` |
| 7.7 | `general-purpose` | — | `docs-master` |
| 7.8 | `playwright` | `accessibility-expert`, `ui-visual-validator` | — |
| 7.9 | `docs-master` | `general-purpose` | — |

---

## Skill Usage by Phase

| Phase | Skills Used |
|---|---|
| 0.1 | `typescript-docs`, `builder-smoke-test` |
| 0.2 | `docker`, `docker-compose`, `docker-deployment` |
| 0.3 | `async-patterns`, `backend-api-patterns`, `drizzle-orm` |
| 0.4 | `vite-expert`, `vite-shadcn-tailwind4`, `react`, `react-component-performance` |
| 0.5 | `drizzle-orm`, `drizzle-orm-patterns`, `database-schema-designer` |
| 0.6 | `docker-compose`, `docker` |
| 1.1 | `auth-expert`, `auth-implementation-patterns`, `auth0-fastify-api` |
| 1.2 | `backend-api-patterns`, `backend-security-coder` |
| 1.3 | `backend-api-patterns` |
| 1.4 | `backend-api-patterns`, `01-sql-fundamentals` |
| 1.5 | `backend-api-patterns`, `01-sql-fundamentals` |
| 1.6 | `backend-api-patterns` |
| 1.7 | `api-testing-observability-api-documenter`, `api-development-expert` |
| 2.1 | `backend-api-patterns` |
| 2.2 | `01-sql-fundamentals` |
| 2.3 | `backend-api-patterns`, `backend-security-coder` |
| 2.4 | `01-sql-fundamentals` |
| 2.5 | `backend-development-tdd-orchestrator` |
| 3.1 | `react`, `react-forms`, `auth-implementation-patterns` |
| 3.2 | `react`, `react-forms`, `react-state-management` |
| 3.3 | `react`, `react-component-performance`, `react-state-management` |
| 3.4 | `react`, `react-forms`, `react-state-management` |
| 3.5 | `react`, `react-component-performance` |
| 3.6 | `accessibility`, `react-performance`, `react-component-performance` |
| 4.1 | `async-patterns`, `backend-api-patterns` |
| 4.2 | `async-patterns`, `backend-api-patterns` |
| 4.3 | `backend-development-tdd-orchestrator` |
| 5.1 | `backend-security-coder`, `comprehensive-review-security-auditor` |
| 5.2 | `backend-api-patterns` |
| 5.3 | `01-sql-fundamentals`, `oracle` |
| 5.4 | `01-sql-fundamentals`, `oracle` |
| 5.5 | `database-migration`, `database-schema-designer` |
| 5.6 | `backend-api-patterns` |
| 5.7 | `backend-development-tdd-orchestrator` |
| 6.1 | `backend-development-tdd-orchestrator` |
| 6.2 | `application-performance-performance-optimization`, `react-performance`, `react-performance-optimizer` |
| 6.3 | `api-testing-observability-api-documenter`, `technical-writer` |
| 6.4 | `docker-deployment`, `cloud-monitoring-alert` |
| 7.1 | `backend-api-patterns`, `drizzle-orm-patterns` |
| 7.2 | `i18n`, `i18n-localization`, `react` |
| 7.3 | `tailwindcss-advanced-design-systems`, `tailwindcss-responsive-darkmode`, `dark-mode-design-expert` |
| 7.4 | `react-forms`, `i18n`, `tailwindcss-responsive-darkmode` |
| 7.5 | `i18n-localization`, `microcopy` |
| 7.6 | `i18n-localization`, `microcopy` |
| 7.7 | `i18n-localization`, `microcopy` |
| 7.8 | `accessibility`, `i18n-localization` |
| 7.9 | `technical-writer`, `microcopy`, `i18n-localization` |

---

*End of Session-by-Session Development Plan*

DISCOVERER_NEO_EXECUTION_PLAN.md content:
# Discoverer Neo — Execution Plan

> **Version:** 1.1 (updated 2026-07-20 — added Phase 7: Internationalization, Theming & User Preferences)
> **Date:** 2026-06-22  
> **Estimated Duration:** 16-20 weeks (full-time development) for Phases 0–6, +3-4 weeks extension for Phase 7  
> **Team Size Recommended:** 2-3 developers  

---

## Overview

This plan is divided into **7 phases**, each building on the previous. Each phase delivers working software that can be demonstrated and tested independently. Phase 7 is a post-launch extension covering internationalization, theming, and per-user preferences.

---

## Phase 0: Project Setup & Infrastructure (Week 1-2)

### Goals
- Set up development environment
- Create Docker Compose infrastructure
- Establish coding standards and CI/CD pipeline

### Tasks

#### 0.1 Repository & Tooling Setup
- [ ] Initialize Git repository with `.gitignore`
- [ ] Set up monorepo structure (backend/, frontend/, migrate/)
- [ ] Configure ESLint + Prettier for both backend and frontend
- [ ] Set up TypeScript strict mode configuration
- [ ] Create `README.md` with project overview and setup instructions

#### 0.2 Docker Infrastructure
- [ ] Create `docker-compose.yml` with all services (PostgreSQL, Redis, backend, frontend)
- [ ] Create `docker-compose.dev.yml` for development (with hot reload)
- [ ] Write backend Dockerfile (multi-stage: build → Oracle Instant Client → production)
- [ ] Write frontend Dockerfile (multi-stage: build → Nginx)
- [ ] Write migration tool Dockerfile
- [ ] Create `.env.example` with all required environment variables
- [ ] Test full stack startup with `docker compose up`

#### 0.3 Database Setup
- [ ] Write Drizzle ORM schema definition (all tables from architecture doc)
- [ ] Create initial migration scripts
- [ ] Set up seed data (admin user, sample business area)
- [ ] Test database creation in Docker

#### 0.4 Backend Scaffolding
- [ ] Initialize Node.js + TypeScript + Fastify project
- [ ] Set up project structure (modules/, plugins/, middleware/, utils/)
- [ ] Configure Fastify with plugins (CORS, JWT, validation)
- [ ] Set up Drizzle ORM connection to PostgreSQL
- [ ] Set up Redis connection
- [ ] Create health check endpoint
- [ ] Create basic error handling middleware

#### 0.5 Frontend Scaffolding
- [ ] Initialize React + TypeScript + Vite project
- [ ] Set up Tailwind CSS + shadcn/ui
- [ ] Configure TanStack Query for API calls
- [ ] Set up Zustand for state management
- [ ] Create basic layout (sidebar + main content)
- [ ] Set up React Router with route structure
- [ ] Create API client layer

### Deliverables
- ✅ Full Docker Compose stack running locally
- ✅ Backend responds to health check
- ✅ Frontend loads with basic layout
- ✅ Database schema created and migrated

---

## Phase 1: Core Backend — Metadata Management (Week 3-5)

### Goals
- Implement the metadata layer (EUL equivalent)
- CRUD operations for business areas, folders, items, joins, hierarchies
- Data source management and Oracle connectivity

### Tasks

#### 1.1 Authentication Module
- [ ] User model and database table
- [ ] JWT authentication (login, logout, refresh)
- [ ] Password hashing with bcrypt
- [ ] Auth middleware (protect routes)
- [ ] Role-based authorization middleware
- [ ] User CRUD endpoints (admin only)

#### 1.2 Data Source Management
- [ ] Data source model and CRUD endpoints
- [ ] Oracle connection testing endpoint
- [ ] Connection pool management service
- [ ] Encrypted password storage
- [ ] Support for multiple Oracle data sources

#### 1.3 Business Area Management
- [ ] Business area model and CRUD endpoints
- [ ] User grant management (who can access which business area)
- [ ] Permission levels (create maps, edit, delete, export, schedule)

#### 1.4 Folder Management
- [ ] Folder model and CRUD endpoints
- [ ] Folder types: TABLE, VIEW, DERIVED, COMPLEX, JOIN, SUMMARY
- [ ] Auto-discovery of tables/columns from Oracle (schema introspection)
- [ ] Custom SQL support for COMPLEX folders
- [ ] Folder-to-data-source linking

#### 1.5 Item Management
- [ ] Item model and CRUD endpoints
- [ ] Item types: CI (column), CU (calculated), CO (condition), JI (join), HI (hierarchy), AG (aggregate), FU (function)
- [ ] Auto-import items from Oracle table columns
- [ ] Formula/calculated field support
- [ ] Format masks and aggregation functions

#### 1.6 Join Management
- [ ] Join model and CRUD endpoints
- [ ] Join types: INNER, LEFT, RIGHT, FULL
- [ ] Auto-suggest joins based on column names
- [ ] Join validation (ensure items belong to correct folders)

#### 1.7 Hierarchy Management
- [ ] Hierarchy and hierarchy level models
- [ ] CRUD endpoints for hierarchies
- [ ] Link hierarchy levels to items

#### 1.8 Custom Function Registration
- [ ] Custom function model and CRUD endpoints
- [ ] Function parameter definitions (JSONB)
- [ ] Support for SQL functions, PL/SQL functions, and package functions

### Deliverables
- ✅ Full metadata CRUD API
- ✅ Oracle schema introspection (auto-discover tables/columns)
- ✅ User authentication and authorization
- ✅ Connection pool management for Oracle

---

## Phase 2: Map Builder — Core Query Engine (Week 6-9)

### Goals
- Implement the map (workbook) builder
- SQL generation engine
- Map execution against Oracle
- Data preview and results display

### Tasks

#### 2.1 Map Management
- [ ] Map model and CRUD endpoints
- [ ] Map types: TABLE, CROSSTAB, PAGE_DETAIL, CHART
- [ ] Map item selection (choose which items to include)
- [ ] Map item configuration (display name, format, aggregation, sort, width)
- [ ] Map duplication

#### 2.2 SQL Generation Engine
- [ ] SELECT clause builder (items, calculated fields, aggregations)
- [ ] FROM clause builder (tables, joins)
- [ ] WHERE clause builder (conditions, parameters, security predicates)
- [ ] GROUP BY / HAVING builder (for aggregations)
- [ ] ORDER BY builder (sorting)
- [ ] Row limit / pagination support
- [ ] Oracle-specific SQL syntax handling
- [ ] Parameter binding (`:param_name` style)

#### 2.3 Condition Builder
- [ ] Condition model and CRUD endpoints
- [ ] Operators: =, <>, <, >, <=, >=, LIKE, IN, BETWEEN, IS NULL
- [ ] Compound conditions (AND/OR with grouping)
- [ ] Parameter-driven conditions (runtime prompts)
- [ ] Static value conditions

#### 2.4 Map Execution Service
- [ ] Execute generated SQL against Oracle
- [ ] Connection pool selection based on data source
- [ ] Query timeout enforcement
- [ ] Row limit enforcement
- [ ] Streaming results for large datasets
- [ ] Execution logging (query_execution_log table)
- [ ] Error handling and user-friendly error messages

#### 2.5 Map Parameters
- [ ] Parameter model and CRUD endpoints
- [ ] Parameter types: STRING, NUMBER, DATE, LIST
- [ ] Default values
- [ ] Required/optional parameters
- [ ] Parameter validation at execution time

#### 2.6 Calculated Fields
- [ ] Ad-hoc calculated fields within maps
- [ ] Formula editor with syntax highlighting
- [ ] Support for arithmetic, string, date, conditional functions
- [ ] Reference to other items by name

#### 2.7 Result Handling
- [ ] Result data API endpoint
- [ ] Pagination for large result sets
- [ ] Column formatting (dates, numbers)
- [ ] Result metadata (row count, execution time)

### Deliverables
- ✅ Map builder API (create, edit, save maps)
- ✅ SQL generation engine producing valid Oracle SQL
- ✅ Map execution against Oracle with results
- ✅ Parameter support (runtime prompts)
- ✅ Calculated fields support

---

## Phase 3: Frontend — Map Builder UI (Week 8-12, overlaps with Phase 2)

### Goals
- Build the React-based map builder interface
- Drag-and-drop query builder
- Data preview and results display

### Tasks

#### 3.1 Authentication UI
- [ ] Login page
- [ ] Session management (token refresh)
- [ ] Route protection (authenticated vs public routes)
- [ ] User profile display

#### 3.2 Admin UI
- [ ] Business area management page (CRUD)
- [ ] Folder management page (with table/column auto-discovery)
- [ ] Item management page
- [ ] Join management page
- [ ] Hierarchy management page
- [ ] Data source configuration page (with connection test)
- [ ] User management page
- [ ] Custom function registration page

#### 3.3 Map Builder UI (Core Feature)
- [ ] Business area tree panel (left sidebar)
  - [ ] Expandable tree: Business Area → Folder → Items
  - [ ] Search/filter items
  - [ ] Item type icons (dimension vs measure)
- [ ] Map canvas (center panel)
  - [ ] Selected columns area (drag items here)
  - [ ] Drag-and-drop reordering
  - [ ] Column configuration (click to set format, agg, sort)
- [ ] Conditions panel
  - [ ] Add conditions with dropdown selectors
  - [ ] AND/OR logic with grouping
  - [ ] Parameter vs static value toggle
- [ ] Sort panel
  - [ ] Multi-column sort configuration
  - [ ] ASC/DESC toggle
- [ ] Calculated field dialog
  - [ ] Formula editor (Monaco Editor)
  - [ ] Function reference panel
  - [ ] Syntax validation
- [ ] Parameters panel
  - [ ] Configure runtime parameters
  - [ ] Set types, defaults, required/optional
- [ ] Preview panel
  - [ ] Execute and show first 100 rows
  - [ ] TanStack Table with sorting and filtering
  - [ ] Loading states and error display
- [ ] Toolbar
  - [ ] Run, Save, Export, Schedule, Share buttons
  - [ ] Map name and description editing

#### 3.4 Map Viewer Page
- [ ] View saved maps
- [ ] Execute with parameter prompts
- [ ] Results table with pagination
- [ ] Export buttons (Excel, CSV)
- [ ] Schedule management

#### 3.5 Dashboard
- [ ] User dashboard with recent maps
- [ ] Quick access to frequently used maps
- [ ] Scheduled results overview

### Deliverables
- ✅ Admin UI for metadata management
- ✅ Interactive map builder with drag-and-drop
- ✅ Data preview with formatted results
- ✅ Parameter prompt dialog at execution time
- ✅ Dashboard with recent activity

---

## Phase 4: Export & Scheduling (Week 11-14)

### Goals
- Excel and CSV export functionality
- Scheduled map execution with BullMQ
- Result caching and retrieval

### Tasks

#### 4.1 Export Service
- [ ] ExcelJS integration for .xlsx export
  - [ ] Streaming writer for large datasets
  - [ ] Column formatting (dates, numbers, headers)
  - [ ] Multiple sheets for crosstab
  - [ ] Support for 1M+ rows
- [ ] fast-csv integration for CSV export
  - [ ] Streaming writer
  - [ ] UTF-8 with BOM
  - [ ] No row limit
- [ ] Export API endpoints
  - [ ] `POST /api/maps/:id/export` (async, returns job ID)
  - [ ] `GET /api/exports/:id/status` (check progress)
  - [ ] `GET /api/exports/:id/download` (download file)
- [ ] Background job processing with BullMQ
  - [ ] Export job queue
  - [ ] Progress tracking
  - [ ] Error handling and retry
- [ ] File storage management
  - [ ] Store exports in Docker volume
  - [ ] Automatic cleanup of old exports (configurable retention)

#### 4.2 Scheduling Service
- [ ] BullMQ job scheduler setup
- [ ] Schedule model and CRUD endpoints
- [ ] Cron expression support (daily, weekly, monthly, custom)
- [ ] Timezone support
- [ ] Pre-set parameter values for scheduled runs
- [ ] Output format configuration (XLSX, CSV)
- [ ] Output destination (store, email, both)
- [ ] Validity window (valid_from, valid_until)
- [ ] Schedule execution worker
  - [ ] Execute map with pre-set parameters
  - [ ] Store results in scheduled_results table
  - [ ] Generate export file
  - [ ] Send email notification (optional)
- [ ] Schedule management UI
  - [ ] Create/edit schedules
  - [ ] View execution history
  - [ ] Enable/disable schedules
  - [ ] Manual trigger

#### 4.3 Result Caching
- [ ] Scheduled results storage in PostgreSQL
- [ ] Result retrieval API
- [ ] Result download API
- [ ] Result expiration and cleanup
- [ ] Result viewing in browser (formatted table)

### Deliverables
- ✅ Excel export (.xlsx) supporting 1M+ rows
- ✅ CSV export with no row limit
- ✅ Background export job processing
- ✅ Map scheduling with cron expressions
- ✅ Scheduled result storage and retrieval
- ✅ Schedule management UI

---

## Phase 5: Security & Migration (Week 13-16)

### Goals
- Row-level security implementation
- Discoverer 4 migration tool
- Security policy management UI

### Tasks

#### 5.1 Row-Level Security
- [ ] Row security policy model and CRUD endpoints
- [ ] SQL predicate injection into generated queries
- [ ] Policy application per folder, per business area
- [ ] Per-user/per-role policy assignment
- [ ] Multiple policies ANDed together
- [ ] Security policy testing/validation tool
- [ ] Security policy management UI

#### 5.2 Map Sharing
- [ ] Map sharing model and endpoints
- [ ] Sharing status: PRIVATE, PUBLIC, SELECTIVE
- [ ] Selective sharing with specific users
- [ ] Permission levels: view, edit, export
- [ ] Sharing management UI

#### 5.3 Discoverer 4 Migration Tool
- [ ] EUL schema reader (connect to Oracle EUL5_* tables)
- [ ] Assessment report generator
  - [ ] List all business areas, folders, items
  - [ ] Identify orphaned objects
  - [ ] Identify workbook usage statistics
- [ ] Data transformers (EUL → Discoverer Neo schema)
  - [ ] Business areas
  - [ ] Folders (with type mapping)
  - [ ] Items (with expression parsing)
  - [ ] Joins
  - [ ] Hierarchies
  - [ ] Custom functions
  - [ ] Workbooks/maps (XML parsing from EUL5_DOCUMENTS)
  - [ ] Security grants
  - [ ] Security manager conditions
- [ ] Migration CLI tool (`dn-migrate`)
  - [ ] `analyze` command
  - [ ] `run` command (with `--dry-run` option)
  - [ ] `validate` command
  - [ ] Progress reporting
  - [ ] Error logging
- [ ] Migration UI in admin panel
  - [ ] Migration wizard
  - [ ] Progress dashboard
  - [ ] Error report
  - [ ] Migration log viewer

#### 5.4 Audit & Logging
- [ ] Query execution logging
- [ ] User action audit trail
- [ ] Login/logout tracking
- [ ] Export tracking
- [ ] Audit log viewer UI

### Deliverables
- ✅ Row-level security with SQL predicate injection
- ✅ Map sharing functionality
- ✅ Migration CLI tool for Discoverer 4 → Discoverer Neo
- ✅ Migration UI in admin panel
- ✅ Comprehensive audit logging

---

## Phase 6: Polish, Testing & Deployment (Week 17-20)

### Goals
- Comprehensive testing
- Performance optimization
- Documentation
- Production deployment

### Tasks

#### 6.1 Testing
- [ ] Backend unit tests (Jest)
  - [ ] SQL generation engine tests
  - [ ] Authentication tests
  - [ ] CRUD operation tests
  - [ ] Security policy tests
- [ ] Backend integration tests
  - [ ] Oracle connectivity tests
  - [ ] End-to-end map execution tests
  - [ ] Export tests
- [ ] Frontend unit tests (Vitest)
  - [ ] Component tests
  - [ ] Store tests
  - [ ] Hook tests
- [ ] Frontend E2E tests (Playwright)
  - [ ] Login flow
  - [ ] Map builder flow
  - [ ] Export flow
  - [ ] Admin flow
- [ ] Migration tool tests
  - [ ] EUL parsing tests
  - [ ] Data transformation tests
  - [ ] End-to-end migration test with sample EUL data

#### 6.2 Performance Optimization
- [ ] Oracle connection pool tuning
- [ ] Query execution optimization
- [ ] Frontend bundle optimization (code splitting, lazy loading)
- [ ] Database index optimization
- [ ] Redis caching for frequently accessed metadata
- [ ] Large dataset export optimization

#### 6.3 Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] User guide (map builder, scheduling, export)
- [ ] Administrator guide (metadata setup, security, migration)
- [ ] Developer guide (architecture, contributing)
- [ ] Migration guide (Discoverer 4 → Discoverer Neo)
- [ ] Docker deployment guide

#### 6.4 Production Readiness
- [ ] Production Docker Compose configuration
- [ ] Nginx SSL configuration
- [ ] Environment variable documentation
- [ ] Backup strategy (PostgreSQL + export files)
- [ ] Monitoring setup (Prometheus + Grafana)
- [ ] Log aggregation setup
- [ ] Health check endpoints
- [ ] Graceful shutdown handling

### Deliverables
- ✅ Comprehensive test suite (>80% coverage)
- ✅ API documentation
- ✅ User and administrator guides
- ✅ Production-ready Docker deployment
- ✅ Monitoring and alerting setup

---

## Phase 7: Internationalization, Theming & User Preferences (Week 21-24, extension)

### Goals
- Users can select their preferred UI language — English, European Portuguese (pt-PT), France French (fr-FR), or European Spanish (es-ES) — persisted per-account
- Users can select a visual theme — Light, Dark, or High Contrast — persisted per-account
- Every user-facing UI string is translated with enterprise BI terminology consistent with Power BI and Tableau's localized editions
- All project documentation (user guide, admin guide) is translated into the same three languages

### Tasks

#### 7.1 User Preferences Backend
- [ ] Add `locale` (`en`, `pt-PT`, `fr-FR`, `es-ES`) and `theme` (`light`, `dark`, `high-contrast`) enum columns to the `users` table, both `NOT NULL DEFAULT`
- [ ] Migration + Drizzle schema update
- [ ] `GET`/`PATCH /api/users/me/preferences` endpoints, Zod-validated
- [ ] Include `locale`/`theme` in login and `/api/auth/me` responses
- [ ] Tests

#### 7.2 i18n Frontend Infrastructure
- [ ] Install and configure `react-i18next` + `i18next-browser-languagedetector`
- [ ] Define namespaced locale resource structure (`common`, `auth`, `nav`, `admin`, `mapBuilder`, `mapViewer`, `schedules`, `security`, `migration`, `audit`, `settings`, `errors`)
- [ ] Extract every hardcoded UI string across all existing pages/components into an `en` baseline
- [ ] Locale resolution: saved user preference → browser language → `en` fallback
- [ ] Locale-aware date/number formatting via `Intl`

#### 7.3 Theming Infrastructure
- [ ] CSS custom-property theme tokens for Light, Dark, and High Contrast, wired into Tailwind/shadcn theme variables
- [ ] `ThemeProvider` React context with `data-theme` attribute strategy
- [ ] Default to OS `prefers-color-scheme` for users with no saved preference; saved preference always overrides
- [ ] Audit all existing components for hardcoded colors that bypass the token system

#### 7.4 Settings / Profile Page
- [ ] New `SettingsPage` (the frontend currently has no settings/profile page) with a language dropdown and a theme picker
- [ ] Live preview before save; persists via the 7.1 preferences API
- [ ] Route + navigation entry

#### 7.5–7.7 Translation Content (one session per language: pt-PT, fr-FR, es-ES)
- [ ] Build a terminology glossary per language, cross-referenced against Power BI and Tableau's localized editions
- [ ] Translate every namespace from 7.2 for that language
- [ ] Preserve all placeholders (`{{count}}`, `%s`, `{0}`) exactly
- [ ] Keep button/label translations concise — no expansion into full sentences
- [ ] Professional, neutral, enterprise tone throughout
- [ ] Automated placeholder/completeness check against the `en` baseline

#### 7.8 i18n & Theming Integration Testing
- [ ] Playwright E2E: language switch reflects across the app, theme switch persists across reload/re-login
- [ ] Missing-translation-key fallback verified (falls back to `en`, never renders a raw key)
- [ ] WCAG AA contrast check for every theme
- [ ] Visual regression across a representative page/theme/locale matrix
- [ ] Wire the placeholder/completeness check into CI as a required, blocking step

#### 7.9 Documentation Update & Translation
- [ ] Update the English `docs/user-guide/` to document the new Settings/language/theme features
- [ ] Translate `docs/user-guide/` and `docs/admin-guide/` into pt-PT, fr-FR, and es-ES, mirroring the existing directory structure
- [ ] Reuse the glossaries from 7.5–7.7 so documentation terminology matches the translated UI exactly
- [ ] Add a docs index with links to each language's guides

### Deliverables
- ✅ Per-user language and theme preference, persisted and applied on every login
- ✅ Fully translated UI in Portuguese (pt-PT), French (fr-FR), and Spanish (es-ES)
- ✅ Three selectable themes, all meeting WCAG AA contrast
- ✅ New Settings page
- ✅ Translated documentation in all three languages, CI-enforced translation completeness

---

## Risk Register

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| Oracle Instant Client compatibility issues in Docker | High | Medium | Test early in Phase 0; use Oracle's official container images |
| Complex EUL parsing for migration | High | High | Start migration tool early; handle edge cases incrementally |
| Large dataset export memory issues | Medium | Medium | Use streaming writes throughout; test with 500k+ rows early |
| SQL injection via user-defined formulas | High | Low | Parameterized queries only; validate formulas before execution |
| Performance degradation with many concurrent users | Medium | Medium | Connection pooling; query timeouts; result caching |
| Discoverer 4 EUL schema variations | Medium | High | Make migration tool configurable; handle missing/extra columns |
| Untranslated or incomplete UI strings ship to production | Medium | Medium | CI check (Session 7.8) that fails the build if any locale is missing keys or placeholders present in the `en` baseline |
| Inconsistent BI terminology across languages confuses users | Medium | Medium | Per-language glossary cross-referenced against Power BI/Tableau localized editions, built before translation and reused for documentation (Sessions 7.5–7.9) |
| Theme fails WCAG AA contrast in Dark/High Contrast modes | Medium | Low | Automated contrast audit in Session 7.8; component color audit against theme tokens in Session 7.3 |

---

## Technology Summary

| Layer | Technology | Version |
|---|---|---|
| **Backend Runtime** | Node.js | 22 LTS |
| **Language** | TypeScript | 5.x |
| **HTTP Framework** | Fastify | 5.x |
| **ORM** | Drizzle ORM | Latest |
| **Oracle Driver** | node-oracledb | 6.x (thick mode) |
| **Oracle Client** | Oracle Instant Client | 19c or 21c |
| **Job Queue** | BullMQ | 5.x |
| **Cache/Queue** | Redis | 7 |
| **Config Database** | PostgreSQL | 16 |
| **Frontend Framework** | React | 19 |
| **Build Tool** | Vite | 6.x |
| **UI Library** | shadcn/ui + Radix UI | Latest |
| **Styling** | Tailwind CSS | 4.x |
| **Data Tables** | TanStack Table | v8 |
| **State (client)** | Zustand | Latest |
| **State (server)** | TanStack Query | v5 |
| **Drag & Drop** | dnd-kit | Latest |
| **Forms** | React Hook Form + Zod | Latest |
| **Charts** | Recharts | Latest |
| **Excel Export** | ExcelJS | Latest |
| **CSV Export** | fast-csv | Latest |
| **Code Editor** | Monaco Editor | Latest |
| **Auth** | jsonwebtoken + bcrypt | Latest |
| **Validation** | Zod | Latest |
| **Logging** | Pino | Latest |
| **Testing (backend)** | Jest | Latest |
| **Testing (frontend)** | Vitest + Playwright | Latest |
| **Reverse Proxy** | Nginx | Latest |
| **Containers** | Docker + Compose | Latest |
| **i18n (frontend)** | react-i18next + i18next-browser-languagedetector | Latest |
| **Theming** | CSS custom properties (Tailwind `@theme` + shadcn tokens) | Tailwind CSS 4.x |

---

## Discoverer 4 → Discoverer Neo Feature Mapping

| Discoverer 4 Feature | Discoverer Neo Equivalent | Phase |
|---|---|---|
| **EUL (End User Layer)** | PostgreSQL metadata schema (business_areas, folders, items, joins, hierarchies) | Phase 1 |
| **Business Areas** | Business Areas (same concept) | Phase 1 |
| **Folders** | Folders (same concept, same types: TABLE, VIEW, DERIVED, COMPLEX, JOIN, SUMMARY) | Phase 1 |
| **Items** | Items (same concept, same types: CI, CU, CO, JI, HI, AG, FU) | Phase 1 |
| **Joins** | Joins (same concept) | Phase 1 |
| **Hierarchies** | Hierarchies (same concept) | Phase 1 |
| **Registered Functions** | Custom Functions (same concept) | Phase 1 |
| **Workbooks** | Maps (same concept) | Phase 2 |
| **Worksheets** | Map items + conditions + sorting + aggregation | Phase 2 |
| **Parameters (runtime variables)** | Map Parameters (same concept) | Phase 2 |
| **Conditions** | Map Conditions (same concept) | Phase 2 |
| **Calculated Items** | Calculated Fields (same concept) | Phase 2 |
| **Aggregations** | Aggregation functions on items (same concept) | Phase 2 |
| **Sorting** | Sort configuration (same concept) | Phase 2 |
| **Drill Down/Up** | Hierarchy-based drill (via TanStack Table) | Phase 3 |
| **Crosstab/Pivot** | Crosstab map type | Phase 2-3 |
| **Table View** | Table map type | Phase 2-3 |
| **Page-Detail View** | Page-detail map type | Phase 3 |
| **Charts** | Chart map type (Recharts) | Phase 3 |
| **Excel Export (.xls, 65k rows)** | Excel Export (.xlsx, 1M+ rows) | Phase 4 |
| **CSV Export** | CSV Export (unlimited rows) | Phase 4 |
| **Scheduling** | BullMQ-based scheduling (same concept, more flexible) | Phase 4 |
| **Scheduled Results** | Scheduled Results (stored in PostgreSQL) | Phase 4 |
| **Security Managers** | Row-Level Security Policies (same concept) | Phase 5 |
| **User Privileges** | RBAC (ADMIN, MANAGER, USER, VIEWER) | Phase 1 |
| **Business Area Grants** | User Business Area Grants (same concept) | Phase 1 |
| **Workbook Sharing** | Map Sharing (PRIVATE, PUBLIC, SELECTIVE) | Phase 5 |
| **Query Statistics** | Query Execution Log (same concept) | Phase 5 |
| **EUL Schema Migration** | Migration Tool (EUL5_* → PostgreSQL) | Phase 5 |
| **Discoverer Administrator** | Admin UI (web-based) | Phase 3 |
| **Discoverer User Edition** | Map Builder + Viewer UI (web-based) | Phase 3 |
| **Oracle Client connection** | node-oracledb thick mode in Docker | Phase 0-1 |

---

*End of Execution Plan*

DISCOVERER_NEO_WORKSHEET_FIDELITY_PLAN.md content:
# Worksheet Fidelity — Execution Plan

**Created:** 2026-08-25 · **Revised:** 2026-08-25 (after `d4wkdmp.exe` was made to run)
**Scope:** bring migrated maps up to what a Discoverer 4 worksheet actually holds.
**Background:** the workbook body (`EUL4_DOCUMENTS.DOC_DOCUMENT`) is already
decoded and migrating — see `discoverer-neo/migrate/EUL_SCHEMA_GROUND_TRUTH.md` §7.

---

## 1. What changed: we have Oracle's own decoder

`E:\claude\discoverer\DISCVR4\d4wkdmp.exe` — Oracle's workbook dump utility —
**now runs**, and dumps real workbooks out of the live EUL. This is the single
most important fact in this plan, because it turns the hardest task from
reverse engineering into *verification against a reference implementation*.

Getting there took seven missing DLLs and four environment variables; the exact
recipe is §2. Two structural discoveries came out of it:

- **`.DIS` files on disk are OLE compound documents** (magic `D0 CF 11 E0`).
  The `DOC_DOCUMENT` blob is the raw *inner stream*. That is why `FS` mode
  throws on a blob extracted from the database and **`DB` mode must be used**.
  (The parser was already reading the inner stream correctly — this only
  affects how the reference tool is driven.)
- The dump exposes an **`IoId`** for every element — the workbook-local element
  id. That is exactly the value the parser reads from tag `0x02bf`, so `IoId`
  is the **Rosetta stone**: it lets a dump line be matched to a byte offset,
  which is what makes field-by-field decoding tractable.

### 1.1 The reference output already validates the parser

Oracle's dump of `GD_M.M172_V01.DIS`, next to what the migration produced:

| Oracle `d4wkdmp` | Discoverer Neo (already migrated) |
| --- | --- |
| 6 `EUL Item Reference`, ids 241941–241946 | 6 `map_items`, same items, same order |
| `Identifier = NUC` / `Name = Nuc` | `items.name = 'Nuc'` |
| `Folder Name = M M172` | `folders.name = 'M M172'` |
| `Sheet Name = Folha 1`, GUID `{20F60964-…}` | map name, worksheet GUID |
| `IoId = 16, 24, 32, 40, 48, 56` | the `0x02bf` column→item references |

and on a calculation: `Id = -115` — **negative**, confirming the signed-id
handling that was added after the first live run.

### 1.2 What the dump gives us that we do not yet migrate

Straight from the reference output, per worksheet:

```
 EUL Sort Item Reference
        Item = EUL Item - M M172.Nuc
        Direction = 1
 Query Request QR1
        Distinct = 0
        Axis Item Usage    - Name = EUL Item - M M172.Nuc          ← axis vs measure
        Measure Item Usage - Name = Calculation - Profit SUM
        Sort Item Usage    - Name = Sort On …Nuc
        Filter Usage       - Name = EUL Filter - …
        Join Usage         - …
 EUL Private Item
        Id = -29860   Identifier = 223   DataType = 1
        Placement = 0   Hidden = 1   IsACalc = 1
        IOFormula = [2,20]([6,16],[6,17],[6,18],[5,1,"M"],…)
```

— i.e. **axis/measure classification, sort direction, `DISTINCT`, per-item
placement, hidden, data type, and the query-request grouping** (a sheet
references one or more `Query Request`s; two sheets can share one).

It also confirms the token language independently: `[2,20]` is a call to the
custom function at `IoId = 20`, which the dump names as
`GET_ATRIBUTOS_SINISTRO`.

---

## 2. Reproducible recipe for `d4wkdmp.exe`

**Verified working 2026-08-25.** Record this — it is not guessable.

**Files.** `E:\claude\discoverer\DISCVR4` must contain the original Discoverer
4 files plus these seven, which were missing (five came from `I:\orant\BIN`,
byte-identical):

```
SH31W32.DLL   std-2.1-vc5.0-mt.dll   thread-2.1-vc5.0-mt.dll   Cfx2032.dll
CORE40.DLL    NLSRTL33.DLL           ORA805.DLL
```

Do **not** copy the Oracle Net libraries (`N*80.dll`, `OTRACE80.dll`,
`nasns80.dll`) into that folder — mixing a partial Net8 set with the complete
one in `I:\orant\BIN` produced an access violation. Let them resolve from the
Oracle home via `PATH`.

**Environment.**

```powershell
$env:ORACLE_HOME = 'I:\orant'
$env:ORA_NLS33   = 'I:\orant\NLSRTL33\DATA'      # else ORA-12705
$env:NLS_LANG    = 'PORTUGUESE_PORTUGAL.WE8ISO8859P1'
$env:TNS_ADMIN   = 'E:\claude\discoverer\DISCVR4\tns'
$env:PATH        = 'E:\claude\discoverer\DISCVR4;I:\orant\BIN;' + $env:PATH
```

`TNS_ADMIN` holds a `tnsnames.ora` with the **current** host (the one in
`I:\orant\NET80\ADMIN` still points at the old `172.16.201.140`):

```
COSEC =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = 10.236.141.201)(PORT = 1530))
    (CONNECT_DATA = (SID = COSEC))
  )
```

**Invocation.** The working directory must be the Discoverer folder — the tool
loads `dceresUS.MSB` relative to it — and the mode must be `DB`:

```powershell
Start-Process -FilePath 'E:\claude\discoverer\DISCVR4\d4wkdmp.exe' `
  -ArgumentList '"GD_M.M172_V01.DIS"','out.txt','DB',"`"siid_testes/$pw@COSEC`"",'SIID_TESTES','-f' `
  -WorkingDirectory 'E:\claude\discoverer\DISCVR4' -NoNewWindow -Wait
```

`-f` adds the EUL cross-check (`*** Found in EUL by id ***`) and roughly
triples the output; use it.

**Credentials.** Decrypt the data source password transiently from the Neo
database — never leave it on disk:

```ts
// backend/src/scripts/<throwaway>.ts, run in the backend container
const [ds] = await db.select().from(dataSources).where(eq(dataSources.id, ID)).limit(1);
writeFileSync(OUT, decrypt(ds.passwordEnc), 'latin1');
```

Delete the file and the script afterwards. `*.pw` and `d4dumps/` are
git-ignored.

**Measured throughput.** 25 / 25 workbooks dumped successfully, ~18 s each
(process start and connection dominate). The full 558 is ≈ 2.8 h — run it as a
batch, once. Sample dumps are in `E:\claude\discoverer\d4dumps\` (ignored by
git — they are customer report metadata).

**Failure modes seen, and what they mean:**

| Symptom | Cause |
| --- | --- |
| `0xC0000135` at start | a DLL in the chain is missing |
| `0xC0000005` | mixed Oracle homes, or `NLS_LANG` unset |
| `ORA-12154` / `12222` / `12538` | `TNS_ADMIN` wrong, or the Net8 adapters are not on `PATH` |
| `ORA-12705` | `ORA_NLS33` not set |
| `dceresUS.MSB not found` | working directory is not the Discoverer folder |
| `0xE06D7363` (C++ exception) | `FS` mode on a raw DB blob — use `DB` mode |

---

## 3. Verdict: an extension, not a redesign

The container decode is solved and validated — 558/558 workbooks, 24 353 of
24 354 columns carrying an EUL `EXP_ID`, every condition operator recognized,
and now confirmed field-for-field against Oracle's own decoder. **Nothing built
so far should be thrown away.**

What is missing is (a) more fields inside elements the parser already locates,
(b) 13 element classes it currently walks past, and (c) — the only genuine
design change — **somewhere in Discoverer Neo to put any of it**. `map_items`
has no concept of an axis; `map_conditions` is a flat list and cannot express
Discoverer's filter tree; there is no table at all for totals, percentages,
exceptions or page setup.

### 3.1 Where we are

| | |
| --- | --- |
| Workbooks read | 558 |
| Worksheets → maps | 916 (one map per worksheet) |
| Columns (`map_items`) | 24 244 |
| Conditions (`map_conditions`) | 6 501 |
| Parameters (`map_parameters`) | 7 466 |
| Calculated fields (`map_calculated_fields`) | 11 801 |

Known losses: 837 condition instances (compound `AND`/`OR`, `NOT IN`), all
sort / axis / total / format information, and 110 columns naming items since
deleted from the EUL (unavoidable).

### 3.2 Element classes still ignored

| Class | Count | Reading |
| --- | ---: | --- |
| `0x0122`, `0x0258`, `0x0384`, `0x04b0`, `0x0d48` | **916 each** | *exactly one per worksheet* → layout / sort list / display settings |
| `0x0272` | 910 | ~one per worksheet |
| `0x0514`, `0x00f0` | 3 841 / 3 840 | ≈ parameter count — parameter detail |
| `0x0898` | 3 005 | likely exception / conditional-format ranges |
| `0x0578`, `0x05dc` | 2 017 each | paired, ~2 per worksheet |
| `0x0834`, `0x0190` | 558 each | *one per workbook* → page setup (`0x0840`–`0x0845`) |
| `0x0118` | 24 | **joins** (`0x0fa7`, `0x011a`, `0x0fa8`, `0x011b`) |
| `0x0320` | 104 320 | cell style (3 per column group) |

Plus unread numeric fields on `0x02bc` (column), `0x0c1c` (total) and
`0x00dc` (calculation: `0x00df`, `0x00e8`, `0x1000`, `0x1100`).

---

## 4. Task breakdown

| # | Task | Depends on | Model | Effort |
| --- | --- | --- | --- | --- |
| **W0** | Condition trees (`AND`/`OR`/`NOT`) | — | Opus 5 | high |
| **W1** | Reference corpus + parser/dump differ | — | Sonnet 5 | high |
| **W2** | Decode the rest, verified against the dumps | W1 | Opus 5 | high |
| **W3** | Neo schema for worksheet semantics | W2 | Opus 5 | high |
| **W4** | Layout: axis, measure, crosstab, hidden, distinct | W2, W3 | Opus 5 | high |
| **W5** | Sorting: direction, rank, group/break | W2, W3 | Opus 5 | high |
| **W6** | Totals, aggregations, percentages | W2, W3 | Opus 5 | high |
| **W7** | Item formats, page setup, joins | W2, W3 | Sonnet 5 | high |
| **W8** | Migration wiring + live re-import | W3–W7 | Opus 5 | high |
| **W9** | Query generation + UI + docs | W8 | Opus 5 | high |

**W0 goes first** — it needs no binary decoding (the tree is already in the
token form the parser reads) and it fixes the only known *correctness* loss:
837 conditions that silently do not filter.

**W1 before W2** — build the reference corpus and the differ first, so W2 is
verification rather than guesswork. W1 dropped from Opus/max to Sonnet/high
precisely because the reference tool now runs; W2 dropped from max to high for
the same reason.

W4–W7 are independent of each other and can run in parallel once W3 lands.

---

## 5. Task prompts

Self-contained; paste into a fresh Claude Code session in
`E:\claude\discoverer\discoverer-neo`. Every task ends with: `migrate`,
`backend` and `frontend` suites green, typecheck and lint clean on touched
files, and `EUL_SCHEMA_GROUND_TRUTH.md` updated with anything newly confirmed.

---

### W0 — Condition trees (`AND` / `OR` / `NOT`)

**Model:** Opus 5 · **Effort:** high · **Depends on:** nothing

> `migrate/src/services/workbook-parser.ts` decodes Discoverer workbook bodies
> out of `EUL4_DOCUMENTS.DOC_DOCUMENT`. Read
> `migrate/EUL_SCHEMA_GROUND_TRUTH.md` §7 first, especially §7.5 (the condition
> token language).
>
> Today a condition whose top-level operator is `[1,98]` (AND) or `[1,99]` (OR)
> is reported and **dropped** — `parseConditionTokens` returns `operator: null`
> and the runner skips it. On the live source that is 837 condition instances
> that silently do not filter. `NOT IN` (`[1,91]`) is dropped the same way.
>
> 1. Parse the token string into a real **tree**: `[1,op](arg, …)` where an arg
>    is another node, `[6,n]` (item element), `[8,n]` (parameter element) or
>    `[5,kind,"…"]` (literal). Handle nesting and quoted commas.
> 2. Measure the corpus before designing the target: how deep do the trees go,
>    what fraction are pure conjunctions? Write the numbers into the
>    ground-truth doc.
> 3. Neo's `map_conditions` (`backend/src/db/schema.ts`) is flat, with a
>    `group_id uuid` and a `logic_operator` enum. Decide whether that expresses
>    the trees actually present, or whether a `parent_id` self-reference is
>    needed. If the schema must change, write the Drizzle migration under
>    `backend/drizzle/` and mirror it in `migrate/src/db/schema.ts`.
> 4. Handle negation — Oracle's model has a per-node `IsNot`
>    (`DCBImportedFilterNode::IsNot` in `E:\claude\discoverer\DISCVR4\DCBIMPB.DLL`).
>    Never migrate a negated condition as its positive form.
> 5. Test via `migrate/src/testing/workbook-fixture.ts` (the encoder for the
>    same byte format). Report the new numbers.
>
> Keep the existing rule: an operator with no Neo equivalent is *reported*,
> never approximated.

---

### W1 — Reference corpus and parser/dump differ

**Model:** Sonnet 5 · **Effort:** high · **Depends on:** nothing

> Build the verification harness that every later task in this plan leans on.
>
> Oracle's own workbook decoder, `E:\claude\discoverer\DISCVR4\d4wkdmp.exe`,
> runs. **Read §2 of `E:\claude\discoverer\DISCOVERER_NEO_WORKSHEET_FIDELITY_PLAN.md`
> for the exact working recipe** — seven DLLs, four environment variables, `DB`
> mode not `FS`, working directory set to the Discoverer folder. It is not
> guessable; follow it literally. Sample output is in
> `E:\claude\discoverer\d4dumps\` (git-ignored; customer metadata — keep it
> that way).
>
> 1. **Dump the corpus.** Script the batch over all 558 workbooks in
>    `EUL4_DOCUMENTS` with `-f`, into `E:\claude\discoverer\d4dumps\`. Expect
>    ~18 s each, ≈ 2.8 h total — run it in the background and report the
>    success rate. Handle duplicate `DOC_NAME`s (they exist).
> 2. **Write a parser for the dump text** — it is regular: `EUL Item
>    Reference`, `EUL Private Item`, `EUL Filter Reference`, `EUL Sort Item
>    Reference`, `EUL Function Reference`, `Query Request QRn`, `Sheet Number
>    n`, each with indented `Key = Value` lines.
> 3. **Write the differ**: for each workbook, compare Oracle's dump against
>    `parseWorkbookDocument`. Correlate on **`IoId`** — the dump's element id is
>    the same value the parser reads from tag `0x02bf`. Report per field:
>    agree / disagree / only-in-dump / only-in-parser.
> 4. Land it as a **dev-only tool** (a script under `migrate/src/scripts/` or
>    similar), not a package export, and document how to run it. It must never
>    become a runtime dependency of the migration — it needs a 32-bit Windows
>    box and an Oracle 8 client.
> 5. Report the baseline: what the parser gets right today, and the exhaustive
>    list of fields present in the dump that it does not yet produce. That list
>    is the input to W2.

---

### W2 — Decode the rest of the worksheet model

**Model:** Opus 5 · **Effort:** high · **Depends on:** W1

> Extend the binary decoder in `migrate/src/services/workbook-parser.ts` to
> cover the worksheet model, **verifying every field against Oracle's reference
> dumps** using the differ built in task W1. Read
> `migrate/EUL_SCHEMA_GROUND_TRUTH.md` §7 (format, framing, the two integer
> fields already decoded) before starting.
>
> **Targets** — element classes present in the corpus and currently ignored.
> Five appear *exactly once per worksheet* (916), the signature of a layout /
> sort list / display-settings block: `0x0122`, `0x0258`, `0x0384`, `0x04b0`,
> `0x0d48`; then `0x0272` (910), `0x0514` (3 841), `0x00f0` (3 840), `0x0898`
> (3 005), `0x0578`/`0x05dc` (2 017 each), `0x0834`/`0x0190` (558 — per
> workbook), `0x0118` (24 — joins). Also unread: numeric fields on `0x02bc`,
> `0x0c1c`, and tags `0x00df`/`0x00e8`/`0x1000`/`0x1100` on `0x00dc`.
>
> **Fields to find** (the dump names them, so you know when you are right):
> axis vs measure usage, `Distinct`, `Placement`, `Hidden`, `DataType`, sort
> `Direction` and rank, the `Query Request` grouping and its link to sheets,
> aggregate function and placement on totals, item display width and alignment,
> join usage.
>
> **More evidence** — `E:\claude\discoverer\DISCVR4\DCBIMPB.DLL` exports
> Oracle's own class model (`DCBImportedSheet`, `DCBImportedItemSort`,
> `DCBImportedSummary`, `DCBImportedItemFormat`, `DCBImportedDisplaySettings`);
> extract the symbols with a regex over printable runs. `DCE.DLL`, `DCB.DLL`
> and `DIS4USR.EXE` carry the enum names (`EDCBAxisType`, `EDCBSortDirection`,
> `EDCBAggregateType`, `EDCBAggregateLocation`, `EDCBViewType`).
>
> **Deliverable.** Extend `EUL_SCHEMA_GROUND_TRUTH.md` §7 with, per class: its
> meaning, its fields (record type, tag, width, signedness, semantics) and the
> enum value tables — with confidence and evidence cited per field. A field you
> could not confirm goes in as *unconfirmed*, not guessed; that document's only
> value is that it is trustworthy. Land the decoding as a reader (extend
> `NUMERIC_TAGS` and the element model) with tests, even where nothing consumes
> it yet, and report differ agreement before and after.
>
> The format is **schema-driven** — the same record type byte means different
> widths under different classes — so resolve widths *per class* and keep the
> parser's resynchronizing behaviour: never advance by a width you are not sure
> of.

---

### W3 — Discoverer Neo schema for worksheet semantics

**Model:** Opus 5 · **Effort:** high · **Depends on:** W2

> Design and land the schema that can hold what a Discoverer 4 worksheet
> contains. Read `migrate/EUL_SCHEMA_GROUND_TRUTH.md` §7 (as updated by W2) for
> what has to be stored, and `backend/src/db/schema.ts` for what exists.
>
> Today `maps` + `map_items` + `map_conditions` + `map_parameters` +
> `map_calculated_fields` hold a flat column list and flat filters. They cannot
> express: a crosstab, which axis an item sits on, sort direction and rank,
> group/break sorting, totals and their placement, percentages, hidden items,
> `SELECT DISTINCT`, per-item display formats, page setup, or conditional
> formatting.
>
> Judgement calls that are yours, and must be written down:
> - Is `maps.map_type` (`TABLE | CROSSTAB | PAGE_DETAIL | CHART`) the right
>   home for `EDCBViewType`, or does layout need its own table?
> - Do axis and placement belong on `map_items`, or in a layout table?
> - Totals and percentages: one table with a kind discriminator, or two?
> - Discoverer's `Query Request` groups items and can be shared by two sheets.
>   Does Neo need that indirection, or does flattening per map lose nothing?
>
> Constraints:
> - Real Drizzle migrations under `backend/drizzle/` — do not hand-edit the
>   journal.
> - Mirror every new table in `migrate/src/db/schema.ts` and add it to
>   `TARGET_TABLES` / `TARGET_TABLE_ORDER` / `EMPTY_COUNTS`, and to
>   `migrate/src/testing/fake-writer.ts`.
> - Everything **nullable/optional**: a worksheet that uses none of it must
>   still migrate exactly as it does today.
> - Update `frontend/src/lib/types.ts` (`MigrationTable`) and the
>   `migration:tables.*` keys in **all four** locales; `node
>   scripts/i18n-check.mjs pt-PT es-ES fr-FR` must pass.
>
> Schema only — no parser or migration changes, existing suites still green.

---

### W4 — Layout: axis, measure, crosstab, hidden, distinct

**Model:** Opus 5 · **Effort:** high · **Depends on:** W2, W3

> Carry a worksheet's *layout* through the migration. Read
> `migrate/EUL_SCHEMA_GROUND_TRUTH.md` §7 and
> `migrate/src/services/workbook-parser.ts`.
>
> A worksheet is a table or a **crosstab** (`EDCBViewType`); its items sit on
> axes (`EDCBAxisType`) at a position, some are **hidden**, measures have their
> own position, and the sheet may be `SELECT DISTINCT`. Oracle's dump reports
> these as `Axis Item Usage`, `Measure Item Usage`, `Placement`, `Hidden` and
> `Distinct` — use the W1 differ to confirm every one.
>
> Extend `WorkbookColumn` / `ParsedWorksheet`, then `TransformedMapItem` /
> `TransformedWorkbook` in `migrate/src/services/transformers/`, then the
> runner (`migration-runner.ts`) and the re-import (`map-reimport.ts`) to write
> the columns W3 added. Build fixtures by extending
> `migrate/src/testing/workbook-fixture.ts` rather than hand-writing bytes.
>
> A worksheet whose layout cannot be decoded migrates exactly as it does today,
> with a warning — never a guessed axis.

---

### W5 — Sorting: direction, rank, group/break

**Model:** Opus 5 · **Effort:** high · **Depends on:** W2, W3

> Migrate worksheet sorting. Oracle's model is `DCBImportedItemSort`:
> **SortItem**, **SortDirection**, **Rank** (precedence) and **IsABreak** —
> group sorting, which the Discoverer 4i Plus User Guide documents as a
> distinct feature from simple table sorting and which these reports lean on
> heavily. The reference dumps show it as `EUL Sort Item Reference` with
> `Direction = n`, and `Sort Item Usage` inside each `Query Request`.
>
> `map_items` already has `sort_direction` and `sort_order` columns the
> migration has never populated; check what W3 added for break/group and use
> them. Wire parser → transformer → runner → re-import, with fixtures via
> `migrate/src/testing/workbook-fixture.ts`, and verify against the dumps with
> the W1 differ.
>
> Crosstab sorting differs from table sorting (`DCBViewMatrixSort` vs
> `DCBViewTableSort`). If only one is decodable, migrate that one and report
> the other.

---

### W6 — Totals, aggregations and percentages

**Model:** Opus 5 · **Effort:** high · **Depends on:** W2, W3

> Migrate worksheet totals. Oracle's model is `DCBImportedSummary`:
> **Function** (`EDCBAggregateType` — SUM/COUNT/AVG/MIN/MAX/…), **Label**,
> **MeasureItem**, **Placement** (`EDCBAggregateLocation`) and
> **PlacementItem** (total per group of X).
>
> The parser already finds the total elements (class `0x0c1c`, 19 319 in the
> corpus) and reads only their label (`0x0c21`) and a reference (`0x0fad`); W2
> decoded the rest. **Percentages are a separate Discoverer feature** (see
> `E:\claude\discoverer\4.1\Discoverer4iPlusUserGuide.pdf`, "Calculating
> Percentages") — establish whether they are a distinct element class or an
> aggregate type, and migrate them accordingly.
>
> This matters more than it looks: the source has whole worksheets named
> `… — TOTALIZADORES` whose entire content is totals. Wire parser →
> transformer → runner → re-import into the tables W3 added, with fixtures via
> `migrate/src/testing/workbook-fixture.ts`.

---

### W7 — Item formats, page setup, joins

**Model:** Sonnet 5 · **Effort:** high · **Depends on:** W2, W3

> Migrate the remaining worksheet detail, in value order:
> 1. **Item formats** (`DCBImportedItemFormat`) — display width, horizontal and
>    vertical alignment, word wrap, font style. The parser already locates the
>    format/font/style triple that follows every column (`0x0640` / `0x07d0` /
>    `0x0320`) and reads only the format mask.
> 2. **Page setup** (`DCBImportedDisplaySettings`) — left/center/right headers
>    and footers, margins, orientation, grid lines. Workbook-level class
>    `0x0834` already carries the header/footer strings (`0x0840`–`0x0845`).
> 3. **Joins** (`DCBImportedJoin`) — class `0x0118`, only 24 in the corpus
>    (`0x0fa7`, `0x011a`, `0x0fa8`, `0x011b`). Resolve to migrated `joins` rows
>    where possible; the dump reports them as `Join Usage`.
>
> Read `migrate/EUL_SCHEMA_GROUND_TRUTH.md` §7. Wire parser → transformer →
> runner → re-import into the columns W3 added, with fixtures via
> `migrate/src/testing/workbook-fixture.ts`. Anything undecodable is skipped
> with a warning, not defaulted.

---

### W8 — Migration wiring and live re-import

**Model:** Opus 5 · **Effort:** high · **Depends on:** W3–W7

> Bring the whole worksheet model through end to end and re-run it against the
> live source. Read `migrate/src/services/map-reimport.ts` (the maps-only
> re-import — a full re-migration is refused by design, one per database),
> `migrate/src/services/migration-runner.ts` and
> `docs/migration/migration-tool.md`.
>
> 1. Every field W4–W7 added must be written by **both** the full runner and
>    the re-import, and counted in `MapReimportCounts` / `TableCounts`.
> 2. Extend the assessment report (`migrate/src/services/assessment.ts`) so an
>    operator sees the new coverage before starting.
> 3. Surface the counts in `frontend/src/pages/MigrationPage.tsx` and all four
>    locales; `node scripts/i18n-check.mjs pt-PT es-ES fr-FR` must pass.
> 4. Dry-run against the live source, review, then run live. **Back up the map
>    tables first** (`pg_dump -t maps -t map_items …`) — the re-import deletes
>    and rebuilds every map in the "Migrated Workbooks" business area.
>    ```
>    docker compose exec backend npx tsx src/scripts/reimport-maps.ts <dataSourceId>
>    docker compose exec backend npx tsx src/scripts/reimport-maps.ts <dataSourceId> --live
>    ```
>    `migrate/` is not bind-mounted: `npm run build --workspace=migrate` and
>    redeploy first (see `docs/developer-guide/development.md`).
> 5. Report before/after counts, and spot-check several maps against Oracle's
>    reference dumps in `E:\claude\discoverer\d4dumps\`.

---

### W9 — Query generation, UI and documentation

**Model:** Opus 5 · **Effort:** high · **Depends on:** W8

> Make the migrated semantics *do* something — until now they are stored but
> unused.
>
> 1. **SQL generation** — `backend/src/lib/sql/` and
>    `backend/src/services/sql-generator.ts` must honour `SELECT DISTINCT`,
>    sort direction and rank (`ORDER BY`), group/break sorting, aggregate
>    totals, and hidden items (selected but not displayed when referenced by a
>    condition or sort).
> 2. **Rendering** — `frontend/src/pages/MapViewerPage.tsx` and
>    `MapBuilderPage.tsx` must render crosstabs, group breaks, totals rows and
>    per-item formats.
> 3. **Documentation** — `docs/migration/from-discoverer4.md` ("What Gets
>    Migrated"), `docs/migration/troubleshooting.md`, `docs/api/endpoints.md`,
>    `docs/user-guide/`, and the four locales. Say plainly what still does not
>    migrate.
>
> Large; if it needs splitting, split at the SQL/UI boundary and say so rather
> than half-doing both.

---

## 6. What will still not migrate

Be explicit with users, even after all of the above:

- **Graphs** — Discoverer's chart definitions. Neo has a `CHART` map type but
  no equivalent model.
- **Drill hierarchies** — depends on hierarchies migrating at all, which they
  do not: `EUL4_HIERARCHIES` has no business-area column and Neo requires one
  (`EUL_SCHEMA_GROUND_TRUTH.md` §4.2 item 6). Its own task.
- **Calculated field formulas as SQL** — they migrate as Discoverer's token
  language with item and parameter references resolved to names. Oracle's
  function-code table is not public; translating it would be guesswork. (The
  reference dump prints the same `IOFormula`, so it does not help here.)
- **Which worksheet used which condition** in a multi-worksheet workbook —
  Discoverer stores conditions per workbook and the file does not record the
  association.
- **Row-level security**, **scheduled reports**, **portlets**.

CLAUDE.md (1) content:
# CLAUDE.md

Guidance for Claude Code working in this repository.

## Working style — token guard

- **Be concise.** Answer first, then detail. No preamble, no restating the ask,
  no summary of what you just did unless it changed.
- **Route mechanical work to a Haiku sub-agent** — bulk renames, formatting,
  file-by-file summarising, scraping, log triage, mass find-and-replace. Use
  `Agent` with `model: "haiku"`. Do it inline only when it is a few steps.
- **Read narrowly.** Grep for the lines, then read the range. Do not read a
  whole large file to answer a question about ten lines of it.
- **Never suggest `/compact` as a cost-saving measure.** Compaction re-reads the
  entire conversation and writes a summary — it costs more than it saves.
  `/clear` between unrelated jobs is the cheap move.
- **Do not switch model or effort mid-session.** Any switch discards the prompt
  cache and re-bills the whole context at full write price. Pick once, at start.

## What This Repository Is

Two things live side by side:

1. **An Oracle Discoverer knowledge base** — vendor PDFs and reference notes for a
   desupported Oracle BI tool (Premier Support ended December 2012), covering
   versions 4.1, 9.0.4, 10.1.2, 10.1.2.1 and 11.1.1.
2. **`discoverer-neo/`** — an active TypeScript monorepo building an open-source
   replacement for Discoverer 4. This is where the code is. See
   `discoverer-neo/CLAUDE.md`.

Also present: `.claude/agents-off/` (138 sub-agents) and `.claude/skills/` (2,543
skills). **Neither is auto-loaded.**

- Skills sit one directory level below where Claude Code discovers skills, which
  keeps 352 KB of descriptions out of every session. Find one by reading
  `.claude/skills/SKILL_INDEX.md` on demand.
- Agents were renamed `agents/` → `agents-off/` on 2026-08-31. Nesting them was
  not enough: agent discovery **recurses**, so all 138 name+description entries
  were landing in every system prompt (8,217 tokens, re-read on every turn) while
  going unused across ten sessions. Read `.claude/agents-off/AGENT_INDEX.md` to
  find one; rename the folder back to `agents/` to re-enable them all.

## Directory Structure

```
E:\claude\discoverer\
├── discoverer-neo\        # The active build (see its own CLAUDE.md)
├── discoverer10g\sql\     # Oracle's shipped SQL scripts — EUL schema ground truth
├── DISCVR4\               # Oracle Discoverer 4 binaries and SQL
├── d4dumps\               # Sample .DIS workbook files
├── 4.1\ 9.0.4\ 10.1.2\ 10.1.2.1\ 11.1.1\   # Vendor PDFs by version
└── .claude\agents-off\, .claude\skills\    # Agent and skill definitions (neither auto-loads)
```

## Oracle Discoverer Key Facts

- **Status:** Desupported. Oracle's replacement is Oracle Analytics Cloud / Server.
- **Architecture:** Client-server, with an End User Layer (EUL) metadata layer
  over Oracle DB tables.
- **Core components:** Administrator, Plus (web), Viewer (read-only),
  Desktop (Windows), Portlet Provider.
- **Key concepts:** Business Areas → Folders → Items → Joins → Hierarchies →
  Workbooks/Worksheets.
- **EUL versions:** `EUL4_` prefix = Discoverer 4.1/4i; `EUL5_` = 9i/10g/11g.
  The prefix is the only reliable version discriminator.

### EUL schema — read the ground truth first

**Do not take EUL table or column names from the markdown guides in this
directory.** `oracle_discoverer_complete_reference.md` §8 and
`EUL_VERSION_REFERENCE.md` describe a schema that does not exist; both carry
retraction headers. Names such as `EUL5_BA`, `EUL5_JOINS`, `EUL5_JOI_COMP`,
`EUL5_HIER_LEVELS`, `EUL5_ELEM_ACCESS`, `OBJ_TABLE_NAME` and `EXP_COL_NAME`
are fabricated.

The verified schema — distilled from Oracle's own shipped scripts in
`discoverer10g\sql\` — is `discoverer-neo\migrate\EUL_SCHEMA_GROUND_TRUTH.md`.
Read that before touching anything EUL-related. A few corrections worth knowing
up front: business areas are `EUL5_BAS`, joins are `EUL5_KEY_CONS` (and bind
**folders**, not items), hierarchies are `EUL5_HI_NODES` + `EUL5_HI_SEGMENTS`,
and `OBJ_TYPE` holds `SOBJ`/`COBJ` — not `TABLE`/`VIEW`/`COMPLEX`.

The user-authored guides (`Discoverer 4.1 EUL Metadata Reference Guide*.md`,
`discoverer_4_1_eul_migration_reference.md`) **are** accurate and agree with the
shipped SQL.

## Working with This Repository

- Vendor PDFs are organized by version in the numbered directories.
- `.claude/agents-off/AGENT_INDEX.md` and `.claude/skills/SKILL_INDEX.md` list the
  available agents and skills. Neither loads automatically — read on demand.
- The knowledge-base half has nothing to build, lint or test — it is documentation.
  The `discoverer-neo/` half does; its own CLAUDE.md has the commands.

CLAUDE.md (2) content:
# CLAUDE.md — Discoverer Neo

An open-source replacement for Oracle Discoverer 4. npm-workspaces monorepo,
TypeScript throughout.

## Layout

| Workspace | What it is | Test runner |
|---|---|---|
| `backend/` | Fastify API, Drizzle ORM on Postgres, Redis, BullMQ workers | jest |
| `frontend/` | React + Vite | vitest, playwright |
| `migrate/` | Reads an Oracle EUL and imports it | jest |

## Commands

Run from this directory. `--workspaces` fans out to all three.

```bash
npm run typecheck --workspaces && npm run lint --workspaces
```

Per workspace: `npm test -w backend`, `npm test -w frontend`,
`npm test -w migrate`. Backend `pretest` provisions its own test database, so
Docker must be up (`docker compose -f docker-compose.dev.yml up -d`).

Database: `npm run db:generate -w backend` writes a migration,
`db:migrate` applies it, `db:seed` loads fixtures.

Translations: `node scripts/i18n-check.mjs pt-PT fr-FR es-ES` diffs each locale's
namespaces against `en` and exits non-zero on any missing key or placeholder
mismatch. CI runs it.

## Port 5173 is not safe — use 5174 for frontend verification

A Docker nginx container serves a stale `dist/` build on :5173. Playwright's
`reuseExistingServer` treats it as a live dev server and skips launching Vite,
so a bare `npx playwright test` silently tests an old bundle.

Always verify the frontend against port 5174:

```bash
FRONTEND_PORT=5174 VITE_BACKEND_URL=http://localhost:3001 npx playwright test
```

This matches the `discoverer-neo-frontend-verify` config in
`../.claude/launch.json`, which exists for exactly this collision. If a test
result looks impossible, check which port it ran against before believing it.

## EUL schema

`migrate/EUL_SCHEMA_GROUND_TRUTH.md` is the only trustworthy schema reference.
It was rebuilt from Oracle's shipped SQL in `../discoverer10g/sql/`. The
markdown guides in the parent directory carry retraction headers — do not take
table or column names from them. Details in `../CLAUDE.md`.

## Plan

`../DISCOVERER_NEO_SESSION_PLAN.md` holds the phased session plan;
`../DISCOVERER_NEO_ARCHITECTURE.md` the architecture. Both are large — read the
section you need, not the whole file.

README.md content:
# Discoverer Neo

> Modern open-source BI tool — an open-source replacement for Oracle Discoverer.

Discoverer Neo is a full-stack business intelligence and reporting platform designed to
replace the legacy Oracle Discoverer suite. It provides a web-based interface for
building queries, creating workbooks, defining business areas, and analyzing data — all
with a modern architecture.

## Architecture

| Workspace  | Tech Stack                                      | Purpose                                  |
| ---------- | ----------------------------------------------- | ---------------------------------------- |
| `backend`  | Node.js · TypeScript · Fastify · PostgreSQL     | REST API, authentication, query engine   |
| `frontend` | React 19 · TypeScript · Vite                     | Single-page application (SPA)            |
| `migrate`  | Node.js · TypeScript · oracledb                  | EUL migration from Oracle Discoverer 4–11 |

### Infrastructure

- **PostgreSQL** — Primary data store for metadata, user data, and query results
- **Redis** — Session caching, query result caching, and rate limiting

## Prerequisites

- [Node.js](https://nodejs.org/) >= 22
- [npm](https://www.npmjs.com/) >= 10
- [Docker](https://www.docker.com/) & Docker Compose
- (Optional) [Oracle Instant Client](https://www.oracle.com/database/technologies/instant-client.html) — required only for EUL migration

## Quickstart

### 1. Clone and install

```bash
git clone https://github.com/your-org/discoverer-neo.git
cd discoverer-neo
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Start infrastructure services

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

This starts PostgreSQL and Redis with health checks.

### 4. Run database migrations

> TODO: Add migration tooling (Prisma / Drizzle / Knex)

### 5. Start development servers

```bash
# Start all workspaces
npm run dev

# Or start individually:
npm run dev --workspace=backend
npm run dev --workspace=frontend
```

- Backend API:  <http://localhost:3000>
- Frontend SPA: <http://localhost:5173>
- Swagger UI: <http://localhost:3000/api/docs>

## Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[User Guide](docs/user-guide/)** — How to use Discoverer Neo (logging in, building maps, executing queries, exporting data)
- **[Administrator Guide](docs/admin-guide/)** — System administration (metadata management, user management, security, data sources)
- **[Developer Guide](docs/developer-guide/)** — Development setup, architecture, backend/frontend code, testing, contributing
- **[API Reference](docs/api/)** — REST API endpoints, authentication, request/response examples
- **[Deployment Guide](docs/deployment/)** — Docker deployment, configuration, SSL/TLS, backup, monitoring
- **[Migration Guide](docs/migration/)** — Migrating from Oracle Discoverer 4–11

Start with [docs/index.md](docs/index.md) for the complete documentation index.

## Project Structure

```
discoverer-neo/
├── docs/             # Complete documentation (see below)
├── backend/          # Node.js + TypeScript + Fastify API
│   └── src/
├── frontend/         # React 19 + TypeScript + Vite SPA
│   └── src/
├── migrate/          # Discoverer 4–11 EUL migration tool
│   └── src/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── package.json      # Root workspace configuration
├── tsconfig.json     # Root TypeScript config (strict mode)
├── eslint.config.js  # ESLint flat config
├── prettier.config.js
├── .gitignore
└── README.md
```

## Scripts

| Command              | Description                          |
| -------------------- | ------------------------------------ |
| `npm install`        | Install all workspace dependencies   |
| `npm run dev`        | Start all dev servers                |
| `npm run build`      | Build all workspaces                 |
| `npm run lint`       | Lint all workspaces                  |
| `npm run typecheck`  | Type-check all workspaces            |

Workspace-scoped: `npm run <script> --workspace=<name>`

## EUL Migration

Discoverer Neo includes a migration tool (`dn-migrate` CLI) for importing End User Layer (EUL) metadata from existing
Oracle Discoverer installations (versions 4.1 through 11g). This includes:

- Business areas, folders, items and joins
- Custom functions, users and privileges
- **Workbooks** — each worksheet becomes a Discoverer Neo map, with the columns,
  headings, format masks, conditions, parameters and calculations it displayed

The worksheet layout is decoded from `DOCUMENTS.DOC_DOCUMENT`, the proprietary
Discoverer container (the same bytes a `.DIS` file holds). Oracle never
documented that format; it is reverse-engineered in
[`migrate/EUL_SCHEMA_GROUND_TRUTH.md`](migrate/EUL_SCHEMA_GROUND_TRUTH.md) §7
and decoded by `migrate/src/services/workbook-parser.ts`.

Hierarchies and row-level security are **not** migrated — see the migration
guide for the full list and why.

A database that was migrated before the tool could read the workbook body has
maps with no columns. Fix it with the maps-only re-import
(`POST /api/migration/reimport-maps`) rather than a second full migration,
which is refused by design.

See the [Migration Guide](docs/migration/) for detailed instructions.

Optional: Requires Oracle Instant Client configured via `ORACLE_CLIENT_PATH` in your `.env` for legacy Discoverer versions (11.2 and earlier).

## License

[MIT](LICENSE)
