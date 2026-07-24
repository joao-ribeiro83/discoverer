# Planification de cartes

Découvrez comment exécuter automatiquement des cartes selon une planification et recevoir les résultats.

## Qu'est-ce que la planification ?

La **planification** exécute une carte automatiquement à des moments définis, stocke les résultats et, en option, envoie des notifications.

## Créer une planification

### Étape 1 : Ouvrir la carte

1. Ouvrez la carte que vous souhaitez planifier
2. Cliquez sur **Planifier** ou **+ Nouvelle planification**

### Étape 2 : Configurer la planification

Saisissez :

- **Nom de la planification** — Nom descriptif (p. ex. « Rapport de ventes quotidien »)
- **Description** — Notes facultatives
- **Expression Cron** — Quand exécuter (voir les exemples ci-dessous)
- **Paramètres** — Valeurs fixes (si la carte comporte des paramètres)
- **État** — Bascule Actif/Inactif
- **E-mail de notification** — (Facultatif) E-mail à l'issue de l'exécution

### Expressions Cron

Les expressions Cron définissent la planification au format Unix standard :

```
0 9 * * MON-FRI   →   Every weekday at 9:00 AM
0 0 * * *         →   Every day at midnight
0 */6 * * *       →   Every 6 hours
0 0 1 * *         →   First day of month at midnight
```

**Format :** `[minute] [hour] [day-of-month] [month] [day-of-week]`

| Champ | Valeurs | Exemple |
|-------|--------|---------|
| Minute | 0–59 | 0, 15, 30, 45 |
| Heure | 0–23 | 0 (minuit), 9 (9 h), 18 (18 h) |
| Jour du mois | 1–31 | 1 (1er), 15 (15) |
| Mois | 1–12 ou JAN-DEC | 1 (janv.), 6 (juin) |
| Jour de la semaine | 0–6 ou SUN-SAT | 0 (dim.), 5 (ven.) |

**Expressions courantes :**

| Planification | Expression |
|----------|-----------|
| Tous les jours à 9 h | `0 9 * * *` |
| En semaine à 8 h | `0 8 * * MON-FRI` |
| Tous les lundis à 9 h | `0 9 * * MON` |
| Toutes les 4 heures | `0 */4 * * *` |
| Premier jour du mois | `0 0 1 * *` |
| Toutes les 30 minutes | `*/30 * * * *` |

### Étape 3 : Définir les paramètres

Si votre carte comporte des paramètres, saisissez des valeurs fixes :

- **Paramètres fixes** — Même valeur à chaque exécution
- (Les paramètres facultatifs sans valeur utilisent les valeurs par défaut)

**Exemple :** rapport de ventes quotidien pour la région Amériques :
- Paramètre `region` = « AMERICAS »

### Étape 4 : Enregistrer la planification

Cliquez sur **Enregistrer la planification**. La planification devient **Active** immédiatement (si elle est activée).

## Gérer les planifications

### Consulter les planifications

1. Cliquez sur **Planifications** dans la barre latérale
2. Consultez la liste de toutes vos planifications avec :
   - Nom de la planification et carte
   - Heure de la prochaine exécution
   - État de la dernière exécution
   - Bascule Actif/Inactif

### Modifier une planification

1. Cliquez sur la planification
2. Modifiez l'expression Cron, les paramètres ou l'e-mail
3. Cliquez sur **Enregistrer**

Les modifications prennent effet immédiatement.

### Désactiver/Activer

Basculez le commutateur **Actif** :
- **Désactivé** — La planification ne s'exécute pas
- **Activé** — La planification s'exécute au prochain intervalle

### Supprimer une planification

1. Cliquez sur la planification → **Supprimer**
2. Confirmez la suppression

La planification est supprimée ; les résultats antérieurs restent disponibles.

## Consulter les résultats

### Depuis la page Planifications

1. Cliquez sur une planification
2. Consultez l'**Historique d'exécution** qui affiche :
   - Date/heure de l'exécution planifiée
   - Heure d'exécution réelle (peut légèrement différer du Cron)
   - État (SUCCESS, FAILED, TIMEOUT)
   - Nombre de lignes renvoyées
   - Durée d'exécution

### Télécharger les résultats

Cliquez sur une exécution passée pour :
- Consulter les résultats (même vue tabulaire que l'exécution manuelle)
- Exporter au format Excel ou CSV

## Notifications

Si vous avez configuré un **e-mail de notification**, vous recevrez :

**En cas de succès :**
```
Subject: [Discoverer Neo] Schedule Complete: Daily Sales Report
To: your-email@example.com

Your scheduled report "Daily Sales Report" completed successfully.
- Rows: 1,524
- Duration: 12 seconds
- View: [link to results]
```

**En cas d'échec :**
```
Subject: [Discoverer Neo] Schedule Failed: Daily Sales Report
To: your-email@example.com

Your scheduled report "Daily Sales Report" failed.
- Error: Connection timeout
- Time: 2026-07-19 09:15:32 UTC
```

## Considérations relatives au fuseau horaire

Les expressions Cron sont évaluées dans le **fuseau horaire du serveur** (UTC par défaut). Si votre serveur se trouve dans un fuseau horaire différent, ajustez les expressions en conséquence.

**Exemple :** pour une exécution à 9 h EST (UTC-5) :
- Utilisez `0 14 * * *` (14 h UTC = 9 h EST en hiver, 10 h EDT en été)

## Exportation planifiée

Les planifications créent des fichiers de résultats, et non des pièces jointes d'e-mail. Pour automatiser l'exportation Excel :

1. Créez une planification qui capture les résultats
2. Configurez un e-mail de notification pour être alerté à l'issue de l'exécution
3. Consultez la planification pour télécharger les résultats au format XLSX/CSV

## Limites et considérations

- **Exécutions simultanées** — Une seule exécution par planification à la fois
- **Requêtes de longue durée** — Si une carte dépasse le délai d'expiration, l'exécution échoue
- **Planifications en échec** — Les exécutions en échec ne sont pas relancées automatiquement
- **Utilisation des ressources** — De nombreuses planifications simultanées peuvent affecter les performances du système

## Dépannage

### La planification ne s'est pas exécutée

- Vérifiez que le commutateur Actif est sur **Activé**
- Vérifiez l'expression Cron (utilisez un validateur Cron en ligne)
- Consultez les journaux du serveur pour détecter d'éventuelles erreurs

### Heure d'exécution incorrecte

- Vérifiez le fuseau horaire du serveur
- Confirmez l'expression Cron (les minutes/heures sont peut-être inversées)

### Erreur de mémoire insuffisante

- La carte est trop volumineuse pour être planifiée
- Ajoutez des filtres ou des paramètres pour réduire le nombre de lignes
- Contactez l'administrateur

## Et ensuite ?

- **[Partage de cartes](sharing.md)** — Partager les rapports planifiés avec vos collègues
- **[Exportation de données](exporting-data.md)** — Télécharger les résultats planifiés
- **[Création de cartes](building-maps.md)** — Optimiser les cartes pour la planification

---

**Voir aussi :** [Guide de l'utilisateur](../user-guide/), [Référence de l'API - Planifications](../../api/endpoints.md#schedules)
