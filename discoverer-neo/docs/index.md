# Discoverer Neo Documentation

Welcome to Discoverer Neo documentation. This is a comprehensive guide for users, administrators, developers, and operators.

## Overview

- **[Project README](README.md)** — What is Discoverer Neo, features, quick start, and architecture

## User Guide

Learn how to use the Discoverer Neo interface to build and run queries.

- **[Getting Started](user-guide/getting-started.md)** — Logging in, navigating the interface
- **[Building Maps](user-guide/building-maps.md)** — Creating maps, selecting items, adding conditions
- **[Executing Maps](user-guide/executing-maps.md)** — Running maps, viewing results, pagination
- **[Exporting Data](user-guide/exporting-data.md)** — Exporting to Excel (XLSX) and CSV
- **[Scheduling Maps](user-guide/scheduling.md)** — Creating scheduled runs, managing schedules
- **[Sharing Maps](user-guide/sharing.md)** — Sharing maps with other users, permissions

## Administrator Guide

Configure and manage the Discoverer Neo system.

- **[Metadata Management](admin-guide/metadata-management.md)** — Business areas, folders, items, joins, hierarchies
- **[Oracle Introspection](admin-guide/oracle-introspection.md)** — Discovering tables and views
- **[Data Sources](admin-guide/data-sources.md)** — Managing Oracle and PostgreSQL connections
- **[User Management](admin-guide/user-management.md)** — Creating users, assigning roles and permissions
- **[Security Policies](admin-guide/security.md)** — Row-level security and access control
- **[Custom Functions](admin-guide/custom-functions.md)** — Defining SQL/PLSQL functions
- **[Audit Logging](admin-guide/audit-logging.md)** — Monitoring system activity

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

- **[From Discoverer 4](migration/from-discoverer4.md)** — EUL migration overview and process
- **[Migration Tool](migration/migration-tool.md)** — `dn-migrate` CLI commands and options
- **[Troubleshooting](migration/troubleshooting.md)** — Common migration issues

---

**Last Updated:** July 2026  
**Version:** 0.1.0
