# Gestion des utilisateurs

Découvrez comment créer des utilisateurs, attribuer des rôles et gérer les autorisations sur les domaines d'activité.

## Rôles utilisateur

Discoverer Neo comporte quatre rôles utilisateur aux capacités différentes :

| Rôle | Capacités |
|------|-------------|
| **ADMIN** | Accès système complet — utilisateurs, domaines d'activité, sources de données, journaux d'audit |
| **MANAGER** | Créer et gérer des domaines d'activité, accorder des autorisations à d'autres utilisateurs |
| **USER** | Créer des cartes, exécuter des requêtes, partager des cartes avec des collègues |
| **VIEWER** | Accès en lecture seule aux cartes et tableaux de bord partagés |

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
3. Cliquez sur **+ Accorder une autorisation**
4. Sélectionnez :
   - **Utilisateur** — Dans la liste déroulante
   - **Niveau d'autorisation** — CREATE, EDIT, DELETE, EXPORT, SCHEDULE ou VIEW
5. Cliquez sur **Accorder**

**Niveaux d'autorisation dans un domaine d'activité :**

| Autorisation | Cartes | Métadonnées | Planification | Exportation |
|-----------|------|----------|----------|--------|
| **CREATE** | Créer de nouvelles cartes | ✗ | ✗ | ✗ |
| **EDIT** | Modifier les cartes | ✗ | ✗ | ✗ |
| **DELETE** | Supprimer les cartes | ✗ | ✗ | ✗ |
| **EXPORT** | Exporter les résultats | ✓ | ✗ | ✓ |
| **SCHEDULE** | Créer des planifications | ✓ | ✗ | ✓ |
| **VIEW** | Exécuter/consulter les cartes | ✓ | ✓ | ✗ |

### Accorder plusieurs autorisations

Les utilisateurs ont généralement besoin de plusieurs autorisations :

- **Utilisateurs de données :** VIEW + EXPORT (peuvent exécuter des cartes et télécharger)
- **Créateurs de rapports :** VIEW + CREATE + EDIT (peuvent créer et tester)
- **Publieurs :** CREATE + EDIT + EXPORT + SCHEDULE (cycle de vie complet des cartes)

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

Les responsables (MANAGER) peuvent déléguer la création d'utilisateurs et la gestion des autorisations :

1. Promouvez des utilisateurs au rôle **MANAGER**
2. Les responsables peuvent alors :
   - Créer des utilisateurs
   - Accorder des autorisations dans leurs domaines d'activité
   - Gérer l'accès d'autres utilisateurs

Les responsables ne peuvent pas :
- Créer d'autres responsables ou administrateurs
- Accéder aux paramètres système ou aux journaux d'audit
- Gérer les sources de données

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
- Chefs d'équipe → rôle **MANAGER** (s'ils gèrent des domaines d'activité)
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
