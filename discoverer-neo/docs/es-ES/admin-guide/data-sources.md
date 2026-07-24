# Gestión de orígenes de datos

Aprenda a agregar y gestionar conexiones a orígenes de datos Oracle y PostgreSQL.

## ¿Qué es un origen de datos?

Un **origen de datos** es una conexión con nombre a una base de datos Oracle o PostgreSQL. Las carpetas de las áreas de negocio hacen referencia a los orígenes de datos para saber de dónde obtener los datos.

## Creación de un origen de datos

### Agregar una conexión de Oracle

1. Panel de administración → **Orígenes de datos**
2. Haga clic en **+ Nuevo origen de datos**
3. Seleccione **Oracle** como tipo de conexión
4. Introduzca:
   - **Nombre** — Identificador único (p. ej., «Production ERP»)
   - **Descripción** — Notas (opcional)
   - **Host** — Nombre de host o IP del servidor
   - **Puerto** — Puerto del proceso de escucha (predeterminado: 1521)
   - **Nombre del servicio** o **SID** — Identificador de la base de datos
   - **Nombre de usuario** — Usuario de la base de datos (p. ej., EUL5_US)
   - **Contraseña** — Contraseña de la base de datos
5. Haga clic en **Probar conexión** para verificar
6. Haga clic en **Crear**

### Agregar una conexión de PostgreSQL

1. Panel de administración → **Orígenes de datos**
2. Haga clic en **+ Nuevo origen de datos**
3. Seleccione **PostgreSQL** como tipo de conexión
4. Introduzca:
   - **Nombre** — Identificador único
   - **Descripción** — Notas (opcional)
   - **Host** — Nombre de host o IP del servidor
   - **Puerto** — Predeterminado: 5432
   - **Base de datos** — Nombre de la base de datos
   - **Nombre de usuario** — Usuario de la base de datos
   - **Contraseña** — Contraseña de la base de datos
5. Haga clic en **Probar conexión**
6. Haga clic en **Crear**

## Detalles de la conexión de Oracle

### Modo thin (predeterminado)

El modo thin conecta sin Oracle Instant Client:

- **Ventajas:** sin instalación de cliente, más ligero, Node.js puro
- **Inconvenientes:** no puede conectar con bases de datos anteriores a la 12.1
- **Idóneo para:** Oracle 12.1+ moderno

**No requiere configuración.** El modo thin es el predeterminado.

### Modo thick (heredado)

El modo thick requiere Oracle Instant Client para las bases de datos heredadas:

- **Ventajas:** admite Oracle 11.2+, habilita la nomenclatura LDAP y el cifrado de red
- **Inconvenientes:** requiere la instalación de Instant Client, mayor huella
- **Idóneo para:** bases de datos Oracle 11.2–12.0 más antiguas, requiere sqlnet.ora

**Para habilitar el modo thick:**

1. Cree la imagen de Docker con el cliente:
   ```bash
   docker compose build --build-arg INSTALL_ORACLE_CLIENT=true backend
   ```

2. Establezca la variable de entorno:
   ```bash
   ORACLE_THICK_MODE=true
   ORACLE_CLIENT_PATH=/opt/oracle/instantclient
   ```

3. El backend verifica que el cliente está instalado y no se inicia si no lo encuentra

## Agrupación de conexiones

Discoverer Neo mantiene un grupo de conexiones por origen de datos:

**Configuración del grupo** (variables de entorno):
- `ORACLE_POOL_MIN` — Conexiones inactivas mínimas (predeterminado: 2)
- `ORACLE_POOL_MAX` — Conexiones máximas (predeterminado: 10)
- `ORACLE_POOL_INCREMENT` — Nuevas conexiones por asignación (predeterminado: 1)
- `ORACLE_POOL_IDLE_TIMEOUT_SECONDS` — Tiempo de espera de inactividad (predeterminado: 300)

**Orientación para el dimensionamiento del grupo:**

Con 4 orígenes de datos Oracle, cada uno con `ORACLE_POOL_MAX=10`:
- Máximo de 40 conexiones simultáneas posibles
- Debe ajustarse a los límites de `sessions`/`processes` de la base de datos

Dimensione en función de las **ejecuciones de mapas simultáneas** previstas, no del número de usuarios:
- Cada ejecución de un mapa mantiene 1 conexión durante la consulta
- Las exportaciones mantienen 1 conexión durante toda la exportación (minutos)
- Implementación típica: de 2 a 10 como máximo por origen

### Ajuste del tamaño del grupo

Para aumentar el límite de conexiones (si la base de datos lo permite):

1. Edite `.env`:
   ```bash
   ORACLE_POOL_MAX=20
   ```

2. Aumente los límites de la base de datos:
   ```sql
   ALTER SYSTEM SET processes=300;  # Default often 150
   ```

3. Reinicie el backend:
   ```bash
   docker compose restart backend
   ```

## Prueba de la conexión

Tras crear un origen de datos, pruebe la conectividad:

1. Haga clic en el origen de datos → **Probar conexión**
2. Estado mostrado:
   - ✓ **Conectado** — Conexión correcta
   - ✗ **Con error** — Se muestra un mensaje de error

**Errores habituales:**

- **Host inaccesible** — Compruebe la red, el firewall y el nombre de host
- **Credenciales no válidas** — Verifique el nombre de usuario y la contraseña
- **Base de datos no encontrada** — Compruebe la ortografía del nombre del servicio/SID
- **El proceso de escucha no se está ejecutando** — Reinicie el proceso de escucha de Oracle

## Edición de un origen de datos

1. Haga clic en el origen de datos → **Editar**
2. Modifique cualquier campo (la contraseña puede dejarse en blanco para mantener la existente)
3. Haga clic en **Guardar**

**Nota:** cambiar los detalles de la conexión puede romper las carpetas existentes si ya no pueden acceder a los datos. Pruebe con cuidado.

## Deshabilitación de un origen de datos

Utilice el conmutador **Activo** para deshabilitarlo temporalmente:

- **Desactivado** — Las carpetas no pueden obtener datos de este origen
- **Activado** — Las carpetas pueden obtener datos con normalidad

Resulta útil para el mantenimiento sin eliminar el origen.

## Eliminación de un origen de datos

1. Haga clic en el origen de datos → **Eliminar**
2. Confirme

Las carpetas que utilizan este origen ya no podrán ejecutarse. Los mapas quedan rotos.

## Cifrado de la conexión

Las contraseñas se cifran en reposo mediante AES-256-GCM:

- **Clave:** variable de entorno `ENCRYPTION_KEY` (mínimo 32 caracteres)
- **Almacenamiento:** cifradas en la base de datos PostgreSQL
- **Transmisión:** utilice siempre HTTPS en producción

Cambiar la clave de cifrado:

1. Establezca una nueva `ENCRYPTION_KEY` en el entorno
2. Reinicie el backend
3. El backend vuelve a cifrar automáticamente todas las contraseñas almacenadas

**Importante:** si pierde la clave de cifrado, las contraseñas almacenadas serán irrecuperables. Haga una copia de seguridad segura de las claves de cifrado.

## Supervisión del estado de las conexiones

Compruebe el estado del grupo de conexiones en la supervisión:

- **Métricas:** punto de conexión `/metrics`
- **Indicador:** `oracledb_pool_connections_active`, `oracledb_pool_connections_idle`
- **Uso:** supervisión con Prometheus (consulte la [Guía de supervisión](../../deployment/monitoring.md))

## Importación masiva (migración)

Al migrar desde Oracle Discoverer:

1. Utilice la CLI `dn-migrate` para importar los metadatos del EUL
2. Cree orígenes de datos para todos los orígenes a los que se hace referencia
3. Importe áreas de negocio, carpetas y elementos con la herramienta de migración

Consulte la [Guía de migración](../../migration/).

## Conectividad de red

### Reglas de firewall

Asegure la conectividad de red:
- Backend → Oracle: puerto 1521 (Oracle predeterminado)
- Backend → PostgreSQL: puerto 5432 (PostgreSQL predeterminado)

### Resolución DNS

Si utiliza nombres de host, verifique el DNS:
```bash
# Test from backend container
docker compose exec backend nslookup oracle.example.com
```

### Túnel SSH

Para conexiones seguras a través de SSH:

1. Establezca un túnel desde el backend hasta el host de la base de datos:
   ```bash
   ssh -L 1521:oracle-internal:1521 bastion-host
   ```

2. Utilice `localhost:1521` en la cadena de conexión

3. Mantenga el túnel en ejecución (puede necesitar una directiva de reinicio)

## Copia de seguridad y restauración

Los orígenes de datos se almacenan en PostgreSQL. Consulte la [Guía de copias de seguridad](../../deployment/backup.md).

Para restaurar:
1. Restaure la base de datos PostgreSQL
2. Los orígenes de datos se recuperan automáticamente
3. Las pruebas de conexión funcionan si hay red disponible hacia los orígenes

## Resolución de problemas

### Grupo de conexiones agotado

**Error:** «Connection timeout waiting for a connection»

**Causas:**
- Demasiadas consultas o exportaciones simultáneas
- Tamaño del grupo demasiado pequeño
- Límite de conexiones de la base de datos alcanzado

**Solución:**
1. Aumente `ORACLE_POOL_MAX` (y `sessions` de la base de datos)
2. Reduzca los trabajos de exportación simultáneos (`EXPORT_WORKER_CONCURRENCY`)
3. Optimice las consultas lentas

### Conexiones obsoletas

**Error:** «Connection reset by peer»

**Causa:** la base de datos cerró las conexiones inactivas; el grupo no lo detectó

**Solución:**
- Reduzca `ORACLE_POOL_IDLE_TIMEOUT_SECONDS`
- Reinicie el backend (recicla el grupo)

## ¿Qué sigue?

- **[Inspección de Oracle](oracle-introspection.md)** — Importe tablas automáticamente
- **[Gestión de metadatos](metadata-management.md)** — Organice carpetas y elementos
- **[Directivas de seguridad](security.md)** — Defina la seguridad de nivel de fila

---

**Consulte también:** [Guía del administrador](../admin-guide/), [Configuración de la implementación](../../deployment/configuration.md)
