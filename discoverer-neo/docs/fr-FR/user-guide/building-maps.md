# Création de cartes

Découvrez comment créer des cartes (requêtes enregistrées) à l'aide du générateur de cartes interactif.

## Qu'est-ce qu'une carte ?

Une **carte** est une définition de requête enregistrée qui précise :
- Les colonnes de données (éléments) à afficher
- Les lignes à filtrer (conditions)
- La manière de trier et d'agréger les résultats
- Les paramètres qui rendent la requête interactive
- Les champs calculés pour la logique métier

## Types de carte

Discoverer Neo prend en charge quatre types de carte :

| Type | Cas d'usage |
|------|----------|
| **TABLE** | Affichage tabulaire des résultats, valeur par défaut pour la plupart des requêtes |
| **CROSSTAB** | Vue en tableau croisé (lignes × colonnes) |
| **PAGE_DETAIL** | Disposition maître-détail (exploration vers le bas) |
| **CHART** | Représentations visuelles (barres, courbes, secteurs, etc.) |

## Créer une carte

### Étape 1 : Lancer le générateur de cartes

1. Cliquez sur **Domaines d'activité** → sélectionnez un domaine d'activité
2. Cliquez sur **Créer une carte** (ou **+ Nouvelle carte**)
3. Saisissez :
   - **Nom** — Titre de la carte (obligatoire)
   - **Description** — Description facultative
   - **Type de carte** — Choisissez TABLE, CROSSTAB, PAGE_DETAIL ou CHART
4. Cliquez sur **Suivant** ou **Créer**

### Étape 2 : Sélectionner les éléments (colonnes)

Les éléments sont les colonnes/champs que vous souhaitez afficher.

1. Dans le panneau **Éléments**, cliquez sur **+ Ajouter un élément**
2. Sélectionnez parmi les éléments disponibles dans le dossier
3. Réorganisez-les en les faisant glisser
4. Pour chaque élément, vous pouvez configurer :
   - **Nom d'affichage** — En-tête de colonne (par défaut, le nom de l'élément)
   - **Sens du tri** — ASC (croissant) ou DESC (décroissant)
   - **Ordre de tri** — 1, 2, 3… pour un tri multicolonne
   - **Fonction d'agrégation** — SUM, COUNT, AVG, MIN, MAX (pour les éléments numériques)
   - **Largeur d'affichage** — Largeur de colonne en pixels (facultatif)
   - **Masque de format** — Mise en forme des dates/nombres (facultatif)

**Exemple :** pour un rapport de ventes :
- CUSTOMER_NAME (nom d'affichage : « Client », ordre de tri 1)
- AMOUNT (agrégation : SUM)
- SALE_DATE (masque de format : « YYYY-MM-DD »)

### Étape 3 : Ajouter des conditions (filtres)

Les conditions filtrent les lignes qui apparaissent dans les résultats.

1. Cliquez sur **+ Ajouter une condition**
2. Sélectionnez un **élément** à filtrer
3. Choisissez un **opérateur** :
   - `=` — Égal à
   - `<>` — Différent de
   - `>` — Supérieur à
   - `<` — Inférieur à
   - `>=` — Supérieur ou égal à
   - `<=` — Inférieur ou égal à
   - `LIKE` — Correspondance de motif (%)
   - `IN` — Plusieurs valeurs
   - `BETWEEN` — Plage
   - `IS_NULL` — Aucune valeur
4. Saisissez une **valeur** ou choisissez un **paramètre**
5. Définissez l'**opérateur logique** (AND/OR) en cas de conditions multiples

**Exemple :** afficher uniquement les ventes de 2026 :
- Élément : SALE_DATE
- Opérateur : >=
- Valeur : 2026-01-01

**Condition paramétrée :** rendez une condition interactive en la liant à un **paramètre** (voir l'étape 4).

### Étape 4 : Ajouter des paramètres

Les paramètres rendent les cartes interactives en invitant les utilisateurs à saisir une valeur lors de l'exécution.

1. Cliquez sur **+ Ajouter un paramètre**
2. Saisissez :
   - **Nom** — Identifiant unique (lettres, chiffres et traits de soulignement uniquement, p. ex. `start_date`)
   - **Type** — STRING, NUMBER, DATE, LIST
   - **Valeur par défaut** — Valeur par défaut facultative (utilisée si le paramètre n'est pas fourni)
   - **Obligatoire** — Si coché, l'utilisateur doit fournir une valeur

3. Utilisez le paramètre dans une condition en le sélectionnant à la place d'une valeur statique

**Exemple :** créez un paramètre DATE `end_date` et utilisez-le dans une condition :
- Élément : SALE_DATE
- Opérateur : <=
- Valeur : <parameter: end_date>

Lors de l'exécution de la carte, les utilisateurs seront invités à saisir une date de fin.

### Étape 5 : Ajouter des champs calculés (facultatif)

Les champs calculés produisent de nouvelles colonnes à l'aide d'expressions SQL.

1. Cliquez sur **+ Ajouter un champ calculé**
2. Saisissez :
   - **Nom** — Nom du champ (p. ex. `REVENUE_PERCENT`)
   - **Formule** — Expression SQL (p. ex. `AMOUNT * QUANTITY`)

**Exemple :**
- Nom : `MARGIN_PCT`
- Formule : `(AMOUNT - COST) / AMOUNT * 100`

Les formules peuvent faire référence à :
- Des noms d'éléments (p. ex. `AMOUNT`, `QUANTITY`)
- Des fonctions SQL (p. ex. `UPPER(CUSTOMER_NAME)`, `TRUNC(SALE_DATE)`)
- Des fonctions de fenêtrage (p. ex. `SUM(AMOUNT) OVER (PARTITION BY CUSTOMER_ID)`)

### Étape 6 : Enregistrer la carte

1. Cliquez sur **Enregistrer la carte**
2. Vérifiez le récapitulatif
3. Cliquez sur **Confirmer**

La carte est désormais enregistrée et disponible dans votre liste **Mes cartes**.

## Modifier une carte

1. Cliquez sur **Cartes** → recherchez votre carte → cliquez sur **Modifier**
2. Modifiez les éléments, conditions, paramètres ou champs calculés
3. Cliquez sur **Enregistrer**

## Conseils sur le générateur de cartes

### Requêtes multidossiers

Pour interroger des données provenant de plusieurs dossiers, vous devez d'abord définir des **jointures** entre eux. Contactez votre administrateur.

### Tri

- Définissez l'**ordre de tri** (1, 2, 3…) pour un tri multicolonne
- Seuls les éléments dotés d'un ordre de tri apparaissent dans le tri
- Les ordres de tri les plus élevés sont appliqués après les ordres inférieurs

### Agrégation

Lorsque vous ajoutez une fonction d'agrégation (SUM, COUNT, etc.) à un élément :
- Les résultats sont automatiquement regroupés par les éléments non agrégés
- Les éléments agrégés sont calculés par groupe

**Exemple :** pour obtenir le total des ventes par client :
- Ajoutez CUSTOMER_NAME (sans agrégation, ordre de tri 1)
- Ajoutez AMOUNT (agrégation : SUM)
- Résultat : une ligne par client avec le total des ventes

### Nommage des paramètres

Les noms de paramètres doivent :
- Commencer par une lettre (A-Z, a-z)
- Contenir uniquement des lettres, des chiffres et des traits de soulignement
- Exemples de noms corrects : `start_date`, `region_code`, `customer_id`

## Et ensuite ?

- **[Exécution de cartes](executing-maps.md)** — Exécuter votre carte et consulter les résultats
- **[Exportation de données](exporting-data.md)** — Enregistrer les résultats au format Excel ou CSV
- **[Partage de cartes](sharing.md)** — Partager avec d'autres utilisateurs

---

**Voir aussi :** [Guide de l'utilisateur](../user-guide/), [Guide de l'administrateur - Métadonnées](../admin-guide/metadata-management.md)
