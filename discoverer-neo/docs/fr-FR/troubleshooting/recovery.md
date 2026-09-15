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
