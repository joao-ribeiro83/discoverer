# Su rol de un vistazo

Discoverer Neo sustituye a Oracle Discoverer. Un **mapa** es un informe (en Oracle Discoverer era una hoja de trabajo). Un **libro** es un grupo de mapas. Un **área de negocio** es un grupo de datos relacionados. Usted tiene el rol **VIEWER**. Su tarea principal es abrir mapas, ejecutarlos y leer los resultados.

| Puede | No puede |
|---|---|
| Ver sus propios mapas, los mapas públicos y los mapas compartidos con usted | Ver mapas privados que nadie ha compartido con usted |
| Ejecutar un mapa y leer sus resultados, ordenar, filtrar y desglosar | Copiar un mapa o un libro |
| Exportar resultados, si el mapa es público o se ha compartido con usted como **Puede exportar** o **Puede editar** | Exportar un mapa compartido con usted solo como **Puede ver** |
| Ver sus propias ejecuciones y exportaciones | Ver las ejecuciones o exportaciones de otras personas |
| Elegir su idioma, tema y colores | Abrir las páginas de administración (no aparecen en su menú) |

El rol VIEWER tiene un límite fijo: no puede copiar mapas ni libros. Todo lo demás depende de lo que se le haya dado para cada mapa y cada área de negocio. Vea la sección siguiente.

## De dónde procede su acceso

El rol no decide lo que puede ejecutar, exportar o programar. Lo deciden estas tres cosas.

- **El mapa.** Ve un mapa si lo creó usted, si su propietario lo hizo **Público** o si alguien lo compartió con usted. Una concesión en un área de negocio **no** le muestra mapas.
- **El nivel de acceso compartido.** La mayoría de los mapas le llegan como un recurso compartido. El nivel le dice lo que puede hacer.
- **Sus concesiones de área de negocio.** Para leer los datos de un mapa, su administrador debe haberle dado acceso a las áreas de negocio que usa. Sin eso, la ejecución falla con "Sin autorización para ejecutar".

| Situación | Abrir y ejecutar | Exportar | Programar | Cambiar el mapa |
|---|---|---|---|---|
| Compartido con usted: **Puede ver** | Sí | No | No | No |
| Compartido con usted: **Puede exportar** | Sí | Sí | Sí | No |
| Compartido con usted: **Puede editar** | Sí | Sí | Sí | Sí |
| Mapa público que no es suyo | Sí | Sí | No | No |

Esta guía trata lo que más hace: buscar un mapa, ejecutarlo y leerlo. Exportar, programar y editar solo funcionan cuando el mapa se comparte con usted en el nivel necesario. Esas partes son breves, al final de cada capítulo.

Si falta un mapa que necesita, pida a su propietario que lo comparta con usted.

## Iniciar sesión, cambiar la contraseña y cerrar sesión

1. Abra la dirección que le dio su administrador.
2. Escriba su **Correo electrónico** y su **Contraseña**.
3. Deje marcada la casilla **Recordarme** para seguir con la sesión iniciada después de cerrar el navegador. Desmárquela en un ordenador compartido.
4. Haga clic en **Iniciar sesión**.

![La página de inicio de sesión con Correo electrónico, Contraseña, Recordarme y el botón Iniciar sesión.](shots/es-ES/common/01-login.png)

Si su cuenta se creó con una contraseña temporal, se abre primero la página **Cambiar la contraseña**. Rellene **Contraseña temporal**, **Nueva contraseña** (al menos 12 caracteres, distinta de la anterior) y **Confirmar nueva contraseña**, y haga clic en **Cambiar contraseña**.

Si olvida su contraseña, pida a su administrador que la restablezca. Para cerrar sesión, haga clic en su nombre en la esquina superior derecha y después en **Cerrar sesión**. Esto termina su sesión. Para volver a usar Discoverer Neo, inicie sesión de nuevo.

---

# Panel

El **Panel** es la primera página tras iniciar sesión. Es un resumen. Es de solo lectura.

![El panel de Viewer con su barra lateral corta y las tarjetas de resumen.](shots/es-ES/viewer/01-dashboard.png)

| Tarjeta | Qué muestra |
|---|---|
| **Total de mapas** | Los mapas que puede abrir, con cuántos son suyos y cuántos se comparten con usted (los mapas públicos también se cuentan ahí) |
| **Total de ejecuciones** | Ejecuciones de los mapas que puede ver, hechas por cualquier persona |
| **Mapas programados** y **Resultados programados** | Sus propias programaciones. Para usted suelen ser cero |
| **Mapas recientes** | Mapas que usted creó. Suele estar vacío para usted |

---

# Mapas

La página **Mapas** es su lista de informes. Úsela para buscar un mapa y abrirlo.

![La lista de Mapas, pestaña Todos, donde cada mapa solo tiene el icono Abrir.](shots/es-ES/viewer/03-maps-all.png)

| Control | Qué hace |
|---|---|
| **Míos**, **Compartidos conmigo**, **Todos** | Sus propios mapas, los mapas compartidos con usted, o todo lo que puede ver. Si no es propietario de ninguno, la página se abre en **Todos** |
| **Buscar mapas por nombre…** | Filtra por nombre mientras escribe |
| Filtro **Área de negocio** | Muestra un área de negocio. **Todas las áreas de negocio** quita el filtro |
| **Ordenar por** | **Actualizado recientemente** o **Nombre (A–Z)** |
| **Limpiar** | Quita la búsqueda y el filtro |
| Nombre del mapa o icono del ojo | Abre el mapa en el visor |

La tabla muestra **Nombre**, **Libro**, **Propietario**, **Área de negocio**, **Tipo**, **Actualizado** y **Acciones**.

No ve un icono Copiar ni existe el botón **Copiar libro**. Es a propósito para su rol.

Encima de la tabla, **Libros de trabajo** muestra los libros que contienen sus mapas. Escriba en **Buscar libros u hojas...**, haga clic en un libro para abrirlo y después haga clic en una hoja para abrir el visor.

![La lista de Mapas, pestaña Compartidos conmigo, con la tarjeta Libros de trabajo y solo el icono Abrir.](shots/es-ES/viewer/02-maps-shared.png)

> **Nota:** Algunos iconos de una fila (por ejemplo el lápiz, el calendario o la papelera) solo funcionan si el mapa es suyo o se ha compartido con usted en un nivel suficiente. Si hace clic en uno y el servidor lo rechaza, verá "Forbidden". No se cambia nada.

Ejemplo: para encontrar el mapa de demostración, escriba **GD_M.M10_V01.DIS** en el cuadro de búsqueda y haga clic en su nombre.

---

# El visor de mapas

El visor ejecuta un mapa y muestra sus filas. Aquí pasará la mayor parte del tiempo.

![Una ejecución completada con los botones Excel, CSV y PDF sobre la cuadrícula de resultados.](shots/es-ES/viewer/06-viewer-results.png)

| Botón o control | Qué hace |
|---|---|
| **Atrás** | Vuelve a la página anterior |
| **Ejecutar** | Ejecuta el mapa. Si el mapa pide valores, primero se abre un cuadro de diálogo |
| **Ejecutar de nuevo** | Vuelve a ejecutar con los mismos valores y omite el resultado guardado. Aparece cuando termina una ejecución |
| **Cancelar** | Detiene una ejecución que aún espera en la cola |

Bajo los botones, una línea de estado muestra **En cola**, **En ejecución…** o la hora del resultado y cuánto tiempo sigue siendo válido (24 horas). "Mostrando un resultado en caché" significa que ejecutó este mapa con los mismos valores hace poco. Haga clic en **Ejecutar de nuevo** para obtener datos actualizados.

## Parámetros de ejecución

Algunos mapas piden valores, como una fecha. En **Parámetros de ejecución**, rellene cada campo (un * rojo significa obligatorio) y haga clic en **Ejecutar**. **Cancelar** cierra el cuadro de diálogo.

![El cuadro Parámetros de ejecución con los dos valores obligatorios rellenados.](shots/es-ES/viewer/05-viewer-params-filled.png)

## Leer los resultados

| Elemento | Qué significa |
|---|---|
| **Resultados**, insignias de filas y ms | Cuántas filas se devolvieron y cuánto se tardó |
| **Hay más filas disponibles** | El resultado se cortó. Solo se devolvió una parte de las filas |
| Encabezado de columna (clic) | Ordena por esa columna: ascendente, descendente, ninguna |
| Cuadro **Filtrar…** bajo un encabezado | Filtra las filas que ha cargado |
| Insignia **Grupo**, **Total de …**, **Total general** | Las filas se agrupan y se subtotalizan. Ordenar o filtrar los pausa |
| Doble clic en una fila | **Ver detalle**: muestra las filas sin procesar que hay detrás de esa fila |
| **Cargar más** | Carga las 500 filas siguientes |
| Celdas de colores | Reglas que el propietario definió para resaltar valores |

Un mapa de tabla cruzada muestra una tabla dinámica.

## Cuando una ejecución no funciona

| Lo que ve | Qué significa |
|---|---|
| **Sin autorización para ejecutar** (rojo) | Puede ver el mapa, pero no tiene acceso a sus datos. Pida ayuda a su administrador |
| **Solicitud rechazada** u **Hoja no ejecutada** (ámbar) | El mapa está construido de una forma que no se puede ejecutar con seguridad. El cuadro explica por qué. Avise al propietario del mapa |
| **Se agotó el tiempo de espera de la consulta** | La consulta tardó demasiado. Inténtelo de nuevo más tarde o avise al propietario |
| **Mapa no encontrado** | El mapa se eliminó o ya no está compartido con usted |

## Exportar (solo si su acceso lo permite)

Los botones **Excel**, **CSV** y **PDF** aparecen bajo los resultados después de una ejecución. Funcionan con mapas públicos y con mapas compartidos con usted como **Puede exportar** o **Puede editar**.

| Botón | Qué hace |
|---|---|
| **Excel** | Descarga un archivo de Excel |
| **CSV** | Descarga un archivo CSV |
| **PDF** | Abre **Exportar a PDF**: elija **Tamaño del papel** (A4, A3, Carta), **Orientación** (Vertical, Horizontal) y las columnas, y después **Exportar** |

![El cuadro Exportar a PDF con las opciones de orientación, tamaño del papel, título y fuente.](shots/es-ES/user/17-builder-pdf-dialog.png)

> **Nota:** Si el mapa se ha compartido con usted solo como **Puede ver**, los botones siguen en pantalla, pero la exportación falla con "Forbidden". Pida al propietario **Puede exportar**.

---

# Ejecuciones

La página **Ejecuciones** muestra todas las ejecuciones de mapas que inició. Úsela para volver a encontrar un resultado sin ejecutar el mapa por segunda vez.

![La página Ejecuciones con las ejecuciones propias del Viewer.](shots/es-ES/viewer/07-runs.png)

| Control | Qué hace |
|---|---|
| Filtros **Mapa**, **Estado** y **Tipo** | Acotan la lista. El tipo es **En directo** (usted lo ejecutó) o **Programada** |
| Icono **Abrir** | Abre el resultado guardado |
| Icono **Ejecutar de nuevo** | Inicia una ejecución con los mismos valores |
| **XLSX**, **CSV**, **PDF** | Descarga un resultado, si su acceso permite exportar |
| Icono **Cancelar** | Cancela una ejecución que sigue en cola |
| Icono **Eliminar** | Elimina para siempre una ejecución terminada |

La tabla muestra **Mapa**, **Tipo**, **Parámetros**, **Estado**, **Filas**, **Duración**, **Ejecutado el**, **Expira en** y **Acciones**. Un resultado en directo dura 24 horas. Cuando **Expira en** dice **Expirado**, ejecute el mapa de nuevo. Solo ve sus propias ejecuciones.

---

# Exportaciones

La página **Exportaciones** muestra los archivos que ha pedido.

![La página Exportaciones con la lista de trabajos de exportación y un botón Descargar en los terminados.](shots/es-ES/user/44-exports.png)

La tabla muestra **Mapa**, **Formato**, **Estado** (**En cola**, **En curso**, **Completada**, **Fallida**), **Filas** y **Creado**. Haga clic en el icono **Descargar** de una fila completada. Los archivos se conservan 7 días. Si la descarga falla, vuelva a exportar desde el visor. Si nunca exporta, esta página queda vacía.

---

# Programaciones

La página **Programaciones** muestra los horarios que ejecutan un mapa por sí solos. Solo es suya si es propietario de un mapa o tiene **Puede exportar** o **Puede editar** en él. Con **Puede ver** o con un mapa público no puede programar. Esos mapas no aparecen en la lista **Mapa** de **Nueva programación**.

![La página Programaciones con el mensaje Aún no hay programaciones.](shots/es-ES/viewer/09-schedules.png)

Si tiene el nivel adecuado:

1. Haga clic en **Nueva programación**, o en el icono del calendario en **Mapas**.
2. Elija el **Mapa** y escriba un **Nombre**.
3. Elija la **Frecuencia** (**Diaria (medianoche)**, **Semanal (domingo, medianoche)**, **Mensual (día 1, medianoche)** o **Personalizada**), la **Zona horaria** y el **Formato de salida** (**Excel (.xlsx)** o **CSV**).
4. Haga clic en **Guardar**.

Use los iconos de cada fila para **Ejecutar ahora**, **Pausar** o **Habilitar**, ver el **Historial**, **Editar** o **Eliminar**. Los resultados se quedan en el servidor. No se envía nada por correo electrónico.

---

# Configuración

**Configuración** cambia el aspecto de la aplicación para usted. Ábrala desde la barra lateral o desde su nombre.

![La página Configuración con las tarjetas Idioma, Tema y Paleta de colores.](shots/es-ES/common/04-settings.png)

| Control | Qué hace |
|---|---|
| **Idioma de visualización** | **English**, **Português (Portugal)**, **Français (France)**, **Español (España)** |
| **Apariencia** | **Claro**, **Oscuro**, **Alto contraste** |
| **Paleta** | **Clásica**, **Azul marino**, **Bosque**, **Vino**, **Océano**, **Ocre**. No disponible con **Alto contraste** |
| **Guardar** | Conserva sus elecciones en su cuenta |

Sus elecciones se ven al instante. Haga clic en **Guardar** para conservarlas en todos los dispositivos.

---

# Preguntas frecuentes

**No veo un mapa que ve un compañero.** Solo ve sus propios mapas, los públicos y los compartidos. Pida al propietario que lo comparta. Los usuarios MANAGER y los administradores ven todos los mapas.

**¿Por qué no hay icono Copiar?** El rol VIEWER no puede copiar mapas ni libros. Pregunte al propietario o a su administrador.

**Me sale "Sin autorización para ejecutar".** No tiene acceso a los datos de ese mapa. Pida ayuda a su administrador.

**Excel, CSV o PDF dice "Forbidden".** El mapa se ha compartido con usted solo como **Puede ver**. Pida al propietario **Puede exportar**.

**El icono Editar o Programar no hace nada.** Necesitan **Puede editar** o **Puede exportar** en el mapa, o ser el propietario.

**Mi resultado dice Expirado.** Los resultados en directo duran 24 horas. Haga clic en **Ejecutar de nuevo**.

**No encuentro una exportación antigua.** Los archivos se eliminan a los 7 días.

**Olvidé mi contraseña.** Pida a su administrador que la restablezca.

---

# Glosario

| Término | Significado |
|---|---|
| Mapa | Un informe. En Oracle Discoverer era una hoja de trabajo |
| Libro | Un grupo de mapas |
| Área de negocio | Un grupo de datos relacionados |
| Ejecución | Una vez que se ejecuta un mapa y produce un resultado |
| Exportación | Un archivo (Excel, CSV o PDF) creado a partir de un resultado |
| Programación | Un horario que ejecuta un mapa por sí solo |
| Recurso compartido | Acceso a un mapa concedido por su propietario: **Puede ver**, **Puede exportar** o **Puede editar** |
| Mapa público | Un mapa que todos los usuarios pueden abrir, ejecutar y exportar |
| Parámetro | Un valor que el mapa pide cuando lo ejecuta |
