# Partage de cartes

Découvrez comment partager des cartes avec vos collègues et gérer les autorisations.

## Pourquoi partager des cartes ?

Partagez des cartes pour :
- Collaborer à l'élaboration de rapports
- Donner à vos collègues l'accès à des requêtes communes
- Déléguer la maintenance à d'autres utilisateurs
- Créer des modèles réutilisables par l'équipe

## Partager une carte

### Qui peut partager

- Le **propriétaire** de la carte
- Un **MANAGER** — n'importe quelle carte
- Un **ADMIN** — n'importe quelle carte

Un utilisateur qui a reçu une carte, même avec EDIT, ne peut pas la transmettre.

### Étape 1 : Ouvrir la fenêtre de partage

1. Cliquez sur **Cartes**
2. Cliquez sur l'icône de partage sur la ligne de la carte, ou sur un classeur
   pour partager toutes les feuilles qu'il contient

### Étape 2 : Choisir les personnes et les niveaux

La fenêtre liste tous les utilisateurs. Les personnes qui ont déjà la carte
apparaissent en premier.

1. Saisissez du texte dans la zone de filtre pour trouver quelqu'un (facultatif)
2. Cliquez sur un niveau à côté de son nom : **Peut consulter**, **Peut
   exporter** ou **Peut modifier**. Survolez un niveau pour voir ce qu'il permet.

Le bouton foncé est le niveau actuel de la personne. Cliquez sur un autre niveau
pour le changer. Cliquez sur **✕** pour lui retirer la carte.

## Niveaux d'autorisation

| Autorisation | Afficher | Modifier | Supprimer | Exporter | Exécuter | Partager |
|-----------|------|------|--------|--------|-----|-------|
| **VIEW** | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ |
| **EDIT** | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ |
| **EXPORT** | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ |

- **VIEW** — Peut consulter la définition de la carte et l'exécuter (lecture seule)
- **EDIT** — Peut exécuter, exporter, planifier et modifier la carte (sans pouvoir la partager)
- **EXPORT** — Peut exécuter la carte, exporter les résultats et la planifier
- **Propriétaire** — Vous (pouvez toujours modifier, partager, supprimer)

## Public ou privé

Basculez sur **Public** pour rendre une carte visible par tous les utilisateurs :

- **Privé** (par défaut) — Partagé uniquement avec des utilisateurs spécifiques
- **Public** — Tous les utilisateurs authentifiés peuvent la consulter et l'exécuter

## Modifier ou révoquer l'accès

Dans la fenêtre de partage, cliquez sur un autre niveau pour le changer, ou sur
**✕** pour le retirer. La modification prend effet immédiatement.

Un ADMIN ou un MANAGER peut aussi le faire depuis **Utilisateurs** → l'icône de
carte sur la ligne d'un utilisateur. Cette liste affiche toutes les cartes que
l'utilisateur peut ouvrir, avec leur propriétaire. Vous pouvez y changer le
niveau d'un partage, le retirer ou attribuer la carte à un nouveau propriétaire.

## Copier une carte

Toute personne autre qu'un VIEWER peut copier une carte qu'elle voit : cliquez
sur l'icône de copie sur sa ligne dans **Cartes**. La copie est à vous, vous
pouvez donc la modifier. Son exécution exige toujours une autorisation sur le
domaine d'activité de la carte.

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
