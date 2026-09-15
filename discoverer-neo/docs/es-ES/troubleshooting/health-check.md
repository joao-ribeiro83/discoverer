# Qué significa un `/health` rojo

`/health` (y `/api/health`) es una verificación de **preparación**: informa si
esta instancia de backend puede realmente servir tráfico, no solo si el proceso
de Node se está ejecutando. Consulte [Monitorización](../deployment/monitoring.md)
para la división completa de preparación vs actividad (`/live` es el punto de
actividad, y no se vuelve rojo por ninguno de estos).

Un `503` de `/health` significa que `database` o `redis` en el cuerpo de la
respuesta es `"disconnected"`:

```bash
curl http://localhost:3000/health
# {"status":"degraded","database":"disconnected","redis":"connected",...}
```

## `database: "disconnected"`

El backend no puede ejecutar `SELECT 1` contra Postgres. Por orden de
probabilidad:

1. **El contenedor de Postgres está apagado o aún se está iniciando.**
   `docker compose -f docker-compose.prod.yml ps postgres` — si no está
   `healthy`, compruebe `docker compose -f docker-compose.prod.yml logs
   postgres`.
2. **`DATABASE_URL` es incorrecto** (host/puerto/credenciales incorrectos). En
   `docker-compose.prod.yml` esto se construye a partir de `POSTGRES_USER` /
   `POSTGRES_PASSWORD` / `POSTGRES_DB` en `.env` — confirme que coincidan con
   lo que Postgres fue realmente inicializado (cambiar `POSTGRES_PASSWORD`
   después de que el volumen ya exista no cambia retroactivamente la contraseña
   de la propia base de datos).
3. **El grupo de conexiones está agotado o la consulta agotó el tiempo.**
   Limitado por `DATABASE_POOL_CONNECTION_TIMEOUT_MS` (por defecto 10s) —
   `/health` no se colgará indefinidamente, pero tardará hasta ese tiempo en
   informar rojo.

Esto **no** causa fallos en el backend. Una conexión inactiva muerta en el grupo
se captura (`backend/src/db/index.ts`'s `pool.on('error', ...)`) y se registra;
el grupo la reemplaza en el próximo uso. Si ve el contenedor de backend
reiniciándose repetidamente mientras Postgres está apagado, eso es una regresión
de esto — compruebe `docker inspect <container> --format '{{.RestartCount}}'`
y los registros del contenedor para un error `pg-pool` no capturado.

## `redis: "disconnected"`

El `redis.ping()` del backend no tuvo éxito en 2 segundos. La misma primera
verificación — `docker compose -f docker-compose.prod.yml ps redis` — luego
confirme que `REDIS_URL` coincida con el nombre de host del servicio `redis`
(`redis://redis:6379` en compose de producción; el cliente ioredis se
reconecta automáticamente una vez que Redis vuelve, así que no se necesita
reinicio aquí tampoco).

El límite de 2 segundos es deliberado: `ioredis` en caso contrario encolará y
reintentará un comando contra un servidor apagado durante decenas de segundos
antes de rechazar, que convirtió un `503` en un `504` desde nginx en su lugar —
demasiado lento para que un orquestador o equilibrador de carga actúe.

## La puerta de versión de Oracle rechazó una conexión

Un error diferente, no un campo `/health`: `getConnection()` lanza
`OraclePoolError: Oracle Database X.Y.Z is below the minimum supported version
12.1.0.0.0` cuando el servidor de una fuente de datos informa una versión
anterior a 12.1. Esto es deliberado (ver Decisión D-019) — Oracle anterior a
12.1 usa un verificador de contraseña que el modo delgado de `node-oracledb` no
puede autenticar, y el fallo necesita ser un rechazo claro que nombre ambas
versiones, no un error de autenticación opaco tres capas más abajo. Corrección:
apunte la fuente de datos a un servidor 12.1+, o establezca
`ORACLE_THICK_MODE=true` y reconstruya la imagen de backend (`INSTALL_ORACLE_CLIENT`
sigue `ORACLE_THICK_MODE` automáticamente en `docker-compose.prod.yml`).

## `oracleClient: "thick_unavailable"`

Significa `ORACLE_THICK_MODE=true` pero el Cliente Instantáneo de Oracle falló
al cargar — esto hace fallar todo el proceso al iniciar (`server.ts` llama
`process.exit(1)`), así que no verá realmente este valor sobre HTTP; está aquí
para búsquedas de registros. Confirme que la imagen se construyó con el cliente
(ver la sección Implementación de producción de
[docker.md](../deployment/docker.md)) — el registro de imagen de backend
`DPI-1047: Cannot locate a 64-bit Oracle Client library` cuando falta.
