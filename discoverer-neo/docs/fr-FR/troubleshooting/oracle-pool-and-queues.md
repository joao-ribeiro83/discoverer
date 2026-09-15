# Lecture de l'épuisement du pool Oracle et de l'accumulation de la file d'attente

Les noms de métriques ci-dessous sont documentés en détail dans
[Monitoring](../deployment/monitoring.md#key-metrics).

## Le pool Oracle a "perdu" des connexions (BE-04)

Symptôme : les exécutions de carte sur une source de données commencent à
expirer avec `Timed out acquiring an Oracle connection after <N>ms`, mais
`oracle_pool_connections{state="in_use"}` n'atteint jamais
`oracle_pool_connections{state="max"}`.

Cet écart est le signal. Un pool qui est vraiment occupé affiche `in_use` épinglé
à `max` ; un pool qui a des fuites d'emplacements (un bug dans la course au
timeout d'acquisition de `getConnection` — voir BE-04, corrigé dans
`backend/src/services/oracle-connection-pool.ts`) affiche `in_use` montant à
un nombre en dessous de `max` et y restant tandis que `waiting` grandit et
`oracle_pool_acquisition_timeouts_total` continue de monter. Seul un redémarrage
du processus récupère un pool qui a réellement perdu des emplacements ; si la
correction régresse, ce modèle de redémarrage-pour-récupération est le signal à
vérifier en premier.

Lisez tous les quatre ensemble :

```promql
oracle_pool_connections{data_source_id="<id>", state="in_use"}
oracle_pool_connections{data_source_id="<id>", state="max"}
oracle_pool_connections{data_source_id="<id>", state="waiting"}
oracle_pool_acquisition_timeouts_total
```

`oracle_pool_acquisition_failures_total` et
`oracle_pool_acquisition_duration_avg_milliseconds` (par source de données)
distinguent une base de données lente (latence croissante, peu d'échecs) d'une
mal configurée (échecs croissants indépendamment de la latence).

## Accumulation de file d'attente d'exportation ou de programmateur

`export_queue_jobs{state="waiting"}` ou `scheduler_queue_jobs{state="waiting"}`
restant au-dessus de quelques chiffres pendant plus de quelques minutes signifie
que les travaux sont mis en file d'attente plus rapidement que les workers les
drainent :

1. Vérifiez `export_jobs_total{outcome="failed"}` / `schedule_runs_total{outcome="failed"}`
   — un taux d'échec croissant aux côtés de l'accumulation signifie généralement
   que les travaux sont en reprise (backoff exponentiel de BullMQ) plutôt que de
   drainer, pas que plus de capacité soit nécessaire.
2. Si les échecs sont plats et `waiting` grandit toujours, mettez à l'échelle
   la concurrence des workers (`EXPORT_WORKER_CONCURRENCY`) ou exécutez
   `workers/export.standalone.ts` / `scheduler.standalone.ts` dans leur propre
   conteneur au lieu de en-processus.
3. Les deux métriques de profondeur de file d'attente sont lues chaque 15s à partir
   du propre `getJobCounts()` de BullMQ à l'intérieur du processus du worker
   (`export.worker.ts`, `scheduler.worker.ts`) — une métrique coincée à sa
   dernière valeur tandis que les travaux s'exécutent visiblement signifie que
   le processus du worker lui-même est bloqué, pas que la file soit vraiment
   inactive.

## Migration bloquée

`migration_running` coincé à `1` avec `migration_progress_percent` plat pendant
plus longtemps que le domaine ne prend normalement : le travail de migration est
bloqué, très probablement sur une seule lecture Oracle lente. L'étiquette `phase`
de `migration_progress_percent` nomme la table cible (ou `read`/`plan`/`write`
pour une réimportation de cartes uniquement) sur laquelle elle a rapporté les
progrès en dernier — vérifiez le décompte de lignes de cette table dans le schéma
EUL source pour tout ce qui est anormalement volumineux.
