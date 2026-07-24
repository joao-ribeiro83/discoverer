# Partage de cartes

Découvrez comment partager des cartes avec vos collègues et gérer les autorisations.

## Pourquoi partager des cartes ?

Partagez des cartes pour :
- Collaborer à l'élaboration de rapports
- Donner à vos collègues l'accès à des requêtes communes
- Déléguer la maintenance à d'autres utilisateurs
- Créer des modèles réutilisables par l'équipe

## Partager une carte

### Étape 1 : Ouvrir la carte

1. Cliquez sur **Cartes** → sélectionnez votre carte
2. Cliquez sur **Partager** ou **Gérer le partage**

### Étape 2 : Ajouter un utilisateur

Dans le panneau de partage :

1. Cliquez sur **+ Ajouter un utilisateur** ou **+ Accorder l'accès**
2. Sélectionnez un utilisateur dans la liste
3. Choisissez le niveau d'autorisation (voir ci-dessous)
4. Cliquez sur **Accorder**

L'utilisateur peut désormais accéder à la carte avec le niveau d'autorisation sélectionné.

## Niveaux d'autorisation

| Autorisation | Afficher | Modifier | Supprimer | Exporter | Exécuter | Partager |
|-----------|------|------|--------|--------|-----|-------|
| **VIEW** | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ |
| **EDIT** | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ |
| **EXPORT** | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ |

- **VIEW** — Peut consulter la définition de la carte et l'exécuter (lecture seule)
- **EDIT** — Peut modifier la carte et la partager avec d'autres
- **EXPORT** — Peut exécuter la carte et exporter les résultats
- **Propriétaire** — Vous (pouvez toujours modifier, partager, supprimer)

## Public ou privé

Basculez sur **Public** pour rendre une carte visible par tous les utilisateurs :

- **Privé** (par défaut) — Partagé uniquement avec des utilisateurs spécifiques
- **Public** — Tous les utilisateurs authentifiés peuvent la consulter et l'exécuter

## Modifier les autorisations

Pour modifier le niveau d'accès d'un utilisateur :

1. Recherchez l'utilisateur dans la liste de partage
2. Cliquez sur la liste déroulante des autorisations
3. Sélectionnez le nouveau niveau
4. Les modifications prennent effet immédiatement

## Révoquer l'accès

Pour retirer l'accès d'un utilisateur :

1. Recherchez l'utilisateur dans la liste de partage
2. Cliquez sur **Retirer** ou sur l'icône de corbeille
3. Confirmez le retrait

L'utilisateur perd son accès immédiatement.

## Partagées avec moi

Pour consulter les cartes partagées avec vous :

1. Cliquez sur **Cartes** dans la barre latérale
2. Cliquez sur l'onglet **Partagées avec moi**
3. Parcourez les cartes partagées

Vous pouvez :
- **Afficher** — Consulter la définition de la carte
- **Exécuter** — Exécuter la carte avec VOS autorisations dans le domaine d'activité
- **Exporter** — Enregistrer les résultats au format Excel/CSV (si l'autorisation EXPORT est accordée)
- **Modifier** — Modifier (si l'autorisation EDIT est accordée)

## Bonnes pratiques de partage

### Conventions de nommage

Utilisez des noms descriptifs pour les cartes partagées :
- ✓ « Rapport de ventes hebdomadaire - Région EMEA »
- ✗ « Rapport1 »

### Niveaux d'autorisation

Accordez l'autorisation minimale nécessaire :
- **VIEW** pour les rapports en lecture seule
- **EDIT** uniquement aux collègues de confiance qui assurent la maintenance de la carte
- **EXPORT** aux utilisateurs qui ont besoin des données mais pas de modifier la carte

### Documentation

Ajoutez des descriptions aux cartes partagées :
1. Modifiez la carte
2. Mettez à jour le champ **Description**
3. Expliquez ce que montre la carte, la signification des paramètres et la planification de rafraîchissement des données

**Exemple :**
```
Rapport des ventes par région

Affiche le total des ventes par région pour la période sélectionnée.
Paramètres :
- start_date : date de début du rapport (par défaut : premier jour du mois en cours)
- end_date : date de fin du rapport (par défaut : aujourd'hui)

Mis à jour quotidiennement à 9 h UTC.
Contact : sales-analytics@example.com pour toute question.
```

### Gestion des versions

Pour les cartes partagées critiques :
- Indiquez le numéro de version dans la description
- Incrémentez la version lors de modifications majeures
- Informez les utilisateurs des changements incompatibles

## Partage entre domaines d'activité

Ne partagez des cartes que dans les domaines d'activité où les destinataires disposent de l'accès **VIEW** :

- **S'ils n'ont pas l'accès VIEW :** ils ne peuvent pas exécuter la carte, même partagée
- **S'ils n'ont pas l'accès EDIT :** ils ne peuvent pas la modifier, même avec un partage EDIT

Contactez d'abord votre administrateur pour accorder l'accès au domaine d'activité.

## Flux de collaboration

**Scénario : élaborer un rapport à plusieurs**

1. **L'utilisateur A** crée un brouillon de carte
2. **L'utilisateur A** le partage avec **l'utilisateur B** avec l'autorisation **EDIT**
3. **L'utilisateur B** exécute la carte et propose des modifications
4. **L'utilisateur A** modifie la carte
5. **L'utilisateur B** vérifie les modifications
6. **L'utilisateur A** la rend **Publique** ou accorde l'accès **VIEW uniquement** à une équipe plus large

## Dépannage

### « Utilisateur introuvable »

- L'utilisateur n'existe pas dans le système
- Contactez l'administrateur pour créer le compte utilisateur

### « Autorisations insuffisantes pour exécuter »

- Vous disposez d'un partage EDIT, mais vous n'avez pas l'accès VIEW dans le domaine d'activité
- Contactez l'administrateur pour obtenir l'accès au domaine d'activité

### « Impossible de partager avec cet utilisateur »

- Le rôle de l'utilisateur (p. ex. VIEWER) peut restreindre certaines actions
- Contactez l'administrateur

## Et ensuite ?

- **[Planification de cartes](scheduling.md)** — Automatiser la distribution des rapports partagés
- **[Création de cartes](building-maps.md)** — Créer des cartes à partager
- **[Guide de l'administrateur - Utilisateurs](../admin-guide/user-management.md)** — Gérer les comptes utilisateurs

---

**Voir aussi :** [Guide de l'utilisateur](../user-guide/), [Référence de l'API - Partages](../../api/endpoints.md#map-shares)
