# Discoverer Neo — Guía para el rol USER

Esta guía es para personas cuya cuenta tiene el rol **USER**. Le explica qué
puede hacer, dónde encontrarlo y qué pedir a su administrador.

Discoverer Neo sustituye a Oracle Discoverer. Los informes que conocía como
**hojas de trabajo** aquí se llaman **mapas**. Un **libro de trabajo** sigue
siendo un grupo de hojas de trabajo.

---

## 1. Qué puede hacer el rol USER

| Puede | No puede |
|---------|-----------|
| Ejecutar los mapas a los que tiene acceso | Crear o modificar áreas de negocio, carpetas, elementos, combinaciones u orígenes de datos |
| Exportar resultados a Excel, CSV y PDF | Administrar usuarios, la seguridad o el registro de auditoría |
| Programar mapas para que se ejecuten automáticamente | Ejecutar la migración desde Oracle Discoverer |
| Crear y editar sus propios mapas (si su administrador se lo permite) | Ver las ejecuciones de otros usuarios |
| Compartir **sus propios** mapas con compañeros | Compartir un mapa que pertenece a otra persona |
| Elegir su idioma y tema | |

El menú solo muestra lo que su rol puede usar. Si no ve una página que ve un
compañero, es que tiene un rol distinto.

### De dónde procede su acceso

Su rol es solo la mitad de la historia. Su administrador también le da
**acceso a áreas de negocio** (grupos de datos relacionados). Puede abrir un
mapa de una de estas formas:

- **Usted lo creó.** Siempre puede ejecutar, editar, exportar, programar,
  compartir y eliminar sus propios mapas.
- **Alguien lo compartió con usted.** Lo que puede hacer depende del nivel de
  uso compartido (consulte la [sección 8](#8-uso-compartido-de-mapas)).
- **Es público.** Cualquier usuario puede abrir, ejecutar y exportar un mapa
  público.
- **Su administrador le dio derechos de creación o edición en su área de
  negocio.** Entonces puede trabajar con los mapas de esa área.

Si un mapa que necesita no está en su lista, pídaselo a su administrador o al
propietario del mapa.

---

## 2. Inicio de sesión

1. Abra la dirección de Discoverer Neo que le dio su administrador.
2. Introduzca su **Correo electrónico** y su **Contraseña**.
3. Haga clic en **Iniciar sesión**.

### Primer inicio de sesión con una contraseña temporal

Si su cuenta procede de Oracle Discoverer, su administrador le da una
**contraseña temporal**. Tiene 16 caracteres, por ejemplo
`ufNnRksjgR7U%M6X`.

1. Inicie sesión con su correo electrónico y la contraseña temporal.
2. Se abre la pantalla **Cambiar la contraseña**. No puede saltársela.
3. Introduzca de nuevo la contraseña temporal y, a continuación, su nueva
   contraseña dos veces.
4. Se abre el panel. La contraseña temporal deja de funcionar.

Su nueva contraseña debe tener **al menos 12 caracteres**. Debe ser distinta
de la contraseña temporal.

> **Consejo:** la contraseña temporal no lleva `O` mayúscula, ni cero, ni `l`
> minúscula, ni uno. Estos caracteres son fáciles de confundir, así que no se
> usan.

Si pierde la contraseña temporal, pida a su administrador que la restablezca.

Para cerrar sesión, haga clic en su correo electrónico en la esquina superior
derecha y luego en **Cerrar sesión**.

---

## 3. La pantalla

El menú izquierdo tiene estos elementos:

| Elemento del menú | Para qué sirve |
|-----------|---------------|
| **Panel** | Sus cifras de un vistazo y sus mapas recientes |
| **Mapas** | Buscar, abrir, ejecutar y crear mapas |
| **Programaciones** | Mapas que se ejecutan automáticamente |
| **Ejecuciones** | Todas las ejecuciones que ha iniciado, y su resultado |
| **Exportaciones** | Archivos que ha exportado |
| **Configuración** (abajo) | Idioma y tema |

### Panel

- **Total de mapas** — los mapas que puede ver.
- **Total de ejecuciones** — cuántas veces ha ejecutado un mapa.
- **Mapas programados** — cuántas de sus programaciones están activas.
- **Resultados programados** — cuántos resultados han generado sus
  programaciones.
- **Mapas recientes** — los últimos 5 mapas que ha modificado.

---

## 4. Búsqueda de un mapa

1. Haga clic en **Mapas**.
2. Elija una pestaña:
   - **Míos** — mapas que ha creado.
   - **Compartidos conmigo** — mapas que otras personas han compartido con
     usted.
   - **Todos** — todos los mapas que tiene permiso para ver. Esto incluye los
     mapas que proceden de Oracle Discoverer.
3. Busque por nombre, filtre por área de negocio u ordene por nombre o por
   fecha.

### Explorar por libro de trabajo

El panel **Libros de trabajo** agrupa los mapas tal como los guardó
Discoverer. Haga clic en un libro de trabajo para ver sus hojas en su orden
original. Haga clic en una hoja para abrirla. Solo ve las hojas que tiene
permiso para ver.

---

## 5. Ejecución de un mapa

1. Abra el mapa.
2. Haga clic en **Ejecutar**.

### Parámetros

Muchos mapas piden valores antes de ejecutarse, por ejemplo una fecha de
inicio y una fecha de fin. Se abre una ventana **Parámetros de ejecución**.

1. Rellene todos los campos marcados con un `*` rojo. Estos campos son
   obligatorios.
2. Deje vacío un campo opcional para usar su valor predeterminado guardado.
3. Haga clic en **Ejecutar**.

Si hace clic en **Ejecutar** y parece que no pasa nada, busque esta ventana.
El mapa espera hasta que la rellene.

**Listas de valores.** La mayoría de los campos muestran una lista de los
valores que hay ahora en la base de datos. Haga clic en el campo o empiece a
escribir. Aun así, puede escribir cualquier valor. Si una columna tiene
demasiados valores, el campo dice
*«Demasiados valores para listar: escriba para buscar.»*. Escriba dos o tres
caracteres para ver coincidencias.

**Fechas.** Escriba las fechas en el formato que muestra el campo.

### Qué ocurre después de hacer clic en Ejecutar

Una ejecución pasa por estos pasos:

- **En cola** — la ejecución espera su turno. Sus ejecuciones avanzan una a
  la vez, en orden.
- **En ejecución** — la base de datos la está procesando.
- **Completada** — las filas aparecen en la tabla.

Si vuelve a ejecutar el mismo mapa con los mismos valores y existe un
resultado válido, Neo muestra ese resultado al instante. Se marca como
**Resultado reutilizado**. Haga clic en **Ejecutar de nuevo** para obtener
datos nuevos.

Un resultado permanece disponible **hasta un día**. Pasado ese tiempo, debe
volver a ejecutar el mapa.

### Cuando Ejecutar está en gris

El motivo aparece debajo del botón. **Sin columnas de salida** significa que
el mapa no tiene columnas que mostrar. Ábralo en el generador y agregue una
columna.

Otros dos mensajes pueden aparecer después de hacer clic en **Ejecutar**:

- **Sin autorización para ejecutar** — puede abrir el mapa, pero no puede
  ejecutarlo sobre estos datos. Pídaselo a su administrador.
- **No se ha podido conectar con el origen de datos** — la base de datos no
  está disponible. Vuelva a intentarlo más tarde. Si continúa, avise a su
  administrador.

### Cuando se rechaza un mapa (panel ámbar)

A veces Neo puede construir la consulta pero no puede garantizar que las
cifras sean correctas. En ese caso muestra un **panel ámbar**, no un error
rojo. El panel indica qué pidió, por qué Neo no puede responder y qué
cambiar. Oracle Discoverer rechazaba el mismo tipo de consultas.

Esto no es un fallo. Cambie el mapa como indica el panel, o pida al
propietario del mapa que lo cambie.

---

## 6. Consulta de los resultados

### Cortes de grupo y totales

- **Cortes de grupo** — una columna agrupada muestra su valor una sola vez,
  en la primera fila de cada grupo. Su encabezado lleva la etiqueta
  **Grupo**.
- **Subtotales** — una línea al final de cada grupo, por ejemplo
  `Total for EMEA`.
- **Totales generales** — una línea en negrita al pie.

Los totales usan **todas las filas que coinciden con los filtros**, no solo
las filas de la pantalla.

**Cuando ordena o filtra la tabla, los cortes de grupo y los subtotales se
detienen.** La tabla pasa a ser una lista simple. Borre la ordenación para
recuperar los grupos. Una nota al pie le avisa cuando esto ocurre.

### Por qué un total está vacío

A veces una celda de total está vacía a propósito. Esto ocurre cuando las
columnas proceden de distintos conjuntos de filas, y sumarlas daría un número
incorrecto. Oracle Discoverer hacía lo mismo. Las filas de la tabla son
correctas. Solo el total no se muestra. La nota al pie indica cuántos totales
están vacíos.

### Ordenar, buscar y columnas

- Haga clic en un encabezado de columna para ordenar: el primer clic ordena
  de A a Z, el segundo de Z a A, el tercero quita la ordenación.
- Use el cuadro de búsqueda para filtrar las filas de la pantalla. Esto no
  vuelve a ejecutar la consulta.
- Arrastre el borde de un encabezado de columna para cambiar su ancho.

### Explorar el detalle

Haga doble clic en una fila para ver las filas de detalle que hay detrás. Por
ejemplo, haga doble clic en un total para ver las filas que lo componen.

### Nota amarilla encima de los resultados

Una nota amarilla enumera los ajustes que esta ejecución no ha podido
aplicar, por ejemplo una ordenación por una columna que el informe no
muestra. Las filas siguen siendo correctas.

### Tablas cruzadas

Los mapas de Oracle Discoverer llegan **como tablas**, también cuando el
original era una tabla cruzada (una tabla dinámica). Discoverer no guardaba
qué columnas iban en la parte superior. Si puede editar el mapa, abra una
columna en el generador y establezca **Borde de la tabla cruzada** en **En la
parte superior**.

---

## 7. Exportación de resultados

1. Ejecute el mapa y espere hasta que muestre **Completada**.
2. Haga clic en **Excel**, **CSV** o **PDF**.
3. La exportación entra en una cola. Cuando esté lista, haga clic en
   **Descargar**.

| Formato | Para qué sirve |
|--------|-----------|
| **Excel** (.xlsx) | Informes y análisis |
| **CSV** | Cargar los datos en otras herramientas |
| **PDF** | Imprimir y enviar un diseño fijo |

Todos los formatos conservan los cortes de grupo, los subtotales y los
totales que ve en la pantalla.

Necesita el uso compartido **Puede exportar** (o superior) para exportar un
mapa que pertenece a otra persona.

### Por qué faltan los botones de exportación

La exportación usa las filas que una ejecución ya guardó. No vuelve a
ejecutar la consulta. Los botones solo aparecen cuando la ejecución está
**Completada** y su resultado no ha caducado. Haga clic en **Ejecutar de
nuevo** para obtener un resultado nuevo que pueda exportar.

### La página Exportaciones

Haga clic en **Exportaciones** para ver todas sus exportaciones y su estado:
**En cola**, **En curso**, **Completada** o **Fallida**. Los archivos se
conservan durante **7 días**. Después se eliminan. Descargue los archivos que
quiera conservar.

Puede salir de la página mientras se ejecuta una exportación grande. Vuelva
más tarde a **Exportaciones**.

---

## 8. Uso compartido de mapas

### Compartir su propio mapa

Solo puede compartir los mapas que **usted creó**.

1. Abra su mapa.
2. Haga clic en **Compartir**.
3. Elija un compañero.
4. Elija el nivel:

| Nivel | Qué puede hacer su compañero |
|-------|---------------------------|
| **Puede ver** | Abrir y ejecutar el mapa |
| **Puede exportar** | Abrir, ejecutar, exportar y programar el mapa |
| **Puede editar** | Todo lo anterior, y modificar el mapa |

5. Haga clic en **Compartir**.

Para cambiar un nivel, elija uno nuevo en la lista. Para dejar de compartir,
haga clic en **Quitar**. El cambio se aplica de inmediato.

Dé el nivel más bajo que necesite su compañero.

**Mapas públicos.** Si convierte un mapa en **Público**, cualquier usuario
puede abrirlo, ejecutarlo y exportarlo.

### Mapas compartidos con usted

Abra **Mapas → Compartidos conmigo**. Lo que puede hacer depende del nivel
que le dieron. Un uso compartido **Puede editar** le permite modificar el
mapa, pero **no puede compartirlo** con otras personas. Solo el propietario
puede hacerlo.

Sus propios derechos sobre los datos se siguen aplicando. Un uso compartido
le da el mapa, no nuevos derechos sobre los datos. Si ve **Sin autorización
para ejecutar**, pida a su administrador acceso a los datos.

---

## 9. Creación y modificación de mapas

Solo puede crear un mapa en un área de negocio donde su administrador le haya
dado el derecho de crear mapas. Si **Crear Mapa** da un error, pida ese
derecho.

### Crear un mapa

1. Haga clic en **Mapas** y luego en **Crear Mapa**.
2. Elija un área de negocio.
3. Introduzca un **Nombre**. Puede agregar una **Descripción**.
4. Elija un **Tipo de mapa**: **TABLE** (el habitual), **CROSSTAB** (tabla
   dinámica), **PAGE_DETAIL** o **CHART**.
5. Agregue columnas: elija elementos de la lista de la izquierda. Arrástrelos
   para cambiar el orden.
6. Agregue filtros (condiciones), parámetros y campos calculados si los
   necesita.
7. Haga clic en **Guardar**.

### Ajustes útiles de columna

- **Orden de clasificación** — 1, 2, 3 … para ordenar por más de una
  columna.
- **Agregación** — SUM, COUNT, AVG, MIN o MAX. Las demás columnas se
  convierten en los grupos.
- **Agrupar y cortar** — muestra un valor una vez por grupo y agrega un
  subtotal.
- **Solo consulta, no mostrar** — la consulta usa la columna, pero la tabla
  no la muestra.
- **Máscara de formato** — por ejemplo `999,999.00` o `DD-MON-YYYY`. Cada
  lector ve el formato en su propio idioma.

### Parámetros

Un parámetro pide un valor cuando se ejecuta el mapa. El nombre solo puede
tener letras, dígitos y guiones bajos, y debe empezar por una letra, por
ejemplo `start_date`.

### Formato condicional

Después de guardar el mapa, haga clic en **Formato** para colorear las
celdas o filas que cumplan una regla. Las reglas también se aplican a las
exportaciones.

### Copiar un mapa

Haga clic en **Duplicar** para hacer su propia copia de un mapa. Para un mapa
que pertenece a otra persona, necesita el derecho de crear mapas en su área
de negocio.

### No hace falta ratón

Cada acción de arrastre tiene una tecla equivalente. Use **Tab** para ir a un
elemento y luego a su botón **Agregar**. Para mover una columna, vaya a su
asa de arrastre, pulse **Espacio**, use las teclas de flecha y vuelva a
pulsar **Espacio**.

---

## 10. Programación de mapas

Una programación ejecuta un mapa por usted a las horas establecidas y
conserva los resultados.

Puede programar sus propios mapas, y los mapas compartidos con usted con el
nivel **Puede exportar** o superior.

### Crear una programación

1. Haga clic en **Programaciones** y luego en **Nueva programación**.
2. Elija el **Mapa**.
3. Introduzca un **Nombre**.
4. Elija una **Frecuencia**: **Diaria (medianoche)**, **Semanal (domingo,
   medianoche)**, **Mensual (día 1, medianoche)** o **Personalizada**.
5. Elija la **Zona horaria**.
6. Opcional: establezca **Válida desde** y **Válida hasta**.
7. Elija el **Formato de salida**: Excel o CSV.
8. Si el mapa tiene parámetros, rellene los **Valores predefinidos de
   parámetros**. Cada ejecución usa estos valores.
9. Marque **Habilitada** y guarde.

### Frecuencia personalizada (cron)

**Personalizada** usa una expresión cron con cinco partes:
`minute hour day-of-month month day-of-week`.

| Cuándo | Expresión |
|------|-----------|
| Todos los días a las 09:00 | `0 9 * * *` |
| De lunes a viernes a las 08:00 | `0 8 * * MON-FRI` |
| Todos los lunes a las 09:00 | `0 9 * * MON` |
| Cada 4 horas | `0 */4 * * *` |
| El primer día de cada mes a medianoche | `0 0 1 * *` |

### Administrar programaciones

En la lista de **Programaciones**, cada programación tiene estas acciones:
**Ejecutar ahora**, **Pausar** o **Habilitar**, **Historial**, **Editar** y
**Eliminar**.

Haga clic en **Historial** para ver cada ejecución, su estado, sus filas y su
duración. Haga clic en **Abrir** para ver las filas, o en **XLSX**, **CSV** o
**PDF** para descargarlas.

### Programaciones de Oracle Discoverer

Las programaciones que proceden de Oracle Discoverer llegan
**deshabilitadas**. No se ejecutan hasta que alguien las habilita. Antes de
habilitar una, mire la columna **Planificador**:

| Planificador | Significado |
|---------|---------|
| **Sin comprobar** | Aún no hay ninguna comprobación. Puede habilitarla y ver el resultado. |
| `FLAT(...)` o `REWRITE(...)` | El mapa puede ejecutarse correctamente. |
| `REFUSE(...)` | El mapa no puede dar una respuesta correcta. Cada ejecución falla. Corrija primero el mapa. |
| `UNPLANNABLE` | El mapa tiene un problema de datos de la migración. Pregunte a su administrador. |

Una ejecución programada fallida no se reintenta automáticamente.

---

## 11. La página Ejecuciones

Haga clic en **Ejecuciones** para ver todas las ejecuciones que ha iniciado,
en directo o programadas. Verá su estado, sus filas, su duración y cuándo
caduca su resultado.

- **Abrir** — muestra las filas de esa ejecución.
- **Ejecutar de nuevo** — ejecuta con los mismos valores.
- **Cancelar** — detiene una ejecución que todavía está en cola.
- **Eliminar** — quita una ejecución finalizada.
- **XLSX / CSV / PDF** — descarga las filas guardadas.

Use el filtro **Mapa** para ver las ejecuciones de un solo mapa.

---

## 12. Configuración

1. Haga clic en **Configuración**, al final del menú.
2. Elija un **Idioma**: English, Português (Portugal), Français (France) o
   Español (España).
3. Elija un **Tema**: **Claro**, **Oscuro** o **Alto contraste**.
4. Haga clic en **Guardar**.

La pantalla cambia de inmediato para que pueda probar cada opción. **Si no
hace clic en Guardar, el cambio se pierde** al recargar la página.

Su configuración le sigue a todos los ordenadores y navegadores.

---

## 13. Problemas y qué hacer

| Problema | Qué hacer |
|---------|-----------|
| No encuentro un mapa | Búsquelo en **Todos**. Si no está ahí, pida al propietario que lo comparta, o pida a su administrador acceso. |
| **Ejecutar** no hace nada | Busque la ventana **Parámetros de ejecución** y rellene los campos marcados con `*` rojo. |
| **Sin autorización para ejecutar** | Pida a su administrador acceso a los datos. |
| **No se ha podido conectar con el origen de datos** | Espere y vuelva a intentarlo. Si continúa, avise a su administrador. |
| Panel ámbar | El mapa no puede dar un número correcto. Cámbielo como indica el panel, o pida al propietario. |
| Sin filas | Compruebe los filtros y los valores de los parámetros. |
| La consulta tarda demasiado | Use intervalos de fechas más pequeños o más filtros. |
| Sin botones de exportación | El resultado caducó o no está completo. Haga clic en **Ejecutar de nuevo**. |
| Exportación **Fallida** | Exporte menos filas (agregue filtros), o pruebe con otro formato. |
| **Crear Mapa** o **Duplicar** da un error | Pida a su administrador el derecho de crear mapas en esa área de negocio. |
| No puedo compartir un mapa | Solo puede compartir los mapas que creó. Pida al propietario. |
| Mi idioma o tema volvió atrás | No hizo clic en **Guardar** en **Configuración**. |
| La programación no se ejecutó | Compruebe que está **Habilitada** y mire su valor de **Planificador**. |

### Qué decir a su administrador

Cuando pida ayuda, indique:

- el nombre del mapa,
- en qué hizo clic,
- el mensaje exacto en la pantalla,
- la fecha y la hora.
