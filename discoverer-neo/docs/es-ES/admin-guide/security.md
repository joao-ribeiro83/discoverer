# Directivas de seguridad

Aprenda a definir directivas de seguridad de nivel de fila (RLS) que filtran los datos por usuario o rol.

## ¿Qué es la seguridad de nivel de fila?

La **seguridad de nivel de fila (RLS)** filtra automáticamente los resultados de las consultas en función del contexto del usuario, sin necesidad de modificar los mapas ni las consultas.

**Ejemplo:** el responsable de una región de ventas ve únicamente los datos de su región, aunque todas las regiones se encuentren en la misma tabla.

## Cómo funciona la RLS

1. **Definir la directiva:** cree un predicado de seguridad para una carpeta
2. **Contexto del usuario:** asocie al usuario con valores de contexto (p. ej., region = «EMEA»)
3. **Ejecución de la consulta:** el predicado se añade automáticamente a la cláusula WHERE
4. **Resultados filtrados:** el usuario ve únicamente las filas que coinciden con su contexto

```sql
-- Base query
SELECT CUSTOMER_ID, SALES_AMOUNT, REGION FROM CUSTOMERS

-- With RLS policy
SELECT CUSTOMER_ID, SALES_AMOUNT, REGION FROM CUSTOMERS
WHERE REGION = NVL2(SYS_CONTEXT('dn_user_context', 'region'),
                     SYS_CONTEXT('dn_user_context', 'region'),
                     REGION)
```

## Creación de directivas de seguridad

### Paso 1: agregar una directiva

1. Panel de administración → **Área de negocio** → **Seguridad**
2. Haga clic en **+ Crear directiva**
3. Introduzca:
   - **Nombre** — Identificador de la directiva (p. ej., «Sales by Region»)
   - **Descripción** — Explique lo que impone la directiva
   - **Tipo de destino** — FOLDER (se aplica a todos los elementos de la carpeta)
   - **Carpeta de destino** — Seleccione la carpeta que desea proteger
   - **Activa** — Conmutador para habilitar/deshabilitar

### Paso 2: definir el predicado

Introduzca el **predicado SQL**, un fragmento de cláusula WHERE que se añade a las consultas:

```sql
REGION = NVL2(SYS_CONTEXT('dn_user_context', 'region'),
              SYS_CONTEXT('dn_user_context', 'region'),
              REGION)
```

**Desglose de la expresión:**

- `SYS_CONTEXT('dn_user_context', 'region')` — Obtiene el valor de contexto de región del usuario
- `NVL2(...)` — Si existe un valor de contexto, lo utiliza; de lo contrario, utiliza REGION (sin filtrado)
- Compara la columna REGION de la carpeta con el contexto de región del usuario

### Paso 3: asignar contexto a los usuarios

Los usuarios necesitan valores de contexto para que las directivas filtren los datos.

1. Panel de administración → **Usuarios** → seleccione un usuario → **Contexto de seguridad**
2. Establezca pares clave-valor de contexto:
   - **Clave:** `region` (coincide con el predicado)
   - **Valor:** `EMEA` (la región de este usuario)
3. Guarde

Ahora, cuando este usuario ejecute una consulta, el predicado utilizará su contexto de región.

## Valores de contexto de seguridad

El contexto de seguridad es un conjunto de pares clave-valor asociado a cada usuario:

| Clave | Valor | Finalidad |
|-----|-------|---------|
| `region` | EMEA, APAC, AMER | Responsable de región de ventas |
| `department` | SALES, HR, FINANCE | Datos limitados por departamento |
| `cost_center` | CC-001, CC-002 | Filtrado por centro de costes |
| `employee_id` | EMP-12345 | Datos específicos del empleado |

**Establecer el contexto:**

1. Panel de administración → **Usuarios**
2. Haga clic en el usuario → **Editar**
3. Desplácese hasta **Contexto de seguridad**
4. Haga clic en **+ Agregar contexto**
5. Introduzca la clave y el valor
6. Guarde

Los usuarios pueden tener varios valores de contexto. Los predicados indican qué valor de contexto se debe utilizar.

## Ejemplos de predicados

### Ejemplo 1: filtrado por región de ventas

**Carpeta:** SALES_DATA
**Directiva:** ver únicamente las ventas de su región

```sql
REGION = SYS_CONTEXT('dn_user_context', 'region')
```

**Configuración del contexto:**
- Usuario: john@example.com → region = 'EMEA'
- Usuario: jane@example.com → region = 'AMER'

**Resultado:**
- John ve: WHERE REGION = 'EMEA'
- Jane ve: WHERE REGION = 'AMER'

### Ejemplo 2: acceso por departamento

**Carpeta:** EMPLOYEE_DATA
**Directiva:** los empleados ven únicamente su departamento

```sql
DEPARTMENT = SYS_CONTEXT('dn_user_context', 'department')
```

### Ejemplo 3: acceso de los responsables

**Carpeta:** PAYROLL
**Directiva:** los responsables ven los datos de sus subordinados

```sql
MANAGER_ID = SYS_CONTEXT('dn_user_context', 'employee_id')
OR EMPLOYEE_ID = SYS_CONTEXT('dn_user_context', 'employee_id')
```

Esto permite a los responsables ver los registros de sus empleados (coincidencia de MANAGER_ID) además de su propio registro.

### Ejemplo 4: sin filtrado para los administradores

**Carpeta:** SENSITIVE_DATA
**Directiva:** omitir el filtrado para los administradores

```sql
SYS_CONTEXT('dn_user_context', 'is_admin') = 'Y'
OR DATA_OWNER = SYS_CONTEXT('dn_user_context', 'employee_id')
```

Los administradores tienen el contexto `is_admin='Y'`; los demás ven únicamente sus propios registros.

## Prueba de las directivas

### Probar como usuario

1. Cierre la sesión (o utilice un navegador de incógnito)
2. Inicie sesión como usuario de prueba
3. Ejecute un mapa que utilice la carpeta protegida
4. Verifique que los resultados se filtran correctamente

### Comprobar el predicado en los registros

Los registros de auditoría muestran el SQL ejecutado:

1. Panel de administración → **Registro de auditoría**
2. Filtre por ejecución de mapa
3. Consulte el SQL generado con el predicado aplicado

## Deshabilitación de directivas

### Deshabilitar temporalmente

1. Busque la directiva → **Editar**
2. Desmarque **Activa**
3. Guarde

La directiva deja de filtrar las consultas.

### Eliminar permanentemente

1. Busque la directiva → **Eliminar**
2. Confirme

La directiva se elimina; las consultas dejan de filtrarse.

## Consideraciones de rendimiento

Los predicados de seguridad se añaden a todas las consultas sobre las carpetas protegidas:

**Impacto:**
- Aumenta el tiempo de ejecución (normalmente <10 % en columnas bien indexadas)
- Las columnas de contexto indexadas ofrecen mejor rendimiento
- Las listas IN grandes (muchas regiones) ralentizan las consultas

**Optimización:**
1. Indexe las columnas a las que hacen referencia los predicados:
   ```sql
   CREATE INDEX idx_sales_region ON SALES_DATA(REGION);
   ```

2. Utilice predicados sencillos (igualdad) siempre que sea posible

3. Supervise el rendimiento de las consultas con y sin RLS

## Auditoría de seguridad

Realice el seguimiento de los cambios en las directivas de seguridad:

1. Panel de administración → **Registro de auditoría**
2. Filtre por tipo de entidad: SECURITY_POLICY
3. Consulte quién creó/modificó/eliminó las directivas

## Redacción de credenciales en el registro de auditoría

Toda petición que modifica datos (`POST`, `PUT`, `PATCH`, `DELETE`) guarda sus
parámetros, su cadena de consulta, su cuerpo de petición y su cuerpo de
respuesta en `audit_log.details`. Algunos de esos cuerpos llevan credenciales en
texto plano: la contraseña de Oracle de una fuente de datos llega a la API en
texto plano y solo se cifra en el servidor, y un cambio de contraseña lleva la
contraseña nueva.

### La regla

Antes de guardar nada, toda clave cuyo nombre **contenga** una de estas
subcadenas, sin distinguir mayúsculas de minúsculas, a cualquier profundidad,
ve su valor sustituido por `[REDACTED]`:

| Subcadena | Captura, entre otros |
|-----------|----------------------|
| `password` | `password`, `passwordEnc`, `newPassword`, `currentPassword`, `passwordHash` |
| `secret` | `secret`, `clientSecret`, `client_secret` |
| `token` | `token`, `apiToken`, `refreshToken`, `accessToken` |
| `credential` | `credential`, `dbCredential`, `credentials` |
| `apikey` | `apiKey`, `api_key` |
| `authorization` | `authorization` |

La regla es `isSensitiveKey` en `backend/src/plugins/audit.ts`. Los arrays y los
objetos anidados se recorren hasta una profundidad de seis.

### Por qué subcadena y no una lista exacta

Antes era una lista exacta de nombres de clave, y una lista exacta es la lista
de los nombres que a alguien se le ocurrieron. Faltaban dos — `passwordEnc` y
`newPassword` — y **174 contraseñas de fuentes de datos Oracle y 5 contraseñas
de usuarios se escribieron en `audit_log` en texto plano**. Sin cifrar; la
cadena tal cual.

Una regla por subcadena captura todas las variantes con prefijo, con sufijo y en
camelCase de la misma palabra, sin que nadie tenga que enumerarlas. El texto
plano existente se purgó con la migración `0010_purge_audit_log_credentials`,
que redacta los valores en su sitio en lugar de borrar filas: un rastro de
auditoría cuyas filas desaparecen es un rastro de auditoría peor.

### Lo que la redacción no cubre

- **Valores, no claves.** Una contraseña pegada en un campo de *descripción* se
  guarda. El redactor compara por el nombre del campo; no puede reconocer un
  secreto con solo mirarlo.
- **Texto de error.** Un mensaje de fallo de Oracle o de Postgres puede citar la
  palabra «password» («password authentication failed»). Son mensajes, no
  credenciales, y se dejan intactos.

### Si añade un campo que lleva un secreto

Póngale un nombre que contenga una de las seis subcadenas. `apiToken` está
cubierto; `apiPass` no. Añadir un nombre que no coincida es añadir una fuga, y
el hook de auditoría no tiene forma de avisarle.

`backend/src/__tests__/audit-redaction.test.ts` fija la regla.

## Prácticas recomendadas

1. **Empiece de forma sencilla** — Comience con el filtrado por una sola columna (región, departamento)
2. **Documente las directivas** — Explique la intención y los requisitos de mantenimiento
3. **Pruebe a fondo** — Verifique que cada usuario ve únicamente los datos adecuados
4. **Supervise el rendimiento** — Los predicados complejos pueden afectar a la velocidad de las consultas
5. **Utilice claves coherentes** — Mantenga la coherencia en los nombres de las claves de contexto (p. ej., siempre `region`, no `region_code`)
6. **Revise periódicamente** — Audite las directivas trimestralmente para asegurarse de que siguen siendo adecuadas

## Limitaciones

- **Asignación manual del contexto** — El contexto de los usuarios se establece actualmente de forma manual (sin sincronización automática con LDAP en la v0.1)
- **Sin RLS temporal** — Aún no existe filtrado basado en el tiempo
- **Un único predicado por carpeta** — Solo se aplica una directiva por carpeta
- **Sin UPDATE/DELETE de nivel de fila** — La RLS solo filtra las consultas SELECT

## ¿Qué sigue?

- **[Gestión de usuarios](user-management.md)** — Cree usuarios y asigne contexto
- **[Gestión de metadatos](metadata-management.md)** — Organice las carpetas
- **[Registro de auditoría](audit-logging.md)** — Revise los eventos de seguridad

---

**Consulte también:** [Guía del administrador](../admin-guide/), [Referencia de la API - Seguridad](../../api/endpoints.md#security)
