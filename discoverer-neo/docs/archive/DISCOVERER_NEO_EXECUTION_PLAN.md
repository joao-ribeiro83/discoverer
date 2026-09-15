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
