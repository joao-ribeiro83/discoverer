# Ejecución de mapas

Aprenda a ejecutar mapas y a consultar los resultados.

## Ejecución de un mapa

### Desde sus mapas

1. Haga clic en **Mapas** en la barra lateral
2. Seleccione un mapa en **Mis mapas** o en **Compartidos conmigo**
3. Haga clic en **Ejecutar**

### Desde un área de negocio

1. Haga clic en **Áreas de negocio** → seleccione un área
2. Busque un mapa en la sección **Mapas**
3. Haga clic en **Ejecutar**

## Proporcionar parámetros

Una hoja migrada desde Discoverer suele llevar parámetros — los títulos
originales los muestran como `&Dt Início`, `&Dt Fim`. Hay 7.521 en total.

Pulse **Ejecutar**: si la hoja tiene algún parámetro sin valor predeterminado,
se abre la ventana **Parámetros de ejecución** antes de enviar nada a la base
de datos:

1. Rellene cada campo marcado con un `*` rojo. Esos son obligatorios.
2. Deje en blanco un campo opcional para usar su valor predeterminado.
3. Pulse **Ejecutar** en la ventana.

La ventana no le deja continuar mientras un campo obligatorio esté vacío —
marca el campo en su lugar. Nada se ejecuta hasta que la ventana esté
completa, así que una hoja que parece no responder a **Ejecutar** suele estar
esperando esta ventana detrás de la página.

Los valores que escribe se envían al servidor como variables de enlace. El
navegador nunca construye SQL, por lo que un valor con comillas o punto y coma
es dato, nunca código.

### Listas de valores

La mayoría de los campos de parámetro ofrecen una **lista de los valores que
existen realmente** en la columna que se está filtrando. Empiece a escribir, o
haga clic en el campo, y el navegador muestra las sugerencias debajo.

Los valores se leen de su base de datos al abrirse la solicitud, así que están
al día. No son una copia hecha cuando se migró el informe.

Tres cosas que conviene saber:

- **Puede escribir cualquier cosa.** La lista es una sugerencia, no una valla.
  Está limitada, así que un valor válido puede quedar fuera de ella; una nota
  bajo el campo lo indica cuando la lista se ha recortado.
- **Una columna muy amplia le pide que escriba primero.** Un campo con cientos
  de miles de valores distintos (un número de póliza, por ejemplo) muestra
  *«Demasiados valores para listar: escriba para buscar»*. Escriba dos o tres
  caracteres y aparecerán los valores que coinciden.
- **Algunos campos no tienen lista.** Un elemento calculado no tiene columna
  detrás, así que no hay nada que listar, y el campo sigue siendo texto simple.
  No pasa nada malo.

Solo verá valores que ya tiene permitido consultar. La lista pasa por las mismas
comprobaciones de permisos que ejecutar el informe.

## Cuando el botón Ejecutar está desactivado

**Ejecutar** aparece en gris cuando no puede hacer nada útil, y el motivo se
imprime debajo del botón. Hoy, el único motivo que la página puede conocer
antes de preguntar al servidor es:

- **Sin columnas de salida.** La hoja no dibuja nada. Ábrala en el generador y
  añada al menos una columna.

Otras dos condiciones solo las conoce el servidor, así que llegan como mensaje
después de pulsar:

- **Sin autorización para ejecutar.** Puede abrir la hoja pero no ejecutarla
  sobre esta fuente de datos.
- **No se pudo conectar con la fuente de datos.** La conexión falta o está
  caída.

## Cuando una hoja se rechaza

A veces la respuesta no es un error ni un resultado — el planificador de
consultas rechaza ejecutar la hoja, porque puede construir el SQL pero no
puede garantizar que la cifra sea correcta.

Una hoja rechazada muestra un panel ámbar, no rojo. Indica qué se pidió, por
qué no se puede responder, y qué cambiar. Discoverer rechazaba las mismas
formas.

Los motivos, y qué hacer, están en
[Resolución de problemas: por qué se rechazó una hoja](../troubleshooting/refusals.md).

## Consulta de los resultados

Una vez completada la ejecución, verá:

### Tabla de resultados

- **Columnas** — Según los elementos seleccionados en el mapa
- **Filas** — Filtradas y ordenadas según la definición del mapa
- **Paginación** — Si los resultados superan el tamaño de página

### Información del resultado

- **Filas totales** — Número total de filas que coinciden con los filtros
- **Tiempo de ejecución** — Cuánto ha tardado la consulta
- **Ejecutado por** — Su nombre de usuario
- **Ejecutado el** — Marca de tiempo

## Cortes de grupo y totales

Un mapa migrado desde Discoverer se muestra como lo dibujaba la hoja original.

**Cortes de grupo.** Una columna marcada como *agrupar y cortar* se muestra una
vez por grupo: el valor aparece en la primera fila y se deja en blanco en las
filas que lo repiten. La cabecera de la columna lleva la etiqueta **Grupo**.

**Subtotales.** Cuando el mapa los define, una línea de subtotal cierra cada
grupo, con el rótulo que escribió el autor original — `Total de EMEA`.

**Totales generales.** Una línea en negrita al pie de los resultados.

Los totales se calculan sobre **todas las filas que abarcan los filtros**, no
sobre las filas cargadas en ese momento. Cargar más filas no los cambia.

**Ordenar o filtrar la cuadrícula suspende esto.** Los cortes y los subtotales
solo tienen sentido en el orden que devolvió la consulta. Si pulsa una cabecera
para ordenar, los resultados pasan a ser una lista simple; borre la ordenación
para recuperar la disposición. El pie indica cuándo está suspendida.

## Tablas cruzadas

Una tabla cruzada pone un conjunto de valores en el lateral, otro en la parte
superior y las medidas en medio.

Los mapas migrados desde Discoverer llegan **como tablas**, aunque el original
fuera una tabla cruzada. Discoverer nunca registró qué columnas iban arriba, así
que nada puede recuperarlo. Abra el mapa en el generador, abra una columna y
defina el *Borde de la tabla cruzada* como *En la parte superior* para
recuperar el cruce. Consulte
[Creación de mapas](building-maps.md).

## Paginación

Para conjuntos de resultados grandes:

- **Página siguiente** — Carga más filas
- **Cargar más** — Añade filas adicionales a la vista actual
- Los resultados se cargan en páginas (valor predeterminado: 100 filas por página)

## Ordenación de los resultados

Haga clic en los encabezados de columna para ordenar:
- **Primer clic** — Ordenación ascendente (A → Z)
- **Segundo clic** — Ordenación descendente (Z → A)
- **Tercer clic** — Borra la ordenación

**Nota:** la ordenación por varias columnas se define en el generador de mapas, no aquí.

## Búsqueda en los resultados

Utilice el cuadro de búsqueda situado encima de los resultados para filtrar las filas visibles por palabra clave:
- Busca en todas las columnas
- No distingue entre mayúsculas y minúsculas
- Filtrado en tiempo real (no vuelve a ejecutar la consulta)

## Acciones de columna

Pase el cursor sobre los encabezados de columna para ver las opciones:
- **Ocultar columna** — La oculta temporalmente de la vista
- **Ajustar ancho** — Arrastre el borde de la columna para cambiar su tamaño
- **Copiar valor** — Copia el valor de la celda en el portapapeles

## Descarga de resultados

Consulte [Exportación de datos](exporting-data.md).

## En cola, en ejecución y reutilizado

Cada **ejecución** pasa por una única cola — ya no existe un botón aparte
para consultas largas. Haga clic en **Ejecutar** y el mapa pasa por:

- **En cola** — esperando su turno. Sus propias ejecuciones avanzan una a la
  vez, en el orden en que las pidió; las ejecuciones de otro usuario nunca
  esperan detrás de las suyas.
- **En ejecución** — la consulta se está ejecutando en el origen de datos.
- **Finalizada** — las filas están listas y aparecen en la cuadrícula de
  resultados.

Si ejecuta el mismo mapa con los mismos parámetros mientras ya existe un
resultado válido, Neo salta la cola y lo devuelve al instante, marcado como
**Resultado reutilizado**. Haga clic en **Ejecutar de nuevo** para forzar una
nueva ejecución de todos modos.

### Validez del resultado

Un resultado finalizado permanece disponible durante **hasta un día** tras
completarse (su administrador puede fijar un límite más corto). El resultado
de una ejecución programada sigue en su lugar la propia retención de esa
programación — consulte [Programación de mapas](scheduling.md). En cuanto un
resultado expira, volver a ejecutar el mapa pone en cola una nueva ejecución,
y sus filas dejan de poder descargarse — consulte
[por qué faltan a veces los botones de exportación](exporting-data.md#por-qué-a-veces-faltan-los-botones-de-exportación).

## La página Ejecuciones

Haga clic en **Ejecuciones** en la barra lateral para ver todas las
ejecuciones que ha pedido, en vivo o programadas, con su estado, número de
filas, duración y caducidad. Desde aquí puede:

- **Abrir** — volver al visor de mapas mostrando las filas de esa ejecución
- **Ejecutar de nuevo** — repetir los mismos parámetros (devuelve al instante
  si el resultado sigue siendo válido)
- **Cancelar** — detener una ejecución que aún esté en cola
- **Eliminar** — quitar una ejecución finalizada
- **XLSX / CSV / PDF** — descargar las filas guardadas (consulte
  [Exportación de datos](exporting-data.md))

Un administrador puede además ver las ejecuciones de todos los usuarios.

## Historial de ejecución

Para ver solo las ejecuciones de un mapa, abra la
[página Ejecuciones](#la-página-ejecuciones) y filtre por ese mapa.

## Resolución de problemas

### Tiempo de espera de la consulta agotado

Si una consulta tarda demasiado:
- Compruebe si los parámetros son demasiado amplios (p. ej., sin filtro de fecha)
- Póngase en contacto con su administrador para optimizar los datos subyacentes

### Sin resultados

Si una consulta no devuelve ninguna fila:
- Compruebe que las condiciones sean correctas
- Verifique los valores de los parámetros
- Pruebe a ejecutarla sin los filtros opcionales

### Error de conexión

Si aparece «Error de conexión»:
- El origen de datos no está disponible temporalmente
- Vuelva a intentarlo en unos instantes
- Póngase en contacto con su administrador si el problema persiste

### Ajustes de la hoja que no se han podido aplicar

Una nota amarilla encima de los resultados enumera todo lo que el mapa pedía y
esta ejecución no ha podido cumplir — un total cuya función de Discoverer no
tiene equivalente en SQL, o una ordenación por una columna que el informe no
muestra.

Las filas en sí son correctas. Corrija el ajuste en el generador de mapas o
consulte
[Resolución de problemas de la migración](../migration/troubleshooting.md#worksheet-settings-that-could-not-be-applied).

## ¿Qué sigue?

- **[Exportación de datos](exporting-data.md)** — Descargue los resultados como Excel o CSV
- **[Programación de mapas](scheduling.md)** — Ejecute mapas automáticamente según una programación
- **[Uso compartido de mapas](sharing.md)** — Comparta consultas con sus colegas

---

**Consulte también:** [Creación de mapas](building-maps.md), [Guía del usuario](../user-guide/)
