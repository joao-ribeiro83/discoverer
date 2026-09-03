# Gestion des métadonnées

Découvrez comment organiser et gérer la hiérarchie des métadonnées : domaines d'activité, dossiers, éléments, jointures et hiérarchies.

## Hiérarchie des métadonnées

Discoverer Neo organise les données selon une hiérarchie :

```
Business Area (e.g., "Sales")
└── Folder (e.g., "CUSTOMERS" table)
    ├── Item (e.g., "CUSTOMER_ID" column)
    ├── Item (e.g., "CUSTOMER_NAME" column)
    └── Item (e.g., "REGION" column)
```

## Domaines d'activité

Un **domaine d'activité** est un regroupement logique de données et de requêtes associées. Exemples : Ventes, Finance, RH, Marketing.

### Créer un domaine d'activité

1. Panneau d'administration → **Domaines d'activité**
2. Cliquez sur **+ Créer un domaine d'activité**
3. Saisissez :
   - **Nom** — Nom unique (obligatoire)
   - **Description** — Vue d'ensemble facultative
4. Cliquez sur **Créer**

Le domaine est créé mais vide. Ajoutez ensuite des dossiers et des éléments.

### Modifier un domaine d'activité

1. Cliquez sur le domaine d'activité
2. Modifiez le **Nom** et la **Description**
3. Cliquez sur **Enregistrer**

### Accorder des autorisations

Les utilisateurs ont besoin d'un accès aux domaines d'activité avant de pouvoir les utiliser. Consultez [Gestion des utilisateurs](user-management.md).

### Supprimer un domaine d'activité

1. Cliquez sur **Supprimer** (suppression réversible)
2. Confirmez

Le domaine archivé et tout son contenu restent dans la base de données, mais sont marqués comme inactifs.

## Dossiers

Un **dossier** représente une table ou une vue issue d'une source de données. Les dossiers contiennent des éléments (colonnes).

### Créer un dossier (manuel)

1. Ouvrez le domaine d'activité → onglet **Dossiers**
2. Cliquez sur **+ Créer un dossier**
3. Saisissez :
   - **Nom** — Nom du dossier (p. ex. « CUSTOMERS »)
   - **Type de dossier** — TABLE, VIEW, DERIVED, COMPLEX, JOIN ou SUMMARY
   - **Source de données** — Sélectionnez une source Oracle ou Postgres
   - **Schéma** — Schéma de base de données (p. ex. « SALES »)
   - **Nom de la table** — Nom de la table de base de données
   - **Description** — Notes facultatives
4. Cliquez sur **Créer**

### Créer un dossier (introspection Oracle)

Importez automatiquement des tables/vues depuis Oracle :

1. Ouvrez le domaine d'activité → onglet **Dossiers**
2. Cliquez sur **Introspecter** ou **+ Importer depuis Oracle**
3. Sélectionnez :
   - **Source de données** — Connexion Oracle
   - **Schéma** — Schéma à parcourir
   - **Objets** — Sélectionnez les tables/vues (liste à cases à cocher)
4. Cliquez sur **Importer**

Les dossiers et les éléments sont créés automatiquement avec les types et les correspondances de colonnes appropriés.

### Types de dossier

| Type | Cas d'usage |
|------|----------|
| **TABLE** | Table physique de base de données |
| **VIEW** | Vue de base de données |
| **DERIVED** | Dossier personnalisé fondé sur du SQL |
| **COMPLEX** | Dossier multitable avec jointures |
| **JOIN** | Résultat pré-joint de plusieurs tables |
| **SUMMARY** | Table de synthèse pré-agrégée |

### Partager un dossier entre domaines d'activité

Un dossier appartient à un domaine d'activité **propriétaire**, mais peut être
*partagé* avec d'autres — comme Oracle Discoverer permet à un dossier
d'apparaître dans plusieurs domaines à la fois. Une dimension de date ou
d'organisation partagée est le cas courant.

1. Panneau d'administration → **Dossiers**
2. Cliquez sur l'icône de **partage** sur la ligne du dossier
3. Choisissez un domaine sous **Partager avec** puis cliquez sur **Partager**

Le dossier apparaît désormais dans les deux domaines. Dans tout domaine qui n'en
est pas propriétaire, il porte un badge **Partagé**, afin que personne ne le
modifie en croyant que le changement est local — les modifications s'appliquent
partout.

Pour arrêter le partage, rouvrez la même boîte de dialogue et retirez le badge.
Le domaine **propriétaire** ne peut pas être retiré ; pour déplacer un dossier,
recréez-le à destination.

> **Migration depuis Discoverer :** toutes les appartenances `BA_OBJ_LINKS` sont
> conservées. Un dossier qui appartenait à trois domaines les garde tous les
> trois — un comme propriétaire et deux comme partages.

### Modifier un dossier

1. Cliquez sur le dossier → **Modifier**
2. Modifiez les métadonnées (nom, description, type)
3. Cliquez sur **Enregistrer**

**Remarque :** modifier le nom de la table/du schéma après la création peut casser les cartes existantes. Procédez avec prudence.

### Supprimer un dossier

1. Cliquez sur le dossier → **Supprimer**
2. Confirmez

Les cartes utilisant ce dossier deviennent inutilisables. Les utilisateurs voient des erreurs lors de leur exécution.

## Éléments

Un **élément** est une colonne ou un attribut issu d'un dossier. Les éléments sont ce que les utilisateurs sélectionnent dans le générateur de cartes.

### Créer un élément (manuel)

1. Ouvrez le dossier → onglet **Éléments**
2. Cliquez sur **+ Ajouter un élément**
3. Saisissez :
   - **Nom** — Nom de l'élément (p. ex. « CUSTOMER_ID »)
   - **Type de données** — VARCHAR, NUMBER, DATE, CLOB, etc.
   - **Nom d'affichage** — Libellé convivial (par défaut, le nom)
   - **Nom de colonne** — Colonne réelle de la base de données
   - **Description** — Texte d'aide pour les utilisateurs
   - **Type** — voir le tableau ci-dessous. **CO** (Élément de base de données)
     est le choix habituel : un élément adossé à une colonne réelle. **CI** est
     un élément *créé* — un calcul.
   - **Est une clé** — Case à cocher s'il s'agit d'une clé primaire/étrangère
   - **Est masqué** — Case à cocher pour exclure du générateur de cartes
   - **Est obligatoire** — Case à cocher s'il doit toujours être inclus
4. Cliquez sur **Créer**

### Créer des éléments (depuis Oracle)

Lors de l'introspection d'une table, les éléments sont créés automatiquement pour toutes les colonnes.

### Configurer l'affichage d'un élément

Pour chaque élément, définissez :

- **Nom d'affichage** — Son apparence dans le générateur de cartes et les résultats
- **Ordre d'affichage** — Position dans la liste (les numéros les plus bas d'abord)
- **Masque de format** — Mise en forme des nombres/dates
  - Date : `YYYY-MM-DD`, `MM/DD/YYYY`, etc.
  - Nombre : `9,999.00`, `$9999`, etc.

### Modifier un élément

1. Cliquez sur l'élément → **Modifier**
2. Modifiez les propriétés
3. Cliquez sur **Enregistrer**

### Masquer/Afficher un élément

Basculez **Est masqué** pour exclure du générateur de cartes ou y inclure l'élément. Utile pour :
- Les colonnes internes que les utilisateurs ne doivent pas sélectionner
- Les colonnes réservées aux calculs
- Les champs obsolètes

### Supprimer un élément

1. Cliquez sur l'élément → **Supprimer**
2. Confirmez

Les cartes sélectionnant cet élément deviennent inutilisables.

## Jointures

Une **jointure** définit une relation entre deux dossiers.

### Créer une jointure

1. Ouvrez le domaine d'activité → onglet **Jointures**
2. Cliquez sur **+ Créer une jointure**
3. Saisissez :
   - **Nom** — Nom de la jointure (p. ex. « Clients vers Commandes »)
   - **Dossier 1** — Dossier de gauche
   - **Dossier 2** — Dossier de droite
   - **Type de jointure** — INNER, LEFT, RIGHT, FULL
   - **Conditions** — Prédicats de jointure (voir ci-dessous)
4. Cliquez sur **Créer**

### Conditions de jointure

Chaque jointure comporte une ou plusieurs conditions reliant des colonnes :

1. Cliquez sur **+ Ajouter une condition**
2. Sélectionnez :
   - **Élément 1** — Colonne du dossier 1
   - **Opérateur** — = (égal à)
   - **Élément 2** — Colonne du dossier 2
3. Ajoutez d'autres conditions si nécessaire (chaînage AND)

**Exemple :** jointure CUSTOMERS vers ORDERS :
```
CUSTOMERS.CUSTOMER_ID = ORDERS.CUSTOMER_ID
```

### Types de jointure

| Type | Résultat |
|------|--------|
| **INNER** | Uniquement les lignes correspondant aux deux dossiers |
| **LEFT** | Toutes les lignes du dossier 1, correspondance dans le dossier 2 ou NULL |
| **RIGHT** | Toutes les lignes du dossier 2, correspondance dans le dossier 1 ou NULL |
| **FULL** | Toutes les lignes des deux dossiers (avec NULL) |

### Requêtes multitables

Les utilisateurs sélectionnent des éléments de plusieurs dossiers dans une carte. Discoverer Neo applique automatiquement les jointures nécessaires.

**Exemple :**
```
Map selects:
- CUSTOMERS.CUSTOMER_NAME (folder A)
- ORDERS.ORDER_DATE (folder B)
- ORDERS.AMOUNT (folder B)

Auto-applies: CUSTOMERS-to-ORDERS join
```

### Modifier une jointure

1. Cliquez sur la jointure → **Modifier**
2. Modifiez le nom, le type ou les conditions
3. Cliquez sur **Enregistrer**

### Supprimer une jointure

1. Cliquez sur la jointure → **Supprimer**
2. Les cartes sélectionnant dans les deux dossiers ne peuvent plus s'exécuter

## Hiérarchies

Une **hiérarchie** permet la navigation par exploration vers le bas sur les dimensions. Exemple : Année → Mois → Jour.

### Créer une hiérarchie

1. Ouvrez le domaine d'activité → onglet **Hiérarchies**
2. Cliquez sur **+ Créer une hiérarchie**
3. Saisissez :
   - **Nom** — Nom de la hiérarchie (p. ex. « Temps »)
   - **Dossier** — Dossier contenant les éléments de la hiérarchie
   - **Description** — Notes facultatives
4. Ajoutez des niveaux :
   - Cliquez sur **+ Ajouter un niveau**
   - Sélectionnez un **élément** (il doit provenir du dossier de la hiérarchie)
   - Saisissez le **nom du niveau** (p. ex. « Année »)
   - Définissez le **numéro de niveau** (1 = sommet, 2 = deuxième, etc.)
5. Cliquez sur **Créer**

### Niveaux de hiérarchie

Les niveaux définissent l'ordre d'exploration vers le bas. Exemple de hiérarchie :

```
1. CALENDAR_YEAR (top level)
2. CALENDAR_QUARTER
3. CALENDAR_MONTH
4. CALENDAR_DATE (detail level)
```

Les utilisateurs peuvent explorer année → trimestre → mois → date dans les rapports.

### Modifier une hiérarchie

1. Cliquez sur la hiérarchie → **Modifier**
2. Modifiez le nom, les niveaux ou l'ordre
3. Cliquez sur **Enregistrer**

### Supprimer une hiérarchie

1. Cliquez sur la hiérarchie → **Supprimer**
2. L'exploration vers le bas devient indisponible pour les cartes utilisant cette hiérarchie

## Mise en cache des métadonnées

Les métadonnées (domaines d'activité, dossiers, éléments, jointures, hiérarchies) sont mises en cache dans Redis pour des raisons de performance.

- **TTL du cache :** 5 minutes (par défaut, configurable)
- **Invalidation :** automatique lorsque les métadonnées sont modifiées

Si vous modifiez les métadonnées directement dans la base de données (déconseillé), redémarrez le backend pour vider le cache.

## Bonnes pratiques

1. **Utilisez des noms descriptifs** — Évitez les abréviations ; les utilisateurs doivent comprendre l'objet des colonnes
2. **Fournissez des descriptions** — Le texte d'aide aide les utilisateurs à construire des requêtes correctes
3. **Organisez de manière logique** — Regroupez les éléments associés dans des dossiers, créez des jointures pour les relations courantes
4. **Masquez les colonnes inutiles** — Gardez le générateur de cartes clair ; masquez les éléments internes/obsolètes
5. **Testez après les modifications** — Vérifiez que les cartes existantes fonctionnent toujours après les modifications de métadonnées
6. **Documentez les hiérarchies** — Décrivez la logique d'exploration vers le bas dans les descriptions
7. **Sauvegardez avant les grandes modifications** — Exportez les définitions de domaine d'activité avant une restructuration majeure

## Et ensuite ?

- **[Introspection Oracle](oracle-introspection.md)** — Découvrir automatiquement les tables et les colonnes
- **[Sources de données](data-sources.md)** — Gérer les connexions aux bases de données
- **[Gestion des utilisateurs](user-management.md)** — Accorder l'accès aux domaines d'activité
- **[Stratégies de sécurité](security.md)** — Définir la sécurité au niveau des lignes

---

**Voir aussi :** [Guide de l'administrateur](../admin-guide/), [Référence de l'API](../../api/endpoints.md)
