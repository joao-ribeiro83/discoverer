# Introspection Oracle

Découvrez automatiquement des tables et des vues à partir de bases de données Oracle et importez-les en tant que dossiers Discoverer Neo.

## Qu'est-ce que l'introspection ?

L'**introspection** se connecte à une base de données Oracle et lit les définitions des tables/vues (schéma, colonnes, types de données) pour créer automatiquement des dossiers et des éléments Discoverer Neo.

Sans introspection, vous devriez créer manuellement chaque dossier et chaque élément, ce qui est fastidieux et source d'erreurs pour les grands schémas.

## Processus d'introspection

1. Se connecter à la base de données Oracle (via une source de données)
2. Interroger les vues du dictionnaire (USER_TABLES, USER_VIEWS, USER_TAB_COLUMNS)
3. Créer un dossier pour chaque table/vue
4. Créer un élément pour chaque colonne
5. Définir les types de données, les contraintes de clé et les noms d'affichage

## Lancer l'introspection

### Étape 1 : Ajouter une source de données

Créez d'abord une source de données Oracle (voir [Sources de données](data-sources.md)) :

1. Panneau d'administration → **Sources de données**
2. Ajoutez une connexion Oracle
3. Testez la connectivité
4. Enregistrez

### Étape 2 : Introspecter les tables

1. Panneau d'administration → **Domaines d'activité** → sélectionnez un domaine
2. Cliquez sur l'onglet **Dossiers**
3. Cliquez sur **+ Introspecter** ou **Importer depuis Oracle**
4. Sélectionnez :
   - **Source de données** — Connexion Oracle
   - **Schéma** — Schéma de base de données (p. ex. « SALES »)
5. Cliquez sur **Lister les tables**

Le système interroge toutes les tables et vues du schéma.

### Étape 3 : Sélectionner les tables/vues

Une liste apparaît affichant tous les objets détectables :

1. Cochez les cases en regard des tables/vues à importer
2. Décochez celles que vous souhaitez ignorer (p. ex. tables temporaires, objets internes)
3. Cliquez sur **Importer**

Discoverer Neo crée des dossiers pour chaque objet sélectionné.

### Étape 4 : Vérifier l'importation

Une fois l'importation terminée :

1. Actualisez la liste des **Dossiers**
2. Vérifiez que toutes les tables/vues attendues apparaissent
3. Cliquez sur un dossier pour examiner les éléments (colonnes)
4. Vérifiez les types de données et les noms d'affichage

## Propriétés des dossiers importés

Lors de l'importation, chaque dossier reçoit :

| Propriété | Détectée automatiquement |
|----------|---------------|
| **Nom** | Nom de la table/vue |
| **Type** | TABLE ou VIEW |
| **Schéma** | Schéma source |
| **Nom de la table** | Nom physique de la table |
| **Description** | Null (à ajouter par l'utilisateur) |

## Propriétés des éléments importés

Pour chaque colonne, les éléments reçoivent :

| Propriété | Détectée automatiquement |
|----------|---------------|
| **Nom** | Nom de la colonne |
| **Type de données** | Type de données Oracle (VARCHAR2 → VARCHAR, NUMBER, DATE, etc.) |
| **Nom d'affichage** | Nom de la colonne (à améliorer par l'utilisateur) |
| **Nom de colonne** | Nom physique de la colonne |
| **Est une clé** | Oui, si la colonne fait partie de la clé primaire |
| **Description** | Null (à ajouter par l'utilisateur) |

## Nettoyage après importation

Après l'introspection, améliorez les métadonnées :

### Ajouter des descriptions

1. Cliquez sur le dossier → **Modifier**
2. Ajoutez une **Description** expliquant la table
3. Répétez pour les éléments clés
4. Enregistrez

**Exemple :**
- Dossier : « Table maître des clients avec coordonnées et adresse »
- Élément CUSTOMER_ID : « Identifiant client unique, clé primaire »
- Élément CUSTOMER_NAME : « Raison sociale du client »

### Améliorer les noms d'affichage

1. Cliquez sur l'élément → **Modifier**
2. Remplacez le **Nom d'affichage** par une version conviviale
3. Exemples :
   - CUST_ID → Customer ID
   - SALES_AMOUNT_USD → Sales Amount (USD)
   - CREATE_DT → Creation Date

### Masquer les éléments inutiles

Pour les colonnes internes que les utilisateurs ne doivent pas utiliser :

1. Cliquez sur l'élément → **Modifier**
2. Cochez **Est masqué**
3. Enregistrez

Les éléments masqués n'apparaissent pas dans le générateur de cartes mais restent disponibles pour les requêtes.

### Définir l'ordre de tri

Organisez les éléments pour le générateur de cartes :

1. Cliquez sur le dossier → **Modifier**
2. Réorganisez les éléments par **Ordre d'affichage**
3. Enregistrez

## Gérer la correspondance des types de données

Les types de données Oracle sont mis en correspondance avec des types génériques :

| Oracle | Mis en correspondance avec | Remarques |
|--------|-----------|-------|
| VARCHAR2(n) | VARCHAR | Texte, jusqu'à 4000 caractères |
| CLOB | VARCHAR | Texte volumineux (>4000 caractères) |
| NUMBER(p,s) | NUMBER | Numérique avec précision |
| DATE | DATE | Date uniquement |
| TIMESTAMP | DATE | Date et heure |
| BLOB | VARCHAR | Binaire (traité comme du texte dans Discoverer Neo) |

## Introspection incrémentielle

Introspectez un schéma à plusieurs reprises pour :

- Ajouter les tables nouvellement créées
- Réimporter les tables modifiées
- Ignorer les tables déjà importées (le système vérifie les doublons)

**Remarque :** la réimportation d'une table existante ne met pas à jour les définitions des éléments. Supprimez d'abord l'ancien dossier, puis introspectez.

## Gérer les objets complexes

### Vues avec jointures

Les vues qui joignent plusieurs tables s'introspectent normalement. Le dossier résultant n'expose pas la structure de la jointure ; il s'agit simplement d'un dossier contenant les éléments du jeu de résultats de la vue.

### Gestion des synonymes

Les synonymes de base de données ne sont généralement pas introspectés (le système les ignore). Si nécessaire :
- Créez une vue plutôt qu'un synonyme
- Créez manuellement un dossier pointant vers le nom du synonyme

### Vues matérialisées

Les vues matérialisées Oracle s'introspectent comme des tables (elles sont matérialisées et se comportent donc comme des tables).

## Dépannage de l'introspection

### « Aucune table trouvée »

**Causes :**
- Nom de schéma incorrect ou inexistant
- L'utilisateur ne dispose pas du privilège SELECT_CATALOG_ROLE
- Aucune table dans le schéma

**Solution :**
1. Vérifiez le nom du schéma auprès du DBA Oracle
2. Vérifiez les privilèges de l'utilisateur :
   ```sql
   SELECT * FROM SESSION_PRIVS WHERE PRIVILEGE LIKE '%CATALOG%';
   ```
3. Listez les tables disponibles :
   ```sql
   SELECT OWNER, TABLE_NAME FROM DBA_TABLES ORDER BY OWNER;
   ```

### « Impossible de se connecter à Oracle »

Consultez [Sources de données - Dépannage](data-sources.md#dépannage).

### « Délai d'expiration de l'importation »

**Cause :** schéma volumineux comportant de nombreux objets

**Solution :**
- Introspectez séparément des schémas plus petits
- Contactez l'administrateur pour augmenter le délai d'expiration dans la configuration du backend

## Automatisation

Pour automatiser une introspection à grande échelle (p. ex. après le déploiement d'un nouvel ERP) :

1. Utilisez l'interface en ligne de commande ou l'API de l'outil de migration pour créer des dossiers en masse
2. Écrivez un script pour introspecter via l'API :
   ```bash
   curl -X POST http://localhost:3000/api/business-areas/:baId/folders/:folderId/introspect \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"dataSourceId":"...","schema":"SALES"}'
   ```

## Étapes suivantes

- **[Gestion des métadonnées](metadata-management.md)** — Créer des jointures entre les tables introspectées
- **[Sources de données](data-sources.md)** — Gérer les connexions aux bases de données
- **[Création de cartes](../user-guide/building-maps.md)** — Utiliser les tables importées dans les requêtes

---

**Voir aussi :** [Guide de l'administrateur](../admin-guide/), [Référence de l'API](../../api/endpoints.md)
