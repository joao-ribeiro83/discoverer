# Stratégies de sécurité

Découvrez comment définir des stratégies de sécurité au niveau des lignes (RLS) qui filtrent les données par utilisateur ou par rôle.

## Qu'est-ce que la sécurité au niveau des lignes ?

La **sécurité au niveau des lignes (RLS)** filtre automatiquement les résultats des requêtes en fonction du contexte de l'utilisateur, sans nécessiter de modification des cartes ni des requêtes.

**Exemple :** un responsable de région commerciale ne voit que les données de sa région, même si toutes les régions figurent dans la même table.

## Fonctionnement de la RLS

1. **Une stratégie contient des règles.** Chaque règle cible un **domaine
   d'activité** ou un **dossier** et porte un prédicat SQL — un fragment de
   clause WHERE tel que `REGION = 'EMEA'` ou
   `{alias}."SALES_REP_ID" = :current_user_id`.
2. **Une stratégie est attribuée** à des utilisateurs, à des rôles, ou aux deux.
3. **Lorsqu'une requête s'exécute,** Neo repère chaque dossier dont les lignes
   peuvent atteindre le résultat : les éléments et conditions de la carte, les
   dossiers qu'un calcul lit, et les dossiers joints qui filtrent des lignes.
   Une règle de domaine d'activité s'applique à chacun de ces dossiers qui
   appartient à son domaine (propriétaire ou partagé) ; une règle de dossier
   s'applique à son dossier.
4. **Chaque prédicat applicable est combiné par un ET dans la clause WHERE,**
   chacun entre ses propres parenthèses, de sorte qu'un `OR` dans les
   conditions de la carte ne peut pas s'en échapper. Sur une feuille qui résume
   plusieurs ensembles de lignes de détail, le prédicat est placé dans chaque
   résumé, avant toute addition.

Les prédicats peuvent utiliser trois liaisons, alimentées par l'utilisateur
connecté et jamais par la requête : `:current_user_id`, `:current_user_email`
et `:current_user_role`. Une règle de dossier peut écrire `{alias}` pour
désigner son dossier dans la requête.

## La sécurité au niveau des lignes refuse par défaut

**Un utilisateur à qui aucune stratégie ne donne de lignes d'un dossier ne voit
rien de ce dossier.** La requête est refusée en nommant le dossier, et aucun
SQL n'atteint Oracle :

> Refusing to run unfiltered: no row-level security policy resolves for you on folder(s) "SALES"

C'est **délibérément différent de Discoverer**, et c'est le seul point où Neo
rompt volontairement la compatibilité (D-090). La sécurité au niveau des lignes
de Discoverer était une condition obligatoire de dossier ; un dossier qui n'en
avait pas montrait toutes les lignes à tout le monde. La reproduire reviendrait
à reproduire une vulnérabilité.

Ce qui en découle :

- **Un nouveau déploiement ne renvoie rien** tant qu'il n'existe pas de
  stratégies, pas même aux administrateurs. Pour qu'un groupe voie toutes les
  lignes d'un domaine d'activité, attribuez-lui une stratégie dont la règle
  cible ce domaine avec le prédicat `1 = 1`.
- **Supprimer, désactiver ou retirer une stratégie n'ouvre jamais l'accès.**
  Cela ne peut que retirer des lignes.
- **Les administrateurs ne sont pas exemptés.** Ils contournent les
  autorisations de domaine d'activité ; ils ne contournent pas la sécurité au
  niveau des lignes. Il n'existe aucun contournement administrateur à auditer.
- **Les listes de valeurs suivent la même règle.** Une liste déroulante sur un
  dossier pour lequel vous n'avez pas de stratégie est refusée elle aussi.

Le paramètre est `ROW_LEVEL_FAIL_MODE`
([Configuration](../../deployment/configuration.md#row-level-security)).
`OPEN` ne refuse qu'un dossier déjà ciblé par une stratégie active et exécute
tous les autres sans filtre, comme avant cette modification. Ne l'utilisez que
pendant la rédaction des stratégies d'un déploiement : en mode `OPEN`,
désactiver une stratégie élargit de nouveau l'accès.

### Les administrateurs sont la frontière de confiance des prédicats

Un prédicat est du SQL brut, inséré dans chaque requête qu'atteint son dossier.
Neo le valide à l'enregistrement et, avant chaque exécution, vérifie de nouveau
qu'il ne peut pas sortir de ses parenthèses. Il refuse :

- les séparateurs d'instructions (`;`) et les commentaires (`--`, `/* */`) ;
- tout ce qui ferme la parenthèse qui entoure le prédicat, comme
  `1=1) OR (1=1`, qui renverrait toutes les lignes ;
- les mots-clés DDL, DML et PL/SQL, `UNION` / `INTERSECT` / `MINUS` /
  `EXCEPT`, et les appels `DBMS_`, `UTL_`, `OWA_`, `HTP.` et `HTF.` ;
- les liaisons autres que les trois ci-dessus, et un texte qui ne s'analyse pas
  comme une condition.

Ces contrôles arrêtent les erreurs et les échappatoires connues. **Ils ne
peuvent pas distinguer une règle fausse d'une règle juste.** Quiconque peut
modifier les stratégies décide de ce que voit chaque utilisateur : traitez le
rôle d'administrateur de sécurité comme vous traiteriez un accès à la base de
données.

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

La stratégie cesse de s'appliquer. Ses utilisateurs ne **retrouvent pas** de
lignes non filtrées : un dossier pour lequel ils n'ont plus de stratégie active
est refusé, comme décrit dans
[La sécurité au niveau des lignes refuse par défaut](#la-sécurité-au-niveau-des-lignes-refuse-par-défaut).
Ce n'est qu'avec `ROW_LEVEL_FAIL_MODE=OPEN` que désactiver ou supprimer une
stratégie élargit l'accès.

### Supprimer définitivement

1. Recherchez la stratégie → **Supprimer**
2. Confirmez

La stratégie, ses règles et ses attributions sont supprimées. Comme pour la
désactivation, cela retire des lignes et n'en rend jamais.

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

## Accès au niveau de l'objet

Lire un dossier, un élément, une jointure ou une hiérarchie par son id exige la
même autorisation que les lister. Un utilisateur sans autorisation sur un domaine
métier auquel l'objet appartient reçoit `403 Forbidden`, pas l'objet. Les
administrateurs contournent la vérification.

Un dossier appartient à son domaine métier propriétaire et à chaque domaine avec
lequel il est partagé ; une autorisation sur l'un d'eux suffit. Les éléments et
les jointures suivent leur dossier. Les hiérarchies suivent leur domaine métier.

`backend/src/__tests__/get-by-id-scoping.test.ts` analyse tous les fichiers de
routes et échoue si une route `GET` avec id ne nomme aucun contrôle d'accès.

Les lectures ne sont pas encore journalisées. C'est la phase 6.4.

## SQL personnalisé des dossiers COMPLEX

Le SQL d'un dossier COMPLEX est inséré dans chaque requête qui le lit ; il est
donc vérifié **à la création et à la mise à jour** par la même fonction
(`assertValidFolderSql` dans `folder.service.ts`). Il doit s'agir d'une seule
instruction `SELECT` ou `WITH` ; le DDL, le DML, `EXEC`, `EXECUTE IMMEDIATE` et
les appels `DBMS_` sont refusés avec `400`. Passer un dossier en COMPLEX sans SQL
est également refusé.

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
- **Les stratégies se combinent par ET** — Lorsque plusieurs de vos stratégies atteignent un dossier, vous ne voyez que les lignes qu'elles autorisent toutes
- **Pas de UPDATE/DELETE au niveau des lignes** — La RLS ne filtre que les requêtes SELECT

## Et ensuite ?

- **[Gestion des utilisateurs](user-management.md)** — Créer des utilisateurs et attribuer un contexte
- **[Gestion des métadonnées](metadata-management.md)** — Organiser les dossiers
- **[Journalisation d'audit](audit-logging.md)** — Examiner les événements de sécurité

---

**Voir aussi :** [Guide de l'administrateur](../admin-guide/), [Référence de l'API - Sécurité](../../api/endpoints.md#security)
