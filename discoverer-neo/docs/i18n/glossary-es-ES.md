# es-ES (European Spanish) Glossary — Discoverer Neo

Terminology reference for translating Discoverer Neo's UI into European Spanish. Every translator/reviewer (human or agent) should treat this file as the source of truth — if a string's natural translation conflicts with a term below, the term below wins.

The reference baseline is the European Spanish localization of **Microsoft Power BI** (Desktop + Service) as the primary source, with **Tableau Desktop** as the fallback where Power BI has no equivalent concept. Microsoft's es-ES localization is the more widely deployed enterprise standard, so where Power BI and Tableau disagree, Power BI wins unless noted otherwise. For database/SQL-level concepts (JOIN, predicate, WHERE clause) the authoritative reference is **Microsoft SQL Server** documentation in es-ES.

## Locale conventions (apply everywhere, not just glossary terms)

Discoverer Neo targets **European Spanish** (es-ES, Spain), not Latin-American Spanish (es-419/es-MX). Where those variants diverge on software vocabulary, use the Spain Microsoft rendering. Microsoft distinguishes es-ES from es-MX, so follow the Spain build (e.g. "Ordenador" sense, "vídeo", euro currency, "Aceptar/Cancelar" dialog verbs).

| Concept | es-ES (use this) | Do NOT use |
|---|---|---|
| Save | Guardar | Salvar |
| Delete | Eliminar | Borrar (reserved for Clear) / Suprimir |
| Remove (from a list) | Quitar | Eliminar (reserved for Delete) / Remover |
| Clear (empty a field) | Borrar | Limpiar / Despejar |
| Add | Agregar | Añadir (understood, but Microsoft es-ES pairs "Agregar o quitar") |
| Log in / Sign in | Iniciar sesión | Loguearse / Entrar / Acceder |
| Log out | Cerrar sesión | Salir / Desconectarse |
| Password | Contraseña | Clave / Palabra clave |
| Email | Correo electrónico | E-mail / Mail / Correo-e |
| Upload | Cargar | Subir / Cargar archivo |
| Download | Descargar | Bajar / Descarga |
| Default | Predeterminado | Por defecto / Predefinido |
| Settings | Configuración | Ajustes / Opciones / Preferencias |
| Log / record (noun, e.g. audit log) | Registro | Bitácora / Log |
| Cancel | Cancelar | — |

**Progressive / "…ing" states:** Spanish *does* have a progressive (estar + gerundio), and Microsoft es-ES uses the gerund for transient states — render "Loading…" / "Saving…" as "Cargando…", "Guardando…", "Eliminando…", "Ejecutando…", "Importando…", "Buscando…". This differs from the fr-FR glossary (French has no progressive and uses deverbal nouns); in Spanish the gerund is correct and natural.

**Numbers & punctuation:** European Spanish uses a **period** as the thousands separator and a **comma** as the decimal separator (`1.234,00`), following the Microsoft es-ES rendering (RAE also permits a non-breaking space for groups of 4+ digits; Microsoft uses the period, which this project follows for consistency). The euro symbol follows the amount with a space (`1.234,00 €`), and a space precedes `%` (`12,3 %`) and unit abbreviations (`30 s`, `120 px`). User-facing quoted content uses Spanish angular quotes «…» (comillas latinas) — **without inner spaces** (`«texto»`), unlike French guillemets which require spaces. **Exception:** Oracle format-mask tokens (`DD-MON-YYYY`, `YYYY-MM-DD`, `999,999.00`) are technical literals the app applies verbatim — never localize them. SQL keywords surfaced to the user (`AND`, `WHERE`) are kept as literals.

**Register:** formal, neutral, enterprise tone with the formal **"usted"** address throughout. Use the imperative-usted form for user instructions ("Seleccione…", "Introduzca…", "Guarde…", "Agregue…") and the infinitive/noun for short control, filter and search labels ("Buscar…", "Filtrar elementos…", "Configurar columna"). Select-dropdown placeholders that read as a prompt use the imperative ("Seleccione un usuario") — the dominant Microsoft es-ES pattern. Welcome copy uses the gender-neutral formal "Le damos la bienvenida" rather than the gendered "Bienvenido/a". No exclamation marks, no consumer-app friendliness, no humor.

## Core domain terms

| Term | es-ES rendering | Reference check | Notes |
|---|---|---|---|
| **Business Area** | Área de negocio | — (no Power BI/Tableau equivalent) | Discoverer/EUL-specific grouping above Folders. Translated plainly. Note the article agreement: "un área", "esta área", "ningún área", "la misma área" (feminine noun with stressed initial /a/). |
| **Folder** | Carpeta | — (closest is Power BI's "tabla" in a semantic model) | EUL concept for an exposed table/view/derived query, not a filesystem folder. "Carpeta" is the standard es-ES rendering and matches Oracle's own historical Discoverer localization. |
| **Item** | Elemento | — | Column/calculation/condition/join-key exposed from a folder. Chose "Elemento" (matches fr-FR "Élément") over the bare cognate "Item" (which pt-PT kept): "elemento" is the standard Microsoft es-ES word and the English "Item" reads as untranslated in Spanish. |
| **Join** | Combinación | Microsoft SQL Server es-ES: "combinación" (INNER JOIN = "combinación interna", OUTER = "combinación externa"). Power Query es-ES: "Tipo de combinación" (Join Kind). Tableau: "combinación". | All three Microsoft references agree on "combinación" for the SQL-JOIN sense used here. "Join Type" → "Tipo de combinación". Not "Unión" (that is SQL UNION) and not "Fusión/Combinar" (Power Query merge action). |
| **Hierarchy** | Jerarquía | Power BI & Tableau agree | No conflict. |
| **Map** (Discoverer Neo's saved-query object — replaces the classic "Workbook") | Mapa | — (Discoverer Neo-specific term) | Literal translation of the product's own first-class object (builder, viewer, share, schedule), parallel to the pt-PT/fr-FR decision to keep it plain ("Mapa"/"Carte"). Deliberately NOT "Informe" (Report) or "Panel" (Dashboard). |
| **Worksheet** (legacy Discoverer artifact, appears in migration text) | Hoja de trabajo | Excel es-ES worksheet: "Hoja"/"Hoja de cálculo" | Classic Discoverer's tab within a workbook. Kept as "Hoja de trabajo" (distinct from "Mapa"), since a migrated worksheet becomes one Map, not a tab inside it. Avoided plain "Hoja" to keep it unambiguous in migration copy. |
| **Parameter** | Parámetro | Power BI & Tableau agree | — |
| **Condition** | Condición | — | Discoverer's term for a WHERE-clause filter row (this app exposes filtering as Conditions rather than a separate user-facing "Filter"). |
| **Calculated Field** | Campo calculado | Tableau: "Campo calculado". Power BI splits into "Columna calculada" / "Medida" with no single unifying term. | Followed Tableau — Discoverer Neo's calculated field (one formula, per-row or pushed to SQL) matches Tableau's single unified concept, not Power BI's split model. |
| **Aggregation** | Agregación | Power BI & Tableau agree | — |
| **Schedule** (noun & verb) | Programación (noun) / Programar (verb) | Power BI: "Actualización programada" (scheduled refresh) uses "programado/programación" | Followed Power BI over the alternative "Planificación/Planificar". "Scheduled" → "programado/programada". |
| **Export** | Exportar (verb) / Exportación (noun) | Power BI & Tableau agree | — |
| **Data Source** | Origen de datos | Power BI/Power Query es-ES: "Origen de datos". Tableau es-ES: "Fuente de datos". | **Power BI and Tableau disagree.** Followed Power BI's "Origen de datos" per the primary-reference rule (Microsoft es-ES is the wider enterprise standard). |
| **Role** | Rol | Microsoft admin centers / Azure RBAC es-ES: "Rol" | Direct, standard rendering for an access-control role. Plural "Roles". |
| **Permission** | Permiso | Power BI, Microsoft 365 & Tableau es-ES: "Permisos" | Standard Microsoft rendering. |
| **Report** | Informe | Power BI & Tableau agree ("Informe") | Reserved for generic reporting language; not used for Discoverer Neo's "Map" (Mapa) object. |
| **Dashboard** | Panel | Power BI: "Panel" (Power BI Service). Tableau: "Panel"/"Dashboard". | Followed Power BI's "Panel". Used both for the BI concept and for the app's home/overview nav item. |
| **Filter** | Filtro | Power BI & Tableau agree | Generic (e.g. table filter inputs); the domain-specific WHERE-row concept is "Condición" above. |
| **Sort** | Ordenar (verb) / Ordenación (noun) | Power BI/Excel es-ES: "Ordenar" / "Orden de clasificación" | "Sort order" → "Orden de clasificación"; "Sort direction" → "Dirección de ordenación"; "Ascending/Descending" → "Ascendente/Descendente". |
| **Drill Down** | Explorar en profundidad / Profundizar | Power BI es-ES uses the "explorar en profundidad" framing | Rendered drill-down hierarchies as "jerarquías de exploración en profundidad". Short verb "Profundizar" available where space is tight. Tableau's context-menu equivalent is "Bajar un nivel". |
| **Drill Up** | Explorar hacia arriba / Reducir detalle | Paired with the above | Symmetric with Drill Down; Tableau: "Subir un nivel". (Neither surfaces as a bare button in the current strings — only the "drill-down hierarchies" description does.) |
| **Crosstab / Pivot Table** | Tabla cruzada (crosstab) / Tabla dinámica (generic pivot table) | Excel/Power BI es-ES pivot: "Tabla dinámica". Power BI matrix visual: "Matriz". Tableau crosstab: "Tabla de referencias cruzadas". | Discoverer Neo's own map type is a crosstab layout, rendered as the concise **"Tabla cruzada"** for the compact map-type selector. Tableau's full es-ES term "Tabla de referencias cruzadas" is precise but too long for a button (conciseness rule); "Tabla cruzada" is the shorter idiomatic form and unambiguous next to "Tabla"/"Gráfico". Not Power BI's differently-scoped "Matriz". |
| **Measure** | Medida | Power BI & Tableau agree | — |
| **Dimension** | Dimensión | Power BI & Tableau agree | — |
| **Column** | Columna | Power BI & Tableau agree | — |
| **Row** | Fila | Power BI & Excel es-ES: "Fila" | Note: diverges from pt-PT "Linha"/fr-FR "Ligne" — Spanish for a data row is "Fila", not "Línea". |
| **Query** | Consulta | Power BI & Tableau agree | — |
| **Audit Log** | Registro de auditoría | Microsoft 365 es-ES: "Registro de auditoría" | "Registro", per the conventions table. |
| **Security Policy** | Directiva de seguridad | Microsoft es-ES uses "Directiva" for policy (Directiva de grupo, Directivas de acceso condicional) | **Followed Microsoft's "Directiva"** over the common alternative "Política de seguridad". Microsoft's es-ES enterprise localization consistently renders "policy" as "directiva". Row-level security → "seguridad de nivel de fila" (Power BI RLS rendering). |
| **Business Area Grant** | Concesión de área de negocio | — | "Grant" alone (as a UI/report noun, e.g. migration counts, "Manage grants") renders as **Concesión / Concesiones**; "to grant access" as **conceder acceso**; "access granted/revoked" as **Acceso concedido / Acceso revocado**. |

## Terms encountered in-context but not in the original checklist

| Term | es-ES rendering | Notes |
|---|---|---|
| Custom Function | Función personalizada | SQL/PL-SQL/package function registered for calculated items — distinct sense of "función" from the RBAC "Role" entry (rendered "Rol"), so no collision. |
| Data type | Tipo de datos | — |
| Format mask | Máscara de formato | Oracle-style format-mask string (`999,999.00`), kept as a literal technical token — never localized. |
| Grant access levels (VIEW / EXPORT / EDIT / SCHEDULE / CREATE / DELETE) | Ver / Exportar / Editar / Programar / Crear / Eliminar | Enum-like permission levels as short infinitives to fit the permission-picker UI. Share-dialog levels "Can view/export/edit" → "Puede ver / Puede exportar / Puede editar". |
| Dry run (migration: validate without writing) | Simulación | Clearer than a literal "ejecución en seco/de prueba"; used consistently for the noun and paired verb ("Ejecutar simulación"). |
| Reconciliation (post-migration row-count check) | Conciliación | Standard es for a data/accounting reconciliation. "row counts match" → "los recuentos de filas coinciden"; "MISMATCH" → "NO COINCIDE". |
| Introspect / Introspection (read schema metadata) | Inspeccionar (verb) / Inspección (noun) | **Diverges from fr-FR/pt-PT**, which kept the cognate ("Introspecter"/"Introspetar"). In es the cognate verb "introspeccionar" is awkward/rare in tech usage; "Inspeccionar esquema" / "Inspección" reads naturally and keeps three distinct verbs alongside "Descubrir" (discover tables) and "Detectar" (detect version). |
| Discover / Discovery (list tables to import) | Descubrir / descubrimiento | "Discover Tables" → "Descubrir tablas"; kept distinct from "Detectar" (Detect version) and "Inspeccionar" (Introspect schema). |
| Canvas (the map-builder drag-and-drop drop surface) | Lienzo | **Diverges from fr-FR/pt-PT** (which avoided the literal canvas word). Power BI es-ES uses "Lienzo" for its report canvas, so it is the correct primary-reference term and is cleanly distinct from "espacio de trabajo" (workspace). "«{{name}}» ya está en el lienzo." |
| Workbook (legacy Discoverer artifact, distinct from Worksheet) | Libro | Matches Excel's own es-ES localization ("Libro1.xlsx"), the model classic Discoverer's workbook/worksheet structure was based on. The literal migrated business-area name "Migrated Workbooks" is kept **untranslated** (a real server-side object name) inside «…». |
| Placeholder ("e.g. …") | "p. ej. …" | Standard es abbreviation for "por ejemplo", replacing English "e.g." in placeholder text. |
| Readiness (migration score) | Preparación | Migration readiness score label. |
| Timestamp | Marca de tiempo | Microsoft es-ES rendering; audit-log column header. |
| Host | Host | Data-source connection field. Kept as-is (widely understood, standard in es-ES DB-connection dialogs) alongside "Puerto" (Port) and "SID". |
| Endpoint | Punto de conexión | Azure es-ES rendering, used in the dashboard tooltip. |
| Display name | Nombre para mostrar | Microsoft es-ES standard. |
| Placeholder (UI element) | Marcador de posición | Microsoft es-ES rendering (mapsList placeholder page). |
| Trigger (a scheduled run) | Iniciar la ejecución | Rendered the "Trigger failed" toast as "Error al iniciar la ejecución" for user clarity (Microsoft's literal "desencadenar" is correct but reads as jargon here). |
| Binds (SQL bind variables listed under a predicate) | Enlaces | Short label mirroring fr-FR "Liaisons"; no space before the colon in es. |
| Array (JSON) | Matriz | Microsoft es-ES renders JSON "array" as "matriz" ("matriz JSON"). |
| Blockers (migration assessment) | Bloqueadores | Issues that block migration. |
| Workspace | Espacio de trabajo | Kept distinct from "Lienzo" (Canvas). |
| Welcome | Le damos la bienvenida | Gender-neutral formal form (usted), Microsoft es-ES standard, over the gendered "Bienvenido". |
