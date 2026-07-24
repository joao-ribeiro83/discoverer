# pt-PT (European Portuguese) Glossary — Discoverer Neo

Terminology reference for translating Discoverer Neo's UI into European Portuguese. Every translator/reviewer (human or agent) should treat this file as the source of truth — if a string's natural translation conflicts with a term below, the term below wins.

## Locale conventions (apply everywhere, not just glossary terms)

Discoverer Neo targets **European Portuguese**, not Brazilian Portuguese. The two diverge on common software vocabulary; using the Brazilian form is treated as a bug, not a style choice.

| Concept | pt-PT (use this) | pt-BR (do NOT use) |
|---|---|---|
| Save | Guardar | Salvar |
| Delete | Eliminar | Excluir / Deletar |
| File | Ficheiro | Arquivo |
| Password | Palavra-passe | Senha |
| Log in / Sign in | Iniciar sessão | Fazer login / Entrar |
| Log out | Terminar sessão | Sair |
| Log / record (noun, e.g. audit log) | Registo | Registro |
| Default | Predefinição / Predefinido | Padrão |
| Screen | Ecrã | Tela |
| Progressive tense ("Loading…") | "a carregar…" (estar a + infinitive) | "carregando…" (gerund) |

Orthography follows the 1990 Orthographic Agreement (AO1990) as adopted in Portugal: `ação` not `acção`, `receção` not `recepção`, `aspeto` not `aspecto`, `ótimo` not `óptimo`.

**Register:** formal, impersonal enterprise tone. Prefer subject-less imperative/infinitive constructions for actions and impersonal phrasing for system messages over explicit second-person pronouns. When a possessive is unavoidable, use **"o seu" / "a sua"** rather than opening with "Você" — e.g. "A sessão expirou. Inicie sessão novamente." (not "Você precisa fazer login de novo."). Never use "tu" (too casual) and avoid leading with "Você" (grammatically formal but reads as address-heavy compared to how Portuguese enterprise software — Microsoft 365, SAP — actually writes UI copy). No exclamation marks, no consumer-app friendliness.

## Core domain terms

| Term | pt-PT rendering | Reference check | Notes |
|---|---|---|---|
| **Business Area** | Área de Negócio | — (no Power BI/Tableau equivalent) | Discoverer/EUL-specific grouping concept above Folders. Translated plainly, capitalized as a proper feature name in headings. |
| **Folder** | Pasta | — (no equivalent; closest is Power BI's "table" in a semantic model) | EUL concept for an exposed table/view/derived query, not a filesystem folder. Matches Oracle's own historical Discoverer pt-PT localization. |
| **Item** | Item | — | Column/calculation/condition/join-key exposed from a folder. Kept as the direct cognate — already how Oracle's Discoverer localizations rendered it; inventing a different word (e.g. "Elemento") would break continuity with EUL documentation translators may already know. |
| **Join** | Junção | Power BI: "Junção" (Power Query merge dialog's "Tipo de Junção" / Join Kind). Tableau: "Combinação". | Followed Power BI — it is the more widely deployed enterprise term and matches the technical (SQL JOIN) sense used here, whereas Tableau's "Combinação" is closer to blending. |
| **Hierarchy** | Hierarquia | Power BI & Tableau agree: "Hierarquia" | No conflict. |
| **Map** (Discoverer Neo's saved-query object — replaces the classic "Workbook") | Mapa | — (Discoverer Neo-specific term) | Deliberately not "Relatório" (Report) or "Painel" (Dashboard) — a Map is Discoverer Neo's own first-class object with its own identity (builder, viewer, share, schedule), so it keeps its own plain, literal name rather than borrowing a BI-tool term that means something narrower. |
| **Worksheet** (legacy Discoverer artifact, appears in migration text) | Folha | — | Classic Discoverer's tab within a workbook. Kept distinct from "Mapa" since a migrated worksheet becomes one Map, not a tab inside it. |
| **Parameter** | Parâmetro | Power BI & Tableau agree | — |
| **Condition** | Condição | — | Discoverer's term for a WHERE-clause filter row (as opposed to a user-facing "Filter", which this app doesn't separately expose — Conditions serve that role). |
| **Calculated Field** | Campo Calculado | Tableau: "Campo Calculado". Power BI splits this into Calculated Column / Measure with no single unifying term. | Followed Tableau — Discoverer Neo's calculated field (one formula, evaluated per row or pushed to SQL) matches Tableau's single unified concept, not Power BI's split model. |
| **Aggregation** | Agregação | Power BI & Tableau agree | — |
| **Schedule** (noun & verb) | Agendamento (noun) / Agendar (verb) | Power BI: "Atualização Agendada" (scheduled refresh) uses "Agendado/Agendamento" | — |
| **Export** | Exportar (verb) / Exportação (noun) | Power BI & Tableau agree | — |
| **Data Source** | Origem de Dados | Power BI & Tableau agree | — |
| **Role** | Função | Common enterprise RBAC rendering (Microsoft admin centers use "Função") | "Papel" is a plausible alternative but "Função" is the more standard rendering in Portuguese enterprise access-control UIs. |
| **Permission** | Permissão | Power BI & Tableau agree | — |
| **Report** | Relatório | Power BI & Tableau agree | Not used for Discoverer Neo's own "Map" object — reserved for describing generic reporting output/output format language. |
| **Dashboard** | Painel | Power BI: "Painéis" (Power BI Service nav). Tableau: "Painel". | Agrees across both references. |
| **Filter** | Filtro | Power BI & Tableau agree | Used generically (e.g. table filter inputs); the domain-specific WHERE-row concept is "Condition" (Condição) above. |
| **Sort** | Ordenar (verb) / Ordenação (noun) | Power BI & Tableau agree | — |
| **Drill Down** | Detalhar | Tableau's pt-PT context-menu action | Short enough for buttons/menu items, matches Tableau precedent (Power BI has no single fixed short label for this action). |
| **Drill Up** | Resumir | Paired with Detalhar | Symmetric short verb, avoids an awkward literal "subir ao nível anterior" in tight UI space. |
| **Crosstab / Pivot Table** | Tabela Cruzada (Crosstab) / Tabela Dinâmica (generic pivot table) | Power BI's closest visual is "Matriz" (Matrix); Excel/general BI usage: "Tabela Dinâmica". | Discoverer Neo's own map type is literally a crosstab layout, kept as "Tabela Cruzada" (matches classic Discoverer's own pt-PT rendering) rather than Power BI's differently-scoped "Matriz". |
| **Measure** | Medida | Power BI & Tableau agree | — |
| **Dimension** | Dimensão | Power BI & Tableau agree | — |
| **Column** | Coluna | Power BI & Tableau agree | — |
| **Row** | Linha | Power BI & Tableau agree | — |
| **Query** | Consulta | Power BI & Tableau agree | — |
| **Audit Log** | Registo de Auditoria | — | "Registo", not "Registro" (pt-PT vs pt-BR) — see conventions table. |
| **Security Policy** | Política de Segurança | — | Discoverer Neo's row-level security construct. |
| **Business Area Grant** | Concessão de Área de Negócio | — | "Grant" alone (as a UI noun, e.g. "Manage grants") renders as **Concessão**; "to grant access" as **conceder acesso**. |

## Terms encountered in-context but not in the original checklist

| Term | pt-PT rendering | Notes |
|---|---|---|
| Custom Function | Função Personalizada | SQL/PL-SQL/package function registered for calculated items — distinct sense of "Função" from the RBAC "Role" entry above; disambiguated by context (Funções Personalizadas vs Funções de utilizador never appear side by side in this app). |
| Data type | Tipo de Dados | — |
| Format mask | Máscara de Formato | Oracle-style format-mask string (`999,999.00`), kept literal since it's a technical term with no consumer-BI equivalent. |
| Business area/folder/map "grant" access levels (VIEW/EXPORT/EDIT/SCHEDULE/CREATE/DELETE) | Ver / Exportar / Editar / Agendar / Criar / Eliminar | Enum-like permission levels rendered as short verbs/infinitives to fit permission-picker UI. |
| Toast / notification | (not surfaced as a UI word — only the message content is translated) | — |
| Placeholder ("e.g. …") | "p. ex. …" | Standard pt-PT abbreviation for "por exemplo", replacing English "e.g." in placeholder text. |
| Workbook (legacy Discoverer artifact, distinct from Worksheet) | Livro | Matches Excel's own pt-PT localization ("Livro1.xlsx"), which is the term classic Discoverer's workbook/worksheet model was itself modeled after. Deliberately NOT "Pasta de trabalho" — collides with this app's "Pasta" (Folder), which means something unrelated. |
| Canvas (the map-builder drag-and-drop drop surface) | Quadro | Not "Tela" — reads as a Brazilian-Portuguese-flavored word here (tela doubles for "screen" in pt-BR) and this glossary's own convention table reserves the screen sense for "Ecrã". "Quadro" is unambiguous and short enough for hint text. |
