# Uso compartido de mapas

Aprenda a compartir mapas con sus colegas y a gestionar los permisos.

## ¿Por qué compartir mapas?

Comparta mapas para:
- Colaborar en el desarrollo de informes
- Dar acceso a sus colegas a consultas comunes
- Delegar el mantenimiento en otros usuarios
- Crear plantillas para su reutilización por el equipo

## Compartir un mapa

### Paso 1: abrir el mapa

1. Haga clic en **Mapas** → seleccione su mapa
2. Haga clic en **Compartir** o **Gestionar uso compartido**

### Paso 2: agregar un usuario

En el panel de uso compartido:

1. Haga clic en **+ Agregar usuario** o **+ Conceder acceso**
2. Seleccione un usuario de la lista
3. Elija el nivel de permiso (véase a continuación)
4. Haga clic en **Conceder**

El usuario ya puede acceder al mapa con el nivel de permiso seleccionado.

## Niveles de permiso

| Permiso | Ver | Editar | Eliminar | Exportar | Ejecutar | Compartir |
|-----------|------|------|--------|--------|-----|-------|
| **VIEW** | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ |
| **EDIT** | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ |
| **EXPORT** | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ |

- **VIEW** — Puede ver la definición del mapa y ejecutarlo (solo lectura)
- **EDIT** — Puede modificar el mapa y compartirlo con otros
- **EXPORT** — Puede ejecutar el mapa y exportar los resultados
- **Propietario** — Usted (siempre puede modificarlo, compartirlo y eliminarlo)

## Público frente a privado

Utilice el conmutador **Público** para que todos los usuarios puedan detectar un mapa:

- **Privado** (predeterminado) — Solo se comparte con usuarios específicos
- **Público** — Todos los usuarios autenticados pueden verlo y ejecutarlo

## Cambio de permisos

Para cambiar el nivel de acceso de un usuario:

1. Busque al usuario en la lista de uso compartido
2. Haga clic en el menú desplegable de permisos
3. Seleccione el nuevo nivel
4. Los cambios surten efecto de inmediato

## Revocación del acceso

Para quitar el acceso de un usuario:

1. Busque al usuario en la lista de uso compartido
2. Haga clic en **Quitar** o en el icono de la papelera
3. Confirme la eliminación

El usuario pierde el acceso de inmediato.

## Compartidos conmigo

Para ver los mapas que se han compartido con usted:

1. Haga clic en **Mapas** en la barra lateral
2. Haga clic en la pestaña **Compartidos conmigo**
3. Explore los mapas compartidos

Puede:
- **Ver** — Consultar la definición del mapa
- **Ejecutar** — Ejecutar el mapa con SUS permisos en el área de negocio
- **Exportar** — Guardar los resultados en Excel/CSV (si se ha concedido el permiso EXPORT)
- **Editar** — Modificarlo (si se ha concedido el permiso EDIT)

## Prácticas recomendadas para compartir

### Convenciones de nomenclatura

Utilice nombres descriptivos para los mapas compartidos:
- ✓ «Informe de ventas semanal - Región EMEA»
- ✗ «Informe1»

### Niveles de permiso

Conceda el permiso mínimo necesario:
- **VIEW** para informes de solo lectura
- **EDIT** solo para colegas de confianza que mantengan el mapa
- **EXPORT** para usuarios que necesitan los datos, pero no modificar el mapa

### Documentación

Añada descripciones a los mapas compartidos:
1. Edite el mapa
2. Actualice el campo **Descripción**
3. Explique qué muestra el mapa, qué significan los parámetros y la programación de actualización de los datos

**Ejemplo:**
```
Informe de ventas por región

Muestra el total de ventas por región para el periodo seleccionado.
Parámetros:
- start_date: fecha de inicio del informe (predeterminado: primer día del mes actual)
- end_date: fecha de fin del informe (predeterminado: hoy)

Actualizado diariamente a las 9:00 UTC.
Contacto: sales-analytics@example.com para consultas.
```

### Control de versiones

Para los mapas compartidos críticos:
- Anote el número de versión en la descripción
- Al realizar cambios importantes, incremente la versión
- Informe a los usuarios de los cambios que rompan la compatibilidad

## Uso compartido entre áreas de negocio

Comparta mapas únicamente en las áreas de negocio en las que los destinatarios tengan acceso **VIEW**:

- **Si carecen de VIEW:** no podrán ejecutar el mapa aunque se comparta con ellos
- **Si carecen de EDIT:** no podrán modificarlo aunque se comparta con permiso EDIT

Póngase en contacto con su administrador para conceder primero el acceso al área de negocio.

## Flujo de trabajo de colaboración

**Escenario: crear un informe conjuntamente**

1. **El usuario A** crea un borrador de mapa
2. **El usuario A** lo comparte con **el usuario B** con permiso **EDIT**
3. **El usuario B** ejecuta el mapa y propone cambios
4. **El usuario A** edita el mapa
5. **El usuario B** verifica los cambios
6. **El usuario A** lo hace **Público** o concede acceso **solo VIEW** a un equipo más amplio

## Resolución de problemas

### «Usuario no encontrado»

- El usuario no existe en el sistema
- Póngase en contacto con el administrador para crear la cuenta de usuario

### «Permisos insuficientes para ejecutar»

- Tiene el mapa compartido con permiso EDIT, pero carece de VIEW en el área de negocio
- Póngase en contacto con el administrador para obtener acceso al área de negocio

### «No se puede compartir con este usuario»

- El rol del usuario (p. ej., VIEWER) puede restringir determinadas acciones
- Póngase en contacto con el administrador

## ¿Qué sigue?

- **[Programación de mapas](scheduling.md)** — Automatice la distribución de informes compartidos
- **[Creación de mapas](building-maps.md)** — Cree mapas para compartir
- **[Guía del administrador - Usuarios](../admin-guide/user-management.md)** — Gestione las cuentas de usuario

---

**Consulte también:** [Guía del usuario](../user-guide/), [Referencia de la API - Uso compartido](../../api/endpoints.md#map-shares)
