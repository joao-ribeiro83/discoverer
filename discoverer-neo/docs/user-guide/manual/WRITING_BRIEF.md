# Writing brief — role manuals (Discoverer Neo 2.0.0)

Shared by every writer and translator. Read it fully before you start.

## Sources, in order of trust

1. `docs/user-guide/manual/CAPABILITIES.md` — ground truth, cited to code. Section 1 = who sees which page. Section 2 = every action and its choices. Section 3 = business rules. Section 4 = places where the screen shows something the server refuses.
2. The code itself, when CAPABILITIES.md is unclear (`frontend/src`, `backend/src`, English labels in `frontend/src/locales/en/*.json`).
3. `docs/user-guide/*.md` — older prose guides. Useful for tone and examples. **Out of date on map access**: since 2.0.0 a business-area grant no longer shows maps. Maps come from: your own, public, shared with you; MANAGER sees all; ADMIN sees all.

Document only what really works. If the screen shows a control that the server refuses for this role (CAPABILITIES.md section 4), do not teach it as a feature. Say once, plainly, that the item is visible but reserved for another role. Do not mention code, APIs, HTTP codes, file names, or "bugs".

## Files

Write `docs/user-guide/manual/src/en/<ROLE>-full.md` and `docs/user-guide/manual/src/en/<ROLE>-quick.md`. The builder (`scripts/build-manuals.cjs`) adds the cover page and the table of contents, so do not write a title or a contents list.

## Markdown the builder understands (nothing else)

- `# Chapter` (starts a new page), `## Section`, `### Sub-section`. Only `#` and `##` go in the table of contents.
- Paragraphs. Inline `**bold**`, `*italic*`, `` `code` ``. No links, no HTML, no nested emphasis.
- `- ` bullets; two spaces before `- ` for a second level. `1. ` numbered steps.
- Pipe tables with a header row. Keep cells short; no line breaks inside a cell.
- Boxes: a line starting with `> **Tip:**`, `> **Note:**` or `> **Warning:**`.
- Pictures: `![Caption sentence](shots/en/<role>/NN-slug.png)` on its own line. Until the screenshot list exists, write a marker on its own line instead: `[[SHOT: role / page / exact state, e.g. "admin / Business Areas / Grants dialog, Permission list open"]]`. Markers are replaced later.
- `---` on its own line = page break. Use rarely.

## Voice

- Plain English for office staff who are not technical. Short sentences. Active voice. One idea per sentence. Speak to the reader as "you".
- Use the exact on-screen label in **bold** for every button, tab, menu entry, field and option: **Run**, **Share**, **Can export**.
- Explain every term the first time: map (a report; in Oracle Discoverer this was a worksheet), workbook (a group of maps), business area (a group of related data), folder, item, run, export, schedule, share, public map.
- No marketing words, no filler, no repeated summaries.

## Full guide ("Complete guide")

Explain everything this role can do.

1. First chapter: **Your role at a glance** — a table *You can / You cannot*, then *Where your access comes from* (role + shares + business-area grants, as they apply to this role), then *How to sign in, change your password, and sign out*.
2. Then one chapter per area the role can use, in sidebar order. For each page:
   - What the page is for, in 1–3 sentences, and when you would use it.
   - A picture of the page.
   - A table *Button or control | What it does* covering every action the role has on that page.
   - For every choice list (dropdowns, radio buttons, levels, formats, frequencies…), a table *Option | What it means / when to pick it*.
   - Step-by-step tasks (`1.` lists) for the common jobs, with a worked example using the demo map **GD_M.M10_V01.DIS** where it fits ("Example: …").
   - Tips and warnings only where they prevent a mistake (what is permanent, what other people will see, what takes a long time).
3. Last chapter: **Common questions** (5–10 real problems, e.g. "I cannot see a map a colleague sees") and **Glossary**.

## Quick guide

For someone who wants to start in five minutes. Same facts, far fewer words.

1. **Your role in one page** — a short *You can / You cannot* table.
2. One `#` chapter per area, each at most about one page: a 1–2 sentence "What is this", one picture, 3–6 numbered steps for the main job, and a small table of the key choices (one short line each).
3. No glossary; explain terms inline in a few words.
4. Aim for about one third of the full guide's length.

## Before you finish

- Every claim matches CAPABILITIES.md for this role. Nothing from another role leaks in.
- Every page in this role's sidebar is covered in both guides.
- Labels match the English locale files exactly.
