# Gestión de usuarios

Aprenda a crear usuarios, asignar roles y gestionar los permisos de las áreas de negocio.

## Roles de usuario

Discoverer Neo tiene cuatro roles de usuario con capacidades diferentes:

| Rol | Capacidades |
|------|-------------|
| **ADMIN** | Acceso completo al sistema: usuarios, áreas de negocio, orígenes de datos, registros de auditoría |
| **MANAGER** | Crear y gestionar áreas de negocio, conceder permisos a otros usuarios |
| **USER** | Crear mapas, ejecutar consultas, compartir mapas con colegas |
| **VIEWER** | Acceso de solo lectura a mapas y paneles compartidos |

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
3. Haga clic en **+ Conceder permiso**
4. Seleccione:
   - **Usuario** — Del menú desplegable
   - **Nivel de permiso** — CREATE, EDIT, DELETE, EXPORT, SCHEDULE o VIEW
5. Haga clic en **Conceder**

**Niveles de permiso en un área de negocio:**

| Permiso | Mapas | Metadatos | Programación | Exportación |
|-----------|------|----------|----------|--------|
| **CREATE** | Crear mapas nuevos | ✗ | ✗ | ✗ |
| **EDIT** | Modificar mapas | ✗ | ✗ | ✗ |
| **DELETE** | Eliminar mapas | ✗ | ✗ | ✗ |
| **EXPORT** | Exportar resultados | ✓ | ✗ | ✓ |
| **SCHEDULE** | Crear programaciones | ✓ | ✗ | ✓ |
| **VIEW** | Ejecutar/ver mapas | ✓ | ✓ | ✗ |

### Conceder varios permisos

Los usuarios suelen necesitar varios permisos:

- **Usuarios de datos:** VIEW + EXPORT (pueden ejecutar mapas y descargar)
- **Creadores de informes:** VIEW + CREATE + EDIT (pueden crear y probar)
- **Publicadores:** CREATE + EDIT + EXPORT + SCHEDULE (ciclo de vida completo del mapa)

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

Utilice el conmutador de estado del usuario:

- **Activo** — El usuario puede iniciar sesión
- **Inactivo** — El usuario no puede iniciar sesión (eliminación temporal)

Resulta útil para deshabilitar temporalmente cuentas sin eliminarlas.

### Cuenta bloqueada

No existe un bloqueo manual de cuentas en la versión actual. Los usuarios pueden reintentar la contraseña de forma indefinida.

Para impedir el inicio de sesión:
- Establezca el estado **Inactivo** (preferible)
- O elimine la cuenta de usuario

## Delegación

Los responsables (MANAGER) pueden delegar la creación de usuarios y la gestión de permisos:

1. Promueva a los usuarios al rol **MANAGER**
2. Los responsables podrán entonces:
   - Crear usuarios
   - Conceder permisos en sus áreas de negocio
   - Gestionar el acceso de otros usuarios

Los responsables no pueden:
- Crear otros responsables o administradores
- Acceder a la configuración del sistema ni a los registros de auditoría
- Gestionar orígenes de datos

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
- Jefes de equipo → rol **MANAGER** (si gestionan áreas de negocio)
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
