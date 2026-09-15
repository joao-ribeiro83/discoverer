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
