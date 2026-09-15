# Recuperación de pérdida de datos

Procedimiento completo: [deployment/backup.md](../deployment/backup.md). Esta
página es síntoma → qué restaurar, no la mecánica.

## Postgres está corrupto o una mala migración destruyó datos

Restaure solo la base de datos — el estado de la cola de Redis no se ve afectado:

```bash
./scripts/restore.sh --postgres backups/postgres/discoverer_neo_<ts>.dump.gz \
                      --compose-file docker-compose.prod.yml
```

Elija el volcado más reciente de **antes** del evento de corrupción, no el
volcado más reciente en general.

## Los trabajos desaparecieron después de un bloqueo de Redis o recreación de contenedor

Si Redis estaba ejecutando la configuración de producción (`--appendonly yes`),
un reinicio no planificado no debería haber perdido nada — compruebe
`docker compose -f docker-compose.prod.yml logs redis` para mensajes `AOF`
primero; una restauración completa es un último recurso:

```bash
./scripts/restore.sh --redis backups/redis/data_<ts>.tar.gz \
                      --compose-file docker-compose.prod.yml
```

Esto reemplaza `/data` (RDB + AOF) completamente e reinicia Redis — cualquier
cosa escrita después de la marca de tiempo de la copia de seguridad se ha ido.
Si el archivo compose de dev/base (`docker-compose.yml` sin la superposición
de producción) es lo que se está ejecutando, esta pérdida es esperada: ese
archivo no habilita AOF.

## `importFromOracle` falló a mitad del camino

Nada que restaurar. Desde BE-08, la carpeta y sus elementos se escriben en una
transacción — una importación fallida no deja carpeta parcial. Re-ejecute la
importación; el intento fallido anterior no dejó rastro que limpiar.

## Verificación de una restauración antes de confiar en ella

Nunca asuma que un volcado es bueno — pruébelo:

```bash
./scripts/verify-restore.sh backups/postgres/discoverer_neo_<ts>.dump.gz
```

Restaura en una base de datos `<db>_restoretest` desechable, diferencia
recuentos de filas contra la base de datos activa tabla por tabla, suelta la
base de datos de scratch, y sale con código no cero en cualquier discrepancia.
