# Exécutions de cartes, rétention et purge automatique

Découvrez comment les exécutions de cartes sont mises en file d'attente,
combien de temps leurs résultats restent valides, et comment la purge
automatique en arrière-plan les nettoie.

## Qu'est-ce qu'une exécution de carte ?

Chaque exécution de carte — un utilisateur qui clique sur **Exécuter**, et
chaque exécution planifiée — passe par une seule file d'attente en
arrière-plan (`map-runs`) et enregistre ses lignes dans Postgres. Rien
n'interroge Oracle deux fois pour la même carte, le même utilisateur et les
mêmes paramètres tant qu'un résultat valide existe déjà : la seconde demande
renvoie instantanément le résultat enregistré au lieu de relancer la requête.

Seul l'aperçu du générateur de cartes lui-même
(`POST /api/maps/:id/execute`, limité à 1 000 lignes) contourne la file
d'attente — c'est une vérification rapide et non enregistrée pendant la
composition d'une carte, pas une exécution.

## Ordre par utilisateur

Les exécutions d'un même utilisateur s'exécutent strictement une par une,
dans l'ordre où elles ont été demandées. Les exécutions d'utilisateurs
différents ne sont pas ordonnées entre elles — le processus exécute
simplement le tour d'un utilisateur, puis passe au suivant.
`MAP_RUN_WORKER_CONCURRENCY` définit combien d'exécutions d'utilisateurs
différents peuvent tourner en même temps.

## Rétention

| Type | Le résultat reste valide jusqu'à |
|---|---|
| **En direct** (un utilisateur a cliqué sur Exécuter) | achèvement + `MAP_RUN_LIVE_TTL_HOURS`, **plafonné à 24 heures quelle que soit la valeur du paramètre** |
| **Planifiée** | achèvement + la propre durée de conservation de cette planification, en jours (voir ci-dessous) |
| Toute exécution en échec | achèvement + 24 heures — conservée comme historique, pas comme donnée |
| En file d'attente ou en cours depuis plus longtemps que `MAP_RUN_STALE_HOURS` | marquée **Échouée** par la purge automatique — un filet de sécurité après un plantage du worker |

Une exécution en direct n'est jamais utilisable plus d'un jour, quelle que
soit la valeur que vous donnez à `MAP_RUN_LIVE_TTL_HOURS`. C'est une limite
stricte, pas une valeur par défaut.

### Rétention planifiée (`BR_EXPIRY`)

La durée de conservation d'une planification vient de son propre champ
`result_retention_days` (30 jours par défaut ; à définir via
`resultRetentionDays` sur `POST`/`PUT /api/schedules` — il n'existe pas
encore de champ dans le formulaire de planification pour cela). Les
planifications importées d'un EUL Discoverer historique récupèrent cette
valeur automatiquement depuis `EUL4_BATCH_REPORTS.BR_EXPIRY` — la colonne de
durée de conservation en jours que Discoverer lui-même utilisait pour les
résultats des rapports par lots (les valeurs 1, 4, 10 et 30 ont été
observées sur des environnements réels). Un `BR_EXPIRY` manquant est importé
comme 30 jours, la même valeur par défaut qu'une planification créée
directement dans Neo.

## La purge automatique

Le worker d'exécution de cartes exécute aussi un nettoyage périodique, selon
le même modèle `setInterval` interne que le nettoyage des exportations :

- Toutes les `MAP_RUN_CLEANUP_INTERVAL_MINUTES`, il supprime toute exécution
  dont le `expires_at` est dépassé, en cascade jusqu'à ses lots de lignes
  enregistrés.
- Dans la même passe, il fait échouer toute exécution encore **En file
  d'attente** ou **En cours** depuis plus de `MAP_RUN_STALE_HOURS` — cela ne
  se déclenche que si un worker a planté en cours d'exécution et n'a jamais
  atteint un état final de lui-même.

Il n'existe pas de commande de purge manuelle. Pour forcer un nettoyage
anticipé, redémarrez le backend (ou le worker autonome) avec un
`MAP_RUN_CLEANUP_INTERVAL_MINUTES` plus court, ou supprimez l'exécution
depuis la [page Exécutions](../user-guide/executing-maps.md#la-page-exécutions)
/ `DELETE /api/runs/:id`.

## Configuration

| Variable | Par défaut | Description |
|---|---|---|
| `MAP_RUN_WORKER_ENABLED` | actif dans tous les environnements sauf `test` | Exécuter le worker d'exécution de cartes dans ce processus |
| `MAP_RUN_WORKER_CONCURRENCY` | 3 (max 8) | Combien d'exécutions d'utilisateurs différents s'exécutent en même temps |
| `MAP_RUN_LIVE_TTL_HOURS` | 24 | Validité d'un résultat en direct — plafonnée à 24 quelle que soit cette valeur |
| `MAP_RUN_MAX_ROWS` | 100000 | Lignes capturées par exécution avant d'être marquée tronquée |
| `MAP_RUN_BATCH_SIZE` | 1000 | Lignes par lot enregistré (JSONB Postgres) |
| `MAP_RUN_CLEANUP_INTERVAL_MINUTES` | 15 | Fréquence d'exécution de la purge automatique |
| `MAP_RUN_STALE_HOURS` | 24 | Une exécution En file d'attente/En cours plus ancienne que cela est marquée Échouée |

Consultez
[Configuration](../../deployment/configuration.md#map-runs-queue-retention-sweeper)
pour savoir comment définir ces variables dans `.env` ou les fichiers
compose, et [Déploiement Docker](../../deployment/docker.md) pour exécuter le
worker d'exécution de cartes dans son propre conteneur.

## Supervision

La profondeur de la file `map-runs` est exposée aux côtés des jauges des
files d'exportation et du planificateur — consultez
[Supervision](../../deployment/monitoring.md).

## Et ensuite ?

- **[Planification de cartes](../user-guide/scheduling.md)** — comment l'exécution propre à une planification est mise en file d'attente
- **[Sources de données](data-sources.md)** — la connexion Oracle sur laquelle s'exécutent les exécutions de cartes
- **[Configuration](../../deployment/configuration.md)** — la référence complète des variables d'environnement

---

**Voir aussi :** [Exécution de cartes](../user-guide/executing-maps.md), [Guide de l'administrateur](../admin-guide/)
