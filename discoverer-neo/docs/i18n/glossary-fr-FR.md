# fr-FR (France French) Glossary — Discoverer Neo

Terminology reference for translating Discoverer Neo's UI into France French. Every translator/reviewer (human or agent) should treat this file as the source of truth — if a string's natural translation conflicts with a term below, the term below wins.

The reference baseline is the France French localization of **Microsoft Power BI** (Desktop + Service) as the primary source, with **Tableau Desktop** as the fallback where Power BI has no equivalent concept. Microsoft's fr-FR localization is the more widely deployed enterprise standard, so where Power BI and Tableau disagree, Power BI wins unless noted otherwise.

## Locale conventions (apply everywhere, not just glossary terms)

Discoverer Neo targets **France French** (fr-FR), not Canadian/Belgian/Swiss French. Where those variants diverge on software vocabulary, use the France Microsoft rendering.

| Concept | fr-FR (use this) | Do NOT use |
|---|---|---|
| Save | Enregistrer | Sauvegarder |
| Delete | Supprimer | Effacer / Éliminer |
| Remove (from a list) | Retirer | Supprimer (reserved for Delete) |
| Log in / Sign in | Se connecter | S'identifier / Se loguer |
| Log out | Se déconnecter | Se déloguer / Sortir |
| Password | Mot de passe | — |
| Email | E-mail / adresse e-mail | Courriel (Québec) / mél |
| Upload | Charger | Téléverser (Québec) |
| Default | Par défaut | — |
| Settings | Paramètres | Réglages / Configuration |
| Log / record (noun, e.g. audit log) | Journal | Registre |
| Cancel | Annuler | — |

**Progressive / "…ing" states:** French has no progressive tense — render "Loading…" / "Saving…" as the deverbal noun form: "Chargement…", "Enregistrement…", "Suppression…", "Exécution…", "Importation…". Never the participle ("Chargeant…").

**Numbers & punctuation:** French uses a space as the thousands separator and a comma as the decimal separator (`1 234,00`), currency symbol after the amount with a space (`1 234,00 €`), and a space before `%` (`12,3 %`). A regular space precedes `:`, `;`, `?`, `!` and is used inside guillemets. User-facing quoted content uses French guillemets « … » rather than straight ASCII quotes. **Exception:** Oracle format-mask tokens (`DD-MON-YYYY`, `YYYY-MM-DD`, `999,999.00`) are technical literals the app applies verbatim — never localize them.

**Register:** formal, neutral, enterprise tone with the formal **"vous"** address throughout. Use the imperative-vous form for user instructions ("Sélectionnez…", "Saisissez…") and the infinitive for control/placeholder labels ("Sélectionner un dossier", "Rechercher…"). No exclamation marks, no consumer-app friendliness, no humor.

## Core domain terms

| Term | fr-FR rendering | Reference check | Notes |
|---|---|---|---|
| **Business Area** | Domaine d'activité | — (no Power BI/Tableau equivalent) | Discoverer/EUL-specific grouping above Folders. Translated plainly; matches Oracle's own historical French Discoverer rendering ("Domaine"). Capitalized as a proper feature name in headings. |
| **Folder** | Dossier | — (closest is Power BI's "table" in a semantic model) | EUL concept for an exposed table/view/derived query, not a filesystem folder. Matches Oracle's French Discoverer localization ("Dossier"). |
| **Item** | Élément | — | Column/calculation/condition/join-key exposed from a folder. Diverges from pt-PT (which kept the cognate "Item"): Oracle's French Discoverer used "Élément", and the bare English "Item" reads as untranslated in French. "Élément" is natural and unambiguous here. |
| **Join** | Jointure | Power BI: "Type de jointure" (Power Query Join Kind). Tableau: "Jointure". | Both agree on "Jointure" for the SQL-JOIN sense used here (distinct from Power Query "Fusionner" / Tableau data blending). |
| **Hierarchy** | Hiérarchie | Power BI & Tableau agree | No conflict. |
| **Map** (Discoverer Neo's saved-query object — replaces the classic "Workbook") | Carte | — (Discoverer Neo-specific term) | Literal translation of the product's own first-class object (builder, viewer, share, schedule), parallel to the pt-PT decision to keep it plain ("Mapa"). Deliberately NOT "Rapport" (Report) or "Tableau de bord" (Dashboard). Note the overlap with Power BI's "Carte" (Card/Map visual): harmless here because Discoverer Neo's map *types* are Tableau/Tableau croisé/Graphique/Page-Détail — "Carte" only ever denotes the top-level object, so context disambiguates. |
| **Worksheet** (legacy Discoverer artifact, appears in migration text) | Feuille de calcul | Tableau: "Feuille de calcul"; Excel fr-FR: "Feuille de calcul" | Classic Discoverer's tab within a workbook. Kept distinct from "Carte" since a migrated worksheet becomes one Map, not a tab inside it. |
| **Parameter** | Paramètre | Power BI & Tableau agree | — |
| **Condition** | Condition | — | Discoverer's term for a WHERE-clause filter row (this app exposes filtering as Conditions rather than a separate user-facing "Filter"). |
| **Calculated Field** | Champ calculé | Tableau: "Champ calculé". Power BI splits into "Colonne calculée" / "Mesure" with no single unifying term. | Followed Tableau — Discoverer Neo's calculated field (one formula, per-row or pushed to SQL) matches Tableau's single unified concept, not Power BI's split model. |
| **Aggregation** | Agrégation | Power BI & Tableau agree | — |
| **Schedule** (noun & verb) | Planification (noun) / Planifier (verb) | Power BI: "Actualisation planifiée" (scheduled refresh) uses "planifié/planification" | Followed Power BI over the alternative "Programmation/Programmer". |
| **Export** | Exporter (verb) / Exportation (noun) | Power BI & Tableau agree | — |
| **Data Source** | Source de données | Power BI & Tableau agree | — |
| **Role** | Rôle | Microsoft admin centers (fr-FR RBAC) use "Rôle" | Direct, standard rendering for an access-control role. |
| **Permission** | Autorisation | Power BI & Microsoft 365 fr-FR use "Autorisations"; Tableau: "Autorisations" | Followed Microsoft — "Autorisation" is the standard rendering. "Permission" as a French word exists but is less used in Microsoft enterprise UIs. |
| **Report** | Rapport | Power BI & Tableau agree | Not used for Discoverer Neo's "Map" (Carte) object — reserved for generic reporting/output language. |
| **Dashboard** | Tableau de bord | Power BI & Tableau agree | — |
| **Filter** | Filtre | Power BI & Tableau agree | Generic (e.g. table filter inputs); the domain-specific WHERE-row concept is "Condition" above. |
| **Sort** | Trier (verb) / Tri (noun) | Power BI: "Trier" / "Ordre de tri". Tableau: "Trier". | — |
| **Drill Down** | Explorer vers le bas | Power BI: "Exploration" / "Explorer vers le bas". Tableau: "Descendre d'un niveau". | Followed Power BI's "exploration" framing (hence "hiérarchies d'exploration" for drill-down hierarchies). |
| **Drill Up** | Explorer vers le haut | Paired with the above; Tableau: "Monter d'un niveau". | Symmetric with Drill Down; kept short for tight UI. |
| **Crosstab / Pivot Table** | Tableau croisé (crosstab) / Tableau croisé dynamique (generic pivot table) | Power BI's closest visual is "Matrice" (Matrix). Tableau & Excel fr-FR: "Tableau croisé" / "Tableau croisé dynamique". | Discoverer Neo's own map type is a crosstab layout, kept as "Tableau croisé" (matches Tableau and classic Discoverer) rather than Power BI's differently-scoped "Matrice". |
| **Measure** | Mesure | Power BI & Tableau agree | — |
| **Dimension** | Dimension | Power BI & Tableau agree | — |
| **Column** | Colonne | Power BI & Tableau agree | — |
| **Row** | Ligne | Power BI & Tableau agree | — |
| **Query** | Requête | Power BI & Tableau agree | — |
| **Audit Log** | Journal d'audit | Microsoft 365 fr-FR: "Journal d'audit" | "Journal", not "Registre" — see conventions table. |
| **Security Policy** | Stratégie de sécurité | Microsoft fr-FR uses "Stratégie" for policy (stratégie de groupe, stratégie de sécurité) | Discoverer Neo's row-level security construct; row-level security = "sécurité au niveau des lignes" (Power BI RLS rendering). |
| **Business Area Grant** | Octroi d'accès (au domaine d'activité) | — | "Grants" as a UI/report noun (e.g. migration counts) renders as **Octrois d'accès**; the admin "Manage grants" action renders as **Gérer les accès** (reads more naturally than "Gérer les octrois"); "to grant access" as **accorder l'accès**; "access revoked" as **Accès révoqué**. |

## Terms encountered in-context but not in the original checklist

| Term | fr-FR rendering | Notes |
|---|---|---|
| Custom Function | Fonction personnalisée | SQL/PL-SQL/package function registered for calculated items — distinct sense of "fonction" from the RBAC "Role" entry (rendered "Rôle"), so no collision. |
| Data type | Type de données | — |
| Format mask | Masque de format | Oracle-style format-mask string (`999,999.00`), kept as a literal technical token — never localized. |
| Grant access levels (VIEW / EXPORT / EDIT / SCHEDULE / CREATE / DELETE) | Afficher / Exporter / Modifier / Planifier / Créer / Supprimer | Enum-like permission levels as short infinitives to fit the permission-picker UI. Share-dialog levels "Can view/export/edit" → "Peut consulter / exporter / modifier". |
| Dry run (migration: validate without writing) | Simulation | Clearer than a literal "exécution à blanc"; used consistently for the noun and paired verb ("Lancer une simulation"). |
| Reconciliation (post-migration row-count check) | Rapprochement | Standard French for a data/accounting reconciliation. |
| Introspect / Introspection (read schema metadata) | Introspecter / Introspection | Kept as the technical cognate (real French tech usage), parallel to pt-PT; distinct from migration "Analyze" (Analyser). |
| Canvas (the map-builder drag-and-drop drop surface) | Zone de travail | Power BI's report canvas is "Canevas", but "se trouve dans la zone de travail" reads more naturally than "sur le canevas" for this drop surface. Kept consistent across builder hints. |
| Workbook (legacy Discoverer artifact, distinct from Worksheet) | Classeur | Matches Excel's own fr-FR localization, the model classic Discoverer's workbook/worksheet structure was based on. The literal migrated business-area name "Migrated Workbooks" is kept **untranslated** (it is a real object name created server-side) inside quotes. |
| Placeholder ("e.g. …") | "p. ex. …" | Standard fr-FR abbreviation for "par exemple", replacing English "e.g." in placeholder text. |
| Readiness (migration score) | Préparation | Migration readiness score label. |
| Timestamp | Horodatage | Audit-log column header. |
| Host | Hôte | Data-source connection field. |
