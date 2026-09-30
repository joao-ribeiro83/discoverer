# Su rol de un vistazo

Discoverer Neo sustituye a Oracle Discoverer. Un **mapa** es un informe (en Oracle Discoverer era una hoja de trabajo). Un **libro** es un grupo de mapas. Un **área de negocio** es un grupo de datos relacionados. Usted tiene el rol **USER**. Le permite abrir y ejecutar mapas, exportarlos y programarlos, y crear mapas propios.

| Puede | No puede |
|---|---|
| Ver sus propios mapas, los mapas públicos y los mapas compartidos con usted | Ver mapas privados que nadie ha compartido con usted |
| Ejecutar un mapa y ver sus resultados | Ejecutar un mapa sobre datos a los que no tiene acceso |
| Exportar resultados a Excel, CSV o PDF, si el nivel de acceso del mapa lo permite | Exportar un mapa que se ha compartido con usted solo como **Puede ver** |
| Programar un mapa, si es suyo o se ha compartido con usted como **Puede exportar** o **Puede editar** | Programar un mapa público que no es suyo |
| Copiar cualquier mapa que pueda ver y cambiar su copia | Cambiar un mapa que no es suyo, salvo que se haya compartido con usted como **Puede editar** |
| Crear un mapa nuevo, pero solo en un área de negocio donde su administrador le ha dado el derecho de creación | Crear mapas en otras áreas de negocio |
| Compartir y eliminar los mapas que son suyos | Compartir o eliminar mapas que pertenecen a otra persona |
| Ver sus propias ejecuciones, exportaciones y programaciones | Ver las ejecuciones, exportaciones o programaciones de otras personas |
| Elegir su idioma, tema y colores | Abrir las páginas de administración (no aparecen en su menú) |

## De dónde procede su acceso

Tres cosas deciden lo que puede hacer. Su rol es solo la primera.

- **El mapa.** Ve un mapa si lo creó usted, si su propietario lo hizo **Público** o si alguien lo compartió con usted. Una concesión en un área de negocio **no** le muestra mapas.
- **El nivel de acceso compartido.** En un mapa que no es suyo, el nivel compartido le dice lo que puede hacer. Vea la tabla siguiente.
- **Sus concesiones de área de negocio.** Su administrador le da derechos sobre áreas de negocio. Para leer los datos de un mapa, necesita acceso a los datos que usa. Para crear un mapa nuevo, necesita el derecho de **creación** en esa área de negocio. Sin él, las ejecuciones del mapa fallan con "Sin autorización para ejecutar", o falla el guardado de un mapa nuevo.

| Situación | Abrir y ejecutar | Exportar | Programar | Cambiar el mapa |
|---|---|---|---|---|
| El mapa es suyo | Sí | Sí | Sí | Sí |
| Compartido con usted: **Puede ver** | Sí | No | No | No |
| Compartido con usted: **Puede exportar** | Sí | Sí | Sí | No |
| Compartido con usted: **Puede editar** | Sí | Sí | Sí | Sí |
| Mapa público que no es suyo | Sí | Sí | No | No |

> **Nota:** Solo el propietario puede compartir o eliminar un mapa. Quien tiene **Puede editar** no puede volver a compartirlo.

Si falta un mapa que necesita, pida a su propietario que lo comparta con usted.

## Iniciar sesión, cambiar la contraseña y cerrar sesión

1. Abra la dirección que le dio su administrador.
2. Escriba su **Correo electrónico** y su **Contraseña**.
3. Deje marcada la casilla **Recordarme** si quiere seguir con la sesión iniciada después de cerrar el navegador. Desmárquela en un ordenador compartido.
4. Haga clic en **Iniciar sesión**.

![La página de inicio de sesión con Correo electrónico, Contraseña, Recordarme y el botón Iniciar sesión.](shots/es-ES/common/01-login.png)

Si su cuenta se creó con una contraseña temporal, se abre primero la página **Cambiar la contraseña**. No podrá usar el resto de la aplicación hasta que la cambie.

| Campo | Qué escribir |
|---|---|
| **Contraseña temporal** (o **Contraseña actual**) | La contraseña que usa ahora |
| **Nueva contraseña** | Al menos 12 caracteres. Debe ser distinta de la actual |
| **Confirmar nueva contraseña** | La misma contraseña nueva otra vez |

Haga clic en **Cambiar contraseña**. Se abre el panel.

Si olvida su contraseña, pida a su administrador que la restablezca. No hay restablecimiento por cuenta propia.

Para cerrar sesión, haga clic en su nombre en la esquina superior derecha y después en **Cerrar sesión**. Esto termina su sesión. Para volver a usar Discoverer Neo, inicie sesión de nuevo.

> **Nota:** Tras 5 contraseñas incorrectas seguidas, su cuenta se bloquea durante 15 minutos. Espere e inténtelo de nuevo.

---

# Panel

El **Panel** es la primera página tras iniciar sesión. Le da un resumen rápido. Es de solo lectura. Lo usa para ver cuánto tiene y para saltar a sus últimos mapas.

![El panel con las tarjetas de resumen y la lista Mapas recientes.](shots/es-ES/user/45-dashboard.png)

| Tarjeta | Qué muestra |
|---|---|
| **Total de mapas** | Los mapas que puede abrir. La línea de debajo dice cuántos son suyos y cuántos se comparten con usted (los mapas públicos también se cuentan ahí) |
| **Total de ejecuciones** | Ejecuciones de los mapas que puede ver, hechas por cualquier persona |
| **Mapas programados** | Mapas para los que tiene al menos una programación activa |
| **Resultados programados** | Resultados guardados por sus programaciones |
| **Mapas recientes** | Sus últimos 5 mapas creados, del más nuevo al más antiguo. Haga clic en uno para abrirlo en el generador de mapas |
| **Ver programaciones** (enlace en dos tarjetas) | Abre la página **Programaciones** |

Si no ha creado ningún mapa, **Mapas recientes** indica que ninguno es suyo.

---

# Mapas

La página **Mapas** es su lista de informes. La usa para buscar un mapa, ejecutarlo, copiarlo, compartirlo o eliminarlo.

![La lista de Mapas, pestaña Míos, con los iconos de acción en la fila del mapa.](shots/es-ES/user/03-maps-mine.png)

## Pestañas, búsqueda y filtros

| Control | Qué hace |
|---|---|
| **Míos** | Mapas que usted creó |
| **Compartidos conmigo** | Mapas que otras personas han compartido con usted, en cualquier nivel |
| **Todos** | Todo lo que puede ver: sus propios mapas, los públicos y los compartidos |
| **Buscar mapas por nombre…** | Filtra la lista por nombre mientras escribe |
| Filtro **Área de negocio** | Muestra solo los mapas de un área de negocio. **Todas las áreas de negocio** quita el filtro |
| **Ordenar por** | **Actualizado recientemente** o **Nombre (A–Z)** |
| **Limpiar** | Restablece la búsqueda y el área de negocio. Solo aparece cuando hay un filtro activo |
| **Crear Mapa** | Abre el generador de mapas para un mapa nuevo |

La tabla muestra **Nombre**, **Libro**, **Propietario**, **Área de negocio**, **Tipo**, **Actualizado** y **Acciones**. Si no es propietario de ningún mapa, la página se abre en **Todos**.

## Acciones de fila

Cada fila tiene iconos. Pase el cursor sobre un icono para leer su indicación.

| Icono | Qué hace |
|---|---|
| Nombre del mapa | Abre el mapa en el generador si puede cambiarlo; si no, en el visor |
| Ojo | Abre el visor, donde ejecuta el mapa y ve las filas |
| Lápiz | Abre el generador de mapas. Solo para sus propios mapas y los mapas compartidos con usted como **Puede editar** |
| Copiar | Crea su propia copia privada y la abre. Usted pasa a ser su propietario |
| Compartir | Abre el cuadro **Compartir mapa**. Solo para mapas que son suyos |
| Calendario | Abre **Programaciones** con este mapa elegido. Solo para mapas que son suyos o que se comparten como **Puede exportar** o **Puede editar** |
| Descargar | Abre el visor, donde exporta |
| Papelera | Elimina el mapa. Solo para sus propios mapas |

> **Nota:** Los iconos de calendario y de descarga de los mapas compartidos aparecen en la pestaña **Compartidos conmigo**. En la pestaña **Todos**, abra el mapa en el visor.

> **Advertencia:** Solo un administrador puede recuperar un mapa eliminado. **¿Eliminar mapa?** le pide que lo confirme con **Eliminar**.

## Libros de trabajo

Encima de la tabla aparece una sección **Libros de trabajo** cuando algunos de sus mapas pertenecen a un libro.

| Control | Qué hace |
|---|---|
| **Buscar libros u hojas...** | Filtra por nombre de libro o de hoja |
| Fila de libro | Haga clic para abrir la lista de sus hojas. Haga clic en una hoja para abrir el visor |
| Lápiz en una hoja | Editar. Solo para hojas que usted creó |
| Copiar | **Copiar libro**: crea un libro nuevo con una copia privada de cada hoja |
| Papelera | **Eliminar libro**: elimina el libro y todas sus hojas. Solo si es propietario de todas las hojas |

El botón **Compartir libro** no es para su rol. Comparta cada mapa que sea suyo con su propio icono **Compartir**.

![El cuadro Copiar libro con el campo de nombre del libro nuevo.](shots/es-ES/user/02-workbook-copy-dialog.png)

Ejemplo: para copiar el mapa de demostración, busque **GD_M.M10_V01.DIS**, haga clic en el icono Copiar y confirme. Su copia se abre en el generador y puede cambiarla libremente. El original queda como estaba.

## Copiar un mapa

1. Busque el mapa en la lista.
2. Haga clic en el icono Copiar.
3. La copia se abre en el generador con el mensaje "Mapa copiado. Ahora está editando su copia."
4. Cambie lo que necesite y haga clic en **Guardar**.

Ejecutar la copia sigue necesitando acceso a los datos. Copiar no se lo da.

## Compartir un mapa que es suyo

1. Haga clic en el icono Compartir de su mapa.
2. Busque a una persona por nombre o correo electrónico.
3. Haga clic en un nivel junto a su nombre. El botón oscuro es el nivel que tiene ahora.
4. Para quitar el acceso, haga clic en la **✕** junto a su nombre.

![El cuadro Compartir mapa con una persona coincidente y los botones Puede ver, Puede exportar y Puede editar.](shots/es-ES/user/29-share-dialog-search.png)

| Opción | Qué significa / cuándo elegirla |
|---|---|
| **Puede ver** | La persona puede abrir y ejecutar el mapa. No puede exportarlo, programarlo ni cambiarlo |
| **Puede exportar** | Lo anterior, y además puede exportar el resultado y poner el mapa en una programación |
| **Puede editar** | Todo lo anterior, y además puede cambiar el mapa. Sigue sin poder compartirlo ni eliminarlo |
| **✕** | Quita su acceso |

Si el mapa es público, el cuadro dice "Este mapa es público: cualquier persona con el enlace puede verlo." y muestra **Copiar enlace**. Úselo para enviar la dirección a un compañero.

---

# El visor de mapas

El visor se abre al hacer clic en el nombre de un mapa (si no puede editarlo) o en el icono del ojo. Lo usa para ejecutar un mapa y leer sus resultados.

![El visor de mapas tras una ejecución completada, con la cuadrícula de resultados y los botones de exportación.](shots/es-ES/user/25-viewer-results.png)

| Botón o control | Qué hace |
|---|---|
| **Atrás** | Vuelve a la página de la que venía |
| **Ejecutar** | Ejecuta el mapa. Si el mapa pide valores (parámetros), primero se abre un cuadro de diálogo |
| **Ejecutar de nuevo** | Vuelve a ejecutar el mapa con los mismos valores y omite el resultado guardado. Aparece cuando termina una ejecución |
| **Cancelar** | Detiene una ejecución que aún espera en la cola. No se ofrece cuando la ejecución ya ha empezado |
| **Administración de programaciones** | Abre la página **Programaciones** |

Mientras hay una ejecución en marcha, una línea bajo los botones muestra **En cola** o **En ejecución…**. Cuando termina, muestra la hora y cuánto tiempo sigue siendo válido el resultado (24 horas). Si ejecutó el mismo mapa con los mismos valores hace poco, puede ver "Mostrando un resultado en caché". Use **Ejecutar de nuevo** para obtener datos actualizados.

Si un mapa no tiene columnas, el visor le dice que no hay nada que ejecutar.

## Parámetros de ejecución

Algunos mapas le piden valores, como una fecha o una región. El cuadro **Parámetros de ejecución** muestra un campo por parámetro. Un * rojo significa que el valor es obligatorio. Para algunos valores, el cuadro sugiere los valores reales de los datos. Haga clic en **Ejecutar** para empezar o en **Cancelar** para cerrar.

![El cuadro Parámetros de ejecución con los dos valores obligatorios rellenados.](shots/es-ES/user/24-viewer-params-filled.png)

## Leer los resultados

| Elemento | Qué significa |
|---|---|
| Encabezado **Resultados** con insignias de filas y ms | Cuántas filas se devolvieron y cuánto se tardó |
| **Hay más filas disponibles** | El resultado se cortó. Solo se devolvió una parte de las filas |
| Encabezado de columna (clic) | Ordena por esa columna: ascendente, descendente, ninguna |
| Cuadro **Filtrar…** bajo un encabezado | Filtra las filas que ha cargado |
| Insignia **Grupo**, **Total de …**, **Total general** | El mapa agrupa filas y muestra subtotales. Ordenar o filtrar los pausa |
| Doble clic en una fila | **Ver detalle**: muestra las filas sin procesar que hay detrás de esa fila |
| **Cargar más** | Carga las 500 filas siguientes |
| Celdas de colores | Reglas definidas por el propietario del mapa (formato condicional) |

Un mapa de tabla cruzada muestra una tabla dinámica cuando una columna se coloca **En la parte superior**.

## Exportar los resultados

Bajo los resultados, use estos botones. Aparecen cuando ha terminado una ejecución.

| Botón | Qué hace |
|---|---|
| **Excel** | Descarga un archivo de Excel |
| **CSV** | Descarga un archivo CSV |
| **PDF** | Abre **Exportar a PDF**, donde elige el papel y las columnas |

![El cuadro Exportar a PDF con las opciones de orientación, tamaño del papel, título y fuente.](shots/es-ES/user/17-builder-pdf-dialog.png)

| Opción en **Exportar a PDF** | Qué significa / cuándo elegirla |
|---|---|
| **Tamaño del papel**: A4, A3, Carta | A4 es el valor predeterminado. Elija A3 para tablas anchas y Carta para papel de EE. UU. |
| **Orientación**: Vertical, Horizontal | Horizontal admite más columnas |
| **Columnas** | Marque las columnas que se imprimirán. **Seleccionar todas** y **Limpiar** las cambian todas a la vez |

Haga clic en **Exportar**. El archivo se crea en segundo plano. Encuéntrelo más tarde en la página **Exportaciones**.

> **Nota:** Los botones de exportación se muestran en todos los mapas. Si su acceso al mapa es solo **Puede ver**, la exportación falla con "Forbidden". Pida al propietario **Puede exportar**.

Ejemplo: abra **GD_M.M10_V01.DIS**, haga clic en **Ejecutar** y después en **Excel**.

---

# Crear y editar mapas

Solo puede crear un mapa nuevo en un área de negocio donde su administrador le haya dado el derecho de **creación**. Puede cambiar un mapa existente si es suyo o se ha compartido con usted como **Puede editar**. El generador se abre desde **Crear Mapa**, desde el icono del lápiz o desde **Mapas recientes**.

![El generador de mapas con el árbol Áreas de negocio, el lienzo de columnas y el panel Propiedades.](shots/es-ES/user/05-builder-overview.png)

El generador tiene una barra de herramientas arriba, un árbol **Áreas de negocio** a la izquierda, el área **Columnas** en el centro y un panel de configuración con cinco pestañas a la derecha. Puede arrastrar los bordes para cambiar el tamaño de los paneles.

> **Advertencia:** El generador nunca guarda solo. Haga clic en **Guardar**. Si sale de la página, los cambios sin guardar se pierden.

## Barra de herramientas

| Botón o control | Qué hace |
|---|---|
| **Atrás** | Vuelve a la página anterior |
| Cuadro del nombre del mapa | El nombre del mapa |
| Lista de tipo de mapa | **Tabla**, **Tabla cruzada**, **Página-Detalle** o **Gráfico**. Solo **Tabla cruzada** cambia el aspecto de los resultados. Los otros tres muestran una tabla simple |
| **● Sin guardar** | Indica que tiene cambios sin guardar |
| **Ejecutar** | Guarda el mapa si es nuevo o ha cambiado, y después lo ejecuta |
| **Guardar** | Guarda el mapa. Necesita al menos una columna |
| **Exportar** | Menú con **Definición del mapa (.xml)**, que descarga el diseño del mapa, no los datos. La exportación de datos está bajo los resultados |
| **Programar** | Abre **Programaciones** con este mapa elegido. Necesita un mapa guardado |
| **Formato** | Abre **Formato condicional**. Necesita un mapa guardado |
| **Compartir** | Abre **Compartir mapa**. Necesita un mapa guardado. Solo el propietario puede cambiar los recursos compartidos |
| **Contraer panel** / **Expandir panel** | Oculta o muestra el panel derecho |

## Agregar columnas

1. En el árbol **Áreas de negocio** de la izquierda, abra un área de negocio y después una carpeta. Una carpeta contiene elementos (una carpeta es como una tabla).
2. Arrastre un elemento al área **Columnas**, o haga clic en el **+** que hay junto a él. Un icono de sigma marca una medida (un número que se suma). Un icono de etiqueta marca una dimensión (un rótulo).
3. Todas las columnas de un mapa deben proceder de la misma área de negocio. La primera columna que agregue la establece. No puede elegir el área usted mismo.
4. Use el cuadro **Filtrar elementos…** para encontrar un elemento por nombre.
5. Arrastre el asa de una columna para reordenarla. Haga clic en **X** para quitarla. Haga clic en la ficha de la columna para configurarla.

Si ve "No hay áreas de negocio.", todavía no tiene acceso a ninguna área de negocio. Pida ayuda a su administrador.

> **Nota:** El árbol muestra todas las áreas de negocio sobre las que tiene algún derecho. Puede crear un mapa con solo derechos de visualización, pero **Guardar** en un mapa nuevo falla sin el derecho de creación.

## Configurar una columna

Haga clic en la ficha de una columna. Los cambios se aplican al borrador. Haga clic en **Guardar** en el cuadro y después en **Guardar** en el mapa.

| Campo | Qué hace |
|---|---|
| **Nombre para mostrar** | Encabezado de la columna. Vacío significa el nombre del elemento |
| **Agregación** | **NONE**, **SUM**, **COUNT**, **AVG**, **MIN** o **MAX** |
| **Dirección de ordenación** | **Ninguno**, **Ascendente**, **Descendente** |
| **Máscara de formato** y **Predefinidos** | Un formato de número o de fecha. Predefinidos: **Número (1.234)**, **Decimal (1.234,00)**, **Moneda (1.234,00 €)**, **Porcentaje (12,3 %)**, **Fecha (DD-MON-YYYY)**, **Fecha (YYYY-MM-DD)** |
| **Orden de clasificación** | Posición de esta columna cuando ordena por varias |
| **Ancho de columna (px)** | Ancho de la columna |
| **Colocación** | **Ninguno**, **Agrupar por (eje)**, **Medida** o **Elemento de página** |
| **Borde de la tabla cruzada** | **En el lateral** o **En la parte superior**. Solo para tablas cruzadas |
| **Agrupar y cortar** | Oculta los valores repetidos y agrega un subtotal cada vez que cambia el valor |
| **Solo consulta, no mostrar** | La columna se usa para filtros y totales pero no se muestra |

![El cuadro Configurar columna con la lista Agregación abierta.](shots/es-ES/user/08-builder-column-aggregation.png)

## Pestañas del panel derecho

| Pestaña | Para qué sirve |
|---|---|
| **Propiedades** | **Descripción** (se imprime encima de los resultados y las exportaciones), **Insertar variable** (**Fecha de ejecución**, **Hora de ejecución**, **Nombre del libro**, **Nombre de la hoja**, o un parámetro) y la casilla **Público** |
| **Condiciones** | Filtros. **Agregar condición**, elija el elemento, el operador (`=`, `<>`, `<`, `>`, `<=`, `>=`, `LIKE`, `IN`, `BETWEEN`, `IS NULL`) y el valor. Elija **Valor estático** o **Solicitar en tiempo de ejecución**. Seleccione dos o más filas y haga clic en **Agrupar** para unirlas con OR. Use **Desagrupar** para deshacerlo |
| **Ordenación** | **Agregar ordenación**: elija una columna y una dirección. Arrastre para cambiar el orden |
| **Parámetros** | Valores que se piden a las personas al ejecutar. Cada uno tiene un nombre, un tipo (**STRING**, **NUMBER**, **DATE**, **LIST**), un valor predeterminado y una casilla **Obligatorio**. Si todos los parámetros tienen valor predeterminado, se omite la solicitud |
| **Campos calculados** | Una columna nueva a partir de una fórmula. Haga clic en **Agregar campo calculado**, póngale nombre y después haga clic en la fórmula para abrir el **Editor de fórmulas** |

![La pestaña Condiciones con las condiciones del mapa y los controles de operador y valor o solicitud.](shots/es-ES/user/09-builder-conditions.png)

> **Advertencia:** La casilla **Público** hace que el mapa sea visible y exportable para todos los usuarios de la aplicación, no solo para un área de negocio. Las reglas de acceso a datos siguen aplicándose a los datos. Úsela con cuidado.

El **Editor de fórmulas** tiene botones de funciones (por ejemplo **ROUND**, **UPPER**, **TO_CHAR**, **NVL**, **CASE**) y sus columnas. **Probar fórmula** la ejecuta sobre las 5 primeras filas. Necesita un mapa guardado.

## Formato condicional

Haga clic en **Formato** para colorear celdas o filas que cumplen una regla. Las reglas se guardan al instante. No forman parte del **Guardar** del mapa. Solo puede agregar o eliminar reglas en mapas que son suyos o que puede editar.

| Campo | Qué significa |
|---|---|
| **Columna** | La columna que se comprueba |
| **Aplicar a** | **Celda** o **Fila** |
| **Operador** | **Igual a**, **Distinto de**, **Mayor que**, **Menor que**, **Mayor o igual que**, **Menor o igual que**, **Contiene (comodines % y _)**, **En la lista**, **Entre**, **Está vacío** |
| **Valor** | Con qué comparar. Use `low,high` para **Entre** |
| **Color de fondo**, **Color de texto** | Colores. **Borrar** quita uno |
| **Negrita**, **Cursiva**, **Subrayado** | Estilo del texto |

![El cuadro Formato con la lista de reglas y los controles Añadir regla.](shots/es-ES/user/19-builder-formatting-dialog.png)

## Ejecutar desde el generador y ejecuciones rechazadas

**Ejecutar** abre un panel **Resultados** en la parte inferior. Funciona como el visor. Si solo tiene derechos de visualización sobre un mapa, no lo edite primero: el guardado automático se rechazaría.

A veces el planificador rechaza un mapa. Un cuadro ámbar explica por qué y qué cambiar. Las causas típicas son carpetas que no están conectadas, o totales de dos conjuntos de filas de detalle. Quite la columna que lo causa o pida a su administrador que defina la combinación que falta. Un banner rojo **Sin autorización para ejecutar** significa que no tiene acceso a los datos de una de las carpetas.

## Ejemplo: crear un mapa pequeño

1. Haga clic en **Crear Mapa** en la página **Mapas**.
2. Abra un área de negocio y arrastre dos elementos a **Columnas**.
3. Escriba un nombre en el cuadro del nombre del mapa.
4. Haga clic en **Guardar**. El mapa ya tiene su propia dirección.
5. Haga clic en **Ejecutar**.
6. Haga clic en **Compartir** si un compañero debe verlo.

---

# Ejecuciones

La página **Ejecuciones** muestra todas las ejecuciones de mapas que inició, en espera, en curso o terminadas. La usa para volver a encontrar un resultado o para ejecutarlo de nuevo.

![La página Ejecuciones con los filtros y la tabla de ejecuciones con sus botones de exportación.](shots/es-ES/user/41-runs.png)

| Control | Qué hace |
|---|---|
| Filtro **Mapa** | Muestra un mapa. **Todos los mapas** los muestra todos |
| Filtro **Estado** | **Todos los estados**, **En cola**, **En curso**, **Completada**, **Fallida**, **Cancelada** |
| Filtro **Tipo** | **Todos los tipos**, **En directo** (usted lo ejecutó) o **Programada** |
| Nombre del mapa | Abre el visor |
| Icono **Abrir** | Abre el resultado guardado |
| Icono **Ejecutar de nuevo** | Inicia una ejecución con los mismos valores. Dice **Resultado reutilizado** si ya existe un resultado válido |
| **XLSX**, **CSV**, **PDF** | Descarga el resultado de la ejecución. Solo para resultados terminados y válidos, y solo si su acceso permite exportar |
| Icono **Cancelar** | Cancela una ejecución en cola. No se ofrece para una ejecución en curso |
| Icono **Eliminar** | Elimina una ejecución terminada, fallida o cancelada y sus filas. No se puede deshacer |

La tabla muestra **Mapa**, **Tipo**, **Parámetros**, **Estado**, **Filas**, **Duración**, **Ejecutado el**, **Expira en** y **Acciones**. **Expira en** le dice cuánto tiempo se conserva el resultado guardado: 24 horas para una ejecución en directo, más para las ejecuciones programadas. Cuando dice **Expirado**, ejecute el mapa de nuevo.

Solo ve sus propias ejecuciones. La página se actualiza sola mientras hay una ejecución en marcha.

---

# Exportaciones

La página **Exportaciones** muestra los archivos que ha pedido. La usa para volver a descargar un archivo.

![La página Exportaciones con la lista de trabajos de exportación y un botón Descargar en los terminados.](shots/es-ES/user/44-exports.png)

| Control | Qué hace |
|---|---|
| Tabla | **Mapa**, **Formato** (XLSX, CSV, PDF), **Estado** (**En cola**, **En curso**, **Completada**, **Fallida**), **Filas**, **Creado**. Pase el cursor sobre **Fallida** para leer el motivo |
| Icono **Descargar** | Descarga un archivo completado |

> **Nota:** Los archivos se conservan 7 días, no para siempre. Si una descarga falla, vuelva a hacer la exportación desde el visor. La descarga también falla si se le quitó el acceso de exportación al mapa.

No puede crear exportaciones aquí. Créelas en el visor, en **Ejecuciones** o en el historial de una programación.

---

# Programaciones

La página **Programaciones** ejecuta un mapa por sí sola en horas fijas y guarda los resultados. La usa para informes que necesita cada día, semana o mes.

Puede programar un mapa que sea suyo o que se haya compartido con usted como **Puede exportar** o **Puede editar**. Un mapa público o un recurso compartido **Puede ver** no se pueden programar. Una programación se ejecuta como usted, con su acceso a los datos.

![La página Programaciones con una programación en pausa y sus iconos de acción.](shots/es-ES/user/38-schedules-list.png)

| Control | Qué hace |
|---|---|
| **Nueva programación** | Abre el cuadro para crear una |
| Tabla | **Nombre**, **Mapa**, **Programación**, **Próxima ejecución**, **Formato**, **Estado** (**Activa** o **En pausa**), **Planificador** |
| Icono de reproducir (**Ejecutar ahora**) | Inicia una ejecución de inmediato. Desactivado mientras está en pausa |
| Icono **Pausar** / **Habilitar** | Detiene o reinicia la programación |
| Icono **Historial** | Muestra las últimas 50 ejecuciones |
| Icono **Editar** | Abre **Editar programación**. No se puede cambiar el mapa |
| Icono **Eliminar** | Elimina la programación y su historial. No se puede deshacer |

La columna **Planificador** se rellena en las programaciones migradas desde Oracle Discoverer. Indica si la programación migrada se pudo planificar. No puede cambiarla. **Sin comprobar** significa que no se registró nada.

## Nueva programación

1. Haga clic en **Nueva programación**. También puede hacer clic en el icono del calendario en **Mapas**, y el mapa ya está elegido.
2. Elija el **Mapa**. La lista muestra sus mapas y los mapas compartidos con usted, marcados "(compartido)". Un mapa compartido con usted como **Puede ver** no aparece en la lista, porque ese nivel no permite una programación.
3. Escriba un **Nombre**.
4. Elija una **Frecuencia**, una **Zona horaria** y un **Formato de salida**.
5. Rellene los **Valores predefinidos de parámetros** si el mapa tiene parámetros.
6. Deje marcada la casilla **Habilitada** y haga clic en **Guardar**.

![El cuadro Nueva programación rellenado, con frecuencia mensual y Habilitada desmarcada.](shots/es-ES/user/37-schedule-filled.png)

| Campo | Qué significa / cuándo elegirlo |
|---|---|
| **Frecuencia**: **Diaria (medianoche)** | Cada día a las 00:00 en la zona horaria elegida |
| **Frecuencia**: **Semanal (domingo, medianoche)** | Cada domingo a las 00:00 |
| **Frecuencia**: **Mensual (día 1, medianoche)** | El día 1 de cada mes a las 00:00 |
| **Frecuencia**: **Personalizada** | Usted escribe una **Expresión cron**, de cinco campos: minuto, hora, día del mes, mes, día de la semana. Por ejemplo, `0 9 * * 1-5` es las 09:00 los días laborables |
| **Zona horaria** | El reloj que usa la programación. UTC es el valor predeterminado |
| **Válida desde (opcional)**, **Válida hasta (opcional)** | La programación no se ejecuta antes ni después de estas horas |
| **Formato de salida**: **Excel (.xlsx)** o **CSV** | El tipo de archivo del resultado guardado. CSV es el valor predeterminado |
| **Valores predefinidos de parámetros** | Los valores que se usan en cada ejecución. Los obligatorios están marcados con * |
| **Habilitada** | Si se desmarca, la programación espera hasta que la habilite |

## Historial

**Historial** muestra **Ejecutado**, **Estado** (**SUCCESS**, **FAILED**, **TIMEOUT**), **Filas** y **Duración**. Para cada resultado, **Abrir** lo muestra, y **XLSX**, **CSV** y **PDF** crean un archivo (si su acceso permite exportar). **Expira** indica cuánto tiempo se conserva el resultado, 30 días por defecto.

Los resultados se quedan en el servidor. No se envía nada por correo electrónico.

---

# Configuración

**Configuración** cambia el aspecto de la aplicación para usted. Ábrala desde la barra lateral o desde su nombre en la esquina superior derecha. Los ajustes pertenecen a su cuenta y le siguen a otros ordenadores.

![La página Configuración con las tarjetas Idioma, Tema y Paleta de colores.](shots/es-ES/common/04-settings.png)

| Control | Qué hace |
|---|---|
| **Idioma de visualización** | **English**, **Português (Portugal)**, **Français (France)**, **Español (España)** |
| **Apariencia** | **Claro**, **Oscuro**, **Alto contraste** |
| **Paleta** | **Clásica**, **Azul marino**, **Bosque**, **Vino**, **Océano**, **Ocre**. No disponible con **Alto contraste** |
| **Guardar** | Conserva sus elecciones en su cuenta |

Sus elecciones se ven al instante. Solo se conservan en todos los dispositivos después de hacer clic en **Guardar**.

---

# Preguntas frecuentes

**No veo un mapa que ve un compañero.** Los mapas son visibles si son suyos, si son públicos o si se han compartido con usted. Estar en la misma área de negocio no basta. Pida al propietario que lo comparta. Un usuario MANAGER o un administrador ve todos los mapas, así que su compañero puede tener otro rol.

**Abrí un mapa y la ejecución dice "Sin autorización para ejecutar".** Puede ver el mapa, pero no tiene acceso a los datos de una de sus carpetas. Pida a su administrador acceso a esa área de negocio.

**Hice clic en Excel y salió "Error en la exportación" o "Forbidden".** El mapa se ha compartido con usted como **Puede ver**. Pida al propietario **Puede exportar**.

**No puedo guardar mi mapa nuevo.** Guardar necesita el derecho de creación en el área de negocio del mapa. Pregunte a su administrador.

**Falta el icono Editar.** Solo puede cambiar sus propios mapas y los mapas compartidos como **Puede editar**. Copie el mapa y edite su copia.

**No puedo programar un mapa.** Debe ser su propietario o tener **Puede exportar** o **Puede editar**. Los mapas públicos no se pueden programar.

**Mi resultado dice Expirado.** Los resultados en directo duran 24 horas. Ejecute el mapa de nuevo.

**No encuentro una exportación antigua.** Los archivos se eliminan a los 7 días. Vuelva a exportar.

**Olvidé mi contraseña.** Pida a su administrador que la restablezca.

**No veo Áreas de negocio, Usuarios ni Migración.** Esas páginas son para otros roles.

---

# Glosario

| Término | Significado |
|---|---|
| Mapa | Un informe. En Oracle Discoverer era una hoja de trabajo |
| Libro | Un grupo de mapas |
| Área de negocio | Un grupo de datos relacionados. Su administrador le da derechos sobre ella |
| Carpeta | Un conjunto de elementos relacionados dentro de un área de negocio, como una tabla |
| Elemento | Un campo. Una dimensión es un rótulo, una medida es un número que se suma |
| Ejecución | Una vez que se ejecuta un mapa y produce un resultado |
| Exportación | Un archivo (Excel, CSV o PDF) creado a partir de un resultado |
| Programación | Un horario que ejecuta un mapa por sí solo y guarda el resultado |
| Recurso compartido | Dar a otro usuario acceso a un mapa que es suyo: **Puede ver**, **Puede exportar** o **Puede editar** |
| Mapa público | Un mapa que cualquier usuario puede abrir, ejecutar y exportar. Otros no pueden programarlo |
| Parámetro | Un valor que el mapa pide cuando lo ejecuta |
| Expresión cron | Cinco campos que indican cuándo se ejecuta una programación |
