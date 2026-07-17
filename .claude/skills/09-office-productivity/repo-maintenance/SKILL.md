---
name: repo-maintenance
description: |-
  Maintain repository integrity and documentation. Use for auditing structure, checking config validity, and reviewing inventory. Use proactively to validate the repository or sync documentation.
allowed-tools: Read, Grep, Glob
model: haiku
version: 1.0.0
category: 09-office-productivity
tags: []
harness:
- claude-code
- opencode
---

# Repository Maintenance Skill

This skill provides the tools to act as a **Repo Custodian**.

<instructions>

## Validate Repository
Ensure configuration files (agents, commands, skills) are valid.
- Command: `python3 .opencode/skill/repo-maintenance/scripts/audit_repo.py`

## Sync Documentation
Report on repository inventory and suggest whether docs need updating.
- Command: `python3 .opencode/skill/repo-maintenance/scripts/sync_docs.py`

</instructions>

<workflow>

## After a Failed Audit
When the audit reports errors or warnings:

1. **Read affected files** - MUST read each file listed in the output
2. **Analyze issues** - Understand what changes would fix each issue
3. **Ask the user** - MUST use question tool to confirm which fixes to apply
4. **Apply selectively** - Only fix what the user approves

MUST NOT auto-fix all issues. Mass changes can break working configurations.

</workflow>

<reference>

## Standards
Refer to `references/validation-rules.md` for:
- YAML Frontmatter Schema
- Description patterns (agents, commands, skills)
- RFC+XML compliance requirements
- Post-audit workflow details

</reference>
