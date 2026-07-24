# Registro de auditoría

Conozca la traza de auditoría de Discoverer Neo y cómo revisar las actividades del sistema.

## ¿Qué es el registro de auditoría?

El **registro de auditoría** registra todas las actividades significativas del sistema: cambios en los metadatos, ejecuciones de mapas, inicios/cierres de sesión de usuarios, concesiones/revocaciones de permisos y trabajos de exportación.

Cada evento de auditoría incluye:
- **Marca de tiempo** — Cuándo se produjo la actividad
- **Usuario** — Quién realizó la acción
- **Acción** — Qué ocurrió (CREATE, UPDATE, DELETE, EXECUTE)
- **Entidad** — Qué se vio afectado (MAP, BUSINESS_AREA, USER, etc.)
- **Cambios** — Detalles de lo que cambió (para las actualizaciones)

## Acceso a los registros de auditoría

### Ver el registro de auditoría

1. Panel de administración → **Registro de auditoría**
2. Verá una lista paginada de eventos recientes (los más nuevos primero)
3. Filtre por:
   - **Intervalo de fechas** — Fecha de inicio y de fin
   - **Usuario** — Filtre por quién realizó la acción
   - **Tipo de entidad** — Filtre por lo que se vio afectado
   - **Acción** — CREATE, UPDATE, DELETE, EXECUTE, GRANT, etc.
4. Haga clic en un evento para ver todos los detalles

### Detalles del evento

Al hacer clic en un evento se muestra:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-07-19T12:15:30Z",
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "userEmail": "alice@example.com",
  "action": "CREATE",
  "entityType": "MAP",
  "entityId": "550e8400-e29b-41d4-a716-446655440100",
  "entityName": "Q3 Sales Report",
  "changes": {
    "name": "Q3 Sales Report",
    "mapType": "TABLE",
    "businessAreaId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

## Tipos de evento

### Cambios en los metadatos

| Entidad | Acciones |
|--------|---------|
| BUSINESS_AREA | CREATE, UPDATE, DELETE |
| FOLDER | CREATE, UPDATE, DELETE |
| ITEM | CREATE, UPDATE, DELETE |
| JOIN | CREATE, UPDATE, DELETE |
| HIERARCHY | CREATE, UPDATE, DELETE |
| CUSTOM_FUNCTION | CREATE, UPDATE, DELETE |

### Ciclo de vida de los mapas

| Entidad | Acciones |
|--------|---------|
| MAP | CREATE, UPDATE, DELETE, DUPLICATE |
| MAP_EXECUTION | EXECUTE, CANCEL |
| MAP_SHARE | GRANT, REVOKE |

### Gestión de usuarios y permisos

| Entidad | Acciones |
|--------|---------|
| USER | CREATE, UPDATE, DELETE |
| BUSINESS_AREA_GRANT | GRANT, REVOKE, UPDATE |
| SECURITY_POLICY | CREATE, UPDATE, DELETE |

### Datos y trabajos

| Entidad | Acciones |
|--------|---------|
| EXPORT | CREATE, START, COMPLETE, FAIL, DELETE |
| SCHEDULE | CREATE, UPDATE, DELETE, EXECUTE |

### Autenticación

| Entidad | Acciones |
|--------|---------|
| LOGIN | LOGIN, LOGOUT |
| TOKEN | REFRESH, BLACKLIST |

## Consultas habituales

### ¿Quién modificó este mapa?

1. Filtre por tipo de entidad: MAP
2. Busque por el nombre o el ID del mapa
3. Consulte los eventos CREATE → UPDATE

### Seguimiento de los cambios de permisos

1. Filtre por tipo de entidad: BUSINESS_AREA_GRANT
2. Filtre por usuario si es necesario
3. Consulte quién concedió/revocó permisos y cuándo

### Buscar exportaciones fallidas

1. Filtre por tipo de entidad: EXPORT
2. Busque las acciones FAIL
3. Consulte los detalles del error

### Historial de ejecución

Para las ejecuciones de un mapa concreto:

1. Abra el mapa → pestaña **Historial** (en la página del mapa, no en el registro de auditoría)
2. Consulte los tiempos de ejecución, los recuentos de filas y el estado

(El registro de auditoría muestra los eventos CREATE/UPDATE de los mapas; el historial de ejecución muestra los eventos EXECUTE)

### Usuarios creados en un intervalo de fechas

1. Filtre por tipo de entidad: USER
2. Filtre por acción: CREATE
3. Filtre por intervalo de fechas
4. Consulte todas las cuentas nuevas creadas

## Retención de la auditoría

Los registros de auditoría se conservan de forma indefinida (en la base de datos PostgreSQL).

**Copia de seguridad:** los registros de auditoría se incluyen en las copias de seguridad de la base de datos (consulte la [Guía de copias de seguridad](../../deployment/backup.md)).

**Exportación:** para exportar los registros de auditoría para su análisis:

```bash
# Use API to fetch logs
curl -X GET "http://localhost:3000/api/audit?limit=10000" \
  -H "Authorization: Bearer $TOKEN" > audit-logs.json

# Parse with jq or import to Excel
jq '.data[] | {timestamp, user: .userEmail, action, entity: .entityType}' audit-logs.json
```

## Consideraciones de seguridad

### Control de acceso

Solo los usuarios **ADMIN** pueden ver los registros de auditoría. Los usuarios que no son administradores no pueden acceder a esta función.

### Manipulación del registro de auditoría

Los registros de auditoría son de solo anexión; los eventos no se pueden eliminar ni modificar (salvo la eliminación de toda la base de datos, lo cual no es viable en producción).

### Datos confidenciales

Los registros de auditoría incluyen:
- Correos electrónicos y nombres de usuario
- Definiciones de mapas (consultas)
- Nombres/valores de parámetros (pueden incluir fechas, regiones)
- Pero NO: contraseñas de base de datos (se almacenan cifradas, no se registran)

Tenga cuidado con los registros de auditoría que contienen datos de negocio confidenciales.

## Casos de uso

### Auditoría de cumplimiento

Realice el seguimiento de quién accedió a qué datos y cuándo:

1. Filtre los eventos EXECUTION
2. Consulte qué usuarios ejecutaron qué mapas
3. Exporte a la base de datos de cumplimiento

### Investigación de incidencias

«Este mapa dejó de funcionar el 15 de julio»:

1. Consulte las actualizaciones de MAP en torno al 15 de julio
2. Vea quién lo cambió y qué cambió
3. Comprenda el impacto

### Supervisión de la actividad de los usuarios

«Seguimiento de los inicios y cierres de sesión de los usuarios»:

1. Filtre por tipo de entidad: LOGIN
2. Consulte los eventos de autenticación con marcas de tiempo
3. Identifique patrones de actividad inusuales

### Auditorías de permisos

«¿Quién tiene permiso CREATE en el área de Finanzas?»:

1. Filtre por tipo de entidad: BUSINESS_AREA_GRANT
2. Filtre por el nombre del área de negocio: Finanzas
3. Consulte todas las concesiones y quién las tiene

## Prácticas recomendadas

1. **Revisión periódica** — Revise los registros de auditoría semanalmente en busca de anomalías
2. **Copia de seguridad de los registros de auditoría** — Inclúyalos en las copias de seguridad de la base de datos
3. **Alertas sobre acciones críticas** — Configure la supervisión de las operaciones confidenciales
4. **Archivo de registros antiguos** — Exporte los registros de más de 1 año para su archivo
5. **Limitación del acceso** — Solo los administradores deben acceder a los registros de auditoría
6. **Documentación de las directivas** — Deje constancia de su proceso de revisión de auditoría

## Rendimiento

El registro de auditoría tiene un impacto mínimo en el rendimiento:
- Los eventos se escriben de forma asíncrona
- Están indexados por marca de tiempo y usuario para consultas rápidas
- No bloquea las operaciones de los usuarios

Las consultas de gran tamaño sobre los registros de auditoría (> 100.000 eventos) pueden ser lentas. Utilice filtros de intervalo de fechas.

## Resolución de problemas

### Faltan eventos de auditoría

Si espera un evento, pero no lo ve:

- Compruebe el filtro de intervalo de fechas
- Verifique la ortografía del correo electrónico del usuario
- Confirme el nombre del tipo de entidad
- Compruebe si el evento se produjo realmente (actualice la página)

### El registro de auditoría es lento

Para tablas de auditoría muy grandes (millones de eventos):

1. Archive los eventos antiguos:
   ```bash
   curl -X GET "http://localhost:3000/api/audit?startDate=2026-01-01&endDate=2026-06-30&limit=100000" \
     -H "Authorization: Bearer $TOKEN" > archive.json
   ```

2. Pida al DBA que analice las estadísticas de la tabla

## Integración

Exporte los eventos de auditoría a sistemas externos:

```bash
# Fetch audit events as JSON
curl -X GET "http://localhost:3000/api/audit?limit=1000" \
  -H "Authorization: Bearer $TOKEN" | \
  jq '.data[] | {timestamp, userEmail, action, entityType, entityName}' | \
  # Pipe to your logging system (ELK, Splunk, etc.)
```

## ¿Qué sigue?

- **[Gestión de usuarios](user-management.md)** — Gestione las cuentas de usuario
- **[Directivas de seguridad](security.md)** — Defina el control de acceso
- **[Supervisión](../../deployment/monitoring.md)** — Estado y rendimiento del sistema

---

**Consulte también:** [Guía del administrador](../admin-guide/), [Referencia de la API - Auditoría](../../api/endpoints.md#audit-logs)
