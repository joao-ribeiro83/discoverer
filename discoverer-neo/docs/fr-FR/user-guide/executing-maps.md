# Exécution de cartes

Découvrez comment exécuter des cartes et consulter les résultats.

## Exécuter une carte

### Depuis vos cartes

1. Cliquez sur **Cartes** dans la barre latérale
2. Sélectionnez une carte dans **Mes cartes** ou **Partagées avec moi**
3. Cliquez sur **Exécuter**

### Depuis un domaine d'activité

1. Cliquez sur **Domaines d'activité** → sélectionnez un domaine
2. Recherchez une carte dans la section **Cartes**
3. Cliquez sur **Exécuter**

## Fournir des paramètres

Si votre carte comporte des paramètres, un panneau de saisie s'affiche :

1. Saisissez les valeurs de chaque paramètre **Obligatoire**
2. Les paramètres facultatifs peuvent rester vides (la valeur par défaut est utilisée)
3. Cliquez sur **Exécuter** pour lancer l'exécution

**Exemple :**
```
Start Date: [2026-01-01]
End Date: [2026-12-31]
Region: [EMEA]
```

## Consulter les résultats

Une fois l'exécution terminée, vous voyez :

### Table de résultats

- **Colonnes** — Selon les éléments sélectionnés dans la carte
- **Lignes** — Filtrées et triées selon la définition de la carte
- **Pagination** — Si les résultats dépassent la taille de page

### Informations sur les résultats

- **Nombre total de lignes** — Nombre total de lignes correspondant aux filtres
- **Durée d'exécution** — Temps qu'a pris la requête
- **Exécuté par** — Votre nom d'utilisateur
- **Exécuté le** — Horodatage

## Pagination

Pour les jeux de résultats volumineux :

- **Page suivante** — Charger plus de lignes
- **Charger plus** — Ajouter des lignes supplémentaires à la vue actuelle
- Les résultats se chargent par pages (par défaut : 100 lignes par page)

## Trier les résultats

Cliquez sur les en-têtes de colonne pour trier :
- **Premier clic** — Tri croissant (A → Z)
- **Deuxième clic** — Tri décroissant (Z → A)
- **Troisième clic** — Effacer le tri

**Remarque :** les tris multicolonnes se définissent dans le générateur de cartes, et non ici.

## Rechercher dans les résultats

Utilisez la zone de recherche au-dessus des résultats pour filtrer les lignes visibles par mot-clé :
- Recherche dans toutes les colonnes
- Insensible à la casse
- Filtrage en temps réel (ne réexécute pas la requête)

## Actions sur les colonnes

Survolez les en-têtes de colonne pour afficher les options :
- **Masquer la colonne** — Masquer temporairement de la vue
- **Ajuster la largeur** — Faire glisser le bord de la colonne pour la redimensionner
- **Copier la valeur** — Copier la valeur de la cellule dans le presse-papiers

## Télécharger les résultats

Consultez [Exportation de données](exporting-data.md).

## Exécution asynchrone (requêtes longues)

Pour les requêtes qui prennent plus de 30 secondes :

1. Cliquez sur **Exécuter en arrière-plan**
2. Vous revenez au tableau de bord
3. Consultez **Tâches planifiées** ou **Historique d'exécution** pour connaître l'état

Valeurs d'état :
- **PENDING** — En file d'attente, en attente d'exécution
- **PROCESSING** — En cours d'exécution
- **COMPLETED** — Terminé, résultats disponibles
- **FAILED** — La requête a échoué (voir l'erreur)

Cliquez sur une tâche terminée pour consulter les résultats.

## Historique d'exécution

Consultez les exécutions récentes d'une carte :

1. Ouvrez une carte → cliquez sur **Historique**
2. Consultez la liste des exécutions récentes avec :
   - Date/heure d'exécution
   - Utilisateur qui l'a exécutée
   - Nombre de lignes renvoyées
   - Durée d'exécution

Cliquez sur une ligne pour consulter à nouveau ces résultats.

## Dépannage

### Délai d'expiration de la requête

Si une requête prend trop de temps :
- Vérifiez si les paramètres sont trop larges (p. ex. absence de filtre de date)
- Contactez votre administrateur pour optimiser les données sous-jacentes

### Aucun résultat

Si une requête ne renvoie aucune ligne :
- Vérifiez que les conditions sont correctes
- Vérifiez les valeurs des paramètres
- Essayez d'exécuter sans les filtres facultatifs

### Erreur de connexion

Si le message « Échec de la connexion » s'affiche :
- La source de données est temporairement indisponible
- Réessayez dans quelques instants
- Contactez votre administrateur si le problème persiste

## Et ensuite ?

- **[Exportation de données](exporting-data.md)** — Télécharger les résultats au format Excel ou CSV
- **[Planification de cartes](scheduling.md)** — Exécuter automatiquement des cartes selon une planification
- **[Partage de cartes](sharing.md)** — Partager des requêtes avec vos collègues

---

**Voir aussi :** [Création de cartes](building-maps.md), [Guide de l'utilisateur](../user-guide/)
