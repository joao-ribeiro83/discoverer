---
name: bun-install
description: |-
  Bun install: install all deps from package.json. Use when bootstrapping a checkout, running a reproducible CI install (--frozen-lockfile), or deploying (--production).
allowed-tools: Bash, Read
model: haiku
version: 1.0.0
category: 11-developer-tools
tags: []
harness:
- claude-code
- opencode
---

# /bun:install

Install all dependencies from package.json using Bun.

## When to Use This Skill

| Use this skill when... | Use bun-add instead when... |
|---|---|
| Bootstrapping a fresh checkout from existing package.json | Adding a new dependency to package.json |
| Running a CI install with `--frozen-lockfile` | Installing a single package with version pinning |
| Preparing a production deployment with `--production` | Updating an existing dependency (use bun-lockfile-update) |
| Restoring node_modules after deletion | Auditing what could be upgraded (use bun-outdated) |

## Context

```
Package file: `find . -maxdepth 1 -name "package.json" | head -1`
Lock file: `find . -maxdepth 1 -name "bun.lock*" -o -name "bun.lockb" | head -1`
```

## Execution

1. Check if package.json exists
2. Run installation with appropriate flags:

**Development (default):**
```bash
bun install
```

**CI/Reproducible builds:**
```bash
bun install --frozen-lockfile
```

**Production deployment:**
```bash
bun install --production
```

3. Report installed package count and any warnings

## Post-install

- Verify node_modules exists
- Check for peer dependency warnings
- Run `bun run prepare` if it exists (for husky/hooks)
