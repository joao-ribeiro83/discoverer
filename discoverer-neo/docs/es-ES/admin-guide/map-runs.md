# Ejecuciones de mapas, retención y el limpiador automático

Aprenda cómo se ponen en cola las ejecuciones de mapas, cuánto tiempo siguen
siendo válidos sus resultados, y cómo el limpiador automático en segundo
plano los elimina.

## ¿Qué es una ejecución de mapa?

Cada ejecución de un mapa — un usuario que hace clic en **Ejecutar**, y cada
ejecución programada — pasa por una única cola en segundo plano
(`map-runs`) y guarda sus filas en Postgres. Nada consulta Oracle dos veces
para el mismo mapa, usuario y parámetros mientras ya exista un resultado
válido: la segunda solicitud devuelve el resultado guardado al instante en
lugar de volver a ejecutar la consulta.

Solo la vista previa del propio generador de mapas
(`POST /api/maps/:id/execute`, limitada a 1000 filas) evita la cola — es una
comprobación rápida y no guardada mientras se compone un mapa, no una
ejecución.

## Orden por usuario

Las ejecuciones del mismo usuario se ejecutan estrictamente de una en una, en
el orden en que se solicitaron. Las ejecuciones de usuarios distintos no se
ordenan entre sí — el proceso simplemente ejecuta el turno de un usuario y
pasa al siguiente. `MAP_RUN_WORKER_CONCURRENCY` define cuántas ejecuciones de
usuarios distintos pueden estar en curso a la vez.

## Retención

| Tipo | El resultado sigue siendo válido hasta |
|---|---|
| **En vivo** (un usuario hizo clic en Ejecutar) | finalización + `MAP_RUN_LIVE_TTL_HOURS`, **limitado a 24 horas sea cual sea el valor del ajuste** |
| **Programada** | finalización + la retención propia de esa programación, en días (ver más abajo) |
| Cualquier ejecución fallida | finalización + 24 horas — se conserva como historial, no como datos |
| En cola o en ejecución durante más tiempo que `MAP_RUN_STALE_HOURS` | marcada como **Fallida** por el limpiador automático — una red de seguridad tras un fallo del proceso |

Una ejecución en vivo nunca se puede usar durante más de un día, sea cual
sea el valor que un administrador asigne a `MAP_RUN_LIVE_TTL_HOURS`. Es un
límite estricto, no un valor predeterminado.

### Retención programada (`BR_EXPIRY`)

La retención de una programación proviene de su propio campo
`result_retention_days` (30 días por defecto; se define mediante
`resultRetentionDays` en `POST`/`PUT /api/schedules` — todavía no existe un
campo en el formulario de programación para esto). Las programaciones
importadas desde un EUL heredado de Discoverer traen este valor
automáticamente desde `EUL4_BATCH_REPORTS.BR_EXPIRY` — la columna de
retención en días que el propio Discoverer usaba para los resultados de
informes por lotes (se han observado los valores 1, 4, 10 y 30 en entornos
reales). Un `BR_EXPIRY` ausente se importa como 30 días, el mismo valor
predeterminado que una programación creada directamente en Neo.

## El limpiador automático

El proceso de ejecución de mapas también ejecuta una limpieza periódica, con
el mismo patrón `setInterval` interno que la limpieza de exportaciones:

- Cada `MAP_RUN_CLEANUP_INTERVAL_MINUTES`, elimina toda ejecución cuyo
  `expires_at` ya haya pasado, en cascada hasta sus lotes de filas guardados.
- En el mismo paso, marca como fallida cualquier ejecución todavía **En
  cola** o **En ejecución** durante más de `MAP_RUN_STALE_HOURS` — esto solo
  ocurre si un proceso se bloqueó a mitad de una ejecución y nunca llegó por
  sí solo a un estado final.

No existe un comando de limpieza manual. Para forzar una limpieza
anticipada, reinicie el backend (o el proceso independiente) con un
`MAP_RUN_CLEANUP_INTERVAL_MINUTES` más corto, o elimine la ejecución desde la
[página Ejecuciones](../user-guide/executing-maps.md#la-página-ejecuciones)
/ `DELETE /api/runs/:id`.

## Configuración

| Variable | Predeterminado | Descripción |
|---|---|---|
| `MAP_RUN_WORKER_ENABLED` | activo en todos los entornos excepto `test` | Ejecutar el proceso de ejecución de mapas en este proceso |
| `MAP_RUN_WORKER_CONCURRENCY` | 3 (máx. 8) | Cuántas ejecuciones de usuarios distintos se ejecutan a la vez |
| `MAP_RUN_LIVE_TTL_HOURS` | 24 | Validez de un resultado en vivo — limitada a 24 sea cual sea este valor |
| `MAP_RUN_MAX_ROWS` | 100000 | Filas capturadas por ejecución antes de marcarse como truncada |
| `MAP_RUN_BATCH_SIZE` | 1000 | Filas por lote guardado (JSONB de Postgres) |
| `MAP_RUN_CLEANUP_INTERVAL_MINUTES` | 15 | Con qué frecuencia se ejecuta el limpiador automático |
| `MAP_RUN_STALE_HOURS` | 24 | Una ejecución En cola/En ejecución más antigua que esto se marca como Fallida |

Consulte
[Configuración](../../deployment/configuration.md#map-runs-queue-retention-sweeper)
para saber cómo definir estas variables en `.env` o en los archivos compose,
y [Implementación con Docker](../../deployment/docker.md) para ejecutar el
proceso de ejecución de mapas en su propio contenedor.

## Supervisión

La profundidad de la cola `map-runs` se expone junto a los indicadores de
las colas de exportación y del programador — consulte
[Supervisión](../../deployment/monitoring.md).

## ¿Qué sigue?

- **[Programación de mapas](../user-guide/scheduling.md)** — cómo se pone en cola la ejecución propia de una programación
- **[Orígenes de datos](data-sources.md)** — la conexión Oracle contra la que se ejecutan las ejecuciones de mapas
- **[Configuración](../../deployment/configuration.md)** — la referencia completa de variables de entorno

---

**Consulte también:** [Ejecución de mapas](../user-guide/executing-maps.md), [Guía del administrador](../admin-guide/)
