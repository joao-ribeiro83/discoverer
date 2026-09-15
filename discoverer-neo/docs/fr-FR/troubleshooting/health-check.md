# Ce qu'un `/health` rouge signifie

`/health` (et `/api/health`) est une vérification de **préparation** : elle
rapporte si cette instance de backend peut réellement servir du trafic, et non
simplement si le processus Node s'exécute. Voir [Monitoring](../deployment/monitoring.md)
pour la répartition complète préparation vs vivacité (`/live` est le point de
vivacité, et il ne devient pas rouge pour l'une de ces raisons).

Un `503` de `/health` signifie que `database` ou `redis` dans le corps de la
réponse est `"disconnected"`:

```bash
curl http://localhost:3000/health
# {"status":"degraded","database":"disconnected","redis":"connected",...}
```

## `database: "disconnected"`

Le backend ne peut pas exécuter `SELECT 1` contre Postgres. Par ordre de
probabilité :

1. **Le conteneur Postgres est arrêté ou en cours de démarrage.**
   `docker compose -f docker-compose.prod.yml ps postgres` — s'il n'est pas
   `healthy`, vérifiez `docker compose -f docker-compose.prod.yml logs postgres`.
2. **`DATABASE_URL` est incorrect** (mauvais host/port/identifiants). Dans
   `docker-compose.prod.yml`, c'est construit à partir de `POSTGRES_USER` /
   `POSTGRES_PASSWORD` / `POSTGRES_DB` dans `.env` — confirmez qu'ils correspondent
   à ce avec quoi Postgres a réellement été initialisé (changer
   `POSTGRES_PASSWORD` après que le volume existe déjà ne change pas
   rétroactivement le mot de passe de la base de données elle-même).
3. **Le pool de connexions est épuisé ou la requête a expiré.** Limité par
   `DATABASE_POOL_CONNECTION_TIMEOUT_MS` (10s par défaut) — `/health` ne se
   bloquera pas indéfiniment, mais cela prendra jusqu'à ce long pour rapporter
   rouge.

Cela **ne** crash pas le backend. Une connexion inactive morte dans le pool est
capturée (`backend/src/db/index.ts`'s `pool.on('error', ...)`) et enregistrée ;
le pool la remplace à la prochaine utilisation. Si vous voyez le conteneur
backend redémarrer à plusieurs reprises tandis que Postgres est arrêté, c'est
une régression de cela — vérifiez `docker inspect <container> --format
'{{.RestartCount}}'` et les journaux du conteneur pour une erreur `pg-pool`
non capturée.

## `redis: "disconnected"`

Le `redis.ping()` du backend n'a pas réussi dans les 2 secondes. Même première
vérification — `docker compose -f docker-compose.prod.yml ps redis` — puis
confirmez que `REDIS_URL` correspond au nom d'hôte du service `redis`
(`redis://redis:6379` en composition prod ; le client ioredis se reconnecte
automatiquement une fois que Redis revient, donc aucun redémarrage n'est
nécessaire ici non plus).

La limite de 2 secondes est intentionnelle : `ioredis` mettrait autrement en
queue et réessayerait une commande sur un serveur arrêté pendant des dizaines
de secondes avant de rejeter, ce qui a transformé un `503` en `504` de nginx à
la place — trop lent pour qu'un orchestrateur ou un équilibreur de charge agisse.

## La porte de version Oracle a refusé une connexion

Une erreur différente, pas un champ `/health` : `getConnection()` lance
`OraclePoolError: Oracle Database X.Y.Z is below the minimum supported version
12.1.0.0.0` quand le serveur d'une source de données rapporte une version
antérieure à 12.1. C'est intentionnel (voir Décision D-019) — le mode Oracle
antérieur à 12.1 utilise un vérificateur de mot de passe que le mode mince
`node-oracledb` ne peut pas authentifier, et l'échec doit être un refus clair
nommant les deux versions, pas une erreur d'authentification opaque trois
couches plus bas. Correction : pointez la source de données vers un serveur
12.1+, ou définez `ORACLE_THICK_MODE=true` et reconstruisez l'image backend
(`INSTALL_ORACLE_CLIENT` suit `ORACLE_THICK_MODE` automatiquement dans
`docker-compose.prod.yml`).

## `oracleClient: "thick_unavailable"`

Signifie `ORACLE_THICK_MODE=true` mais le Client instantané Oracle n'a pas pu
se charger — cela fait échouer l'ensemble du processus au démarrage
(`server.ts` appelle `process.exit(1)`), vous ne verrez donc pas vraiment cette
valeur sur HTTP ; elle est ici pour les recherches de journal. Confirmez que
l'image a été construite avec le client (voir la section Déploiement de
production de [docker.md](../deployment/docker.md)) — le journal d'image backend
`DPI-1047: Cannot locate a 64-bit Oracle Client library` quand il manque.
