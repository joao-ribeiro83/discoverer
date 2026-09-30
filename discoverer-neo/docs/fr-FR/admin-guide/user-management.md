# Gestion des utilisateurs

Découvrez comment créer des utilisateurs, attribuer des rôles et gérer les autorisations sur les domaines d'activité.

## Rôles utilisateur

Discoverer Neo comporte quatre rôles utilisateur aux capacités différentes :

| Rôle | Capacités |
|------|-------------|
| **ADMIN** | Accès système complet — utilisateurs, domaines d'activité, sources de données, journaux d'audit. Ouvre, modifie, partage et supprime toutes les cartes. |
| **MANAGER** | Ouvre, exécute, exporte, planifie et partage **toutes** les cartes, et peut changer le propriétaire d'une carte. Ne modifie que ses propres cartes. Voit, modifie, active et désactive les comptes MANAGER, USER et VIEWER. Ne peut pas voir les administrateurs, créer ou supprimer des utilisateurs, ni donner le rôle ADMIN. Ne peut pas modifier le modèle de données (domaines d'activité, dossiers, éléments, jointures, hiérarchies), même avec un accès, et ne peut pas utiliser les fonctions personnalisées ni les sources de données. |
| **USER** | Ne voit que ses propres cartes et celles partagées avec lui. Crée une nouvelle carte en copiant l'une d'elles. |
| **VIEWER** | Lecture seule. Ouvre et exécute les cartes partagées avec lui. Ne peut ni créer, ni copier, ni modifier de cartes. |

La page Utilisateurs affiche ces règles sous le champ **Rôle** lorsque vous
modifiez un utilisateur. La page Utilisateurs d'un MANAGER ne liste que les comptes MANAGER, USER et VIEWER.
Il peut y modifier un compte (nom, e-mail, mot de passe et un rôle autre que
ADMIN), l'activer ou le désactiver, et voir les cartes de chaque utilisateur :
changer le niveau d'un partage, retirer un partage ou attribuer une carte à un
nouveau propriétaire. Seul un ADMIN voit les comptes d'administrateur, crée ou
supprime des utilisateurs et donne le rôle ADMIN.

Toute personne autre qu'un VIEWER peut copier une carte qu'elle voit. La copie
lui appartient. Son exécution exige toujours une autorisation sur son domaine
d'activité (voir « deux portes » ci-dessous).

## Créer des utilisateurs

### Ajouter un utilisateur unique

1. Panneau d'administration → **Utilisateurs**
2. Cliquez sur **+ Créer un utilisateur**
3. Saisissez :
   - **E-mail** — Adresse e-mail unique (identifiant de connexion)
   - **Nom** — Nom complet ou nom d'affichage
   - **Mot de passe** — Mot de passe initial (l'utilisateur doit le changer à la première connexion)
   - **Rôle** — ADMIN, MANAGER, USER ou VIEWER
4. Cliquez sur **Créer**

L'utilisateur reçoit une notification pour se connecter (si l'e-mail est configuré).

### Importation en masse

Pour migrer de nombreux utilisateurs depuis Oracle Discoverer :

1. Exportez la liste des utilisateurs au format CSV :
   ```
   email,name,role
   john@example.com,John Smith,USER
   jane@example.com,Jane Doe,MANAGER
   ```

2. Utilisez l'outil de migration ou l'API pour créer en masse

3. Envoyez un e-mail de bienvenue avec les mots de passe temporaires

## Attribuer des rôles

### Modifier le rôle d'un utilisateur

1. Panneau d'administration → **Utilisateurs**
2. Cliquez sur l'utilisateur → **Modifier**
3. Modifiez la liste déroulante **Rôle**
4. Cliquez sur **Enregistrer**

Le changement de rôle prend effet immédiatement.

## Autorisations sur les domaines d'activité

Une fois les utilisateurs créés, accordez-leur l'accès à des domaines d'activité spécifiques.

### Accorder une autorisation

1. Panneau d'administration → **Domaines d'activité**
2. Sélectionnez le domaine d'activité → **Gérer les accès**
3. Cochez un ou plusieurs utilisateurs dans la liste. Saisissez du texte dans la zone de filtre pour les trouver.
4. Choisissez le niveau d'**Autorisation**. La zone en dessous indique ce que ce niveau permet.
5. Cliquez sur **Ajouter**. Chaque utilisateur coché reçoit ce niveau.

### Niveaux d'autorisation

Les niveaux forment une hiérarchie. Chaque niveau inclut tous les niveaux supérieurs du tableau. Aucun niveau n'affiche les cartes des autres personnes — seul un partage (ou le rôle MANAGER) le fait.

| Niveau | Ce qu'il ajoute |
|-------|--------------|
| **VIEW** | Lire les données des dossiers de la domaine. Voir les dossiers, éléments, jointures et hiérarchies de la domaine. Exécuter des cartes dont vous êtes propriétaire, des cartes partagées avec vous et des cartes publiques. |
| **EXPORT** | Identique à VIEW actuellement (voir la note 2). |
| **SCHEDULE** | Identique à VIEW actuellement (voir la note 2). |
| **CREATE** | Créer de nouvelles cartes, des dossiers, éléments, jointures et hiérarchies dans le domaine. |
| **EDIT** | Modifier le domaine et ses dossiers, éléments, jointures et hiérarchies. |
| **DELETE** | Supprimer des dossiers, éléments, jointures et hiérarchies du domaine. |

Les utilisateurs ADMIN contournent tous ces contrôles.

**Note 1 — deux portes.** Pour exécuter une carte, un utilisateur doit passer deux contrôles :

1. **Puis-je voir cette carte ?** Oui si vous êtes ADMIN ou MANAGER, si vous en êtes propriétaire, si elle est publique ou si elle est partagée avec vous.
2. **Puis-je lire ses données ?** Oui si vous détenez **une** autorisation dans la domaine d'activité de chaque dossier utilisé par la carte.

Ainsi, une carte partagée avec un utilisateur échoue si l'utilisateur n'a pas d'autorisation sur la domaine d'où proviennent les données.

**Note 2 — VIEW, EXPORT et SCHEDULE fonctionnent de la même façon sur les cartes.** Aucune des trois ne permet à un utilisateur de voir les cartes d'autres personnes. Sur une carte partagée, le **partage** détermine ce que l'utilisateur peut faire : un partage VIEW lui permet de l'exécuter ; un partage EXPORT ajoute l'exportation et la planification ; un partage EDIT ajoute les modifications. Voir [Partage](../user-guide/sharing.md).

### Quel niveau accorder

Accordez **une** autorisation par utilisateur et par domaine d'activité — le niveau le plus élevé dont il a besoin. Il inclut déjà les niveaux en dessous. N'ajoutez pas de niveaux inférieurs au-dessus.

| L'utilisateur doit… | Accordez |
|----------------|-------|
| Exécuter des cartes que d'autres partagent avec lui, ou les copier | VIEW |
| Créer de nouvelles cartes de zéro | CREATE |
| Gérer les dossiers, éléments et jointures du domaine | EDIT |
| Les supprimer également | DELETE |

### Révoquer une autorisation

1. Cliquez sur le domaine d'activité → **Gérer les accès**
2. Recherchez l'utilisateur dans la liste des autorisations
3. Cliquez sur **Retirer**
4. Confirmez

L'utilisateur perd son accès immédiatement.

### Modifier le niveau d'autorisation

1. Cliquez sur le domaine d'activité → **Gérer les accès**
2. Recherchez l'utilisateur
3. Cliquez sur la liste déroulante des autorisations
4. Sélectionnez le nouveau niveau
5. La modification prend effet immédiatement

## Gestion des mots de passe

### Utilisateurs importés et mots de passe temporaires

Discoverer stocke les noms d'utilisateur mais jamais les mots de passe : rien ne
peut donc être repris. À la place, la migration **génère un mot de passe
temporaire unique pour chaque personne importée** et les écrit tous dans un
fichier que vous distribuez.

1. Lancez la migration (voir [Utilisateurs et mots de passe migrés](../../migration/user-credentials.md)).
2. Récupérez `credentials/credentials-<id-execution>.csv` sur le serveur.
3. Remettez à chacun son mot de passe par un canal de confiance.
4. **Supprimez le fichier.** Rien ne le supprime à votre place.

Chaque compte doit changer ce mot de passe avant de pouvoir faire quoi que ce
soit d'autre — c'est imposé par le serveur, et pas seulement suggéré par
l'interface.

### Créer un utilisateur manuellement

Lorsque vous ajoutez un utilisateur via Panneau d'administration →
**Utilisateurs**, vous définissez directement son premier mot de passe.
Demandez-lui de le changer après connexion, depuis **Paramètres → Changer le mot
de passe**.

### Ce que signifie « doit changer son mot de passe »

Tant qu'un compte attend le changement, il ne peut atteindre que l'écran de
changement. Toutes les autres pages et tous les appels d'API sont refusés. La
connexion réussit, mais l'application reste indisponible jusqu'au changement.

La liste des Utilisateurs indique qui est encore en attente.

### Réinitialisation du mot de passe

Si un utilisateur oublie son mot de passe (en tant qu'administrateur) :

1. Panneau d'administration → **Utilisateurs**
2. Cliquez sur l'utilisateur → **Réinitialiser le mot de passe**
3. Le système génère un mot de passe temporaire
4. Transmettez-le à l'utilisateur (par e-mail ou hors bande)
5. L'utilisateur change son mot de passe à la première connexion

### Exiger un changement de mot de passe

Les comptes créés par une migration sont marqués automatiquement — vous n'avez
rien à faire. Il n'y a pas de case à cocher : l'indicateur est posé lorsque le
compte reçoit un mot de passe temporaire et retiré dès que l'utilisateur choisit
le sien.

Pour forcer une rotation sur un compte existant, réinitialisez son mot de passe ;
la réinitialisation replace le compte dans le même état.

### Réapprovisionement au basculement

Interrogez qui a besoin de quoi — ne supposez pas un effectif fixe, cela varie
au fur et à mesure que les utilisateurs complètent leur première connexion :

```sql
-- Vraies personnes ayant besoin d'une accréditation entièrement nouvelle (jamais réapprovisionées):
SELECT count(*) FROM users WHERE password_hash = '!migrated-no-login' AND is_role = false;
-- Vraies personnes qui ont déjà une accréditation, n'ont simplement pas encore ouvert de session:
SELECT count(*) FROM users WHERE must_change_password = true AND password_hash != '!migrated-no-login';
```

Les comptes de rôle et de service (`is_role = true`, plus le compte du service
de migration) ne sont intentionnellement jamais réapprovisionne — ils portent la
sentinelle `!migrated-no-login` à jamais par conception. Procédure complète et
une répétition réelle de ce flux : [`docs/deployment/cutover-runbook.md`](../../deployment/cutover-runbook.md#step-6--re-provision-credentials).

## Rôles de base de données

Les utilisateurs importés d'Oracle Discoverer ne sont pas tous des personnes.
Discoverer accorde des privilèges à des **rôles** Oracle (`CONNECT`, `RESOURCE`)
aussi bien qu'à des individus, et la migration reprend les deux.

Un rôle apparaît dans la liste des Utilisateurs avec un badge **Rôle** :

| | Personne | Rôle de base de données |
| --- | --- | --- |
| Peut se connecter | Oui | **Non — jamais** |
| Détient des autorisations | Oui | Oui |
| Possède un mot de passe | Oui | Aucun. Aucun mot de passe ne correspond. |

Les rôles sont conservés car ils portent les autorisations sur lesquelles votre
sécurité Discoverer reposait. Ils ne peuvent pas devenir des comptes de
connexion — attribuez les autorisations équivalentes à de vrais utilisateurs,
puis retirez le rôle.

## Préférences utilisateur

Les utilisateurs peuvent gérer leurs propres préférences d'interface sans intervention d'un administrateur :

- **Langue** — Les utilisateurs sélectionnent leur langue d'interface préférée (English, Português, Français, Español) dans les Paramètres
- **Thème** — Les utilisateurs choisissent leur thème visuel préféré (Clair, Sombre, Contraste élevé) dans les Paramètres

Ces préférences sont en libre-service et propres à chaque utilisateur. Chaque utilisateur peut accéder aux Paramètres via la barre latérale ou le menu déroulant de profil pour personnaliser son expérience. Aucune configuration par un administrateur n'est nécessaire.

## Statut de l'utilisateur

### Actif/Inactif

Dans l'écran Utilisateurs, la colonne **Statut** indique si chaque compte est Actif ou Inactif.

1. Ouvrez **Utilisateurs** dans la barre latérale d'administration.
2. Pour désactiver un utilisateur, cliquez sur le bouton **Désactiver** (personne avec une croix) de sa ligne, puis cliquez sur **Désactiver** dans la boîte de confirmation.
3. Pour activer un utilisateur inactif, cliquez sur le bouton **Activer** (personne avec une coche) de sa ligne. Aucune confirmation n'est demandée.

Vous ne pouvez pas désactiver votre propre compte ; son bouton est désactivé.

Vous pouvez aussi définir `isActive` via l'API :

```bash
curl -X PUT http://localhost:3000/api/users/<user-id> \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

- **Actif** (par défaut) — L'utilisateur peut se connecter
- **Inactif** — L'utilisateur ne peut ni se connecter ni renouveler une session (suppression réversible)

Utile pour désactiver temporairement sans supprimer les comptes.

**Le retrait d'accès prend effet immédiatement.** L'existence, le statut actif
et le rôle sont lus dans la base de données à chaque requête et à chaque
renouvellement de jeton, jamais dans le jeton lui-même. Un utilisateur que vous
désactivez ou supprimez est refusé dès sa requête suivante, et un utilisateur
rétrogradé est limité au nouveau rôle dès sa requête suivante. Inutile
d'attendre l'expiration de son jeton.

### Compte verrouillé

Les échecs de connexion verrouillent un compte pendant une courte durée. Avec les paramètres par défaut :

- **5 échecs de connexion** sur un compte en 15 minutes verrouillent ce compte
  pendant **15 minutes**. La connexion renvoie `429 Too Many Requests` jusqu'à
  la fin du verrouillage.
- **100 échecs de connexion** depuis une même adresse IP en 15 minutes bloquent
  cette adresse jusqu'à la fin des 15 minutes, pour tous les comptes.
- Une connexion réussie remet à zéro les échecs du compte.
- Une adresse qui s'est connectée avec succès à ce compte au cours des
  30 derniers jours peut encore se connecter pendant le verrouillage. Un
  attaquant ne peut donc pas bloquer le véritable utilisateur en échouant
  exprès. Cette adresse reste soumise à la limite par adresse.
- Chaque verrouillage écrit un événement `auth.lockout` dans le journal d'audit.

Le verrouillage prend fin tout seul ; il n'existe pas de déverrouillage manuel.
Les limites se règlent dans la
[Configuration](../../deployment/configuration.md#login-rate-limiting).

Pour empêcher la connexion :
- Définissez le statut **Inactif** (recommandé)
- Ou supprimez le compte utilisateur

## Délégation

Donnez le rôle **MANAGER** à une personne qui s'occupe des cartes des autres.
Un MANAGER peut :
- Voir, exécuter, exporter, planifier et partager toutes les cartes
- Donner une carte à un nouveau propriétaire, modifier ou retirer ses partages (Utilisateurs → icône de carte)
- Modifier, activer et désactiver les comptes MANAGER, USER et VIEWER

Un MANAGER ne peut pas :
- Voir ou modifier les comptes d'administrateur, créer ou supprimer des utilisateurs, donner le rôle ADMIN, ni donner un accès à un domaine d'activité
- Modifier le modèle de données : domaines d'activité, dossiers, éléments, jointures, hiérarchies
- Ouvrir Fonctions personnalisées, Sources de données, Sécurité, Journal d'audit ou Migration

## Piste d'audit

Suivez les actions des utilisateurs dans le **Journal d'audit** :

1. Panneau d'administration → **Journal d'audit**
2. Filtrez par :
   - Plage de dates
   - Utilisateur
   - Action (CREATE, UPDATE, DELETE, EXECUTE)
   - Type d'entité (USER, MAP, BUSINESS_AREA, etc.)

Les événements de création/modification d'utilisateurs sont journalisés.

## Bonnes pratiques

### Conventions de nommage

Utilisez un adressage e-mail cohérent :
- ✓ prenom.nom@example.com
- ✓ e-mail issu d'un service d'annuaire (LDAP, Active Directory)
- ✗ Identifiants numériques (difficiles à identifier)

### Rôles par défaut

Attribuez le rôle minimal nécessaire :

- La plupart des utilisateurs → rôle **USER** (pas MANAGER ni ADMIN)
- Créateurs de rapports → rôle **USER**
- Chefs d'équipe → rôle **MANAGER** (s'ils s'occupent des cartes de l'équipe)
- Seulement 1 à 2 → rôle **ADMIN**

### Audits réguliers

Vérifiez périodiquement :
- Les autorisations des utilisateurs (retirez les utilisateurs inactifs)
- Les accès aux domaines d'activité (révoquez les octrois d'accès inutiles)
- Les comptes d'administrateur (assurez-vous qu'ils sont limités au nécessaire)

### Liste de contrôle d'intégration

1. ✓ Créer le compte utilisateur
2. ✓ Attribuer le rôle approprié
3. ✓ Accorder les autorisations sur les domaines d'activité
4. ✓ Envoyer un e-mail de bienvenue avec les instructions de connexion
5. ✓ Planifier une présentation pour les nouveaux utilisateurs

### Liste de contrôle de départ

1. ✓ Identifier les cartes dont l'utilisateur est propriétaire
2. ✓ Transférer la propriété ou archiver les cartes
3. ✓ Révoquer les autorisations sur les domaines d'activité
4. ✓ Définir l'utilisateur comme **Inactif** (ou le supprimer)
5. ✓ Journaliser l'événement d'audit

## Intégration à un annuaire (à venir)

Les futures versions pourront prendre en charge LDAP/Active Directory :
- Provisionnement automatique des utilisateurs depuis l'annuaire
- Synchronisation des rôles/autorisations depuis les groupes de l'annuaire
- Prise en charge de la connexion SSO

## Et ensuite ?

- **[Stratégies de sécurité](security.md)** — Définir la sécurité au niveau des lignes pour les utilisateurs
- **[Journalisation d'audit](audit-logging.md)** — Examiner les activités des utilisateurs
- **[Gestion des domaines d'activité](metadata-management.md)** — Organiser le contenu

---

**Voir aussi :** [Guide de l'administrateur](../admin-guide/), [Référence de l'API - Utilisateurs](../../api/endpoints.md#users)
