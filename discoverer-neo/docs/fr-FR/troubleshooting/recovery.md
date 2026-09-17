# Récupération après perte de données

Procédure complète : [deployment/backup.md](../deployment/backup.md). Cette
page est symptôme → ce qui restaurer, pas la mécanique.

## Postgres est corrompu ou une mauvaise migration a détruit les données

Restaurez uniquement la base de données — l'état de la file d'attente Redis n'est
pas affecté :

```bash
./scripts/restore.sh --postgres backups/postgres/discoverer_neo_<ts>.dump.gz \
                      --compose-file docker-compose.prod.yml
```

Choisissez le vidage le plus récent **avant** l'événement de corruption, pas le
vidage le plus récent en général.

## Les travaux ont disparu après un arrêt Redis ou une récréation de conteneur

Si Redis exécutait la configuration prod (`--appendonly yes`), un redémarrage
non planifié ne devrait rien avoir perdu — vérifiez `docker compose -f
docker-compose.prod.yml logs redis` pour les messages `AOF` d'abord ; une
restauration complète est un dernier recours :

```bash
./scripts/restore.sh --redis backups/redis/data_<ts>.tar.gz \
                      --compose-file docker-compose.prod.yml
```

Cela remplace `/data` (RDB + AOF) entièrement et redémarre Redis — tout ce qui
a été écrit après le timestamp de la sauvegarde est parti. Si le fichier compose
dev/base (`docker-compose.yml` sans superposition prod) c'est ce qui s'exécute,
cette perte est attendue : ce fichier n'active pas l'AOF.

## `importFromOracle` a échoué à mi-chemin

Rien à restaurer. Depuis BE-08, le dossier et ses éléments sont écrits dans une
transaction — une importation échouée ne laisse aucun dossier partiel derrière.
Réexécutez l'importation ; la tentative échouée précédente n'a laissé aucune
trace à nettoyer.

## Vérification d'une restauration avant de lui faire confiance

Ne supposez jamais qu'un vidage est bon — prouvez-le :

```bash
./scripts/verify-restore.sh backups/postgres/discoverer_neo_<ts>.dump.gz
```

Restaure dans une base de données jetable `<db>_restoretest`, différencie les
comptes de lignes par rapport à la base de données active table par table, supprime
la base de données de scratch, et sort avec code non-zéro en cas de non-concordance.

## Une étape du basculement a échoué

Procédure complète : [`docs/deployment/cutover-runbook.md`](../deployment/cutover-runbook.md).
Chaque étape a son propre signal d'échec et sa restauration ; les deux pièges
généraux rencontrés lors de la répétition :

- **Un conteneur planté peut toujours s'afficher comme "en cours d'exécution" dans `docker ps`.** Sous
  `tsx watch` (démarrage style développement), une exception non interceptée au démarrage — p.ex.
  la protection des secrets de production refusant un `JWT_SECRET` par défaut — est capturée par
  l'observateur, enregistrée, et le processus reste en attente d'une modification de fichier
  qui ne viendra jamais. Vérifiez `docker logs` ou `/health`, pas le statut du conteneur seul,
  pour décider si un démarrage a réellement réussi.
- **`docker run -e SOME_PATH=/opt/...` sur Windows/Git Bash** a sa valeur
  silencieusement réécrite en chemin Windows par la conversion de chemins de MSYS,
  cassant n'importe quoi qui attend un chemin Unix (p.ex. `ORACLE_CLIENT_PATH`).
  Préfixez la commande avec `MSYS_NO_PATHCONV=1`.

Si le vérificateur (`docs/migration/verify.md`) rapporte `COMPLETED_WITH_BLOCKERS`
au moment du basculement, vérifiez chaque bloqueur contre la liste connue à
l'Étape 3 du runbook avant de le traiter comme nouveau — un bloqueur Phase 3.4/4.x
déjà suivi n'est pas une raison d'arrêter ; un non répertorié l'est.
