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

## Un paso del cutover falló

Procedimiento completo: [`docs/deployment/cutover-runbook.md`](../deployment/cutover-runbook.md).
Cada paso tiene su propia señal de fallo y reversión; las dos trampas generales
halladas durante el ensayo:

- **Un contenedor fallido aún puede mostrar `docker ps` como "en ejecución".** Bajo
  `tsx watch` (arranque estilo desarrollo), una excepción no capturada al iniciar — p.ej.
  la protección de secretos de producción rechazando un `JWT_SECRET` por defecto — es
  capturada por el observador, registrada, y el proceso permanece observando un cambio
  de archivo que nunca llegará. Compruebe `docker logs` o `/health`, no solo el estado
  del contenedor, para decidir si el arranque realmente tuvo éxito.
- **`docker run -e SOME_PATH=/opt/...` en Windows/Git Bash** tiene su valor
  reescrito silenciosamente en una ruta Windows por la conversión de rutas de MSYS,
  rompiendo cualquier cosa que espere una ruta Unix (p.ej. `ORACLE_CLIENT_PATH`).
  Prefije el comando con `MSYS_NO_PATHCONV=1`.

Si el verificador (`docs/migration/verify.md`) reporta `COMPLETED_WITH_BLOCKERS`
en el cutover, compruebe cada bloqueador contra la lista conocida en el Paso 3 del
runbook antes de tratarlo como nuevo — un bloqueador de Fase 3.4/4.x ya rastreado
no es razón para detener; uno no listado sí.
