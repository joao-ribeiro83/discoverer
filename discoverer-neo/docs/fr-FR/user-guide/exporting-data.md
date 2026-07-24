# Exportation de données

Découvrez comment télécharger les résultats de cartes sous forme de fichiers Excel ou CSV.

## Formats d'exportation

| Format | Idéal pour | Fonctionnalités |
|--------|----------|----------|
| **XLSX** (Excel) | Rapports professionnels, analyse | Mise en forme, feuilles multiples, graphiques |
| **CSV** (valeurs séparées par des virgules) | Intégration de données, feuilles de calcul | Texte brut, compatibilité universelle |

## Exporter les résultats

### Depuis l'exécution d'une carte

1. Après avoir exécuté une carte, cliquez sur le bouton **Exporter**
2. Choisissez le format : **XLSX** ou **CSV**
3. Cliquez sur **Exporter**

La tâche d'exportation est mise en file d'attente et son traitement va commencer.

### État du téléchargement

Un panneau d'état s'affiche indiquant :
- **État** — PENDING, PROCESSING, COMPLETED, FAILED
- **Taille du fichier** — Une fois terminé
- **Expire** — Date à laquelle le fichier sera supprimé (par défaut : 7 jours)

Cliquez sur **Télécharger** lorsque l'état est **COMPLETED**.

### Options d'exportation

Lors de l'exportation, vous pouvez choisir :
- **Toutes les lignes** — Exporter toutes les lignes correspondantes (mêmes filtres que la carte)
- **Page actuelle** — Exporter uniquement les lignes visibles
- **Inclure la mise en forme** — (XLSX uniquement) Appliquer la mise en forme d'affichage et les couleurs

## Stockage des fichiers

Les fichiers exportés sont stockés temporairement :
- **Durée de conservation** — 7 jours (configurable par l'administrateur)
- **Emplacement** — Répertoire d'exportation du serveur
- **Après expiration** — Les fichiers sont automatiquement supprimés

## Exportations volumineuses

Pour les jeux de résultats très volumineux :

1. Les exportations s'exécutent de manière asynchrone en arrière-plan
2. Vous pouvez quitter la page et revenir plus tard
3. Consultez la section **Exportations** pour voir toutes les exportations en attente/terminées

**Conseils pour les exportations volumineuses :**
- Les exportations mobilisent une connexion à la base de données pendant toute leur durée
- Plusieurs exportations simultanées peuvent être limitées afin de préserver les performances
- Les exportations très volumineuses (des millions de lignes) peuvent échouer ou expirer
- Contactez l'administrateur pour augmenter les limites d'exportation si nécessaire

## Résoudre les problèmes de téléchargement

### Gestionnaire de téléchargements du navigateur

Les fichiers téléchargés apparaissent dans l'emplacement de téléchargement par défaut de votre navigateur :
- **Chrome/Firefox :** consultez le dossier Téléchargements
- **Safari :** consultez le dossier Téléchargements ou la notification
- **IE/Edge :** peut ouvrir une boîte de dialogue d'enregistrement

### Échec de l'exportation

Si l'état indique **FAILED** :
- Consultez le message d'erreur (s'il est affiché)
- Essayez d'exporter moins de lignes (filtrez davantage)
- Contactez l'administrateur si le problème persiste

### Fichier corrompu

Si le fichier téléchargé est corrompu :
- Essayez d'exporter à nouveau
- Utilisez un format différent (XLSX ↔ CSV)
- Vérifiez l'espace disque disponible sur votre ordinateur

## Consulter les fichiers exportés

### XLSX (Excel)

Ouvrez avec :
- Microsoft Excel
- Google Sheets
- LibreOffice Calc
- Toute application de feuille de calcul

**Fonctionnalités du format XLSX :**
- En-têtes de colonne issus des noms d'affichage de la carte
- Types de données préservés (nombres, dates)
- Mise en forme appliquée (si « Inclure la mise en forme » est sélectionné)
- Prise en charge d'un grand nombre de lignes (jusqu'à environ 1 million par feuille)

### CSV

Ouvrez avec :
- Applications de feuille de calcul (Excel, Sheets, Calc)
- Éditeurs de texte (Bloc-notes, VS Code)
- Outils de données (Python, R, SQL)

**Format CSV :**
- Séparé par des virgules par défaut
- Encodé en UTF-8
- Les valeurs entre guillemets contiennent des caractères spéciaux
- Adapté à l'importation dans des bases de données ou des scripts

## Partager les fichiers exportés

Une fois téléchargés, les fichiers exportés ne sont plus liés à Discoverer Neo :
- Envoyez-les par e-mail à vos collègues
- Chargez-les sur un stockage cloud
- Importez-les dans d'autres systèmes
- Partagez-les via le système de fichiers de votre organisation

## Conseils de performance

1. **Filtrez d'abord** — Appliquez des conditions dans la carte pour réduire le nombre de lignes
2. **Limitez la plage de dates** — Utilisez des paramètres de date pour restreindre les résultats
3. **Excluez le texte volumineux** — Retirez les colonnes de texte larges si elles ne sont pas nécessaires
4. **Planifiez en heures creuses** — Les exportations volumineuses s'exécutent plus vite pendant les périodes de faible activité

## Et ensuite ?

- **[Planification de cartes](scheduling.md)** — Automatiser la génération d'exportations
- **[Partage de cartes](sharing.md)** — Partager des requêtes avec vos collègues
- **[Création de cartes](building-maps.md)** — Optimiser votre carte pour l'exportation

---

**Voir aussi :** [Exécution de cartes](executing-maps.md), [Guide de l'utilisateur](../user-guide/)
