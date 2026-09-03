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

Si su mapa tiene parámetros, verá un panel de entrada:

1. Introduzca valores para cada parámetro **obligatorio**
2. Los parámetros opcionales pueden dejarse en blanco (se utiliza el valor predeterminado)
3. Haga clic en **Ejecutar** para iniciar la ejecución

**Ejemplo:**
```
Start Date: [2026-01-01]
End Date: [2026-12-31]
Region: [EMEA]
```

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

## Ejecución asíncrona (consultas largas)

Para consultas que tardan más de 30 segundos:

1. Haga clic en **Ejecutar en segundo plano**
2. Volverá al panel
3. Consulte **Trabajos programados** o **Historial de ejecución** para ver el estado

Valores de estado:
- **PENDING** — En cola, a la espera de ejecutarse
- **PROCESSING** — En ejecución
- **COMPLETED** — Finalizado, resultados disponibles
- **FAILED** — La consulta ha fallado (consulte el error)

Haga clic en un trabajo completado para ver los resultados.

## Historial de ejecución

Consulte las ejecuciones recientes de un mapa:

1. Abra un mapa → haga clic en **Historial**
2. Verá una lista de las ejecuciones recientes con:
   - Fecha y hora de ejecución
   - Usuario que la ejecutó
   - Número de filas devueltas
   - Tiempo de ejecución

Haga clic en cualquier fila para volver a ver esos resultados.

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
