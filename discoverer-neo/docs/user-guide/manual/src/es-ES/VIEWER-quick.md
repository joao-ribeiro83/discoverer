# Su rol en una página

Usted tiene el rol **VIEWER**. Su tarea principal es abrir mapas y leer sus resultados. Un **mapa** es un informe. Un **área de negocio** es un grupo de datos relacionados.

| Puede | No puede |
|---|---|
| Ver sus mapas, los públicos y los compartidos | Ver los mapas privados de otras personas |
| Ejecutar mapas, ordenar, filtrar y desglosar | Copiar un mapa o un libro |
| Exportar, si el mapa es público o se comparte como **Puede exportar** o **Puede editar** | Exportar un mapa compartido como **Puede ver** |
| Cambiar su idioma y su tema | Abrir las páginas de administración |

Niveles de acceso compartido: **Puede ver** = solo ejecutar. **Puede exportar** = ejecutar, exportar y programar. **Puede editar** = todo lo anterior y además cambiar el mapa. Lo decide el recurso compartido, no su rol.

Inicie sesión con su **Correo electrónico** y su **Contraseña** y después haga clic en **Iniciar sesión**. Una contraseña temporal debe cambiarse primero (al menos 12 caracteres). Para salir, haga clic en su nombre y después en **Cerrar sesión**.

![La página de inicio de sesión con Correo electrónico, Contraseña, Recordarme y el botón Iniciar sesión.](shots/es-ES/common/01-login.png)

---

# Panel y Mapas

El **Panel** es un resumen de solo lectura. **Mapas** muestra lo que puede abrir.

![La lista de Mapas, pestaña Todos, donde cada mapa solo tiene el icono Abrir.](shots/es-ES/viewer/03-maps-all.png)

1. Haga clic en **Mapas** en la barra lateral.
2. Abra **Compartidos conmigo** o **Todos**.
3. Busque por nombre o elija un **Área de negocio**.
4. Haga clic en el nombre del mapa o en el icono del ojo.

| Opción | Línea |
|---|---|
| **Míos** / **Compartidos conmigo** / **Todos** | Los suyos, los compartidos, o todo lo que puede ver |
| Copiar | No disponible para su rol |
| Otros iconos | Solo funcionan si el mapa es suyo o tiene **Puede editar** o **Puede exportar** |

---

# Ejecutar y leer un mapa

El visor ejecuta un mapa y muestra sus filas.

![Una ejecución completada con los botones Excel, CSV y PDF sobre la cuadrícula de resultados.](shots/es-ES/viewer/06-viewer-results.png)

1. Haga clic en **Ejecutar**. Rellene **Parámetros de ejecución** si se le piden.
2. Lea las filas. Haga clic en un encabezado para ordenar. Escriba en **Filtrar…** para acotar.
3. Haga doble clic en una fila para **Ver detalle**.
4. Haga clic en **Cargar más** si no se muestran todas las filas.
5. Haga clic en **Ejecutar de nuevo** para obtener datos actualizados. Un resultado sigue siendo válido durante 24 horas.

| Opción | Línea |
|---|---|
| **Excel**, **CSV**, **PDF** | Exportar. Solo con **Puede exportar** o **Puede editar**, o en un mapa público. En caso contrario, "Forbidden" |
| **Sin autorización para ejecutar** | No tiene acceso a los datos. Pida ayuda a su administrador |
| **Cancelar** | Solo mientras la ejecución está en cola |

---

# Ejecuciones y Exportaciones

**Ejecuciones** muestra sus ejecuciones. **Exportaciones** muestra sus archivos.

![La página Ejecuciones con las ejecuciones propias del Viewer.](shots/es-ES/viewer/07-runs.png)

1. Abra **Ejecuciones** para ver el estado y **Expira en**.
2. Haga clic en **Abrir** para ver un resultado guardado, o en **Ejecutar de nuevo**.
3. Abra **Exportaciones** y haga clic en **Descargar** en un archivo terminado.

| Opción | Línea |
|---|---|
| **Eliminar** | Elimina una ejecución para siempre |
| Archivos | Se conservan 7 días |

---

# Programaciones

Las programaciones ejecutan un mapa por sí solas. Solo puede crear una para un mapa que sea suyo o que se comparta como **Puede exportar** o **Puede editar**. Los mapas públicos y los recursos compartidos **Puede ver** no se pueden programar.

![La página Programaciones con el mensaje Aún no hay programaciones.](shots/es-ES/viewer/09-schedules.png)

1. Haga clic en **Nueva programación**, o en el icono del calendario en **Mapas**.
2. Elija el **Mapa** y un **Nombre**.
3. Elija la **Frecuencia**, la **Zona horaria** y el **Formato de salida**.
4. Haga clic en **Guardar**.

| Opción | Línea |
|---|---|
| **Frecuencia** | **Diario**, **Semanal**, **Quincenal**, **Mensual**, cada 2, 3, 4 o 6 meses, **Anual** o **Personalizado (cron)** |
| **Formato de salida** | **Excel (.xlsx)** o **CSV** |

---

# Configuración

Abra **Configuración** desde la barra lateral.

![La página Configuración con las tarjetas Idioma, Tema y Paleta de colores.](shots/es-ES/common/04-settings.png)

1. Elija un **Idioma de visualización**.
2. Elija **Claro**, **Oscuro** o **Alto contraste**.
3. Elija una **Paleta** (no con **Alto contraste**).
4. Haga clic en **Guardar**. Sin ello, la elección solo se queda en este navegador.
