# Discoverer Neo Documentation

Welcome to Discoverer Neo documentation. This is a comprehensive guide for users, administrators, developers, and operators.

## Languages

The User Guide and Administrator Guide are also available in Português (Portugal), Français (France), and Español (España). Other sections (Developer Guide, Deployment, API, Migration) are English-only.

| Language | User Guide | Administrator Guide |
|----------|-----------|---------------------|
| English (default) | [Getting Started](user-guide/getting-started.md) | [Metadata Management](admin-guide/metadata-management.md) |
| Português (Portugal) | [Introdução](pt-PT/user-guide/getting-started.md) | [Gestão de Metadados](pt-PT/admin-guide/metadata-management.md) |
| Français (France) | [Prise en main](fr-FR/user-guide/getting-started.md) | [Gestion des métadonnées](fr-FR/admin-guide/metadata-management.md) |
| Español (España) | [Primeros pasos](es-ES/user-guide/getting-started.md) | [Gestión de metadatos](es-ES/admin-guide/metadata-management.md) |

## Overview

- **[Project README](README.md)** — What is Discoverer Neo, features, quick start, and architecture

## User Guide

Learn how to use the Discoverer Neo interface to build and run queries.

- **[Getting Started](user-guide/getting-started.md)** — Logging in, navigating the interface
- **[Settings](user-guide/settings.md)** — Language and theme preferences
- **[Building Maps](user-guide/building-maps.md)** — Creating maps, selecting items, adding conditions
- **[Executing Maps](user-guide/executing-maps.md)** — Running maps, viewing results, pagination
- **[Exporting Data](user-guide/exporting-data.md)** — Exporting to Excel (XLSX) and CSV
- **[Scheduling Maps](user-guide/scheduling.md)** — Creating scheduled runs, managing schedules
- **[Sharing Maps](user-guide/sharing.md)** — Sharing maps with other users, permissions

## Troubleshooting

Why the product said no, and what to do about it.

- **[Why a worksheet was declined](troubleshooting/refusals.md)** — the query shapes the planner refuses, why, and what to change

## Administrator Guide

Configure and manage the Discoverer Neo system.

- **[Metadata Management](admin-guide/metadata-management.md)** — Business areas, folders, items, joins, hierarchies
- **[Oracle Introspection](admin-guide/oracle-introspection.md)** — Discovering tables and views
- **[Data Sources](admin-guide/data-sources.md)** — Managing Oracle and PostgreSQL connections
- **[User Management](admin-guide/user-management.md)** — Creating users, assigning roles and permissions
- **[Security Policies](admin-guide/security.md)** — Row-level security and access control
- **[Custom Functions](admin-guide/custom-functions.md)** — Defining SQL/PLSQL functions
- **[Audit Logging](admin-guide/audit-logging.md)** — Monitoring system activity
- **[Migrated Users & Passwords](migration/user-credentials.md)** — Temporary passwords, the credentials file, forced password change

## API Documentation

Reference for REST API integration.

- **[Endpoints Reference](api/endpoints.md)** — Complete endpoint reference with examples
- **[Authentication](api/authentication.md)** — JWT authentication flow and token management
- **[Swagger/OpenAPI](http://localhost:3000/api/docs)** — Interactive API explorer (when running locally)

## Developer Guide

Get set up for local development and contributing.

- **[Architecture](developer-guide/architecture.md)** — System design, component relationships, data flow
- **[Development Setup](developer-guide/development.md)** — Local development environment
- **[Backend Code Guide](developer-guide/backend.md)** — Backend modules, services, and patterns
- **[Frontend Code Guide](developer-guide/frontend.md)** — Frontend structure, components, and state management
- **[Testing](developer-guide/testing.md)** — Running tests (Jest, Vitest, Playwright)
- **[Contributing](developer-guide/contributing.md)** — Contribution guidelines and workflow

## Deployment Guide

Deploy Discoverer Neo to production.

- **[Docker Deployment](deployment/docker.md)** — Docker Compose setup and multi-container orchestration
- **[Configuration](deployment/configuration.md)** — Environment variables and configuration reference
- **[SSL/TLS](deployment/ssl.md)** — HTTPS setup with Nginx
- **[Backup and Restore](deployment/backup.md)** — Database and export file backup strategies
- **[Monitoring](deployment/monitoring.md)** — Prometheus metrics and health checks
- **[Troubleshooting](deployment/troubleshooting.md)** — Common issues and solutions

## Migration Guide

Migrate from legacy Oracle Discoverer.

- **[From Discoverer 4](migration/from-discoverer4.md)** — EUL migration overview, what becomes what, and how workbooks become maps
- **[Migration Tool](migration/migration-tool.md)** — `dn-migrate` CLI commands, options, and the maps-only re-import
- **[Migrated Users & Passwords](migration/user-credentials.md)** — Temporary passwords, the credentials file, forced password change
- **[Troubleshooting](migration/troubleshooting.md)** — Common migration issues, including maps that arrived without their layout
- **[EUL Schema Ground Truth](../migrate/EUL_SCHEMA_GROUND_TRUTH.md)** — the real EUL table and column names, and the `.DIS` workbook container format

---

**Last Updated:** August 2026  
**Version:** 0.1.0
