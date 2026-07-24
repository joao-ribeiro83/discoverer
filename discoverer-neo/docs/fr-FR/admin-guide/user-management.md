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

### Mots de passe initiaux

Les nouveaux utilisateurs reçoivent des mots de passe initiaux. Bonne pratique :

1. Définissez un mot de passe temporaire (p. ex. « TempPassword123! »)
2. Demandez à l'utilisateur de le changer à la première connexion
3. L'utilisateur se connecte, clique sur **Profil** → **Changer le mot de passe**
4. Saisit un nouveau mot de passe

### Réinitialisation du mot de passe

Si un utilisateur oublie son mot de passe (en tant qu'administrateur) :

1. Panneau d'administration → **Utilisateurs**
2. Cliquez sur l'utilisateur → **Réinitialiser le mot de passe**
3. Le système génère un mot de passe temporaire
4. Transmettez-le à l'utilisateur (par e-mail ou hors bande)
5. L'utilisateur change son mot de passe à la première connexion

### Forcer le changement de mot de passe

Pour exiger le changement de mot de passe d'un utilisateur :

1. Cliquez sur l'utilisateur → **Modifier**
2. Cochez **Forcer le changement de mot de passe à la connexion**
3. Enregistrez

L'utilisateur sera invité à changer son mot de passe à la prochaine connexion.

## Préférences utilisateur

Les utilisateurs peuvent gérer leurs propres préférences d'interface sans intervention d'un administrateur :

- **Langue** — Les utilisateurs sélectionnent leur langue d'interface préférée (English, Português, Français, Español) dans les Paramètres
- **Thème** — Les utilisateurs choisissent leur thème visuel préféré (Clair, Sombre, Contraste élevé) dans les Paramètres

Ces préférences sont en libre-service et propres à chaque utilisateur. Chaque utilisateur peut accéder aux Paramètres via la barre latérale ou le menu déroulant de profil pour personnaliser son expérience. Aucune configuration par un administrateur n'est nécessaire.

## Statut de l'utilisateur

### Actif/Inactif

Basculez le statut de l'utilisateur :

- **Actif** — L'utilisateur peut se connecter
- **Inactif** — L'utilisateur ne peut pas se connecter (suppression réversible)

Utile pour désactiver temporairement sans supprimer les comptes.

### Compte verrouillé

Aucun verrouillage manuel de compte dans la version actuelle. Les utilisateurs peuvent réessayer leur mot de passe indéfiniment.

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
