---
name: meeting-report
description: |-
  Génère automatiquement un compte-rendu de réunion en français à partir d'une transcription Teams (.vtt) et optionnellement d'un rapport de présence (.csv). Propose ensuite optionnellement de créer des issues de suivi GitLab/GitHub à partir du compte-rendu. Agnostique par défaut, avec un mode...
allowed-tools: Read, Write, Bash, Grep, Glob, AskUserQuestion
model: fable
version: 1.0.0
category: 02-design-animation
tags: []
harness:
- claude-code
- opencode
---

# Meeting Report

Generate a structured French meeting report from a Microsoft Teams `.vtt` transcript, optionally enriched with a Teams `.csv` attendance report.

The skill works on **any project**. It auto-detects the **hexagone-monorepo** project and, when detected, applies project-specific rules (sub-domain classification, sub-folder routing, foundation date-only naming). On any other project, it falls back to a generic single-folder output.

After the report is written, the skill can optionally propose follow-up GitLab/GitHub issues derived from the report (Step 12).

## Prerequisites

Steps 1–11 require no external tooling. **Step 12 (optional issue creation)** uses a Git platform CLI — these are *soft* dependencies: if the CLI is absent or unauthenticated, Step 12 simply skips and the report is unaffected.

- **`gh`** (GitHub CLI) — required only to create GitHub issues from the report. Install: https://cli.github.com
- **`glab`** (GitLab CLI) — required only to create GitLab issues from the report. Install: https://gitlab.com/gitlab-org/cli

## When to Use This Skill

Activate when the user:
- Dépose un chemin vers un fichier `.vtt` Teams dans le prompt
- Dit « crée un compte-rendu de cette transcription Teams »
- Dit « génère le compte-rendu de cette réunion »
- Dit « transforme cette transcription en rapport »
- Dépose en plus un fichier `.csv` de présence Teams (optionnel)

## Inputs

The skill expects **one or two file paths** dropped in the user prompt:

- **Required:** `.vtt` file — Teams meeting transcript in WebVTT format
- **Optional:** `.csv` file — Teams attendance report

Detection: inspect file extensions in the user prompt. If both are present, `.vtt` is the transcript and `.csv` is the attendance report. If only one file is dropped, it must be the `.vtt`.

## Project Mode Detection

Before processing, decide whether the current working directory is the **hexagone-monorepo** project. This sets the routing behavior for the rest of the workflow.

Run these checks (any one of them is sufficient to enter `hexagone-monorepo` mode):

1. **Folder layout** — `docs/reports/foundation/` AND `docs/reports/interoperability/` both exist
2. **Git remote** — `git remote -v` mentions `hexagone-monorepo`
3. **Package name** — root `package.json` has a `name` containing `hexagone-monorepo`

If none match → **generic mode**.

The user may also explicitly override:
- « mode générique » / « generic mode » → force generic
- « mode hexagone » → force hexagone-monorepo (only valid if the layout exists)

State the detected mode in one short sentence to the user before producing the report (e.g. « Mode détecté : hexagone-monorepo. » or « Mode détecté : générique. »).

## Workflow

### Step 1: Locate and Read the Files

1. Parse the user prompt for file paths (look for `.vtt` and `.csv` extensions)
2. Verify each file exists using Read
3. If no `.vtt` is found → stop and ask the user to provide one
4. Read the `.vtt` content entirely
5. Read the `.csv` content if provided

### Step 2: Parse the Transcript

Teams `.vtt` file structure:

```
WEBVTT

NOTE
Meeting metadata may appear here (date, title, organizer)

00:00:01.000 --> 00:00:04.000
<v Speaker Name>Speech content</v>

00:00:05.000 --> 00:00:08.000
Anonymous speech without voice tag
```

Extract:

1. **Meeting date** — try in this order:
   - **(a)** `NOTE` header content containing a date pattern (ISO `YYYY-MM-DD` or French `DD/MM/YYYY`)
   - **(b)** Filename date pattern (e.g. `20260410_...vtt` → `2026-04-10`)
   - **(c)** Today's date as fallback
2. **Speakers** — parse `<v Speaker Name>...</v>` voice tags (may be absent)
3. **Content blocks** — each timestamped segment is a speaker turn

### Step 3: Resolve Participants

Priority order:

1. **If `.csv` attendance report provided** → parse it and extract the `Name` column. Teams attendance CSVs typically contain columns like `Name`, `First Join`, `Last Leave`, `Duration`, `Role`, `Email`. Use names only for the `## Participants` section.
2. **Else if `<v>` voice tags are present in the `.vtt`** → extract unique speaker names
3. **Else** → **stop and ask the user** to provide the participants list before continuing:

   > « La transcription est anonyme et aucun fichier de présence n'est fourni. Peux-tu me donner la liste des participants ? »

### Step 4: Classify the Sub-Domain (hexagone-monorepo mode only)

**Skip this step in generic mode.** In generic mode, there is no domain classification — the report goes to a single output folder (see Step 10).

In **hexagone-monorepo mode**, analyze transcript content for domain signals using the table below (case-insensitive keyword matching):

| Folder | Signals (French / technical keywords) |
|---|---|
| `foundation/` | sprint, rétro, rétrospective, point équipe, stand-up, daily, foundation, équipe foundation |
| `core/` | architecture transversale, cross-domain, LDAP, S3A, S3A settings, permissions utilisateur, rôles, authentification |
| `interoperability/` | Hexaflux, interopérabilité, interop, HL7, HL7 v2, HL7 v2.5, FHIR, IHE, PAM, ADT, segment, PID, PV1, PV2, NK1, OBX, EVN, MSH, HPK, flux, intégration, message, mapping, broker, Mirth, Rhapsody |
| `gap/` | admission, patient, venue, séjour, dossier patient, pré-admission, AMO, AMC, débiteur, couverture sociale, facturation, valorisation, portail patient, ROC, serveur d'actes, actes, urgences, Diapason |
| `grh/` | RH, ressources humaines, employé, salarié, contrat, paie, MyRHConnect, RH Dossier |
| `gef/` | pharmacie, M21, contentieux, emprunts, trésorerie, HA GHT, immobilisations, achats, fournisseurs, comptabilité générale, Hélios, export comptable |
| `ui-ux/` | design, maquette, Figma, atelier UX, atelier UI, wireframe, écran, prototype, UX/UI |

**Classification rule:**

Classification is **by project/domain, not by team org.** The Hexaflux team is organizationally part of the Foundation team but works exclusively on the Hexaflux project (domain = interoperability), so their recurring meetings land in `interoperability/`, not `foundation/`. Always check project-specific signals before the generic Foundation standup rule.

1. If the meeting is the **Hexaflux team recurring meeting** (mentions « Hexaflux », or a weekly/standup/rétro involving the HL7/interop scope) → `interoperability/`
2. Else if the meeting is a **Foundation team recurring meeting** working on the horizontal/transverse platform (sprint, rétro, daily, point équipe, stand-up — without project-specific scope) → `foundation/`
3. **Interoperability vs. GAP disambiguation.** HL7 messages carry patient data (PID, PV1, NK1, etc.) so GAP keywords (patient, admission, séjour, venue) will naturally appear. When HL7/interop signals are present alongside GAP signals, the meeting is about **integration**, not patient business workflows → classify as `interoperability/`. Only classify as `gap/` when the discussion is about the functional/business side (UI, portail patient, facturation, workflows métier admission) without a technical HL7/message layer.
4. Otherwise, count keyword matches per domain folder and pick the **folder with the highest count** (dominant domain)
5. On a tie, prefer the folder whose signals appear earliest in the transcript
6. If no signals match at all → ask the user to confirm the target folder

### Step 5: Extract Meeting Title and Slug

1. Read the first minutes of the transcript for explicit subject references (greetings usually mention the meeting title)
2. Infer a clean French meeting title (e.g. `Atelier UX/UI Recherche Patient`)
3. Generate a kebab-case slug from the title:
   - Lowercase, ASCII only (strip accents)
   - Replace spaces and punctuation with `-`
   - Max ~60 characters
   - Example: `atelier-ux-ui-recherche-patient`

### Step 6: Rewrite Content by Topic

**Style:** Heavy rewrite, grouped by topic, **not** chronological, **not** verbatim.

1. Identify the main topics discussed — cluster speaker turns into thematic groups (topic detection, not speaker order)
2. For each topic, extract:
   - **Décisions** — concrete decisions made (always present as a `### Décisions` subsection)
   - **Point d'attention** — ambiguities, unresolved items (optional `### Point d'attention` subsection)
   - **Problèmes identifiés** — blockers, technical issues, missing dependencies (optional `### Problèmes identifiés` subsection)
3. Write in professional French:
   - Use "nous" or impersonal tone
   - **Fix all missing accents aggressively** — Teams French transcripts are notoriously bad with accents and punctuation
   - **Remove filler words** — « euh », « du coup », « en fait », repetitions, stammering
   - Use `**bold**` emphasis on key terms inside decision bullets
4. **Target length: 800–1500 words** for the full report
5. Number the sections: `## 1. <Topic>`, `## 2. <Topic>`, etc.
6. **Do not quote speakers verbatim.** The output is a synthesized report, not minutes.

### Step 7: Decide Whether to Add a Mermaid Diagram

Add a mermaid diagram **only** when the content genuinely benefits from visualization. Good triggers:

- Multi-step workflows (e.g. a facturation 6/8/7-step process)
- Decision trees with clear branches
- Sequence of events between multiple actors (e.g. admission → séjour → facturation)
- Data flow between systems

Prefer these diagram types:
- `flowchart LR` or `flowchart TD` for processes and decisions
- `sequenceDiagram` for inter-actor interactions
- `timeline` for project phases

Place the diagram **inside the relevant topic section**, not at the top of the report.

**Default: no diagram.** When in doubt, skip it. A report without a diagram is the norm, not the exception.

### Step 8: Assemble the Report

Use this exact template:

```markdown
# Compte-rendu — <Type de réunion> <Sujet>

**Date :** DD/MM/YYYY
**Organisateur :** <Nom> (<Rôle>)

## Participants

<Nom1>, <Nom2>, <Nom3>, ...

---

## 1. <Topic 1>

### Décisions

- **<Key term>** : <decision>
- ...

### Point d'attention

<Optional paragraph — only when there is an ambiguity or unresolved item>

### Problèmes identifiés

- <Optional bullet list — only when problems were raised>

---

## 2. <Topic 2>

### Décisions

- ...

---

<...as many topics as needed...>
```

**Rules:**
- **No YAML front-matter**
- **Date in French format** `DD/MM/YYYY` in the body (ISO only in the filename)
- **Participants** is a single comma-separated line, not a table, no roles
- **Organisateur**: if identifiable from transcript/csv, write `**Organisateur :** Nom (Rôle)`. If not identifiable, write `**Organisateur :** À préciser`
- `---` horizontal rule separator between topics

### Step 9: Determine the Filename

**hexagone-monorepo mode:**
- Foundation team meetings (`foundation/` folder) → `YYYY-MM-DD.md` (date only, no slug — one standing team meeting per day maximum)
- All other folders → `YYYY-MM-DD-<slug>.md`

**Generic mode:**
- Always `YYYY-MM-DD-<slug>.md`

The filename always uses the **ISO date format** `YYYY-MM-DD`, different from the French `DD/MM/YYYY` used in the report body.

### Step 10: Resolve the Output Folder and Write the File

**hexagone-monorepo mode:**
1. Target path: `docs/reports/<sub-domain>/<filename>.md`
2. Verify the sub-domain folder exists (`ls docs/reports/<sub-domain>/`). If missing, create it.

**Generic mode:**
1. Pick the first existing folder among:
   - `docs/reports/`
   - `docs/meetings/`
   - `meetings/`
   - `reports/`
2. If none exists, create `docs/reports/` and use it.
3. Target path: `<chosen-folder>/<filename>.md`

**Common to both modes:**
1. Check if a file with the same name already exists — if yes, append `-2`, `-3`, etc. before writing (do NOT overwrite)
2. Write the file with the Write tool

### Step 11: Report to the User

Show a concise summary:

1. ✓ Mode: `hexagone-monorepo` or `generic`
2. ✓ Target path
3. One-line summary: (sub-domain in hexagone mode), number of topics, number of participants
4. Note any fallback that was triggered (no attendance CSV, no voice tags, today's date used because no date found, default folder created, etc.)
5. Do not run `git add`, `git commit`, or `git push` — the user commits the report manually after review.

Then proceed to Step 12.

### Step 12: Propose Follow-up Issues (Optional)

After the report is written and reported, optionally offer to create follow-up GitLab/GitHub issues from it. This step **must never block, delay, or alter the report** — the report of Step 11 is already delivered. It runs in **both modes** (generic and hexagone-monorepo).

#### Step 12a: Preflight (silent gate)

Run these checks. **If any one fails, print a single short line stating why and stop — do NOT show a prompt:**

1. **Interactive context** — if the skill is running non-interactively / in a batch, skip.
2. **Single platform** — `git remote -v` in the current directory must resolve to exactly one platform: a GitHub remote (`github.com`) OR a GitLab remote. No remote, or both platforms present → skip.
3. **CLI ready** — the matching CLI must be installed AND authenticated: `gh auth status` for GitHub, `glab auth status` for GitLab. Missing or unauthenticated → skip.
4. **Quality candidates** — at least one quality candidate must survive Step 12b. Zero → skip.

Skip messages (one line, French), e.g.: « Aucune issue proposée : pas de remote git détecté. » / « Aucune issue proposée : `glab` non authentifié. » / « Aucune issue proposée : aucune décision actionnable dans le compte-rendu. »

#### Step 12b: Derive Candidate Issues

From the **report just written** (not the raw transcript), extract actionable follow-up items:

- **Primary sources:** `### Problèmes identifiés` and `### Point d'attention` bullets.
- **`### Décisions`** bullets only when the decision implies follow-up work (e.g. « on a décidé de migrer X » → the migration is the candidate). A settled fact is not an issue.
- **Quality filter** — drop items that are purely informational, deferrals (« on en reparlera »), or have no actionable verb. Prefer fewer sharp candidates over many vague ones.
- For each surviving item, build:
  - a **title** — imperative French reformulation, never the verbatim bullet, ≤ ~80 chars, control characters and stray newlines stripped
  - a **suggested type** — `Problèmes identifiés` → `bug`; `Point d'attention` / `Décisions` → `task`
- **Cap at the top 4** (the `AskUserQuestion` option limit). If more survive the filter, keep the 4 highest-signal and tell the user the rest can be created on a re-run.

#### Step 12c: Present and Select

Use a **single `AskUserQuestion`** with `multiSelect: true`:

- The question header **names the exact target explicitly**: « Les issues seront créées sur `<owner/repo>` (`<host>`). Lesquelles créer ? » — this is both the selection and the target confirmation.
- One option per candidate: label = title, description = source section + topic + suggested type.
- The user selects zero or more. If nothing is selected or the prompt is dismissed → **create nothing**, report done.

#### Step 12d: Create Selected Issues

For each selected candidate, **inline the platform CLI** — do NOT route through the `gitlab-issue` / `github-issues` skills (those are interactive consoles and would re-ask everything already resolved here):

1. **Search for a duplicate first:** `gh issue list --search "<title>"` / `glab issue list --search "<title>"`. If a near-identical open issue exists, surface it and let the user confirm or skip that candidate.
2. **Create:**
   - GitHub: `gh issue create --title "<title>" --body "<body>"`
   - GitLab: `glab issue create --title "<title>" --description "<body>"`
3. **Body** = a 2-3 line French summary of the item + a relative link to the report file. **Never** paste raw transcript excerpts or patient-identifying content into the body — the detail stays in the local report.
4. **Labels** — apply an existing project label only if one clearly fits (e.g. `bug`). **Never create a new label**; omit the label if none fits.
5. Always use the **detected** host/project — never a hardcoded default.

#### Step 12e: Report the Outcome

Print a per-issue result: the created issue URLs, and for any failure the candidate title + the error. Offer to re-run for the items that failed or were not shown.

**Notes for Step 12:**
- This step performs a **network side-effect** (issue creation) but still **no git actions** — no commit, no push.
- v1 does not persist state between runs: re-running the skill on the same transcript re-proposes the same candidates. The empty default selection and the pre-create duplicate search are the safeguards.

## Important Notes

- **Project-agnostic by default.** Sub-domain classification and `docs/reports/<sub-domain>/` routing only apply when the hexagone-monorepo project is detected.
- **No redaction or pseudonymization.** Team meetings are considered internal and trusted. Names and content may appear verbatim in reports.
- **No git commits or pushes.** The skill writes the report file; the user commits and pushes manually. Step 12 may create GitLab/GitHub issues — an opt-in, gated network side-effect — but never runs `git add`, `git commit`, or `git push`.
- **Issue creation is opt-in, gated, and bounded.** Step 12 proposes shallow follow-up issues derived from the report and never auto-creates anything (empty default selection). Deep, investigated, single-bug issues belong to the `triage-issue` skill, not here.
- **Rewrite heavily — do not transcribe.** The output is a thematic synthesis, not chronological minutes.
- **Fix French accents aggressively.** Teams `.vtt` French transcripts routinely miss accents and punctuation.
- **Foundation date-only naming applies only in hexagone-monorepo mode.** Generic mode always uses `YYYY-MM-DD-<slug>.md`.
- **Mermaid is optional, rare, and only when useful.** Default is no diagram.
- **Participants fallback order:** `.csv` first, then `<v>` voice tags, then ask the user. Never invent names.
- **Never overwrite an existing report.** Append a numeric suffix if a file with the same name already exists.

## Examples

### Example 1: Generic project, simple meeting

```
User: crée un compte-rendu de cette transcription Teams /tmp/kickoff.vtt

→ Detection: no docs/reports/foundation/ found → generic mode
→ Skill reads the .vtt
→ Parses <v> voice tags → 5 speakers
→ Extracts date 2026-04-22
→ Picks docs/reports/ (exists) as output folder
→ Writes docs/reports/2026-04-22-kickoff-projet.md
→ Reports: « Mode détecté : générique. »
```

### Example 2: Generic project, no docs/reports folder yet

```
User: génère le compte-rendu /tmp/atelier.vtt /tmp/attendees.csv

→ Detection: generic mode
→ No docs/reports/, no docs/meetings/, no meetings/, no reports/ → creates docs/reports/
→ Writes docs/reports/2026-04-15-atelier-architecture.md
→ Reports: « Mode détecté : générique. Dossier docs/reports/ créé. »
```

### Example 3 (hexagone-monorepo): UX/UI atelier with attendance CSV

```
User: crée un compte-rendu de cette transcription Teams /tmp/atelier_recherche_patient.vtt /tmp/attendees.csv

→ Detection: docs/reports/foundation/ + interoperability/ exist → hexagone-monorepo mode
→ Skill reads both files
→ Extracts date from .vtt NOTE header: 2026-03-18
→ Participants from .csv: Chloé Julenon, Richard Gill, Adrien Marcos, Myriam Fatoux, Damien Battistella
→ Detects ui-ux signals (atelier, écran, maquette, recherche patient)
→ Classifies as ui-ux/
→ Writes docs/reports/ui-ux/2026-03-18-atelier-recherche-patient.md
```

### Example 4 (hexagone-monorepo): Foundation team sprint review, no CSV

```
User: génère le compte-rendu de cette réunion /tmp/sprint_review.vtt

→ Detection: hexagone-monorepo mode
→ Parses <v Speaker> voice tags → extracts 4 speakers
→ Extracts date from NOTE header: 2026-04-10
→ Detects foundation signals (sprint, rétro, point équipe)
→ Classifies as foundation/
→ Uses date-only naming
→ Writes docs/reports/foundation/2026-04-10.md
```

### Example 5: Anonymous transcript with no CSV (any mode)

```
User: transforme cette transcription en rapport /tmp/meeting.vtt

→ No <v> tags found
→ No .csv provided
→ Stops and asks: « La transcription est anonyme et aucun fichier de présence n'est fourni. Peux-tu me donner la liste des participants ? »
→ Waits for the user, then continues with the provided names
```

### Example 6 (hexagone-monorepo): Hexaflux weekly — HL7 discussion, not GAP

```
User: crée un compte-rendu /tmp/hexaflux_weekly.vtt

→ Detection: hexagone-monorepo mode
→ Detects HL7 / ADT / PID / PV1 / NK1 / OBX / segment / mapping signals
→ Patient and admission keywords are present BUT tied to HL7 message segments, not business workflows
→ Applies the interop-vs-gap disambiguation rule → picks interoperability/
→ Writes docs/reports/interoperability/2026-04-17-hexaflux-weekly.md
```

### Example 7: Follow-up issue proposal after the report (GitHub)

```
User: génère le compte-rendu /tmp/sprint.vtt

→ Report written to docs/reports/2026-05-12-sprint-planning.md and reported (Steps 1–11)
→ Step 12a preflight: git remote → github.com/Dedalus-ERP-PAS/foo, `gh` authenticated → pass
→ Step 12b: derives 3 quality candidates from Problèmes identifiés + Point d'attention
→ Step 12c: AskUserQuestion « Les issues seront créées sur Dedalus-ERP-PAS/foo (github.com). Lesquelles créer ? »
→ User selects 2 of 3
→ Step 12d: `gh issue create` ×2 (duplicate search first, no label invented)
→ Step 12e: reports the 2 created issue URLs
```

### Example 8: Issue step skipped — no git remote

```
User: transforme cette transcription en rapport /tmp/atelier.vtt

→ Report written and reported (Steps 1–11)
→ Step 12a preflight: `git remote -v` empty → no platform
→ Prints « Aucune issue proposée : pas de remote git détecté. » and stops
```
