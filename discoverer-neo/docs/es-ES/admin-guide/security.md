# Directivas de seguridad

Aprenda a definir directivas de seguridad de nivel de fila (RLS) que filtran los datos por usuario o rol.

## ¿Qué es la seguridad de nivel de fila?

La **seguridad de nivel de fila (RLS)** filtra automáticamente los resultados de las consultas en función del contexto del usuario, sin necesidad de modificar los mapas ni las consultas.

**Ejemplo:** el responsable de una región de ventas ve únicamente los datos de su región, aunque todas las regiones se encuentren en la misma tabla.

## Cómo funciona la RLS

1. **Una directiva contiene reglas.** Cada regla se dirige a un **área de
   negocio** o a una **carpeta** y lleva un predicado SQL: un fragmento de
   cláusula WHERE como `REGION = 'EMEA'` o
   `{alias}."SALES_REP_ID" = :current_user_id`.
2. **Una directiva se asigna** a usuarios, a roles o a ambos.
3. **Cuando se ejecuta una consulta,** Neo localiza todas las carpetas cuyas
   filas pueden llegar al resultado: los elementos y las condiciones del mapa,
   las carpetas que lee un cálculo y las carpetas unidas que filtran filas. Una
   regla de área de negocio se aplica a cada una de esas carpetas que pertenezca
   a su área (propia o compartida); una regla de carpeta se aplica a su carpeta.
4. **Cada predicado aplicable se combina con AND en la cláusula WHERE,** cada
   uno entre sus propios paréntesis, de modo que un `OR` de las condiciones del
   mapa no puede escaparse de él. En una hoja que resume varios conjuntos de
   filas de detalle, el predicado va dentro de cada resumen, antes de sumar nada.

Los predicados pueden usar tres enlaces, que se rellenan a partir del usuario
que ha iniciado sesión y nunca a partir de la petición: `:current_user_id`,
`:current_user_email` y `:current_user_role`. Una regla de carpeta puede
escribir `{alias}` para referirse a su carpeta dentro de la consulta.

## La seguridad de nivel de fila deniega por defecto

**Un usuario al que ninguna directiva da filas de una carpeta no ve nada de esa
carpeta.** La consulta se rechaza nombrando la carpeta, y ningún SQL llega a
Oracle:

> Refusing to run unfiltered: no row-level security policy resolves for you on folder(s) "SALES"

Esto es **deliberadamente distinto de Discoverer**, y es el único punto en el
que Neo rompe la compatibilidad a propósito (D-090). La seguridad de nivel de
fila de Discoverer era una condición obligatoria de carpeta; una carpeta sin
ella mostraba todas las filas a todo el mundo. Reproducirlo sería reproducir
una vulnerabilidad.

Lo que se deriva de ello:

- **Una instalación nueva no devuelve nada** hasta que existen directivas,
  tampoco a los administradores. Para que un grupo vea todas las filas de un
  área de negocio, asígnele una directiva cuya regla se dirija a esa área con el
  predicado `1 = 1`.
- **Eliminar, deshabilitar o desasignar una directiva nunca abre el acceso.**
  Solo puede quitar filas.
- **Los administradores no están exentos.** Omiten los permisos de área de
  negocio; no omiten la seguridad de nivel de fila. No hay ninguna omisión de
  administrador que auditar.
- **Las listas de valores siguen la misma regla.** Una lista desplegable sobre
  una carpeta para la que no tiene directiva también se rechaza.

El ajuste es `ROW_LEVEL_FAIL_MODE`
([Configuración](../../deployment/configuration.md#row-level-security)).
`OPEN` rechaza solo una carpeta a la que ya se dirige alguna directiva activa y
ejecuta sin filtrar todas las demás, como antes de este cambio. Úselo solo
mientras se escriben las directivas de una instalación: con `OPEN`,
deshabilitar una directiva vuelve a ampliar el acceso.

### Los administradores son la frontera de confianza de los predicados

Un predicado es SQL sin procesar que se inserta en cada consulta a la que llega
su carpeta. Neo lo valida al guardarlo y, antes de cada ejecución, vuelve a
comprobar que no puede salirse de sus paréntesis. Rechaza:

- separadores de sentencias (`;`) y comentarios (`--`, `/* */`);
- todo lo que cierre el paréntesis que envuelve al predicado, como
  `1=1) OR (1=1`, que devolvería todas las filas;
- palabras clave DDL, DML y PL/SQL, `UNION` / `INTERSECT` / `MINUS` /
  `EXCEPT`, y llamadas `DBMS_`, `UTL_`, `OWA_`, `HTP.` y `HTF.`;
- enlaces distintos de los tres anteriores y texto que no se analiza como una
  condición.

Estas comprobaciones detienen errores y las vías de escape conocidas. **No
pueden distinguir una regla equivocada de una correcta.** Quien puede editar las
directivas decide lo que ve cada usuario, así que trate el rol de administrador
de seguridad como trataría el acceso a la base de datos.

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

La directiva deja de aplicarse. Sus usuarios **no** recuperan filas sin filtrar:
una carpeta para la que ya no tienen ninguna directiva activa se rechaza, como
se explica en
[La seguridad de nivel de fila deniega por defecto](#la-seguridad-de-nivel-de-fila-deniega-por-defecto).
Solo con `ROW_LEVEL_FAIL_MODE=OPEN` deshabilitar o eliminar una directiva
amplía el acceso.

### Eliminar permanentemente

1. Busque la directiva → **Eliminar**
2. Confirme

Se eliminan la directiva, sus reglas y sus asignaciones. Igual que al
deshabilitarla, esto quita filas y nunca las devuelve.

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
plano existente se purgó con la migración `0011_purge_audit_log_credentials`,
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

## Acceso a nivel de objeto

Leer una carpeta, un elemento, una unión o una jerarquía por su id requiere el
mismo permiso que listarlos. Un usuario sin permiso sobre un área de negocio a la
que pertenece el objeto recibe `403 Forbidden`, no el objeto. Los
administradores omiten la comprobación.

Una carpeta pertenece a su área de negocio propietaria y a todas las áreas con
las que se comparte; basta un permiso sobre cualquiera de ellas. Los elementos y
las uniones siguen a su carpeta. Las jerarquías siguen a su área de negocio.

`backend/src/__tests__/get-by-id-scoping.test.ts` analiza todos los archivos de
rutas y falla si una ruta `GET` con id no nombra ninguna comprobación de acceso.

Las lecturas aún no se registran en la auditoría. Eso es la fase 6.4.

## SQL personalizado en carpetas COMPLEX

El SQL de una carpeta COMPLEX se inserta en cada consulta que la lee, así que se
comprueba **al crear y al actualizar** con la misma función
(`assertValidFolderSql` en `folder.service.ts`). Debe ser una única sentencia
`SELECT` o `WITH`; DDL, DML, `EXEC`, `EXECUTE IMMEDIATE` y llamadas `DBMS_` se
rechazan con `400`. Cambiar el tipo de una carpeta a COMPLEX sin SQL también se
rechaza.

**Una carpeta COMPLEX a la que llega una directiva de seguridad de nivel de fila
no se ejecuta.** Su SQL se inserta como tabla derivada y el predicado de la
directiva se combina con AND en la consulta que la rodea, nunca en las tablas
que ese SQL lee, así que Neo no puede demostrar que el predicado filtre nada. El
rechazo nombra la carpeta y la directiva, se aplica a todos los usuarios y vale
tanto si la directiva se dirige a la carpeta como a su área de negocio:

> Refusing to run: COMPLEX folder "X" is covered by row-level security policy "P", and a policy's predicate cannot yet be proven to filter the rows a COMPLEX folder's own SQL reads

Con el modo predeterminado `CLOSED`, por tanto, una carpeta COMPLEX no se puede
leer en absoluto: sin directiva se rechaza por no estar cubierta, y con ella se
rechaza aquí. Lea esos datos a través de una carpeta normal sobre la tabla o la
vista subyacente y ponga la directiva en esa carpeta.

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
- **Las directivas se combinan con AND** — Cuando varias de sus directivas llegan a una carpeta, solo ve las filas que todas permiten
- **Sin UPDATE/DELETE de nivel de fila** — La RLS solo filtra las consultas SELECT

## ¿Qué sigue?

- **[Gestión de usuarios](user-management.md)** — Cree usuarios y asigne contexto
- **[Gestión de metadatos](metadata-management.md)** — Organice las carpetas
- **[Registro de auditoría](audit-logging.md)** — Revise los eventos de seguridad

---

**Consulte también:** [Guía del administrador](../admin-guide/), [Referencia de la API - Seguridad](../../api/endpoints.md#security)
