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
