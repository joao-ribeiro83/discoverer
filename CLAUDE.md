# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a **knowledge base and tooling repository for Oracle Discoverer** — a legacy Oracle business intelligence / reporting tool that has been desupported (Premier Support ended December 2012). The repository contains:

1. **Oracle Discoverer documentation** — A comprehensive technical reference covering all major versions (4.1, 9.0.4, 10.1.2, 10.1.2.1, 11.1.1).
2. **Claude Code agent definitions** — 138 specialized sub-agents across 7 categories.
3. **Claude Code skills** — 2,564 skills across 11 categories (web dev, design, DevOps, security, database, AI/ML, testing, research, productivity, mobile, developer tools).

## Directory Structure

```
E:\claude\discoverer\
├── oracle_discoverer_complete_reference.md   # Master technical reference (all versions)
├── 4.1/                                      # Discoverer 4i PDF documentation
├── 9.0.4/                                    # Discoverer 9.0.4 PDF documentation
├── 10.1.2/                                   # Discoverer 10.1.2 PDF documentation
├── 10.1.2.1/                                 # Discoverer 10.1.2.1 PDF documentation
├── 11.1.1/                                   # Discoverer 11g PDF documentation
└── .claude/
    ├── settings.local.json                   # Claude Code settings (OpenRouter, permissions)
    ├── AGENT_INDEX.md                        # Index of all 138 agents
    ├── agents/                               # Agent definition files
    │   ├── 01-agents-core/                   # 58 core agents (Ariadne, Developer, auditor, etc.)
    │   ├── 02-agents-web/                    # 11 web agents (Clio, Figma Converter, etc.)
    │   ├── 03-agents-infra/                  # 7 infrastructure agents (Docker, Terraform, Redis, etc.)
    │   ├── 04-agents-security/               # 9 security agents (guardian, malware-analyst, etc.)
    │   ├── 05-agents-data/                   # 10 data agents (SQL, MongoDB, Postgres, etc.)
    │   ├── 06-agents-ai/                     # 21 AI agents (ai-engineer, LLM proxy, etc.)
    │   └── 08-agents-specialized/            # 22 specialized agents (archivist, scout, etc.)
    └── skills/                               # Skill definitions
        ├── 01-web-development/               # 392 web development skills
        ├── 02-design-animation/              # 605 design & animation skills
        ├── 03-devops-infrastructure/         # 149 DevOps skills
        ├── 04-security/                      # 79 security skills
        ├── 05-database/                      # 165 database skills
        ├── 06-ai-ml/                         # 514 AI/ML skills
        ├── 07-testing-qa/                    # 143 testing skills
        ├── 08-research-analysis/             # 32 research skills
        ├── 09-office-productivity/           # 150 productivity skills
        ├── 10-mobile-development/             # 22 mobile skills
        ├── 11-developer-tools/               # 313 developer tool skills
        └── SKILL_INDEX.md                    # Full skill index
```

## Oracle Discoverer Key Facts

- **Status:** Desupported by Oracle. Replacement is Oracle Analytics Cloud (OAC) / Oracle Analytics Server (OAS).
- **Architecture:** Client-server with an End User Layer (EUL) metadata abstraction over Oracle DB tables.
- **EUL:** Stored in ~50 Oracle DB tables (e.g., `EUL5_BA`, `EUL5_OBJS`, `EUL5_JOINS`, `EUL5_EXPRESSIONS`). Owned by a dedicated schema user (e.g., `EUL5_US`).
- **Core components:** Discoverer Administrator, Plus (web), Viewer (read-only), Desktop (Windows), Portlet Provider.
- **Key concepts:** Business Areas → Folders → Items → Joins → Hierarchies → Workbooks/Worksheets.
- **Folder types:** TABLE, VIEW, DERIVED, COMPLEX, JOIN, SUMMARY.
- **EUL versions:** Version 5 (used with 10g/11g).

## Working with This Repository

### Reading Documentation
- The main reference file is `oracle_discoverer_complete_reference.md` — a single-file comprehensive guide covering architecture, EUL setup, workbook building, security, migration to OAC, EUL security conditions, analytic functions, and the EUL database table schema.
- PDF documentation is organized by version in numbered directories.

### Agent and Skill Discovery
- Use `AGENT_INDEX.md` and `SKILL_INDEX.md` to discover available agents and skills.
- Agent definitions live in `.claude/agents/` subdirectories.
- Skill definitions (SKILL.md files) live in `.claude/skills/` subdirectories.

### No Build/Test Tooling
This is a documentation and configuration repository. There is no source code to build, lint, or test. There is no `package.json`, `Makefile`, or equivalent.
