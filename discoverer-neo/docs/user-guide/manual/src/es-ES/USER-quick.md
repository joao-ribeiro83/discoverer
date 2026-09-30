# Su rol en una página

Usted tiene el rol **USER**. Un **mapa** es un informe. Un **área de negocio** es un grupo de datos relacionados.

| Puede | No puede |
|---|---|
| Ver sus mapas, los públicos y los compartidos | Ver los mapas privados de otras personas |
| Ejecutar mapas, y exportarlos o programarlos cuando el nivel de acceso lo permite | Exportar un mapa compartido como **Puede ver** |
| Copiar un mapa y editar su copia | Cambiar mapas que no son suyos, salvo que se compartan como **Puede editar** |
| Crear mapas donde tiene el derecho de creación | Crear mapas en otras áreas de negocio |
| Compartir y eliminar sus propios mapas | Compartir o eliminar los mapas de otras personas |
| Cambiar su idioma y su tema | Abrir las páginas de administración |

Niveles de acceso compartido: **Puede ver** = solo ejecutar. **Puede exportar** = ejecutar, exportar y programar. **Puede editar** = todo lo anterior y además cambiar el mapa.

Inicie sesión con su **Correo electrónico** y su **Contraseña** y después haga clic en **Iniciar sesión**. Una contraseña temporal debe cambiarse primero (al menos 12 caracteres). Para salir, haga clic en su nombre y después en **Cerrar sesión**.

![La página de inicio de sesión con Correo electrónico, Contraseña, Recordarme y el botón Iniciar sesión.](shots/es-ES/common/01-login.png)

---

# Panel

Es la primera página tras iniciar sesión. Es de solo lectura.

![El panel con las tarjetas de resumen y la lista Mapas recientes.](shots/es-ES/user/45-dashboard.png)

1. Lea **Total de mapas** y **Total de ejecuciones** para ver un resumen.
2. Lea **Mapas programados** y **Resultados programados** para ver sus programaciones. Haga clic en **Ver programaciones** para abrirlas.
3. Haga clic en un mapa de **Mapas recientes** (sus últimos 5) para abrirlo en el generador.

---

# Mapas

La lista de sus informes. Pestañas: **Míos**, **Compartidos conmigo**, **Todos**.

![La lista de Mapas, pestaña Míos, con los iconos de acción en la fila del mapa.](shots/es-ES/user/03-maps-mine.png)

1. Busque por nombre o elija un **Área de negocio**.
2. Haga clic en el icono del ojo para abrir el visor.
3. Haga clic en el icono Copiar para hacer su propia copia.
4. Haga clic en el icono Compartir (sus propios mapas) para dar acceso.
5. Haga clic en **Crear Mapa** para crear uno nuevo.

| Icono | Uso |
|---|---|
| Ojo | Abrir y ejecutar |
| Lápiz | Editar (propio o **Puede editar**) |
| Copiar | Su propia copia |
| Compartir | Establecer **Puede ver**, **Puede exportar**, **Puede editar**, o **✕** para quitar |
| Calendario | Programar (propio, **Puede exportar**, **Puede editar**) |
| Papelera | Eliminar (solo los propios; solo un administrador puede restaurar) |

---

# Ejecutar y exportar

El visor ejecuta un mapa y muestra las filas.

![El visor de mapas tras una ejecución completada, con la cuadrícula de resultados y los botones de exportación.](shots/es-ES/user/25-viewer-results.png)

1. Abra el mapa con el icono del ojo.
2. Haga clic en **Ejecutar**. Rellene **Parámetros de ejecución** si se le piden.
3. Lea los resultados. Haga clic en un encabezado para ordenar y haga doble clic en una fila para **Ver detalle**.
4. Haga clic en **Excel**, **CSV** o **PDF** para exportar.
5. Haga clic en **Ejecutar de nuevo** para obtener datos actualizados. Un resultado sigue siendo válido durante 24 horas.

| Opción | Línea |
|---|---|
| Cuadro de diálogo **PDF** | Elija **Tamaño del papel** (A4, A3, Carta), **Orientación** y columnas |
| **Sin autorización para ejecutar** | No tiene acceso a los datos. Pida ayuda a su administrador |
| **Forbidden** al exportar | El mapa es solo **Puede ver**. Pida **Puede exportar** |

---

# Crear y editar un mapa

Cree un mapa con elementos de una sola área de negocio. Solo donde tenga el derecho de creación.

![El generador de mapas con el árbol Áreas de negocio, el lienzo de columnas y el panel Propiedades.](shots/es-ES/user/05-builder-overview.png)

1. Haga clic en **Crear Mapa**.
2. Arrastre elementos desde el árbol **Áreas de negocio** a **Columnas**. El primer elemento establece el área de negocio.
3. Establezca los filtros en **Condiciones**, la ordenación en **Ordenación** y las solicitudes en **Parámetros**.
4. Escriba un nombre y haga clic en **Guardar**. Nada se guarda solo.
5. Haga clic en **Ejecutar** para probar.

| Pestaña | Uso |
|---|---|
| **Propiedades** | Descripción y casilla **Público** (visible para todos los usuarios) |
| **Condiciones** | Filtros, fijos o **Solicitar en tiempo de ejecución** |
| **Ordenación** | Niveles de ordenación |
| **Parámetros** | Valores que se piden al ejecutar |
| **Campos calculados** | Columna nueva a partir de una fórmula |

**Formato** colorea las celdas que cumplen una regla. Necesita un mapa guardado.

---

# Ejecuciones y Exportaciones

**Ejecuciones** muestra sus ejecuciones. **Exportaciones** muestra sus archivos.

![La página Ejecuciones con los filtros y la tabla de ejecuciones con sus botones de exportación.](shots/es-ES/user/41-runs.png)

1. Abra **Ejecuciones** para ver el estado, las filas y **Expira en**.
2. Haga clic en **Abrir** para ver un resultado guardado, o en **Ejecutar de nuevo**.
3. Haga clic en **XLSX**, **CSV** o **PDF** para descargar un resultado.
4. Abra **Exportaciones** y haga clic en **Descargar** en un archivo terminado.

| Opción | Línea |
|---|---|
| **Cancelar** | Solo para una ejecución en cola |
| **Eliminar** | Elimina la ejecución para siempre |
| Archivos | Se conservan 7 días |

![La página Exportaciones con la lista de trabajos de exportación y un botón Descargar en los terminados.](shots/es-ES/user/44-exports.png)

---

# Programaciones

Ejecuta un mapa por sí sola y guarda el resultado en el servidor. No se envía nada por correo electrónico.

![El cuadro Nueva programación con mapa, nombre, frecuencia, zona horaria y formato de salida.](shots/es-ES/user/32-schedule-new-dialog.png)

1. Haga clic en **Nueva programación**, o en el icono del calendario en **Mapas**.
2. Elija el **Mapa** (propio, o compartido como **Puede exportar** o **Puede editar**).
3. Escriba un **Nombre**.
4. Elija la **Frecuencia**, la **Zona horaria** y el **Formato de salida**.
5. Rellene **Valores predefinidos de parámetros** y después haga clic en **Guardar**.
6. Use **Ejecutar ahora**, **Pausar** e **Historial** para gestionarla.

| Opción | Línea |
|---|---|
| **Frecuencia** | **Diaria (medianoche)**, **Semanal (domingo, medianoche)**, **Mensual (día 1, medianoche)**, **Personalizada** (cron, p. ej. `0 9 * * 1-5`) |
| **Formato de salida** | **Excel (.xlsx)** o **CSV** |
| Mapa público | No se puede programar |

---

# Configuración

Abra **Configuración** desde la barra lateral.

![La página Configuración con las tarjetas Idioma, Tema y Paleta de colores.](shots/es-ES/common/04-settings.png)

1. Elija un **Idioma de visualización**.
2. Elija **Claro**, **Oscuro** o **Alto contraste**.
3. Elija una **Paleta** (no con **Alto contraste**).
4. Haga clic en **Guardar**. Sin ello, la elección solo se queda en este navegador.
