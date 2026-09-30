# Translation brief — role manuals

Translate the 8 English sources in `docs/user-guide/manual/src/en/` (ADMIN, MANAGER, USER, VIEWER × full, quick) into one target language. Write each file with the same name to `docs/user-guide/manual/src/<locale>/`.

## Rules

1. **On-screen labels must match the app exactly.** Every word in `**bold**` that is a button, tab, menu entry, field, option, status or message comes from `frontend/src/locales/en/*.json`. Find the same key in `frontend/src/locales/<locale>/*.json` and use that text, character for character. Grep the English label in `locales/en` to find the key. If a label has no key (rare), translate it naturally.
2. **Keep the structure identical.** Same headings in the same order, same tables with the same number of rows and columns, same lists, same `---` page breaks, same line order. Do not add or drop content.
3. **Picture markers stay untouched.** Copy every `[[SHOT: …]]` line exactly as it is, in English. They are replaced later.
4. **Do not translate:** code and cron in backticks, role names (ADMIN, MANAGER, USER, VIEWER), grant levels (VIEW, EXPORT, SCHEDULE, CREATE, EDIT, DELETE) unless the app's locale file shows them translated, aggregation names (SUM, COUNT…), folder types, item type codes, map names such as **GD_M.M10_V01.DIS**, business area names, e-mail addresses, `ROW_LEVEL_FAIL_MODE`.
5. **Boxes:** start them with these words, in bold, followed by a colon:

| Locale | Tip | Note | Warning |
|---|---|---|---|
| pt-PT | **Dica:** | **Nota:** | **Atenção:** |
| es-ES | **Consejo:** | **Nota:** | **Advertencia:** |
| fr-FR | **Astuce :** | **Remarque :** | **Attention :** |

6. **Language:** pt-PT is European Portuguese (Portugal), never Brazilian (use "ecrã", "ficheiro", "utilizador", "palavra-passe", "clique em", "transferir"). es-ES is Spain Spanish (usted form is not needed; use the neutral imperative the app uses — check the locale files' tone). fr-FR is France French with vous. Follow the terminology of the app's own locale files (for example the word the app uses for "map", "run", "export", "schedule", "share", "business area").
7. **Voice:** short, plain sentences, as in the English source. Office staff, not technical readers.

## Before you finish

- Every `**bold**` UI label was checked against the locale JSON.
- Marker count per file equals the English file: `grep -c "\[\[SHOT:"`.
- Heading count per file equals the English file: `grep -c "^#"`.
