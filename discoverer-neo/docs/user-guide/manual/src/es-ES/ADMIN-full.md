# Su rol de un vistazo

Usted es **administrador**. Puede usar todas las páginas de Discoverer Neo. Configura los datos sobre los que se crean los mapas, decide quién puede ver qué, se ocupa de las cuentas de usuario y trae el trabajo antiguo de Oracle Discoverer.

Un **mapa** es un informe (en Oracle Discoverer era una hoja de trabajo). Un **libro** es un grupo de mapas. Un **área de negocio** es un grupo de datos relacionados. Una **carpeta** es una tabla o una vista dentro de un área de negocio. Un **elemento** es una columna de una carpeta.

## Puede / No puede

| Puede | No puede |
|---|---|
| Abrir, ejecutar, cambiar, compartir, copiar y eliminar todos los mapas | Eliminar o desactivar su propia cuenta |
| Crear mapas en cualquier área de negocio, sin concesión | Descargar la exportación de otro usuario (las exportaciones son siempre privadas para su propietario) |
| Ver el SQL generado y el plan de base de datos de un mapa | Ver las programaciones de otro usuario en la lista **Programaciones** (ve las suyas) |
| Ver las ejecuciones de todos los usuarios (**Mostrar ejecuciones de todos los usuarios**) | |
| Crear, editar y desactivar áreas de negocio, carpetas, elementos, combinaciones, jerarquías, funciones personalizadas y orígenes de datos | |
| Dar y quitar concesiones de área de negocio | |
| Crear, editar, desactivar, eliminar y reactivar usuarios | |
| Emitir un archivo de credenciales con contraseñas temporales | |
| Pasar un mapa a un nuevo propietario | |
| Escribir directivas de seguridad a nivel de fila | |
| Leer el registro de auditoría | |
| Migrar un EUL de Oracle Discoverer | |

## De dónde procede su acceso

Su acceso procede de su rol. No depende de recursos compartidos ni de concesiones.

- **Mapas.** Ve todos los mapas activos, sea quien sea su propietario. Puede cambiar, compartir y eliminar cualquier mapa.
- **Datos.** Puede leer los datos de todas las carpetas sin una concesión de área de negocio. Cada vez que lo hace, el sistema escribe una nota en el registro de auditoría.
- **Seguridad a nivel de fila.** Las directivas de seguridad a nivel de fila se siguen aplicando a usted (vea el capítulo **Directivas de seguridad**).
- **Otras personas.** Los usuarios normales solo ven sus propios mapas, los mapas públicos y los mapas compartidos con ellos. Una concesión de área de negocio da acceso a los datos. Nunca hace visible un mapa.

## Cómo iniciar sesión, cambiar la contraseña y cerrar sesión

1. Abra la dirección de Discoverer Neo en su navegador.
2. Escriba su **Correo electrónico** y su **Contraseña**.
3. Deje marcada la casilla **Recordarme** para seguir con la sesión iniciada después de cerrar el navegador. Desmárquela en un ordenador compartido. La sesión termina entonces al cerrar el navegador.
4. Haga clic en **Iniciar sesión**.

![La página de inicio de sesión con Correo electrónico, Contraseña, Recordarme y el botón Iniciar sesión.](shots/es-ES/common/01-login.png)

Tras cinco contraseñas incorrectas, la cuenta se bloquea durante 15 minutos. El mensaje es **Demasiados intentos de inicio de sesión. Inténtelo de nuevo más tarde.** Si pierde su contraseña, otro administrador debe establecerle una nueva. No hay enlace de "he olvidado mi contraseña".

La página **Cambiar la contraseña** se abre sola cuando su cuenta tiene una contraseña temporal. Escriba la contraseña actual y después la nueva dos veces. La nueva contraseña debe tener al menos 12 caracteres y ser distinta de la anterior. (La contraseña que un administrador establece para otra persona en **Usuarios** solo necesita 8 caracteres.)

Para cerrar sesión, haga clic en su nombre en la parte superior derecha y elija **Cerrar sesión**. Esto termina su sesión. Para volver a usar Discoverer Neo, inicie sesión de nuevo.

![El menú de la cuenta abierto, con Configuración y Cerrar sesión.](shots/es-ES/common/03-user-menu.png)

## La barra lateral

| Sección | Páginas |
|---|---|
| **Información general** | **Panel** |
| **Modelado de datos** | **Áreas de negocio**, **Carpetas**, **Elementos**, **Combinaciones**, **Jerarquías**, **Funciones personalizadas**, **Orígenes de datos**, **Usuarios**, **Seguridad**, **Registro de auditoría** |
| **Mapas** | **Mapas** |
| **Otros** | **Programaciones**, **Ejecuciones**, **Exportaciones**, **Migración** |

**Configuración** está en la parte inferior de la barra lateral. En una pantalla estrecha, la barra lateral se oculta tras el botón de menú de la parte superior izquierda (**Mostrar u ocultar el menú**).

![La barra lateral completa de Administrador, con Modelado de datos y Migración.](shots/es-ES/admin/01-dashboard-sidebar.png)

---

# Configuración

**Configuración** contiene sus propias elecciones. Le siguen a cualquier navegador a través de su cuenta. Ábrala desde la barra lateral o desde el menú de su nombre.

![La página Configuración con las tarjetas Idioma, Tema y Paleta de colores.](shots/es-ES/common/04-settings.png)

| Botón o control | Qué hace |
|---|---|
| **Idioma de visualización** | Cambia de inmediato el idioma de las pantallas en este navegador. |
| **Apariencia** | Cambia de inmediato el tema en este navegador. |
| **Paleta** | Cambia de inmediato los colores de acento en este navegador. |
| **Guardar** | Conserva sus elecciones en su cuenta, de modo que se aplican en todos los dispositivos. |

**Idioma de visualización**

| Opción | Qué significa / cuándo elegirla |
|---|---|
| English | Pantallas en inglés. |
| Português (Portugal) | Pantallas en portugués. Es el valor predeterminado antes de iniciar sesión. |
| Français (France) | Pantallas en francés. |
| Español (España) | Pantallas en español. |

**Apariencia**

| Opción | Qué significa / cuándo elegirla |
|---|---|
| **Claro** | Fondo claro. |
| **Oscuro** | Fondo oscuro. Más cómodo en una habitación con poca luz. |
| **Alto contraste** | Colores fijos e intensos para leer con más facilidad. Las opciones de **Paleta** se desactivan mientras está seleccionado. |

**Paleta**

| Opción | Qué significa / cuándo elegirla |
|---|---|
| **Clásica**, **Azul marino**, **Bosque**, **Vino**, **Océano**, **Ocre** | Seis conjuntos de colores de acento. Elija el que prefiera. |

> **Advertencia:** Una elección cambia la pantalla de inmediato, pero solo se conserva en su cuenta cuando hace clic en **Guardar**. Si sale sin guardar, el próximo inicio de sesión recupera los valores anteriores.

---

# Panel

El **Panel** es la página que ve tras iniciar sesión. Le da un recuento rápido del trabajo del sistema. Aquí no puede cambiar nada.

![El panel de Administrador con las tarjetas de resumen y la lista Mapas recientes.](shots/es-ES/admin/01-dashboard-sidebar.png)

| Tarjeta | Qué muestra |
|---|---|
| **Total de mapas** | Todos los mapas activos del sistema. Debajo: cuántos son suyos y cuántos pertenecen a otras personas ("N suyos, M compartidos con usted"). Para usted, "compartidos con usted" significa los mapas de todas las demás personas, incluidos los privados. |
| **Total de ejecuciones** | Todas las ejecuciones de todos los mapas, de cualquier persona. |
| **Mapas programados** | Cuántos mapas tienen al menos una programación activa creada por usted. |
| **Resultados programados** | Cuántos resultados guardados han producido sus programaciones. |
| **Mapas recientes** | Los últimos 5 mapas que creó y cambió. Haga clic en uno para abrirlo en el generador. |

El enlace **Ver programaciones** de dos tarjetas abre la página **Programaciones**.

---

# Mapas

**Mapas** es la lista de todos los mapas del sistema. Úsela para buscar un mapa, ejecutarlo, cambiarlo, compartirlo, copiarlo, entregarlo a otra persona o eliminarlo.

![La lista de Mapas, pestaña Todos, con todos los iconos de fila y la sección Libros de trabajo encima.](shots/es-ES/admin/02-maps-all.png)

## La lista

| Botón o control | Qué hace |
|---|---|
| **Crear Mapa** | Abre el generador de mapas con un mapa vacío. |
| Pestañas **Míos**, **Compartidos conmigo**, **Todos** | **Míos** muestra los mapas que creó. **Compartidos conmigo** muestra los mapas que otras personas compartieron con usted. **Todos** muestra todos los mapas del sistema. La página se abre en **Todos** si no es propietario de ningún mapa. |
| **Buscar mapas por nombre…** | Filtra la lista por nombre. |
| Filtro **Área de negocio** | Muestra solo los mapas de un área de negocio. |
| **Ordenar por** | **Actualizado recientemente** o **Nombre (A–Z)**. |
| **Limpiar** | Quita la búsqueda y el filtro de área de negocio. Solo se muestra mientras hay un filtro activo. |
| Nombre del mapa | Abre el mapa en el generador. |
| Icono del ojo | Abre el mapa en el visor, donde lo ejecuta y lee las filas. |
| Icono del lápiz | Abre el mapa en el generador para cambiar columnas, condiciones y diseño. |
| Icono Copiar | Crea su propia copia del mapa y la abre para editarla. |
| Icono Compartir | Abre el cuadro **Compartir mapa**. |
| Icono del calendario | Abre **Programaciones** con este mapa ya elegido. |
| Icono Descargar | Abre el visor, donde exporta a Excel, CSV o PDF. |
| Icono de la papelera | Elimina el mapa después de confirmar. |

Las columnas son **Nombre**, **Libro**, **Propietario**, **Área de negocio**, **Tipo** y **Actualizado**.

Eliminar un mapa lo quita de todas las listas. Solo un administrador puede recuperarlo. Sus ejecuciones y programaciones siguen vinculadas a él.

> **Advertencia:** Como administrador, puede eliminar cualquier mapa. Compruebe antes la columna **Propietario**.

## Libros de trabajo

La sección **Libros de trabajo** aparece en la parte superior cuando al menos un mapa pertenece a un libro. Haga clic en un libro para ver sus mapas. Use **Buscar libros u hojas...** para encontrar uno.

| Botón o control | Qué hace |
|---|---|
| Icono del lápiz en la fila de un mapa | Abre ese mapa en el generador. |
| Icono Copiar | Abre el cuadro **Copiar**. Crea un libro nuevo con una copia privada de cada mapa. El original no cambia. Escriba el **Nombre del libro nuevo** y haga clic en **Copiar**. |
| Icono Compartir | Abre el cuadro de compartición del libro. Da acceso a una persona a todos los mapas del libro a la vez. |
| Icono de la papelera | Elimina el libro y todos sus mapas después de confirmar. Solo un administrador puede recuperarlos. |

## Compartir un mapa

Compartir decide quién más puede abrir un mapa y qué puede hacer con él.

![El cuadro Compartir mapa con un cuadro de búsqueda y los botones Puede ver, Puede exportar y Puede editar.](shots/es-ES/manager/03-share-dialog.png)

1. Haga clic en el icono Compartir de la fila del mapa.
2. Escriba en **Buscar por nombre o correo electrónico…** para encontrar a la persona.
3. Haga clic en un nivel junto a la persona. El nivel oscuro es el que la persona tiene ahora.
4. Para quitar el acceso, haga clic en la **✕** junto a la persona.

| Opción | Qué significa / cuándo elegirla |
|---|---|
| **Puede ver** | La persona puede abrir y ejecutar el mapa. No puede exportarlo, programarlo ni cambiarlo. |
| **Puede exportar** | La persona puede abrir y ejecutar el mapa, exportar el resultado y ponerlo en una programación. |
| **Puede editar** | La persona puede hacer todo lo anterior y además cambiar el mapa. No puede volver a compartirlo. |

Si el mapa es público, el cuadro muestra **Este mapa es público: cualquier persona con el enlace puede verlo.** y un botón **Copiar enlace**. Un mapa público puede abrirlo y exportarlo cualquier usuario con la sesión iniciada. Un mapa se hace público en el generador (vea el capítulo **Generador de mapas**).

Una persona también necesita una concesión de área de negocio sobre los datos del mapa. Sin ella, la persona puede abrir el mapa pero la ejecución se detiene con **Sin autorización para ejecutar**.

## Compartir un libro completo

En el cuadro de compartición del libro, los niveles son los mismos: **Puede ver**, **Puede exportar**, **Puede editar**. Un clic comparte todos los mapas del libro. La lista muestra "n de m hojas" para cada persona. Haga clic en **✕** para quitar el acceso.

## Copiar un mapa

Haga clic en el icono Copiar. Obtiene una copia privada de la que es propietario. Después puede cambiarla. El original queda como estaba.

## Ejemplo: dar acceso de lectura a un compañero

Ejemplo: comparta **GD_M.M10_V01.DIS** con un compañero que solo debe leerlo.

1. En **Mapas**, busque **GD_M.M10_V01.DIS**.
2. Haga clic en el icono Compartir.
3. Busque el nombre de su compañero.
4. Haga clic en **Puede ver**.
5. Compruebe que el compañero tiene una concesión en el área de negocio del mapa (vea **Áreas de negocio**). Sin ella, la ejecución se rechaza.

---

# Generador de mapas

El generador es donde crea y cambia un mapa. Ábralo con **Crear Mapa**, o con el icono del lápiz o el nombre del mapa en la lista. Como administrador, puede cambiar todos los mapas.

![El generador de mapas con el árbol Áreas de negocio, el lienzo de columnas y el panel Propiedades.](shots/es-ES/user/05-builder-overview.png)

## La pantalla

- **Izquierda:** el árbol **Áreas de negocio**. Abra un área de negocio, después una carpeta y arrastre un elemento.
- **Centro:** el lienzo **Columnas**. Contiene las columnas del mapa. Los resultados aparecen debajo tras una ejecución.
- **Derecha:** cinco pestañas: **Propiedades**, **Condiciones**, **Ordenación**, **Parámetros**, **Campos calculados**.

Puede arrastrar las barras entre las zonas para cambiar su ancho. **Contraer panel** oculta el lado derecho.

## La barra de herramientas

| Botón o control | Qué hace |
|---|---|
| **Atrás** | Vuelve a la página de la que venía. El generador no le avisa de los cambios sin guardar. |
| Cuadro del nombre del mapa | El nombre del mapa. |
| Lista de tipo de mapa | **Tabla**, **Tabla cruzada**, **Página-Detalle** o **Gráfico**. Solo **Tabla cruzada** cambia el aspecto del resultado (vea más abajo). |
| **● Sin guardar** | Indica que el mapa tiene cambios que no ha guardado. |
| **Ejecutar** | Guarda el mapa si es nuevo o ha cambiado y después lo ejecuta. |
| **Guardar** | Guarda el mapa. No hay guardado automático. |
| **Exportar** > **Definición del mapa (.xml)** | Descarga la definición del mapa como archivo XML. No contiene filas de datos. Solo funciona después de guardar el mapa. |
| **Programar** | Abre **Programaciones** con este mapa elegido. Funciona después de guardar el mapa. |
| **Formato** | Abre el cuadro de formato condicional. Funciona después de guardar el mapa. |
| **Compartir** | Abre el cuadro **Compartir mapa**. Funciona después de guardar el mapa. |

| Opción (tipo de mapa) | Qué significa / cuándo elegirla |
|---|---|
| **Tabla** | Una cuadrícula simple de filas. El valor predeterminado. |
| **Tabla cruzada** | Una cuadrícula con valores en la parte superior y en el lateral. Necesita al menos una columna establecida en **En la parte superior**. Si no hay ninguna, el resultado se muestra como una tabla con una nota. |
| **Página-Detalle** | Se guarda con el mapa, pero el resultado se muestra como una cuadrícula simple. |
| **Gráfico** | Se guarda con el mapa, pero el resultado se muestra como una cuadrícula simple. |

## Crear un mapa

1. Haga clic en **Crear Mapa**.
2. En el árbol **Áreas de negocio**, abra un área de negocio y una carpeta.
3. Arrastre un elemento al lienzo, o haga clic en el **+** que hay junto a él. Repita para agregar más columnas.
4. Haga clic en **Guardar**.

La primera columna que agregue fija el área de negocio del mapa. Todas las demás columnas deben proceder de la misma área de negocio. El sistema rechaza una columna de otra área con **Área de negocio diferente**. Una columna solo puede estar una vez en el lienzo. No hay selector de área de negocio.

Ejemplo: cree un mapa pequeño en el área de negocio **DC**. Arrastre una dimensión (icono de etiqueta) y una medida (icono de sigma) al lienzo. Establezca la medida en **SUM**. Haga clic en **Ejecutar**.

Use **Filtrar elementos…** encima del árbol para encontrar un elemento. Arrastre el asa de una columna para cambiar el orden. Haga clic en **X** en una columna para quitarla.

Mientras crea el mapa, el sistema comprueba su forma. Si se va a rechazar, un banner ámbar explica por qué antes de que haga clic en **Ejecutar** (vea **Rechazos**).

## Configurar una columna

Haga clic en una columna del lienzo. Se abre el cuadro **Configurar columna**. No se conserva nada hasta que hace clic en **Guardar** en el mapa.

| Botón o control | Qué hace |
|---|---|
| **Nombre para mostrar** | El encabezado de la columna. En blanco, usa el nombre del elemento. |
| **Agregación** | Cómo se totaliza la columna. |
| **Dirección de ordenación** | Ordena el resultado por esta columna. |
| **Máscara de formato** | Cómo se imprimen los números y las fechas. |
| **Predefinidos** | Rellena la **Máscara de formato** a partir de una lista. |
| **Orden de clasificación** | El lugar de la columna cuando ordena por varias columnas. |
| **Ancho de columna (px)** | El ancho de la columna. Debe ser mayor que cero. |
| **Colocación** | La función de la columna en el diseño. |
| **Borde de la tabla cruzada** | Dónde va una columna en una tabla cruzada. |
| **Agrupar y cortar** | Oculta los valores repetidos y empieza un subtotal cada vez que cambia la columna. |
| **Solo consulta, no mostrar** | La consulta pide la columna, así que una condición, una ordenación o un total pueden usarla, pero el resultado no la muestra. |

| Opción (**Agregación**) | Qué significa / cuándo elegirla |
|---|---|
| NONE | Sin total. Úsela para nombres y códigos. |
| SUM | Suma los valores. |
| COUNT | Cuenta las filas. |
| AVG | Media. |
| MIN | El valor más pequeño. |
| MAX | El valor más grande. |

| Opción (**Dirección de ordenación**) | Qué significa / cuándo elegirla |
|---|---|
| **Ninguno** | No ordenar por esta columna. |
| **Ascendente** | Primero el más pequeño, de la A a la Z. |
| **Descendente** | Primero el más grande, de la Z a la A. |

| Opción (**Predefinidos**) | Qué significa / cuándo elegirla |
|---|---|
| **Número (1.234)** | Número entero con separador de miles. |
| **Decimal (1.234,00)** | Dos decimales. |
| **Moneda (1.234,00 €)** | Dinero con el signo de moneda. |
| **Porcentaje (12,3 %)** | Porcentaje. |
| **Fecha (DD-MON-YYYY)** | Fecha como 31-DEC-2026. |
| **Fecha (YYYY-MM-DD)** | Fecha como 2026-12-31. |

| Opción (**Colocación**) | Qué significa / cuándo elegirla |
|---|---|
| **Ninguno** | Sin función especial. |
| **Agrupar por (eje)** | La columna agrupa las filas. |
| **Medida** | La columna contiene los números. |
| **Elemento de página** | La columna divide el resultado en páginas. |

| Opción (**Borde de la tabla cruzada**) | Qué significa / cuándo elegirla |
|---|---|
| **Ninguno** | No se usa en una tabla cruzada. |
| **En el lateral** | Los valores van por el lado izquierdo, hacia abajo. |
| **En la parte superior** | Los valores van por la parte superior, a lo ancho. |

![El cuadro Configurar columna con la lista Agregación abierta.](shots/es-ES/user/08-builder-column-aggregation.png)

## La pestaña Propiedades

| Botón o control | Qué hace |
|---|---|
| **Descripción** | El encabezado que se imprime encima de los resultados y en la parte superior de cada exportación. El texto que sigue a `&` es una variable. |
| **Insertar variable** | Coloca una variable en la posición del cursor. |
| **Público (visible para todos en el área de negocio)** | Hace público el mapa al guardar. En realidad, cualquier usuario con la sesión iniciada puede entonces abrirlo y exportarlo. Los datos siguen necesitando una concesión. |
| Recuentos | Totales de solo lectura de columnas, condiciones, parámetros y campos calculados. |

| Opción (**Insertar variable**) | Qué significa / cuándo elegirla |
|---|---|
| Fecha de ejecución (`&Date`) | La fecha de la ejecución. |
| Hora de ejecución (`&Time`) | La hora de la ejecución. |
| Nombre del libro (`&Workbook`) | El libro al que pertenece el mapa. |
| Nombre de la hoja (`&Worksheet`) | El nombre del mapa. |
| Parámetros introducidos en la ejecución | Cada parámetro del mapa como `&Name`. |

## La pestaña Condiciones

Una condición conserva solo las filas que cumplen una prueba.

| Botón o control | Qué hace |
|---|---|
| **Agregar condición** | Agrega una fila. Necesita al menos una columna en el lienzo. |
| Casilla de la fila | Selecciona la fila para agruparla. |
| **Agrupar n condiciones seleccionadas** | Agrupa dos o más filas seleccionadas en un bloque OR. |
| **Desagrupar** | Quita el bloque. |
| **Operador lógico** | Une la fila con la anterior: **AND** u **OR**. |
| **Elemento de condición** | La columna que se comprueba. |
| **Operador** | La comparación. |
| **Valor estático** | Un valor fijo en el cuadro. |
| **Solicitar en tiempo de ejecución** | El valor se pide cuando se ejecuta el mapa. Usted da nombre a un parámetro. |
| Cuadro de valor | El valor. Use `value1, value2, …` para IN y `low, high` para BETWEEN. |
| **Nombre del parámetro** | El parámetro que proporciona el valor. Debe existir. |
| Papelera | Quita la condición. |

| Opción (**Operador**) | Qué significa / cuándo elegirla |
|---|---|
| `=` | Igual a. |
| `<>` | Distinto de. |
| `<`, `>`, `<=`, `>=` | Menor que, mayor que, y con igualdad. |
| LIKE | Coincide con un patrón con `%` y `_`. |
| IN | Coincide con uno de una lista. |
| BETWEEN | Entre un valor mínimo y uno máximo. |
| IS NULL | El valor está vacío. Sin cuadro de valor. |

## La pestaña Ordenación

| Botón o control | Qué hace |
|---|---|
| **Elija una columna** | Escoge la columna que se agregará. |
| **Agregar ordenación** | Agrega el nivel de ordenación. |
| Asa | Arrastre para cambiar la prioridad. |
| Lista de dirección | **Ascendente** o **Descendente**. |
| X | Quita el nivel. |

## La pestaña Parámetros

Un parámetro es una pregunta que se hace cuando se ejecuta el mapa.

| Botón o control | Qué hace |
|---|---|
| **Agregar parámetro** | Agrega un parámetro llamado Parameter1, Parameter2, etc. |
| Cuadro del nombre | El nombre. Debe ser único. |
| Lista de tipo | El tipo de valor. |
| Valor predeterminado | Se usa cuando nadie escribe un valor. Si todos los parámetros tienen valor predeterminado, el mapa se ejecuta sin preguntar. |
| **Obligatorio** | La ejecución rechaza un valor en blanco. |
| Papelera | Quita el parámetro. |
| **Vista previa de la solicitud en tiempo de ejecución** | Muestra la solicitud tal como la verán las personas. |

| Opción (**Tipo**) | Qué significa / cuándo elegirla |
|---|---|
| STRING | Texto. |
| NUMBER | Un número. |
| DATE | Una fecha. |
| LIST | Varios valores, separados por comas. |

## La pestaña Campos calculados

Un campo calculado es una columna nueva creada a partir de una fórmula.

| Botón o control | Qué hace |
|---|---|
| **Agregar campo calculado** | Agrega Calc1, Calc2, etc. |
| Asa | Reordena los campos. |
| Cuadro del nombre | El nombre. Otras fórmulas lo llaman como `[Name]`. |
| Orden de visualización | El lugar de la columna. |
| Botón de fórmula | Abre el **Editor de fórmulas**. |
| Papelera | Quita el campo. |

En el **Editor de fórmulas**, escriba la fórmula o haga clic en una función para insertarla. Haga clic en el nombre de una columna para insertar `[Column]`. El editor avisa de fórmulas vacías, comillas o corchetes sin cerrar, y funciones o columnas desconocidas. **Probar fórmula** ejecuta la fórmula sobre las 5 primeras filas de datos reales. Funciona después de guardar el mapa.

| Grupo de funciones | Qué contiene |
|---|---|
| Aritmética | ROUND, TRUNC, FLOOR, CEIL, ABS, MOD, POWER, SQRT, SIGN, GREATEST, LEAST |
| Cadena | UPPER, LOWER, INITCAP, LENGTH, SUBSTR, TRIM, LTRIM, RTRIM, INSTR, REPLACE, CONCAT, LPAD, RPAD |
| Fecha | TO_CHAR, TO_DATE, ADD_MONTHS, MONTHS_BETWEEN, LAST_DAY |
| Condicional / gestión de nulos | NVL, NVL2, COALESCE, DECODE, TO_NUMBER, CASE |

## Formato condicional

**Formato** pinta una celda o una fila completa cuando un valor cumple una prueba. Las reglas se guardan al instante. No esperan a **Guardar**.

| Botón o control | Qué hace |
|---|---|
| **Añadir regla** | Abre el formulario de la regla. |
| **Columna** | La columna que se comprueba. |
| **Aplicar a** | **Celda** pinta una celda. **Fila** pinta la fila completa. |
| **Operador** | La prueba. |
| **Valor** | El valor con el que se compara. |
| **Color de fondo**, **Color de texto** | Los colores. **Borrar** quita uno. |
| **Negrita**, **Cursiva**, **Subrayado** | Estilo del texto. |
| **Guardar** | Conserva la regla. |
| X en una regla | Elimina la regla. |

| Opción (**Operador**) | Qué significa / cuándo elegirla |
|---|---|
| **Igual a**, **Distinto de** | Mismo valor o distinto. |
| **Mayor que**, **Menor que** | Por encima o por debajo. |
| **Mayor o igual que**, **Menor o igual que** | Por encima o por debajo, con igualdad. |
| **Contiene (comodines % y _)** | Coincidencia con un patrón. |
| **En la lista** | Uno de `value1,value2,…`. |
| **Entre** | Desde `low,high`. |
| **Está vacío** | Sin valor. |

## Ejecutar un mapa y leer el resultado

Haga clic en **Ejecutar**. Si un parámetro no tiene valor predeterminado, se abre primero el cuadro **Parámetros de ejecución**. Rellene los valores y haga clic en **Ejecutar**. Los valores obligatorios en blanco muestran **Este parámetro es obligatorio.**

El panel de resultados muestra el número de filas y el tiempo. **Hay más filas disponibles** significa que el resultado se cortó. Haga clic en **Cargar más** para obtener las 500 filas siguientes.

| Botón o control | Qué hace |
|---|---|
| **SQL** | Muestra u oculta el texto SQL que se envió a la base de datos. Solo lo ven usted y otros administradores. |
| **Plan** | Muestra el plan de ejecución de la base de datos. Solo administradores. |
| **Excel**, **CSV** | Exporta el resultado. |
| **PDF** | Abre **Exportar a PDF**. |
| Encabezado de columna | Haga clic para ordenar las filas cargadas. |
| Cuadro **Filtrar…** | Filtra las filas cargadas. |
| Doble clic en una fila | Abre **Ver detalle**: las filas sin procesar que hay detrás de esa fila. |

**Exportar a PDF**

| Opción | Qué significa / cuándo elegirla |
|---|---|
| **Tamaño del papel**: **A4**, **A3**, **Carta** | El tamaño de página. A4 es el valor predeterminado. Use A3 para resultados anchos. |
| **Orientación**: **Vertical**, **Horizontal** | Página alta o ancha. Use **Horizontal** para muchas columnas. |
| Lista **Columnas**, **Seleccionar todas** / **Limpiar** | Las columnas que se imprimirán. Al principio están todas marcadas. **Exportar** necesita al menos una. |

![Los resultados de una ejecución con los botones SQL y Plan junto a los botones Excel, CSV y PDF.](shots/es-ES/admin/03-viewer-results.png)

Los resultados de las ejecuciones se conservan 24 horas. Volver a ejecutar el mismo mapa con los mismos valores muestra el resultado guardado ("Mostrando un resultado en caché"). Haga clic en **Ejecutar de nuevo** en el visor para una ejecución nueva.

## Rechazos y errores

El sistema rechaza algunos mapas que darían totales erróneos. Dice por qué y qué cambiar.

| Mensaje | Qué hacer |
|---|---|
| Estas carpetas no están conectadas | Quite las columnas de la carpeta no conectada, o defina una combinación (vea **Combinaciones**). |
| Una combinación no tiene condición | Defina las columnas en las que coincide la combinación. |
| Una combinación está configurada en ambos sentidos a la vez | Desactive una de las dos opciones de combinación externa. |
| Estos totales se miden respecto a cosas distintas | Totalice desde un solo conjunto de filas de detalle. |
| Estas carpetas están unidas en círculo | Use una de las dos carpetas de detalle. |
| Valores individuales de dos conjuntos de filas de detalle | Totalice en su lugar, o liste desde un solo conjunto. |
| Se expande desde más de una carpeta | Divídalo en dos mapas. |
| Este tipo de total no puede calcularse a través de una combinación | Use SUM, COUNT, MIN o MAX. |

Un banner rojo **Sin autorización para ejecutar** significa que falta una concesión de área de negocio o, en modo cerrado, una directiva de seguridad a nivel de fila. Usted se salta las concesiones, pero no la seguridad a nivel de fila.

---

# El visor de mapas

El visor ejecuta un mapa y muestra las filas. Nunca cambia el mapa. Ábralo con el icono del ojo, o con el nombre de un mapa en **Ejecuciones**.

![El visor de mapas tras una ejecución completada, con la cuadrícula de resultados y los botones de exportación.](shots/es-ES/user/25-viewer-results.png)

| Botón o control | Qué hace |
|---|---|
| **Ejecutar** | Ejecuta el mapa. Pide parámetros si alguno no tiene valor predeterminado. |
| **Ejecutar de nuevo** | Lo ejecuta otra vez con los mismos valores e ignora el resultado guardado. Solo aparece tras una ejecución completada. |
| **Cancelar** | Cancela una ejecución que aún espera en la cola. Solo aparece mientras la ejecución está en cola. |
| **Administración de programaciones** | Abre **Programaciones**. |
| **Excel**, **CSV**, **PDF** | Exporta el resultado. |
| **SQL**, **Plan** | Solo administradores. |

La línea bajo **Ejecutar** le indica el estado: en cola, en ejecución o "Resultado de … válido hasta …". Un mapa migrado puede mostrar una advertencia de que no se pudieron migrar algunos filtros de Discoverer. El resultado puede entonces contener más filas que el original.

---

# Ejecuciones

**Ejecuciones** muestra todas las ejecuciones que ha pedido, en espera, en curso o terminadas. Úsela para abrir un resultado guardado, ejecutar de nuevo, exportar o limpiar ejecuciones antiguas. Los resultados se conservan 24 horas (ejecuciones en directo) o durante el tiempo de retención de la programación (ejecuciones programadas). La página se actualiza sola.

![La página Ejecuciones mostrando las ejecuciones de todos los usuarios.](shots/es-ES/admin/04-runs-every-user.png)

| Botón o control | Qué hace |
|---|---|
| Filtro **Mapa** | Muestra un solo mapa. |
| Filtro **Estado** | Muestra un solo estado. |
| Filtro **Tipo** | Muestra las ejecuciones **En directo** o **Programada**. |
| **Mostrar ejecuciones de todos los usuarios** | Muestra las ejecuciones de todos los usuarios, no solo las suyas. No hay columna de propietario, así que las filas de otros usuarios no llevan nombre. |
| Nombre del mapa | Abre el mapa en el visor. |
| Icono **Abrir** | Abre el resultado guardado. |
| Icono **Ejecutar de nuevo** | Inicia una ejecución nueva del mismo mapa con los mismos valores. Es su ejecución, aunque la haya copiado de la fila de otro usuario. |
| Botones **XLSX**, **CSV**, **PDF** | Exportan una ejecución completada que no ha expirado. |
| Icono **Cancelar** | Cancela una ejecución que está en espera. |
| Icono **Eliminar** | Elimina una ejecución terminada y sus filas guardadas. No se puede deshacer. |

| Opción (**Estado**) | Qué significa / cuándo elegirla |
|---|---|
| **En cola** | Esperando su turno. Cada persona ejecuta un mapa a la vez. |
| **En curso** | Trabajando ahora. |
| **Completada** | Terminada. El resultado se puede abrir y exportar. |
| **Fallida** | Detenida por un error. |
| **Cancelada** | Detenida por una persona. |

La columna **Expira en** muestra el tiempo que queda en minutos, horas o días, o **Expirado**.

---

# Exportaciones

**Exportaciones** muestra los archivos que ha exportado. Solo muestra sus propias exportaciones. Ni siquiera un administrador puede ver o descargar la exportación de otra persona.

![La página Exportaciones con la lista de trabajos de exportación, su estado y los botones de descarga.](shots/es-ES/admin/05-exports.png)

| Botón o control | Qué hace |
|---|---|
| Icono Descargar | Guarda el archivo. Se muestra en las exportaciones **Completada**. |
| Insignia de estado | **En cola**, **En curso**, **Completada** o **Fallida**. Apunte a una fallida para leer el motivo. |

Las columnas son **Mapa**, **Formato**, **Estado**, **Filas** y **Creado**.

| Opción (**Formato**) | Qué significa / cuándo elegirla |
|---|---|
| XLSX | Hoja de cálculo de Excel. |
| CSV | Texto sin formato con comas. Úselo para cargar los datos en otro programa. |
| PDF | Un documento paginado, creado con el tamaño de papel y las columnas que eligió. |

Una exportación se crea a partir de una ejecución terminada: desde el visor, el generador, **Ejecuciones** o el historial de una programación. Los archivos se eliminan a los 7 días. Después, la fila permanece pero la descarga falla.

---

# Programaciones

Una **programación** ejecuta un mapa por sí sola en horas fijas y guarda el resultado. Úsela para informes que necesita cada día, semana o mes. Solo muestra las programaciones que usted creó. No envía correos electrónicos. El resultado se queda en el servidor.

![La página Programaciones con una programación en pausa y sus iconos de acción.](shots/es-ES/user/38-schedules-list.png)

| Botón o control | Qué hace |
|---|---|
| **Nueva programación** | Abre el formulario de la programación. |
| Icono de reproducir (**Ejecutar ahora**) | Ejecuta la programación de inmediato. Está desactivado mientras la programación está en pausa. |
| Icono **Pausar** / **Habilitar** | Detiene o reinicia el horario. |
| Icono **Historial** | Abre **Historial de ejecución**. |
| Icono **Editar** | Cambia la programación. No puede cambiar su mapa. |
| Icono **Eliminar** | Elimina la programación y su historial después de confirmar. |

Las columnas son **Nombre**, **Mapa**, **Programación**, **Próxima ejecución**, **Formato**, **Estado** (**Activa** o **En pausa**) y **Planificador**. **Planificador** muestra la nota que dejó la migración en una programación que procedía de Discoverer. **Sin comprobar** es lo normal en programaciones nuevas. Las programaciones migradas desde Discoverer llegan en pausa.

Una programación se ejecuta como su creador. Se aplican las concesiones de área de negocio y las directivas a nivel de fila del creador.

## Nueva programación y Editar programación

| Botón o control | Qué hace |
|---|---|
| **Mapa** | El mapa que se ejecuta. La lista contiene sus propios mapas y los mapas compartidos con usted, marcados "(compartido)". Para programar el mapa de otro usuario, use el icono del calendario en **Mapas**. |
| **Nombre** | El nombre de la programación. |
| **Frecuencia** | Con qué frecuencia se ejecuta. |
| **Zona horaria** | El reloj que sigue el horario. |
| **Expresión cron** | El horario en cinco campos. Solo se muestra para **Personalizada**. |
| **Válida desde (opcional)** | El horario empieza en esta fecha y hora. |
| **Válida hasta (opcional)** | El horario se detiene después de esta fecha y hora. |
| **Formato de salida** | El tipo de archivo del resultado guardado. |
| **Valores predefinidos de parámetros** | Un valor fijo para cada parámetro del mapa. Solo se muestra si el mapa tiene parámetros. |
| **Habilitada** | Si el horario está activado. |

| Opción (**Frecuencia**) | Qué significa / cuándo elegirla |
|---|---|
| **Diaria (medianoche)** | Cada día a las 00:00. |
| **Semanal (domingo, medianoche)** | Cada domingo a las 00:00. |
| **Mensual (día 1, medianoche)** | El día 1 de cada mes a las 00:00. |
| **Personalizada** | Escriba su propia **Expresión cron**, por ejemplo `0 9 * * 1-5` (días laborables a las 09:00). Los cinco campos son minuto, hora, día del mes, mes, día de la semana. |

| Opción (**Formato de salida**) | Qué significa / cuándo elegirla |
|---|---|
| **Excel (.xlsx)** | Una hoja de cálculo. |
| **CSV** | Texto sin formato con comas. El valor predeterminado. |

**Zona horaria** ofrece UTC, America/New_York, America/Chicago, America/Denver, America/Los_Angeles, America/Sao_Paulo, Europe/London, Europe/Berlin, Europe/Paris, Europe/Moscow, Asia/Kolkata, Asia/Shanghai, Asia/Tokyo, Asia/Dubai y Australia/Sydney. UTC es el valor predeterminado.

Los resultados se conservan 30 días.

![El cuadro Nueva programación con una frecuencia personalizada y el campo Expresión cron.](shots/es-ES/user/34-schedule-custom-cron.png)

## Historial de ejecución

**Historial** muestra las últimas 50 ejecuciones de la programación: **Ejecutado**, **Estado** (SUCCESS, FAILED o TIMEOUT), **Filas** y **Duración**. Apunte a una fila fallida para leer el error.

| Botón o control | Qué hace |
|---|---|
| **XLSX**, **CSV**, **PDF** | Exporta el resultado guardado de una ejecución correcta. |
| Icono **Abrir** | Abre el resultado guardado en el visor. |
| Icono **Descargar** | Guarda directamente un archivo de resultado más antiguo. |
| "Expira …" | El tiempo que queda antes de que se elimine el resultado. |

## Ejemplo: un resultado semanal

Ejemplo: ejecute **GD_M.M10_V01.DIS** todos los lunes a las 07:00.

1. En **Mapas**, haga clic en el icono del calendario del mapa.
2. En **Nueva programación**, escriba un **Nombre**.
3. Establezca la **Frecuencia** en **Personalizada** y escriba `0 7 * * 1`.
4. Elija su **Zona horaria**.
5. Deje marcada la casilla **Habilitada** y haga clic en **Guardar**.
6. Más tarde, haga clic en el icono **Historial** para abrir o exportar el resultado.

---

# Áreas de negocio

Un **área de negocio** es un grupo de carpetas relacionadas, por ejemplo "Ventas". Es la unidad para dar a las personas acceso a los datos.

![La página Áreas de negocio con la lista de áreas, el botón Nueva área de negocio y los iconos de fila.](shots/es-ES/admin/06-business-areas.png)

Las columnas son **Nombre**, **Descripción**, **Estado** (**Activo** o **Inactivo**) y **Creado**.

| Botón o control | Qué hace |
|---|---|
| **Nueva área de negocio** | Abre el formulario de creación. |
| Icono **Administrar concesiones** | Abre el cuadro **Concesiones**. |
| Icono **Editar** | Cambia el nombre y la descripción. |
| Icono **Eliminar** | Desactiva el área de negocio después de confirmar. |

Eliminar solo desactiva. Un administrador puede recuperar el área.

![El cuadro Nueva área de negocio con los campos Nombre y Descripción.](shots/es-ES/admin/07-business-areas-new.png)

## Crear un área de negocio

1. Haga clic en **Nueva área de negocio**.
2. Escriba un **Nombre** (obligatorio, hasta 255 caracteres). Escriba una **Descripción** si lo desea.
3. Haga clic en **Guardar**. Aparece el aviso **Área de negocio creada**.

## Concesiones

Una **concesión** da a una persona un nivel de acceso a los datos de un área de negocio. Solo un administrador puede agregar o quitar concesiones. Las concesiones se aplican a una persona, no a un rol. Una concesión nunca hace visible un mapa.

![El cuadro Administrar concesiones con la lista Permiso abierta.](shots/es-ES/admin/09-business-areas-grants-permission.png)

| Botón o control | Qué hace |
|---|---|
| **Filtrar usuarios por nombre o correo electrónico** | Filtra la lista de personas. |
| Casillas de usuario | Marque una o varias personas. |
| **Permiso** | El nivel que se da a cada persona marcada. El texto que hay debajo explica el nivel. |
| **Agregar** | Da el nivel a cada persona marcada. Está desactivado hasta que marque a alguien. |
| Insignia de nivel en una concesión | Muestra el nivel que tiene una persona. |
| **Revocar** (X) | Quita la concesión de esa persona. |
| **Cerrar** | Cierra el cuadro. |

Los seis niveles forman una escalera. Cada nivel incluye los anteriores. Si una persona tiene varias concesiones en un área, prevalece la más alta.

| Opción (**Permiso**) | Qué significa / cuándo elegirla |
|---|---|
| VIEW | Leer los datos de las carpetas del área. Ejecutar los mapas que se han compartido con la persona. Ver las carpetas, los elementos, las combinaciones y las jerarquías del área. Elíjalo para quienes solo ejecutan informes. |
| EXPORT | Igual que VIEW. Los derechos de exportación de un mapa proceden de cómo se comparte el mapa. |
| SCHEDULE | Igual que VIEW. Los derechos de programación de un mapa proceden de cómo se comparte el mapa. |
| CREATE | Todo lo de VIEW, más crear mapas, carpetas, elementos, combinaciones y jerarquías nuevos en el área. Elíjalo para quienes crean mapas. |
| EDIT | Todo lo de CREATE, más cambiar el área y sus carpetas, elementos, combinaciones y jerarquías. |
| DELETE | Todo lo de EDIT, más eliminar carpetas, elementos, combinaciones y jerarquías del área. |

> **Nota:** EXPORT y SCHEDULE no añaden nada por sí solos. Que alguien pueda exportar o programar un mapa depende de cómo se comparte el mapa. Una persona necesita al menos CREATE para guardar un mapa nuevo.

> **Nota:** Un Manager nunca cambia carpetas, elementos, combinaciones, jerarquías ni el área, sea cual sea su concesión. Para un Manager, CREATE, EDIT y DELETE solo le permiten crear mapas.

Ejemplo: dé a un compañero el derecho de crear mapas en el área de negocio **DC**.

1. Haga clic en el icono **Administrar concesiones** del área.
2. Marque a su compañero.
3. Establezca **Permiso** en CREATE.
4. Haga clic en **Agregar**. Aparece el aviso **Acceso otorgado a 1 usuario**.

Para dar el mismo nivel a varias personas, márquelas a todas antes de hacer clic en **Agregar**. Si alguna falla, los avisos las informan por separado.

---

# Carpetas

Una **carpeta** es una tabla, una vista o una consulta dentro de un área de negocio. Sus columnas pasan a ser **elementos**. Elija primero un área de negocio. **Actualizar todo** y **Nueva carpeta** permanecen desactivados hasta que lo haga.

![La página Carpetas con un área de negocio elegida, mostrando la tabla de carpetas y los iconos de fila.](shots/es-ES/admin/11-folders.png)

Las columnas son **Nombre** (con una insignia **Compartida** para una carpeta que pertenece a otra área), **Tipo**, **Nombre de la tabla** y **Origen de datos**.

| Botón o control | Qué hace |
|---|---|
| **Área de negocio** | Elige el área cuyas carpetas ve. |
| **Actualizar todo** | Vuelve a leer todas las tablas y vistas del área desde su origen de datos. Las columnas nuevas pasan a ser elementos. Los tipos modificados se actualizan. Las columnas desaparecidas solo se enumeran. |
| **Nueva carpeta** | Abre el asistente de carpetas. |
| Icono **Actualizar desde el origen de datos** | La misma actualización para una carpeta. Se muestra en carpetas de tabla y de vista que tienen un origen de datos y no están compartidas desde otra área. |
| Icono **Gestionar áreas de negocio** | Abre el cuadro de compartición. |
| Icono **Editar** | Abre el asistente sobre esta carpeta. |
| Icono **Eliminar** | Desactiva la carpeta después de confirmar. |
| Panel **Resultado de la actualización**, **Cerrar** | Enumera lo que encontró cada actualización. |

La actualización nunca elimina un elemento. Una columna que ya no está en el origen se enumera como "La columna ya no existe en el origen (elemento conservado — bórrelo si ningún mapa lo usa)".

**Actualizar todo** omite las carpetas compartidas desde otra área. Actualícelas desde el área a la que pertenecen.

## El asistente de carpetas

| Botón o control | Qué hace |
|---|---|
| **Nombre** | El nombre de la carpeta. Se rellena a partir de la tabla si está vacío. |
| **Descripción** | Texto. Se rellena a partir del comentario de la tabla de Oracle si está vacío. |
| **Tipo de carpeta** | El tipo de carpeta. |
| **SQL personalizado** | El SQL que define la carpeta. Se muestra para **DERIVED** y **COMPLEX**. |
| **Origen de datos** | La conexión a la base de datos. Se muestra para todos los tipos salvo **DERIVED** y **COMPLEX**. |
| **Descubrir tablas** | Lee las tablas del origen de datos para que pueda escoger una. |
| Cuadro de filtro | Filtra la lista descubierta por nombre o comentario. |
| Lista descubierta | Haga clic en una tabla para rellenar **Nombre de la tabla**, **Propietario de la tabla**, **Nombre** y **Descripción**. |
| **Nombre de la tabla**, **Propietario de la tabla** | La tabla que se usará. Puede escribirlos. El sistema comprueba que la tabla existe y se puede leer. |
| **Elementos a crear (n)** | Las columnas de la tabla. Cada columna marcada pasa a ser un elemento. Puede cambiar cada descripción. **Seleccionar todas** / **Limpiar** marca o desmarca todas. |
| **Guardar** | Crea la carpeta y después crea los elementos. |

| Opción (**Tipo de carpeta**) | Qué significa / cuándo elegirla |
|---|---|
| TABLE | Una tabla de la base de datos. La opción habitual. |
| VIEW | Una vista de la base de datos. |
| DERIVED | Una carpeta definida por su propio texto en **SQL personalizado**. |
| COMPLEX | Una carpeta definida por su propio SQL. El SQL no debe estar vacío y debe superar la comprobación. Las directivas de seguridad a nivel de fila no funcionan con ella: una carpeta COMPLEX cubierta por una directiva se rechaza. |
| JOIN | Una carpeta que representa una combinación. |
| SUMMARY | Una carpeta de resumen. |

![El cuadro Nueva carpeta con una tabla elegida y la lista de comprobación Elementos a crear.](shots/es-ES/admin/15-folders-picked.png)

Ejemplo: crear una carpeta para una tabla.

1. Elija el área de negocio y haga clic en **Nueva carpeta**.
2. Deje el **Tipo de carpeta** en TABLE. Elija el **Origen de datos**.
3. Haga clic en **Descubrir tablas**. Escriba parte del nombre en el cuadro de filtro.
4. Haga clic en la tabla. Las columnas aparecen en **Elementos a crear**.
5. Desmarque las columnas que no necesite. Haga clic en **Guardar**.

## Compartir una carpeta en otra área de negocio

Una carpeta pertenece a un área de negocio. También puede aparecer en otras, como en Oracle Discoverer. Una concesión en cualquiera de sus áreas da acceso a la carpeta.

1. Haga clic en el icono **Gestionar áreas de negocio**.
2. En **Compartir con**, elija un área.
3. Haga clic en **Compartir**.
4. Para dejar de compartir, haga clic en la X de la insignia. No puede quitar el área propietaria.

![El cuadro de compartición de carpetas con la insignia del propietario y la lista Compartir con.](shots/es-ES/admin/16-folders-sharing.png)

---

# Elementos

Un **elemento** es una columna de una carpeta. Los mapas se crean a partir de elementos. Elija un **Área de negocio** y después una **Carpeta**. La lista de carpetas incluye las carpetas compartidas desde otra área.

![La página Elementos de una carpeta elegida, con las columnas Tipo, Columna, Tipo de datos y Agregación.](shots/es-ES/admin/17-items.png)

Las columnas son **Nombre**, **Tipo**, **Columna**, **Tipo de datos** y **Agregación**.

| Botón o control | Qué hace |
|---|---|
| **Área de negocio**, **Carpeta** | Eligen de quién ve los elementos. |
| **Nuevo elemento** | Abre el formulario de creación. Está desactivado hasta que se elige una carpeta. |
| Icono **Editar** | Cambia el elemento. No puede moverlo a otra carpeta. |
| Icono **Eliminar** | Desactiva el elemento después de confirmar. |

Los elementos normalmente los crea el asistente de carpetas. Esta página no tiene botón de importación.

| Botón o control | Qué hace |
|---|---|
| **Nombre** | El nombre del elemento. Obligatorio. |
| **Descripción** | Texto opcional. |
| **Tipo de elemento** | El tipo de elemento. |
| **Nombre de la columna** | La columna física. Solo se muestra para **Elemento de base de datos (CO)**. |
| **Fórmula** | El cálculo. Se muestra para todos los tipos salvo CO. Una fórmula no válida se rechaza. |
| **Tipo de datos** | Por ejemplo NUMBER. |
| **Máscara de formato** | Por ejemplo `999,999.00`. |
| **Agregación** | El total predeterminado del elemento. |

| Opción (**Tipo de elemento**) | Qué significa / cuándo elegirla |
|---|---|
| **Elemento de base de datos (CO)** | Una columna de la tabla. La opción habitual. |
| **Elemento creado (CI)** | Un elemento que usted creó, mediante una fórmula. |
| **Elemento calculado (CU)** | Un elemento calculado, mediante una fórmula. |
| **Elemento de combinación (JI)** | Un elemento que llega a través de una combinación. |
| **Elemento de jerarquía (HI)** | Un elemento que es un nivel de una jerarquía. |
| **Agregación (AG)** | Un elemento que totaliza otros elementos. |
| **Función (FU)** | Un elemento que llama a una función personalizada. |

| Opción (**Agregación**) | Qué significa / cuándo elegirla |
|---|---|
| NONE | Sin total predeterminado. No almacena nada. |
| SUM, COUNT, AVG, MIN, MAX | El total predeterminado de este elemento cuando se usa en un mapa. Elija SUM para importes. |

![El cuadro Nuevo elemento con la lista Tipo de elemento abierta, mostrando los tipos de elemento.](shots/es-ES/admin/19-items-type-open.png)

---

# Combinaciones

Una **combinación** le dice al sistema cómo se conectan dos carpetas, para que un mapa pueda usar columnas de ambas. Elija primero un área de negocio.

![La página Combinaciones, con combinaciones formadas por varios pares de columnas.](shots/es-ES/admin/20-joins.png)

Las columnas son **Nombre**, **Carpeta izquierda**, **Carpeta derecha**, **Columnas** (pares mostrados como `left op right`, unidos con AND) y **Tipo**.

| Botón o control | Qué hace |
|---|---|
| **Área de negocio** | Elige el área. |
| **Nueva combinación** | Abre el formulario de la combinación. |
| Icono **Editar** | Cambia la combinación. |
| Icono **Eliminar** | Desactiva la combinación después de confirmar. |

| Botón o control | Qué hace |
|---|---|
| **Nombre** | El nombre de la combinación. Obligatorio. Se rellena con una sugerencia si está vacío. |
| **Carpeta izquierda**, **Carpeta derecha** | Las dos carpetas. Ambas deben pertenecer al área. |
| **Sugerir combinaciones** | Busca nombres de columna coincidentes entre carpetas y los enumera. Parte de la carpeta izquierda. Haga clic en una sugerencia para rellenar el formulario. |
| **Elemento izquierdo**, **Operador**, **Elemento derecho** | Un par de columnas y cómo se comparan. |
| X en un par | Quita el par. No se puede quitar el último par. |
| **Añadir par de columnas** | Agrega otro par. Todos los pares deben coincidir (AND). Esto da una combinación sobre varias columnas. |
| **Tipo de combinación** | El tipo de combinación. |

| Opción (**Operador**) | Qué significa / cuándo elegirla |
|---|---|
| `=` | Las columnas son iguales. Casi siempre es la opción correcta. |
| `<>`, `<`, `<=`, `>`, `>=` | Otras comparaciones. Poco habituales. |

| Opción (**Tipo de combinación**) | Qué significa / cuándo elegirla |
|---|---|
| INNER | Solo las filas que coinciden en ambos lados. El valor predeterminado. |
| LEFT | Todas las filas de la carpeta izquierda, con o sin coincidencia. |
| RIGHT | Todas las filas de la carpeta derecha, con o sin coincidencia. |

No hay combinación completa, a propósito.

![El cuadro Nueva combinación con una lista desplegable abierta.](shots/es-ES/admin/23-joins-select-open.png)

Ejemplo: conectar dos carpetas.

1. Elija el área y haga clic en **Nueva combinación**.
2. Elija la **Carpeta izquierda** y la **Carpeta derecha**.
3. Haga clic en **Sugerir combinaciones** y haga clic en la sugerencia que encaje.
4. Compruebe el **Tipo de combinación** y haga clic en **Guardar**.

---

# Jerarquías

Una **jerarquía** es una lista ordenada de elementos, del más amplio al más estrecho, por ejemplo Año, Trimestre, Mes. Define cómo se desglosa. Elija primero un área de negocio.

![La página Jerarquías con la tabla que muestra el número de niveles.](shots/es-ES/admin/24-hierarchies.png)

Las columnas son **Nombre** y **Niveles**.

| Botón o control | Qué hace |
|---|---|
| **Área de negocio** | Elige el área. |
| **Nueva jerarquía** | Abre el formulario. |
| Icono **Editar** | Abre la jerarquía con sus niveles. |
| Icono **Eliminar** | Desactiva la jerarquía después de confirmar. |

| Botón o control | Qué hace |
|---|---|
| **Nombre**, **Descripción** | Campos de texto. |
| **Agregar nivel** | Agrega un nivel al final. |
| Asa de arrastre | Arrastre para reordenar. El orden es el orden de desglose (de arriba abajo). |
| **Nombre del nivel** | El nombre del nivel. |
| **Carpeta**, **Elemento** | El elemento que es este nivel. Al elegir una carpeta nueva se borra el elemento. |
| X en un nivel | Quita el nivel. |
| **Guardar** | Desactivado hasta que la jerarquía tenga nombre, al menos un nivel, y cada nivel tenga un nombre y un elemento. |

> **Advertencia:** La lista **Carpeta** también muestra las carpetas compartidas desde otras áreas, pero una jerarquía solo acepta elementos de carpetas que pertenezcan a su propia área. Un elemento de una carpeta compartida desde otra área se rechaza al guardar.

![El cuadro Nueva jerarquía tras agregar un nivel, con los selectores de carpeta y elemento.](shots/es-ES/admin/26-hierarchies-level-added.png)

---

# Funciones personalizadas

Una **función personalizada** registra una función que vive en la base de datos de Oracle, para que la puedan llamar los elementos calculados. No tiene área de negocio.

![La página Funciones personalizadas con el cuadro de filtro, Actualizar todo, Nueva función y la tabla de funciones.](shots/es-ES/admin/27-custom-functions.png)

Las columnas son **Nombre**, **Tipo**, **Función de la base de datos** (`OWNER.PACKAGE.NAME`, con `@LINK` si lo hay), **Origen de datos**, **Parámetros** y **Tipo de retorno**.

| Botón o control | Qué hace |
|---|---|
| **Actualizar todo** | Vuelve a leer desde Oracle todas las funciones que tienen un origen de datos y escribe de vuelta las firmas modificadas. Recompila los campos calculados si algo cambió. Las funciones que ya no están en Oracle solo se enumeran y se conservan. |
| **Nueva función** | Abre el formulario. |
| **Filtrar por nombre o función de la base de datos…** | Filtra la tabla. |
| Icono **Actualizar desde la base de datos** | Actualiza una función. |
| Icono **Editar** | Cambia la función. |
| Icono **Eliminar** | Desactiva la función después de confirmar. |
| Panel **Resultado de la actualización**, **Cerrar** | Enumera lo que cambió, lo que ha desaparecido y lo que falló. |

## El formulario de la función

| Botón o control | Qué hace |
|---|---|
| **Origen de datos** | Dónde está la función. Se elige por usted si solo hay uno. |
| **Propietario**, **Buscar una función**, **Buscar** | Busca funciones y paquetes en la base de datos de Oracle. Solo funciona con un origen de datos Oracle. Haga clic en un resultado para rellenar el formulario. Los resultados que no se pueden llamar desde SQL aparecen en gris con el motivo. |
| **Propietario**, **Paquete**, **Nombre de la función**, **Enlace de base de datos** | Las partes de la dirección de la función. Use letras, dígitos, `_`, `$` o `#`, empezando por una letra. |
| **Nombre**, **Descripción** | El nombre que ve la gente, y un texto. |
| **Tipo de función** | El tipo de función. |
| **Tipo de retorno** | Por ejemplo NUMBER. |
| **Parámetros (JSON)** | Una lista de parámetros. Cada uno necesita un nombre y un tipo, por ejemplo `[{ "name": "p_id", "type": "NUMBER", "required": true }]`. |

| Opción (**Tipo de función**) | Qué significa / cuándo elegirla |
|---|---|
| SQL | Una función escrita en SQL. |
| PLSQL | Una función PL/SQL independiente. El valor predeterminado. |
| PACKAGE | Una función dentro de un paquete. La búsqueda la elige cuando encuentra un paquete. |

![El cuadro Nueva función personalizada con las funciones de la base de datos que coinciden con la búsqueda.](shots/es-ES/admin/29-custom-functions-search-results.png)

---

# Orígenes de datos

Un **origen de datos** es una conexión guardada a una base de datos. Lo usan las áreas de negocio, las carpetas y las migraciones. Las contraseñas se guardan en el servidor y no se vuelven a mostrar.

![La página Orígenes de datos con una tabla de conexiones y cinco iconos de fila.](shots/es-ES/admin/30-data-sources.png)

Las columnas son **Nombre**, **Tipo**, **Host**, **Estado** y **Creado**.

| Botón o control | Qué hace |
|---|---|
| **Nuevo origen de datos** | Abre el formulario de conexión. |
| Icono **Probar conexión** | Intenta conectarse con los datos guardados. El resultado se muestra en un aviso y en un cuadro encima de la tabla. |
| Icono **Inspeccionar esquema** | Vuelve a leer el esquema de Oracle. El aviso indica cuántas tablas se encontraron. Solo funciona con Oracle. |
| Icono **Importar tablas** | Abre **Importar tablas**. |
| Icono **Editar** | Cambia la conexión. |
| Icono **Eliminar** | Desactiva el origen de datos después de confirmar. |

| Botón o control | Qué hace |
|---|---|
| **Nombre** | Debe ser único. |
| **Tipo de conexión** | El tipo de base de datos. |
| **Host**, **Puerto** | Dónde está el servidor. |
| **Nombre del servicio**, **SID** | Se muestran solo para Oracle. |
| **Nombre de usuario** | La cuenta de la base de datos. |
| **Contraseña** | La contraseña de la cuenta. Al editar, déjela en blanco para conservar la guardada. |

| Opción (**Tipo de conexión**) | Qué significa / cuándo elegirla |
|---|---|
| **Oracle** | Una base de datos Oracle. Necesaria para la inspección, la búsqueda de funciones y la migración. |
| **PostgreSQL** | Una base de datos PostgreSQL. |

## Importar tablas

**Importar tablas** convierte muchas tablas en carpetas a la vez.

1. Haga clic en el icono **Importar tablas**.
2. Escriba el **Propietario de la tabla / Esquema** (el nombre de usuario del origen de datos es el valor predeterminado).
3. Haga clic en **Descubrir tablas**.
4. Elija el **Área de negocio** que será propietaria de las carpetas nuevas.
5. Marque las tablas que quiera.
6. Haga clic en **Importar n tabla(s)**. El aviso indica cuántas carpetas se crearon y cuántas se omitieron porque ya existen.

![El cuadro Importar tablas con el botón Descubrir tablas, antes de encontrar ninguna tabla.](shots/es-ES/admin/34-data-sources-import-dialog.png)

---

# Usuarios

**Usuarios** muestra todas las cuentas. Úsela para agregar personas, cambiar roles, desactivar cuentas y entregar mapas a otras personas.

![La página Usuarios con los botones Archivo de credenciales y Nuevo usuario y los iconos de fila.](shots/es-ES/admin/35-users.png)

Las columnas son **Nombre**, **Correo electrónico**, **Rol** y **Estado** (**Activo** o **Inactivo**).

| Botón o control | Qué hace |
|---|---|
| **Archivo de credenciales** | Da una nueva contraseña temporal a cada cuenta activa que aún tiene una, y descarga la lista como archivo CSV. |
| **Nuevo usuario** | Abre el formulario de creación. |
| Icono **Mapas que este usuario puede abrir** | Abre la lista de mapas que esta persona puede abrir, y por qué. |
| Icono **Editar** | Cambia el nombre, el correo electrónico, la contraseña o el rol. |
| Icono **Desactivar** | Desactiva la cuenta. Se muestra en las cuentas activas. |
| Icono **Activar** | Vuelve a activar la cuenta, sin preguntar. Se muestra en las cuentas inactivas. |
| Icono **Eliminar** | Elimina la cuenta para siempre. |

No puede desactivar ni eliminar su propia cuenta. Esos iconos aparecen en gris en su fila.

## Crear o cambiar un usuario

| Botón o control | Qué hace |
|---|---|
| **Nombre** | Obligatorio, hasta 255 caracteres. |
| **Correo electrónico** | La dirección de inicio de sesión. Debe ser única. |
| **Contraseña** | Al menos 8 caracteres. Al editar, déjela en blanco para conservar la anterior. Una contraseña que usted establece no obliga a la persona a cambiarla. |
| **Rol** | El tipo de cuenta. La lista de debajo explica cada rol. |

| Opción (**Rol**) | Qué significa / cuándo elegirla |
|---|---|
| ADMIN | Lo hace todo: usuarios, áreas de negocio, orígenes de datos, seguridad y auditoría. Abre, cambia, comparte y elimina todos los mapas. Désela a muy pocas personas. |
| MANAGER | Abre, ejecuta, exporta, programa y comparte todos los mapas, y cambia quién es propietario de un mapa. Solo cambia sus propios mapas y los mapas compartidos con **Puede editar**. Ve, edita, activa y desactiva cuentas MANAGER, USER y VIEWER, pero nunca ve a los administradores y no puede crear ni eliminar usuarios ni dar el rol ADMIN. No puede cambiar áreas de negocio, carpetas, elementos, combinaciones ni jerarquías, sea cual sea su concesión. No puede usar **Funciones personalizadas**, **Orígenes de datos**, **Seguridad**, **Registro de auditoría** ni **Migración**. |
| USER | Ve sus propios mapas, los mapas públicos y los mapas compartidos con él. Ejecuta, exporta y programa según lo que permita cada recurso compartido. Copia mapas y crea mapas nuevos donde tiene una concesión CREATE. El valor predeterminado. |
| VIEWER | Como USER, pero no puede copiar mapas ni libros. Para una persona que solo debe leer, comparta mapas con **Puede ver** y no le dé ninguna concesión CREATE. |

> **Nota:** El texto breve bajo la lista **Rol** en pantalla es un resumen. La tabla anterior es lo que cada rol puede hacer realmente.

Un cambio de rol se aplica en el siguiente clic de la persona. No necesita volver a iniciar sesión.

![El cuadro Nuevo usuario con la lista Rol abierta y cada rol descrito.](shots/es-ES/admin/37-users-role-open.png)

## Desactivar, activar o eliminar

- **Desactivar** conserva la cuenta y su historial. La persona cierra sesión en su siguiente solicitud y no puede iniciar sesión hasta que usted active la cuenta. Úselo cuando alguien se va o está ausente.
- **Activar** vuelve a activar la cuenta de inmediato.
- **Eliminar** quita la cuenta para siempre y no se puede deshacer. La confirmación lo dice y enumera lo que desaparece con la cuenta: sus programaciones, ejecuciones y exportaciones. Si tiene dudas, use **Desactivar**.

![El cuadro de confirmación que se muestra antes de desactivar a un usuario.](shots/es-ES/admin/39-users-deactivate-dialog.png)

> **Advertencia:** **Eliminar** es permanente. **Desactivar** no lo es.

## El archivo de credenciales

Las cuentas migradas empiezan con una contraseña temporal y deben cambiarla antes de poder hacer nada. **Archivo de credenciales** crea una nueva contraseña temporal para cada cuenta activa que aún tiene una y descarga un CSV. Cada clic genera contraseñas nuevas, así que guarde el archivo en un lugar seguro y entregue a cada persona solo su propia línea. Las cuentas inactivas o que representan roles de base de datos se omiten.

## Mapas que este usuario puede abrir

El icono abre **Mapas de <name>**. Muestra exactamente lo que la persona ve en su propia página **Mapas**, con el propietario y el motivo.

![El cuadro Mapas de un usuario, con insignias de origen y selectores de nivel de acceso compartido.](shots/es-ES/admin/41-users-maps-dialog.png)

| Insignia | Qué significa |
|---|---|
| Administrador | La persona es administradora y ve todos los mapas. |
| Propietario | La persona es propietaria del mapa. |
| Compartido | El mapa se compartió con la persona. |
| Público | El mapa es público. |
| Rol de gestor | La persona es Manager y ve todos los mapas. |

| Botón o control | Qué hace |
|---|---|
| Nombre del mapa | Abre el mapa en el visor. |
| Lista de nivel de acceso compartido | En un mapa compartido, cambia el nivel: **Puede ver**, **Puede exportar**, **Puede editar**. |
| Icono de entregar mapa | Muestra la lista **Nuevo propietario**. |
| **Nuevo propietario** | Elija un usuario activo. El mapa pasa a esa persona. Puede cambiarlo, compartirlo y eliminarlo. |
| Icono X | Quita este mapa a la persona de inmediato, sin preguntar. |

Ejemplo: un compañero se va. Abra **Mapas que este usuario puede abrir** para ese compañero. Para cada mapa del que sea propietario, haga clic en el icono de entregar mapa y elija al nuevo propietario. Después haga clic en **Desactivar** en la cuenta.

---

# Directivas de seguridad

Las **Directivas de seguridad** controlan la **seguridad a nivel de fila**: qué filas de una carpeta puede ver cada persona. Una **directiva** contiene una o más **reglas**. Cada regla apunta a un área de negocio o a una carpeta y contiene un filtro escrito como una prueba SQL. El filtro se agrega a cada consulta que ejecuta una persona cubierta por la directiva.

![La página Directivas de seguridad con los botones Probar y Nueva directiva.](shots/es-ES/admin/43-security.png)

> **Advertencia:** Lo que ocurre con una carpeta que ninguna directiva cubre depende de un ajuste de la instalación (`ROW_LEVEL_FAIL_MODE`). **Cerrado**, el valor predeterminado: nadie ve sus filas, administradores incluidos, y las ejecuciones se detienen con **Refusing to run unfiltered**. **Abierto**: todos los que tienen una concesión ven todas sus filas. Pregunte a la persona que instaló el sistema qué modo usa el suyo. En modo cerrado, escriba y asigne directivas antes de que las personas ejecuten mapas.

Las columnas son **Nombre**, **Descripción**, **Estado**, **Reglas** y **Asignaciones**.

| Botón o control | Qué hace |
|---|---|
| **Probar** | Abre **Probar una directiva**. |
| **Nueva directiva** | Abre el formulario de la directiva. |
| Icono **Asignaciones** | Abre el cuadro **Asignaciones**. |
| Icono **Editar** | Cambia la directiva. |
| Icono **Eliminar** | Elimina la directiva después de confirmar. |

## Escribir una directiva

| Botón o control | Qué hace |
|---|---|
| **Nombre** | Obligatorio. |
| **Descripción** | Texto opcional. |
| **Activa** | Una directiva inactiva no se aplica. |
| **Añadir regla** | Agrega otra regla. Una directiva necesita al menos una. |
| **Se aplica a** | A qué apunta la regla. |
| **Área de negocio**, **Carpeta** | El destino. **Carpeta** enumera las carpetas del área elegida. |
| **Predicado SQL (fragmento de cláusula WHERE)** | El filtro. No debe estar vacío. |
| **Validar** | Comprueba el filtro. **Predicado válido** significa que es correcto. |
| **Quitar regla** | Quita la regla. |

| Opción (**Se aplica a**) | Qué significa / cuándo elegirla |
|---|---|
| **Área de negocio** | La regla cubre todas las carpetas del área. |
| **Carpeta** | La regla cubre una carpeta. |

En el filtro puede usar `:current_user_id`, `:current_user_email` y `:current_user_role`. Use `{alias}` para el nombre de la carpeta dentro de la consulta. Ejemplo: `{alias}.REGION = 'NORTH'`. Todos los filtros que coinciden se unen con AND.

> **Nota:** Una carpeta COMPLEX cubierta por una directiva se rechaza. Use otro tipo de carpeta si la carpeta necesita una directiva.

![El cuadro Nueva directiva tras pulsar Validar en un predicado.](shots/es-ES/admin/46-security-validate.png)

## Asignar una directiva

Una directiva se aplica a cada persona asignada y a todos los que tienen un rol asignado.

| Opción (**Asignar a**) | Qué significa / cuándo elegirla |
|---|---|
| **Usuario** | Una persona concreta. Elíjala en **Usuario**. |
| **Rol** | Todos los que tienen ese rol: ADMIN, MANAGER, USER o VIEWER. Elíjalo en **Rol**. |

1. Haga clic en el icono **Asignaciones**.
2. Elija **Usuario** o **Rol** y después elija la persona o el rol.
3. Haga clic en **Asignar**. Aparece el aviso **Directiva asignada**.
4. Para quitarla, haga clic en el icono **Quitar asignación**.

Una directiva sin asignación no da filas a nadie ("Sin asignar: esta directiva no da filas a nadie").

## Probar una directiva

**Probar** muestra dónde caen los filtros en una consulta de ejemplo. No ejecuta la consulta. Elija la **Directiva**, edite la **Consulta de ejemplo** (la predeterminada es `SELECT * FROM SALES`) y haga clic en **Ejecutar prueba**. El resultado aparece bajo **Consulta con predicados de seguridad**.

---

# Registro de auditoría

El **Registro de auditoría** registra cada cambio y cada evento de inicio de sesión del sistema. Úselo para averiguar quién hizo qué y cuándo. Es de solo lectura.

![La página Registro de auditoría con el botón de exportación, las tarjetas de estadísticas, el gráfico diario y los filtros.](shots/es-ES/admin/47-audit.png)

La parte superior de la página muestra **Total de acciones**, **Acciones principales** y **Acciones por día**.

| Botón o control | Qué hace |
|---|---|
| **Exportar CSV (esta página)** | Guarda las filas de la pantalla (hasta 25) como CSV. No es el registro completo. |
| Filtro **Usuario** | Muestra las acciones de una persona. **Todos los usuarios** lo quita. |
| **Tipo de entidad** | Muestra un tipo de objeto. Escriba el texto exacto, por ejemplo `maps`. |
| **Acción** | Muestra una acción. Escriba el texto exacto, por ejemplo `POST /api/maps`. |
| **Desde**, **Hasta** | El intervalo de fechas. |
| **Limpiar** | Quita todos los filtros. |
| Icono **Ver detalles** | Abre **Detalles de la entrada de auditoría** con la entrada completa. |
| **Anterior**, **Siguiente** | Se mueven entre páginas de 25 filas. |

Las columnas son **Marca de tiempo**, **Usuario**, **Acción**, **Entidad** y **Dirección IP**. Un usuario en blanco muestra **Sistema / sin autenticar**.

Lo que se registra: cada solicitud que cambia algo (crear, cambiar, eliminar, iniciar sesión, cerrar sesión, exportar, migrar) y la lectura de áreas de negocio, carpetas, elementos, combinaciones, jerarquías, funciones personalizadas y orígenes de datos. Las contraseñas y los tokens nunca se almacenan. Los filtros de texto coinciden con el texto completo y distinguen mayúsculas de minúsculas.

Cuando lee los datos de una carpeta sin una concesión, el registro lo anota como una excepción de administrador.

---

# Migración

La **Migración** trae una capa de usuario final (EUL, por sus siglas en inglés: el lugar donde Discoverer guardaba sus áreas de negocio, carpetas, elementos, usuarios y libros de trabajo) de Oracle Discoverer a Discoverer Neo. Es potente. Escribe muchos objetos en esta base de datos.

> **Advertencia:** Haga siempre primero una **simulación** y lea el informe. Una migración real escribe en la base de datos de Discoverer Neo. **Reimportar mapas** reemplaza todos los mapas del área de negocio "Migrated Workbooks", así que se pierden las ediciones hechas desde la primera migración, y también las programaciones, los recursos compartidos, las ejecuciones y las exportaciones de esos mapas. Prefiera **Reimportar todo**, que los conserva.

![La página Migración con la tarjeta de origen, sus botones y el texto de ayuda.](shots/es-ES/admin/50-migration.png)

El origen es un **origen de datos** Oracle que registró antes (vea **Orígenes de datos**). Se usa su contraseña guardada en el servidor. En esta página no se escribe ninguna contraseña.

## Elegir el origen

| Botón o control | Qué hace |
|---|---|
| **Origen de datos Oracle** | La conexión de Oracle que contiene el EUL. |
| **Propietario del esquema EUL (opcional)** | El esquema propietario del EUL, por ejemplo `EUL5_US`. |
| **Versión de EUL** | La versión del EUL. |
| **Detectar versión** | Encuentra la versión y muestra la tarjeta **Origen detectado**. |
| **Analizar** | Comprueba la preparación y la complejidad. Rellena la tarjeta **Evaluación**. |
| **Simulación (validar sin escribir)** | Activada por defecto. Las ejecuciones son solo una prueba y no escriben nada. |
| **Ejecutar simulación** / **Ejecutar migración** | Inicia el trabajo. El nombre sigue a la casilla **Simulación**. |
| **Reimportar mapas** | Reconstruye los mapas de una base de datos que ya está migrada. |
| **Reimportar todo** | Repite toda la migración con la versión actual. |
| **Compilar campos calculados** | Comprueba cada campo calculado y escribe el SQL que ejecutan los mapas. |

| Opción (**Versión de EUL**) | Qué significa / cuándo elegirla |
|---|---|
| **Detección automática** | El sistema encuentra la versión. Elíjala primero. |
| **Forzar EUL4** | Trata el origen como Discoverer 4. |
| **Forzar EUL5** | Trata el origen como Discoverer 9i, 10g u 11g. |

## Qué hace cada acción

| Acción | Qué hace |
|---|---|
| **Ejecutar migración** | Una primera migración de un destino vacío. No se puede ejecutar en un destino que ya contiene una migración (**La base de datos de destino ya está migrada**). Use una reimportación en su lugar. |
| **Reimportar mapas** | Reconstruye solo los mapas, a partir de los libros de trabajo del EUL. Reemplaza todos los mapas del área de negocio "Migrated Workbooks" y elimina con ellos sus programaciones y recursos compartidos. No toca usuarios, carpetas, elementos ni concesiones. |
| **Reimportar todo** | Reescribe, objeto por objeto, lo que ahora difiere: áreas de negocio, carpetas, elementos, combinaciones, jerarquías, funciones, usuarios, concesiones y mapas. No se elimina nada. Los identificadores de los mapas se conservan, así que se mantienen las programaciones y los recursos compartidos. Los objetos eliminados del EUL solo se informan. Una ejecución real termina compilando los campos calculados. |
| **Compilar campos calculados** | Úselo si un mapa dice que un campo "no se ha compilado". Una migración y una reimportación ya lo hacen al final. No lee el EUL. |

Los botones están desactivados mientras hay un trabajo en marcha, o cuando no se ha elegido ningún origen de datos. **Compilar campos calculados** funciona incluso sin origen de datos.

## Hacer una migración con seguridad

1. Registre el origen de datos Oracle en **Orígenes de datos** y pruébelo.
2. Elíjalo aquí. Haga clic en **Detectar versión** y después en **Analizar**. Lea la **Evaluación**: preparación, bloqueos y advertencias.
3. Deje marcada la casilla **Simulación**. Haga clic en **Ejecutar simulación**.
4. Lea el informe: **Filas que se insertarían**, el resumen, la conciliación y el **Registro de la migración**.
5. Cuando la simulación esté limpia, desmarque **Simulación**. Aparece la advertencia "Una migración real escribe en esta base de datos de Discoverer Neo". Haga clic en **Ejecutar migración**.
6. Abra **Usuarios**. Las cuentas migradas no pueden iniciar sesión hasta que tienen una contraseña. Haga clic en **Archivo de credenciales** y entregue las contraseñas.
7. Revise los mapas del área de negocio "Migrated Workbooks" y mueva cada uno al área a la que pertenece.

La tarjeta **Evaluación** muestra una puntuación de preparación sobre 100, la complejidad, el esfuerzo estimado, los recuentos de lo encontrado, la cobertura del diseño de hojas, los bloqueos y las advertencias.

---

# Preguntas frecuentes

**No veo un mapa que ve un compañero. O un compañero no ve mi mapa.**
Usted ve todos los mapas, así que el problema es del compañero. Abra **Usuarios**, haga clic en **Mapas que este usuario puede abrir** y compruebe la insignia. Si falta el mapa, compártalo (al menos **Puede ver**) o hágalo público.

**Un usuario abre un mapa pero la ejecución se detiene con "Sin autorización para ejecutar".**
El mapa es visible pero la persona no tiene concesión en el área de negocio de sus carpetas. Agregue una concesión en **Áreas de negocio**. En modo cerrado, la falta de una directiva de seguridad a nivel de fila da el mismo banner.

**Todo el mundo recibe "Refusing to run unfiltered".**
La instalación ejecuta la seguridad a nivel de fila en modo cerrado y ninguna directiva cubre la carpeta. Escriba una directiva en **Directivas de seguridad** y asígnela.

**Una persona puede ver un mapa pero no puede exportarlo ni programarlo.**
Su recurso compartido es **Puede ver**. Cámbielo a **Puede exportar**. Los mapas públicos se pueden exportar pero no programar.

**Un usuario migrado no puede iniciar sesión.**
La cuenta aún no tiene contraseña. Use **Archivo de credenciales** en **Usuarios**. Si la persona está desactivada, haga clic en **Activar**.

**No puedo eliminar ni desactivar mi propia cuenta.**
Es a propósito. Pídaselo a otro administrador.

**La página Ejecuciones solo muestra mis ejecuciones.**
Marque **Mostrar ejecuciones de todos los usuarios**.

**No puedo descargar una exportación hecha por otra persona.**
Las exportaciones son privadas, incluso para los administradores. Pida a la persona que vuelva a exportar.

**Una programación que creé para el mapa de otra persona no está en la lista.**
La página **Programaciones** solo muestra las programaciones que usted creó. La lista **Mapa** del formulario muestra sus propios mapas y los mapas compartidos con usted. Para programar el mapa de otra persona, use el icono del calendario en **Mapas**.

**Un campo calculado dice que "no se ha compilado".**
Haga clic en **Compilar campos calculados** en **Migración**.

## Glosario

| Término | Significado |
|---|---|
| Mapa | Un informe. En Oracle Discoverer era una hoja de trabajo. |
| Libro | Un grupo de mapas. |
| Área de negocio | Un grupo de datos relacionados. La unidad de las concesiones. |
| Carpeta | Una tabla, vista o consulta de un área de negocio. |
| Elemento | Una columna de una carpeta. |
| Combinación | Una regla que conecta dos carpetas. |
| Jerarquía | Una lista ordenada de elementos que se usa para el desglose. |
| Concesión | Un nivel de acceso a un área de negocio, dado a una persona. |
| Ejecución | Una vez que se ejecuta un mapa. Su resultado se guarda durante un tiempo. |
| Exportación | Un archivo (XLSX, CSV o PDF) creado a partir de una ejecución terminada. |
| Programación | Un horario que ejecuta un mapa por sí solo y guarda el resultado. |
| Recurso compartido | Acceso a un mapa, dado a una persona: **Puede ver**, **Puede exportar** o **Puede editar**. |
| Mapa público | Un mapa que puede abrir y exportar cualquier usuario con la sesión iniciada. |
| Origen de datos | Una conexión guardada a una base de datos. |
| Seguridad a nivel de fila | Reglas que deciden qué filas de una carpeta ve una persona. |
| EUL | Capa de usuario final (End User Layer). Donde Oracle Discoverer guardaba sus metadatos. |
| Simulación | Una prueba de migración que no escribe nada. |
