# Lectura del agotamiento del grupo de Oracle y acumulación de cola

Los nombres de métrica abajo se documentan completamente en
[Monitorización](../deployment/monitoring.md#key-metrics).

## El grupo de Oracle ha "perdido" conexiones (BE-04)

Síntoma: las ejecuciones de mapas contra una fuente de datos comienzan a agotarse
con `Timed out acquiring an Oracle connection after <N>ms`, pero
`oracle_pool_connections{state="in_use"}` nunca alcanza
`oracle_pool_connections{state="max"}`.

Esa brecha es la señal. Un grupo que está genuinamente ocupado muestra `in_use`
fijado en `max`; un grupo que ha filtrado espacios (un error en la carrera de
tiempo de adquisición de `getConnection` — ver BE-04, fijo en
`backend/src/services/oracle-connection-pool.ts`) muestra `in_use` subiendo a
algún número por debajo de `max` y quedándose allí mientras `waiting` crece y
`oracle_pool_acquisition_timeouts_total` sigue subiendo. Solo un reinicio del
proceso recupera un grupo que realmente ha perdido espacios; si la corrección
regresa, ese patrón de reinicio-para-recuperar es la señal para comprobar primero.

Lea los cuatro juntos:

```promql
oracle_pool_connections{data_source_id="<id>", state="in_use"}
oracle_pool_connections{data_source_id="<id>", state="max"}
oracle_pool_connections{data_source_id="<id>", state="waiting"}
oracle_pool_acquisition_timeouts_total
```

`oracle_pool_acquisition_failures_total` y
`oracle_pool_acquisition_duration_avg_milliseconds` (por fuente de datos)
distinguen una base de datos lenta (latencia subiendo, pocas fallas) de una mal
configurada (fallas subiendo independientemente de la latencia).

## Acumulación de cola de exportación o programador

`export_queue_jobs{state="waiting"}` o `scheduler_queue_jobs{state="waiting"}`
manteniéndose por encima de dígitos simples durante más de unos pocos minutos
significa que los trabajos se están encolando más rápido que los trabajadores
los drenan:

1. Compruebe `export_jobs_total{outcome="failed"}` / `schedule_runs_total{outcome="failed"}`
   — una tasa de falla creciente junto con la acumulación generalmente significa
   que los trabajos se están reintentando (retroceso exponencial de BullMQ) en
   lugar de drenar, no que se necesite más capacidad.
2. Si las fallas son planas y `waiting` aún crece, escale la concurrencia del
   trabajador (`EXPORT_WORKER_CONCURRENCY`) o ejecute
   `workers/export.standalone.ts` / `scheduler.standalone.ts` en su propio
   contenedor en lugar de en proceso.
3. Ambas métricas de profundidad de cola se leen cada 15 segundos desde el propio
   `getJobCounts()` de BullMQ dentro del proceso del trabajador
   (`export.worker.ts`, `scheduler.worker.ts`) — una métrica atascada en su
   último valor mientras los trabajos se están ejecutando visiblemente significa
   que el propio proceso del trabajador está bloqueado, no que la cola esté
   realmente inactiva.

## Migración estancada

`migration_running` atascado en `1` con `migration_progress_percent` plano
durante más de lo que normalmente tarda el patrimonio: el trabajo de migración
está colgado, muy probablemente en una única lectura de Oracle lenta.
`migration_progress_percent`'s etiqueta `phase` nombra la tabla de destino (o
`read`/`plan`/`write` para una re-importación de solo mapas) en la que reportó
progreso por última vez — compruebe el recuento de filas de esa tabla en el
esquema EUL de la fuente por cualquier cosa inusualmente grande.
