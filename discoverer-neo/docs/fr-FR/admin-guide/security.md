# Stratégies de sécurité

Découvrez comment définir des stratégies de sécurité au niveau des lignes (RLS) qui filtrent les données par utilisateur ou par rôle.

## Qu'est-ce que la sécurité au niveau des lignes ?

La **sécurité au niveau des lignes (RLS)** filtre automatiquement les résultats des requêtes en fonction du contexte de l'utilisateur, sans nécessiter de modification des cartes ni des requêtes.

**Exemple :** un responsable de région commerciale ne voit que les données de sa région, même si toutes les régions figurent dans la même table.

## Fonctionnement de la RLS

1. **Définir une stratégie :** créez un prédicat de sécurité pour un dossier
2. **Contexte utilisateur :** associez l'utilisateur à des valeurs de contexte (p. ex. region = « EMEA »)
3. **Exécution de la requête :** le prédicat est automatiquement ajouté à la clause WHERE
4. **Résultats filtrés :** l'utilisateur ne voit que les lignes correspondant à son contexte

```sql
-- Base query
SELECT CUSTOMER_ID, SALES_AMOUNT, REGION FROM CUSTOMERS

-- With RLS policy
SELECT CUSTOMER_ID, SALES_AMOUNT, REGION FROM CUSTOMERS
WHERE REGION = NVL2(SYS_CONTEXT('dn_user_context', 'region'),
                     SYS_CONTEXT('dn_user_context', 'region'),
                     REGION)
```

## Créer des stratégies de sécurité

### Étape 1 : Ajouter une stratégie

1. Panneau d'administration → **Domaine d'activité** → **Sécurité**
2. Cliquez sur **+ Créer une stratégie**
3. Saisissez :
   - **Nom** — Identifiant de la stratégie (p. ex. « Ventes par région »)
   - **Description** — Expliquez ce que la stratégie applique
   - **Type de cible** — FOLDER (s'applique à tous les éléments du dossier)
   - **Dossier cible** — Sélectionnez le dossier à protéger
   - **Actif** — Bascule pour activer/désactiver

### Étape 2 : Définir le prédicat

Saisissez le **prédicat SQL** — un fragment de clause WHERE ajouté aux requêtes :

```sql
REGION = NVL2(SYS_CONTEXT('dn_user_context', 'region'),
              SYS_CONTEXT('dn_user_context', 'region'),
              REGION)
```

**Décomposition de l'expression :**

- `SYS_CONTEXT('dn_user_context', 'region')` — Récupère la valeur de contexte « region » de l'utilisateur
- `NVL2(...)` — Si la valeur de contexte existe, l'utilise ; sinon, utilise REGION (aucun filtrage)
- Compare la colonne REGION du dossier au contexte de région de l'utilisateur

### Étape 3 : Attribuer un contexte aux utilisateurs

Les utilisateurs ont besoin de valeurs de contexte pour que les stratégies filtrent les données.

1. Panneau d'administration → **Utilisateurs** → sélectionnez l'utilisateur → **Contexte de sécurité**
2. Définissez des paires clé-valeur de contexte :
   - **Clé :** `region` (correspond au prédicat)
   - **Valeur :** `EMEA` (région de cet utilisateur)
3. Enregistrez

Désormais, lorsque cet utilisateur exécute une requête, le prédicat utilise son contexte de région.

## Valeurs de contexte de sécurité

Le contexte de sécurité est un ensemble de paires clé-valeur associées à chaque utilisateur :

| Clé | Valeur | Objectif |
|-----|-------|---------|
| `region` | EMEA, APAC, AMER | Responsable de région commerciale |
| `department` | SALES, HR, FINANCE | Données limitées au service |
| `cost_center` | CC-001, CC-002 | Filtrage par centre de coûts |
| `employee_id` | EMP-12345 | Données propres à l'employé |

**Définir le contexte :**

1. Panneau d'administration → **Utilisateurs**
2. Cliquez sur l'utilisateur → **Modifier**
3. Faites défiler jusqu'à **Contexte de sécurité**
4. Cliquez sur **+ Ajouter un contexte**
5. Saisissez la clé et la valeur
6. Enregistrez

Les utilisateurs peuvent avoir plusieurs valeurs de contexte. Les prédicats indiquent quelle valeur de contexte utiliser.

## Exemples de prédicats

### Exemple 1 : filtrage par région commerciale

**Dossier :** SALES_DATA
**Stratégie :** ne voir que les ventes de votre région

```sql
REGION = SYS_CONTEXT('dn_user_context', 'region')
```

**Configuration du contexte :**
- Utilisateur : john@example.com → region = 'EMEA'
- Utilisateur : jane@example.com → region = 'AMER'

**Résultat :**
- John voit : WHERE REGION = 'EMEA'
- Jane voit : WHERE REGION = 'AMER'

### Exemple 2 : accès par service

**Dossier :** EMPLOYEE_DATA
**Stratégie :** les employés ne voient que leur service

```sql
DEPARTMENT = SYS_CONTEXT('dn_user_context', 'department')
```

### Exemple 3 : accès des responsables

**Dossier :** PAYROLL
**Stratégie :** les responsables voient les données de leurs subordonnés

```sql
MANAGER_ID = SYS_CONTEXT('dn_user_context', 'employee_id')
OR EMPLOYEE_ID = SYS_CONTEXT('dn_user_context', 'employee_id')
```

Cela permet aux responsables de voir les enregistrements de leurs employés (correspondance MANAGER_ID) ainsi que leur propre enregistrement.

### Exemple 4 : aucun filtrage pour les administrateurs

**Dossier :** SENSITIVE_DATA
**Stratégie :** ignorer le filtrage pour les administrateurs

```sql
SYS_CONTEXT('dn_user_context', 'is_admin') = 'Y'
OR DATA_OWNER = SYS_CONTEXT('dn_user_context', 'employee_id')
```

Les administrateurs disposent du contexte `is_admin='Y'` ; les autres ne voient que leurs propres enregistrements.

## Tester les stratégies

### Tester en tant qu'utilisateur

1. Déconnectez-vous (ou utilisez un navigateur en navigation privée)
2. Connectez-vous en tant qu'utilisateur de test
3. Exécutez une carte utilisant le dossier protégé
4. Vérifiez que les résultats sont correctement filtrés

### Vérifier le prédicat dans les journaux

Les journaux d'audit affichent le SQL exécuté :

1. Panneau d'administration → **Journal d'audit**
2. Filtrez par exécution de carte
3. Consultez le SQL généré avec le prédicat appliqué

## Désactiver les stratégies

### Désactiver temporairement

1. Recherchez la stratégie → **Modifier**
2. Décochez **Actif**
3. Enregistrez

La stratégie ne filtre plus les requêtes.

### Supprimer définitivement

1. Recherchez la stratégie → **Supprimer**
2. Confirmez

La stratégie est supprimée ; les requêtes ne sont plus filtrées.

## Considérations de performance

Les prédicats de sécurité sont ajoutés à toutes les requêtes sur les dossiers protégés :

**Impact :**
- Ajoute du temps d'exécution (généralement <10 % pour des colonnes bien indexées)
- Les colonnes de contexte indexées offrent de meilleures performances
- Les grandes listes IN (nombreuses régions) ralentissent les requêtes

**Optimisation :**
1. Indexez les colonnes référencées dans les prédicats :
   ```sql
   CREATE INDEX idx_sales_region ON SALES_DATA(REGION);
   ```

2. Utilisez des prédicats simples (égalité) lorsque c'est possible

3. Surveillez les performances des requêtes avec/sans RLS

## Audit de sécurité

Suivez les modifications des stratégies de sécurité :

1. Panneau d'administration → **Journal d'audit**
2. Filtrez par type d'entité : SECURITY_POLICY
3. Consultez qui a créé/modifié/supprimé des stratégies

## Expurgation des identifiants dans le journal d'audit

Toute requête qui modifie des données (`POST`, `PUT`, `PATCH`, `DELETE`) voit
ses paramètres, sa chaîne de requête, son corps de requête et son corps de
réponse enregistrés dans `audit_log.details`. Certains de ces corps
transportent des identifiants en clair — le mot de passe Oracle d'une source de
données arrive à l'API en clair et n'est chiffré que côté serveur, et un
changement de mot de passe transporte le nouveau mot de passe.

### La règle

Avant tout enregistrement, toute clé dont le nom **contient** l'une de ces
sous-chaînes, sans distinction de casse, à n'importe quelle profondeur, voit sa
valeur remplacée par `[REDACTED]` :

| Sous-chaîne | Attrape, entre autres |
|-------------|-----------------------|
| `password` | `password`, `passwordEnc`, `newPassword`, `currentPassword`, `passwordHash` |
| `secret` | `secret`, `clientSecret`, `client_secret` |
| `token` | `token`, `apiToken`, `refreshToken`, `accessToken` |
| `credential` | `credential`, `dbCredential`, `credentials` |
| `apikey` | `apiKey`, `api_key` |
| `authorization` | `authorization` |

La règle est `isSensitiveKey` dans `backend/src/plugins/audit.ts`. Les tableaux
et les objets imbriqués sont parcourus jusqu'à une profondeur de six.

### Pourquoi une sous-chaîne et non une liste exacte

C'était auparavant une liste exacte de noms de clés, et une liste exacte est la
liste des noms auxquels quelqu'un a pensé. Il en manquait deux — `passwordEnc`
et `newPassword` — et **174 mots de passe de sources de données Oracle et 5
mots de passe d'utilisateurs ont été écrits en clair dans `audit_log`**. Non
chiffrés ; la chaîne telle quelle.

Une règle par sous-chaîne attrape toutes les variantes préfixées, suffixées et
en camelCase du même mot, sans que personne ait à les énumérer. Le texte en
clair existant a été purgé par la migration
`0011_purge_audit_log_credentials`, qui expurge les valeurs sur place plutôt
que de supprimer des lignes — une piste d'audit dont les lignes disparaissent
est une piste d'audit moins bonne.

### Ce que l'expurgation ne couvre pas

- **Les valeurs, pas les clés.** Un mot de passe collé dans un champ
  *description* est enregistré. L'expurgateur compare sur le nom du champ ; il
  ne peut pas reconnaître un secret en le regardant.
- **Les textes d'erreur.** Un message d'échec d'Oracle ou de Postgres peut
  citer le mot « password » (« password authentication failed »). Ce sont des
  messages, pas des identifiants, et ils restent intacts.

### Si vous ajoutez un champ qui transporte un secret

Nommez-le de sorte qu'il contienne l'une des six sous-chaînes. `apiToken` est
couvert ; `apiPass` ne l'est pas. Ajouter un nom qui ne correspond pas revient
à ajouter une fuite, et le hook d'audit n'a aucun moyen de vous en avertir.

`backend/src/__tests__/audit-redaction.test.ts` fixe la règle.

## Bonnes pratiques

1. **Commencez simplement** — Débutez par un filtrage sur une seule colonne (region, department)
2. **Documentez les stratégies** — Expliquez l'intention et les exigences de maintenance
3. **Testez rigoureusement** — Vérifiez que chaque utilisateur ne voit que les données appropriées
4. **Surveillez les performances** — Les prédicats complexes peuvent affecter la vitesse des requêtes
5. **Utilisez des clés cohérentes** — Conservez des noms de clés de contexte cohérents (p. ex. toujours `region`, pas `region_code`)
6. **Révisez régulièrement** — Auditez les stratégies chaque trimestre pour vous assurer qu'elles restent pertinentes

## Limites

- **Attribution manuelle du contexte** — Le contexte des utilisateurs est actuellement défini manuellement (aucune synchronisation LDAP automatique dans la v0.1)
- **Pas de RLS temporelle** — Aucun filtrage basé sur le temps pour l'instant
- **Un seul prédicat par dossier** — Une seule stratégie s'applique par dossier
- **Pas de UPDATE/DELETE au niveau des lignes** — La RLS ne filtre que les requêtes SELECT

## Et ensuite ?

- **[Gestion des utilisateurs](user-management.md)** — Créer des utilisateurs et attribuer un contexte
- **[Gestion des métadonnées](metadata-management.md)** — Organiser les dossiers
- **[Journalisation d'audit](audit-logging.md)** — Examiner les événements de sécurité

---

**Voir aussi :** [Guide de l'administrateur](../admin-guide/), [Référence de l'API - Sécurité](../../api/endpoints.md#security)
