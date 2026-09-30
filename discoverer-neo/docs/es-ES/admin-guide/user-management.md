# Gestión de usuarios

Aprenda a crear usuarios, asignar roles y gestionar los permisos de las áreas de negocio.

## Roles de usuario

Discoverer Neo tiene cuatro roles de usuario con capacidades diferentes:

| Rol | Capacidades |
|------|-------------|
| **ADMIN** | Acceso completo al sistema: usuarios, áreas de negocio, orígenes de datos, registros de auditoría. Abre, cambia, comparte y elimina todos los mapas. |
| **MANAGER** | Abre, ejecuta, exporta, programa y comparte **todos** los mapas, y puede cambiar el propietario de un mapa. Solo cambia sus propios mapas. Ve, edita, activa y desactiva cuentas MANAGER, USER y VIEWER. No puede ver a los administradores, crear ni eliminar usuarios, ni dar el rol ADMIN. No puede cambiar el modelo de datos (áreas de negocio, carpetas, elementos, combinaciones, jerarquías), ni siquiera con una concesión, y no puede usar funciones personalizadas ni orígenes de datos. |
| **USER** | Solo ve sus propios mapas y los que se han compartido con él. Crea un mapa nuevo copiando uno de ellos. |
| **VIEWER** | Solo lectura. Abre y ejecuta los mapas compartidos con él. No puede crear, copiar ni cambiar mapas. |

La página Usuarios muestra estas reglas bajo el campo **Rol** cuando edita un
usuario. La página Usuarios de un MANAGER muestra solo cuentas MANAGER, USER y
VIEWER. Allí puede editar una cuenta (nombre, correo electrónico, contraseña y
un rol distinto de ADMIN), activarla o desactivarla, y ver los mapas de cada
usuario: cambiar el nivel de un uso compartido, quitarlo o asignar un mapa a un
nuevo propietario. Solo un ADMIN ve las cuentas de administrador, crea o
elimina usuarios y da el rol ADMIN.

Cualquier persona, salvo un VIEWER, puede copiar un mapa que pueda ver. La copia
le pertenece. Ejecutarla sigue exigiendo un permiso sobre su área de negocio
(véase «dos comprobaciones» más abajo).

## Creación de usuarios

### Agregar un único usuario

1. Panel de administración → **Usuarios**
2. Haga clic en **+ Crear usuario**
3. Introduzca:
   - **Correo electrónico** — Dirección de correo electrónico única (identificador de inicio de sesión)
   - **Nombre** — Nombre completo o nombre para mostrar
   - **Contraseña** — Contraseña inicial (el usuario debería cambiarla en el primer inicio de sesión)
   - **Rol** — ADMIN, MANAGER, USER o VIEWER
4. Haga clic en **Crear**

El usuario recibe una notificación para iniciar sesión (si el correo electrónico está configurado).

### Importación masiva

Para migrar muchos usuarios desde Oracle Discoverer:

1. Exporte la lista de usuarios como CSV:
   ```
   email,name,role
   john@example.com,John Smith,USER
   jane@example.com,Jane Doe,MANAGER
   ```

2. Utilice la herramienta de migración o la API para crearlos de forma masiva

3. Envíe un correo electrónico de bienvenida con contraseñas temporales

## Asignación de roles

### Cambiar el rol de un usuario

1. Panel de administración → **Usuarios**
2. Haga clic en el usuario → **Editar**
3. Cambie el menú desplegable **Rol**
4. Haga clic en **Guardar**

El cambio de rol surte efecto de inmediato.

## Permisos de las áreas de negocio

Una vez que existan los usuarios, concédales acceso a áreas de negocio específicas.

### Conceder un permiso

1. Panel de administración → **Áreas de negocio**
2. Seleccione un área de negocio → **Gestionar acceso**
3. Marque uno o varios usuarios de la lista. Escriba en el cuadro de filtro para encontrarlos.
4. Elija el nivel de **Permiso**. El cuadro de debajo indica lo que permite ese nivel.
5. Haga clic en **Añadir**. Todos los usuarios marcados reciben ese nivel.

### Niveles de permiso

Los niveles forman una jerarquía. Cada nivel incluye todos los niveles anteriores de la tabla. Ningún nivel muestra los mapas de otras personas: solo lo hace un uso compartido (o el rol MANAGER).

| Nivel | Lo que añade |
|-------|--------------|
| **VIEW** | Leer los datos en las carpetas del área. Ver las carpetas, elementos, combinaciones y jerarquías del área. Ejecutar mapas que usted posee, mapas compartidos con usted y mapas públicos. |
| **EXPORT** | Igual que VIEW actualmente (ver nota 2). |
| **SCHEDULE** | Igual que VIEW actualmente (ver nota 2). |
| **CREATE** | Crear mapas nuevos, carpetas, elementos, combinaciones y jerarquías en el área. |
| **EDIT** | Cambiar el área y sus carpetas, elementos, combinaciones y jerarquías. |
| **DELETE** | Eliminar carpetas, elementos, combinaciones y jerarquías del área. |

Los usuarios ADMIN omiten todas estas comprobaciones.

**Nota 1 — dos comprobaciones.** Para ejecutar un mapa, un usuario debe pasar dos comprobaciones:

1. **¿Puedo ver este mapa?** Sí si es ADMIN o MANAGER, es propietario, el mapa es público o está compartido con usted.
2. **¿Puedo leer sus datos?** Sí si tiene **cualquier** permiso en el área de negocio de cada carpeta que utiliza el mapa.

Por lo tanto, un mapa compartido con un usuario falla si el usuario no tiene permiso en el área de la que provienen los datos.

**Nota 2 — VIEW, EXPORT y SCHEDULE actúan igual en los mapas.** Ninguno de estos tres permite a un usuario ver los mapas de otras personas. En un mapa compartido, el **uso compartido** determina lo que el usuario puede hacer: un uso compartido VIEW le permite ejecutarlo; un uso compartido EXPORT añade exportación y programación; un uso compartido EDIT añade cambios. Consulte [Compartir](../user-guide/sharing.md).

### Qué nivel conceder

Conceda **un** permiso por usuario y por área de negocio — el nivel más alto que necesite. Ya incluye los niveles inferiores. No añada permisos inferiores.

| El usuario debe… | Conceda |
|----------------|-------|
| Ejecutar mapas que otros comparten con usted, o copiarlos | VIEW |
| Crear mapas nuevos desde cero | CREATE |
| Mantener las carpetas, elementos y combinaciones del área | EDIT |
| También eliminarlos | DELETE |

### Revocar un permiso

1. Haga clic en el área de negocio → **Gestionar acceso**
2. Busque al usuario en la lista de permisos
3. Haga clic en **Quitar**
4. Confirme

El usuario pierde el acceso de inmediato.

### Cambiar el nivel de permiso

1. Haga clic en el área de negocio → **Gestionar acceso**
2. Busque al usuario
3. Haga clic en el menú desplegable de permisos
4. Seleccione el nuevo nivel
5. El cambio surte efecto de inmediato

## Gestión de contraseñas

### Usuarios importados y contraseñas temporales

Discoverer almacena nombres de usuario, pero nunca contraseñas, por lo que no se
puede trasladar ninguna. En su lugar, la migración **genera una contraseña
temporal única para cada persona importada** y las escribe todas en un archivo
para que usted las distribuya.

1. Ejecute la migración (consulte [Usuarios y contraseñas migrados](../../migration/user-credentials.md)).
2. Recoja `credentials/credentials-<id-ejecucion>.csv` del servidor.
3. Entregue a cada persona su contraseña por un canal de confianza.
4. **Elimine el archivo.** Nada lo elimina por usted.

Cada cuenta debe cambiar esa contraseña antes de poder hacer cualquier otra cosa
— lo impone el servidor, no es una mera sugerencia de la interfaz.

### Crear un usuario manualmente

Al añadir un usuario desde Panel de administración → **Usuarios**, usted define
directamente su primera contraseña. Pídale que la cambie tras iniciar sesión,
desde **Configuración → Cambiar contraseña**.

### Qué significa «debe cambiar la contraseña»

Mientras una cuenta esté pendiente de cambiar la contraseña, solo puede acceder a
la pantalla de cambio. Todas las demás páginas y llamadas a la API se rechazan.
El inicio de sesión funciona, pero la aplicación no está disponible hasta que se
cambie la contraseña.

Puede ver quién sigue pendiente en la lista de Usuarios.

### Restablecimiento de la contraseña

Si un usuario olvida su contraseña (como administrador):

1. Panel de administración → **Usuarios**
2. Haga clic en el usuario → **Restablecer contraseña**
3. El sistema genera una contraseña temporal
4. Envíela al usuario (por correo electrónico o por otro medio)
5. El usuario cambia la contraseña en el primer inicio de sesión

### Exigir un cambio de contraseña

Las cuentas creadas por una migración se marcan automáticamente: no tiene que
hacer nada. No hay una casilla manual; el indicador se establece cuando la cuenta
recibe una contraseña temporal y se borra en cuanto el usuario elige la suya.

Para forzar una rotación en una cuenta existente, restablezca su contraseña; el
restablecimiento devuelve la cuenta al mismo estado.

### Re-aprovisionamiento en el cutover

Consulte quién aún necesita qué — no asuma un número fijo de usuarios, cambia a
medida que las personas completan el primer inicio de sesión:

```sql
-- Personas reales que necesitan una credencial completamente nueva (nunca re-aprovisionadas):
SELECT count(*) FROM users WHERE password_hash = '!migrated-no-login' AND is_role = false;
-- Personas reales que ya tienen una credencial, simplemente no han iniciado sesión aún:
SELECT count(*) FROM users WHERE must_change_password = true AND password_hash != '!migrated-no-login';
```

Las cuentas de rol y servicio (`is_role = true`, además de la cuenta del servicio
de migración) nunca se re-aprovisionan deliberadamente — llevan la marca
`!migrated-no-login` para siempre por diseño. Procedimiento completo y un ensayo
real de este flujo: [`docs/deployment/cutover-runbook.md`](../../deployment/cutover-runbook.md#step-6--re-provision-credentials).

## Roles de base de datos

Los usuarios importados de Oracle Discoverer no son todos personas. Discoverer
concede privilegios tanto a **roles** de Oracle (`CONNECT`, `RESOURCE`) como a
individuos, y la migración trae ambos.

Un rol aparece en la lista de Usuarios con una etiqueta **Rol**:

| | Persona | Rol de base de datos |
| --- | --- | --- |
| Puede iniciar sesión | Sí | **No, nunca** |
| Tiene permisos | Sí | Sí |
| Tiene contraseña | Sí | Ninguna. Ninguna contraseña coincide. |

Los roles se conservan porque llevan los permisos sobre los que se basaba su
seguridad de Discoverer. No pueden convertirse en cuentas de acceso: asigne los
permisos equivalentes a usuarios reales y después retire el rol.

## Preferencias de usuario

Los usuarios pueden gestionar sus propias preferencias de interfaz sin la intervención de un administrador:

- **Idioma** — Los usuarios seleccionan el idioma de la interfaz que prefieren (English, Português, Français, Español) en Configuración
- **Tema** — Los usuarios eligen el tema visual que prefieren (Claro, Oscuro, Alto contraste) en Configuración

Estas preferencias son de autoservicio y por usuario. Cada usuario puede acceder a Configuración a través de la barra lateral o del menú desplegable de perfil para personalizar su experiencia. No se necesita ninguna configuración por parte del administrador.

## Estado del usuario

### Activo/Inactivo

En la pantalla de usuarios, la columna **Estado** muestra cada cuenta como Activa o Inactiva.

1. Abra **Usuarios** en la barra lateral de administración.
2. Para desactivar un usuario, haga clic en el botón **Desactivar** (persona con una cruz) de su fila y, a continuación, haga clic en **Desactivar** en el cuadro de confirmación.
3. Para activar un usuario inactivo, haga clic en el botón **Activar** (persona con una marca de verificación) de su fila. No se pide confirmación.

No puede desactivar su propia cuenta; su botón está deshabilitado.

También puede establecer `isActive` mediante la API:

```bash
curl -X PUT http://localhost:3000/api/users/<user-id> \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

- **Activo** (predeterminado) — El usuario puede iniciar sesión
- **Inactivo** — El usuario no puede iniciar sesión ni renovar una sesión (eliminación temporal)

Resulta útil para deshabilitar temporalmente cuentas sin eliminarlas.

**La baja surte efecto de inmediato.** La existencia, el estado activo y el rol
se leen de la base de datos en cada solicitud y en cada renovación del token,
nunca del propio token. Un usuario que desactive o elimine queda rechazado en
su siguiente solicitud, y un usuario al que rebaje de rol queda limitado al
nuevo rol en su siguiente solicitud. No es necesario esperar a que caduque su token.

### Cuenta bloqueada

Los inicios de sesión fallidos bloquean una cuenta durante un tiempo breve. Con la configuración predeterminada:

- **5 inicios de sesión fallidos** en una cuenta en 15 minutos bloquean esa
  cuenta durante **15 minutos**. El inicio de sesión devuelve
  `429 Too Many Requests` hasta que termina el bloqueo.
- **100 inicios de sesión fallidos** desde una misma dirección IP en 15 minutos
  bloquean esa dirección hasta que terminan los 15 minutos, para todas las cuentas.
- Un inicio de sesión correcto pone a cero los fallos de la cuenta.
- Una dirección que inició sesión correctamente en la cuenta en los últimos
  30 días puede seguir iniciando sesión mientras la cuenta está bloqueada. Así,
  un atacante no puede dejar fuera al usuario real fallando a propósito. Esa
  dirección sigue sujeta al límite por dirección.
- Cada bloqueo escribe un evento `auth.lockout` en el registro de auditoría.

El bloqueo termina solo; no hay desbloqueo manual. Los límites se definen en
[Configuración](../../deployment/configuration.md#login-rate-limiting).

Para impedir el inicio de sesión:
- Establezca el estado **Inactivo** (preferible)
- O elimine la cuenta de usuario

## Delegación

Dé el rol **MANAGER** a quien se ocupe de los mapas de otras personas.
Un MANAGER puede:
- Ver, ejecutar, exportar, programar y compartir todos los mapas
- Entregar un mapa a un nuevo propietario, y cambiar o quitar sus recursos compartidos (Usuarios → icono de mapa)
- Editar, activar y desactivar cuentas MANAGER, USER y VIEWER

Un MANAGER no puede:
- Ver o cambiar cuentas de administrador, crear o eliminar usuarios, dar el
  rol ADMIN, ni dar acceso a áreas de negocio
- Cambiar el modelo de datos: áreas de negocio, carpetas, elementos, combinaciones, jerarquías
- Abrir Funciones personalizadas, Orígenes de datos, Seguridad, Registro de auditoría ni Migración

## Traza de auditoría

Realice el seguimiento de las acciones de los usuarios en el **Registro de auditoría**:

1. Panel de administración → **Registro de auditoría**
2. Filtre por:
   - Intervalo de fechas
   - Usuario
   - Acción (CREATE, UPDATE, DELETE, EXECUTE)
   - Tipo de entidad (USER, MAP, BUSINESS_AREA, etc.)

Los eventos de creación/modificación de usuarios quedan registrados.

## Prácticas recomendadas

### Convenciones de nomenclatura

Utilice un direccionamiento de correo electrónico coherente:
- ✓ firstname.lastname@example.com
- ✓ correo electrónico del servicio de directorio (LDAP, Active Directory)
- ✗ ID numéricos (difíciles de identificar)

### Roles predeterminados

Asigne el rol mínimo necesario:

- La mayoría de los usuarios → rol **USER** (no MANAGER ni ADMIN)
- Creadores de informes → rol **USER**
- Jefes de equipo → rol **MANAGER** (si se ocupan de los mapas del equipo)
- Solo 1 o 2 → rol **ADMIN**

### Auditorías periódicas

Revise periódicamente:
- Los permisos de los usuarios (quite los usuarios inactivos)
- El acceso a las áreas de negocio (revoque las concesiones innecesarias)
- Las cuentas de administrador (asegúrese de que solo existan las necesarias)

### Lista de comprobación de incorporación

1. ✓ Cree la cuenta de usuario
2. ✓ Asigne el rol adecuado
3. ✓ Conceda los permisos de las áreas de negocio
4. ✓ Envíe un correo electrónico de bienvenida con instrucciones de inicio de sesión
5. ✓ Programe una sesión guiada para los nuevos usuarios

### Lista de comprobación de baja

1. ✓ Identifique los mapas de los que el usuario es propietario
2. ✓ Transfiera la propiedad o archive los mapas
3. ✓ Revoque los permisos de las áreas de negocio
4. ✓ Establezca el usuario como **Inactivo** (o elimínelo)
5. ✓ Registre el evento de auditoría

## Integración con directorios (futuro)

Es posible que las versiones futuras admitan LDAP/Active Directory:
- Usuarios aprovisionados automáticamente desde el directorio
- Roles/permisos sincronizados desde los grupos del directorio
- Compatibilidad con inicio de sesión SSO

## ¿Qué sigue?

- **[Directivas de seguridad](security.md)** — Defina la seguridad de nivel de fila para los usuarios
- **[Registro de auditoría](audit-logging.md)** — Revise las actividades de los usuarios
- **[Gestión de áreas de negocio](metadata-management.md)** — Organice el contenido

---

**Consulte también:** [Guía del administrador](../admin-guide/), [Referencia de la API - Usuarios](../../api/endpoints.md#users)
