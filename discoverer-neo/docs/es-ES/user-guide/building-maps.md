# Creación de mapas

Aprenda a crear mapas (consultas guardadas) mediante el generador de mapas interactivo.

## ¿Qué es un mapa?

Un **mapa** es una definición de consulta guardada que especifica:
- Qué columnas de datos (elementos) se muestran
- Qué filas se filtran (condiciones)
- Cómo se ordenan y agregan los resultados
- Los parámetros que hacen que la consulta sea interactiva
- Los campos calculados para la lógica de negocio

## Tipos de mapa

Discoverer Neo admite cuatro tipos de mapa:

| Tipo | Caso de uso |
|------|----------|
| **TABLE** | Presentación de resultados en formato tabular, predeterminado para la mayoría de las consultas |
| **CROSSTAB** | Vista de tabla cruzada (filas × columnas) |
| **PAGE_DETAIL** | Diseño maestro-detalle (exploración en profundidad) |
| **CHART** | Representaciones visuales (barras, líneas, sectores, etc.) |

## Creación de un mapa

### Paso 1: iniciar el generador de mapas

1. Haga clic en **Mapas** en la barra lateral, luego en **Crear mapa**
2. Elija un área de negocio para el nuevo mapa
3. Introduzca:
   - **Nombre** — Título del mapa (obligatorio)
   - **Descripción** — Descripción opcional
   - **Tipo de mapa** — Elija TABLE, CROSSTAB, PAGE_DETAIL o CHART
4. Haga clic en **Siguiente** o **Crear**

### Paso 2: seleccionar elementos (columnas)

Los elementos son las columnas/campos que desea mostrar.

1. En el panel **Elementos**, haga clic en **+ Agregar elemento**
2. Seleccione entre los elementos disponibles en la carpeta
3. Cambie el orden arrastrando los elementos
4. Para cada elemento, puede configurar:
   - **Nombre para mostrar** — Encabezado de columna (el valor predeterminado es el nombre del elemento)
   - **Dirección de ordenación** — ASC (ascendente) o DESC (descendente)
   - **Orden de clasificación** — 1, 2, 3... para la ordenación por varias columnas
   - **Función de agregación** — SUM, COUNT, AVG, MIN, MAX (para elementos numéricos)
   - **Ancho de columna** — Ancho de la columna en píxeles (opcional)
   - **Máscara de formato** — Formato de fecha/número (opcional)

**Ejemplo:** para un informe de ventas:
- CUSTOMER_NAME (nombre para mostrar: «Cliente», orden de clasificación 1)
- AMOUNT (agregación: SUM)
- SALE_DATE (máscara de formato: «YYYY-MM-DD»)

### Paso 3: agregar condiciones (filtros)

Las condiciones filtran las filas que aparecen en los resultados.

1. Haga clic en **+ Agregar condición**
2. Seleccione un **elemento** por el que filtrar
3. Elija un **operador**:
   - `=` — Igual a
   - `<>` — Distinto de
   - `>` — Mayor que
   - `<` — Menor que
   - `>=` — Mayor o igual que
   - `<=` — Menor o igual que
   - `LIKE` — Coincidencia de patrón (%)
   - `IN` — Varios valores
   - `BETWEEN` — Intervalo
   - `IS_NULL` — Sin valor
4. Introduzca un **valor** o elija un **parámetro**
5. Establezca el **operador lógico** (AND/OR) si hay varias condiciones

**Ejemplo:** mostrar solo las ventas de 2026:
- Elemento: SALE_DATE
- Operador: >=
- Valor: 2026-01-01

**Condición parametrizada:** haga que una condición sea interactiva enlazándola a un **parámetro** (consulte el paso 4).

### Paso 4: agregar parámetros

Los parámetros hacen que los mapas sean interactivos al solicitar datos a los usuarios durante la ejecución.

1. Haga clic en **+ Agregar parámetro**
2. Introduzca:
   - **Nombre** — Identificador único (solo letras, dígitos y guiones bajos, p. ej., `start_date`)
   - **Tipo** — STRING, NUMBER, DATE, LIST
   - **Valor predeterminado** — Valor predeterminado opcional (se utiliza si no se proporciona el parámetro)
   - **Obligatorio** — Si está marcado, el usuario debe proporcionar un valor

3. Utilice el parámetro en una condición seleccionándolo en lugar de un valor estático

**Ejemplo:** cree un parámetro DATE `end_date` y utilícelo en una condición:
- Elemento: SALE_DATE
- Operador: <=
- Valor: <parámetro: end_date>

Al ejecutar el mapa, se pedirá a los usuarios que introduzcan una fecha de finalización.

### Paso 5: agregar campos calculados (opcional)

Los campos calculados calculan columnas nuevas mediante expresiones SQL.

1. Haga clic en **+ Agregar campo calculado**
2. Introduzca:
   - **Nombre** — Nombre del campo (p. ej., `REVENUE_PERCENT`)
   - **Fórmula** — Expresión SQL (p. ej., `AMOUNT * QUANTITY`)

**Ejemplo:**
- Nombre: `MARGIN_PCT`
- Fórmula: `(AMOUNT - COST) / AMOUNT * 100`

Las fórmulas pueden hacer referencia a:
- Nombres de elementos (p. ej., `AMOUNT`, `QUANTITY`)
- Funciones SQL (p. ej., `UPPER(CUSTOMER_NAME)`, `TRUNC(SALE_DATE)`)
- Funciones de ventana (p. ej., `SUM(AMOUNT) OVER (PARTITION BY CUSTOMER_ID)`)

### Paso 6: guardar el mapa

1. Haga clic en **Guardar mapa**
2. Revise el resumen
3. Haga clic en **Confirmar**

El mapa queda guardado y disponible en su lista **Mis mapas**.

## Edición de un mapa

1. Haga clic en **Mapas** → busque su mapa → haga clic en **Editar**
2. Modifique los elementos, las condiciones, los parámetros o los campos calculados
3. Haga clic en **Guardar**

## Sugerencias para el generador de mapas

### Consultas de varias carpetas

Para consultar datos de varias carpetas, primero debe definir **combinaciones** entre ellas. Póngase en contacto con su administrador.

### Ordenación

- Establezca el **orden de clasificación** (1, 2, 3...) para la ordenación por varias columnas
- Solo los elementos con un orden de clasificación aparecen en la ordenación
- Los órdenes de clasificación más altos se aplican después de los más bajos

### Agregación

Cuando agrega una función de agregación (SUM, COUNT, etc.) a un elemento:
- Los resultados se agrupan automáticamente por los elementos no agregados
- Los elementos agregados se calculan por grupo

**Ejemplo:** para obtener las ventas totales por cliente:
- Agregue CUSTOMER_NAME (sin agregación, orden de clasificación 1)
- Agregue AMOUNT (agregación: SUM)
- Resultado: una fila por cliente con las ventas totales

### Nomenclatura de los parámetros

Los nombres de los parámetros deben:
- Empezar por una letra (A-Z, a-z)
- Contener únicamente letras, dígitos y guiones bajos
- Ejemplos de nombres correctos: `start_date`, `region_code`, `customer_id`

### Agrupar y cortar

Marque **Agrupar y cortar** en una columna para ocultar sus valores repetidos y
empezar un subtotal nuevo cada vez que cambie. Las columnas de grupo se ordenan
siempre antes que todas las demás: un corte solo agrupa si nada se ordena fuera
de él.

### Colocación y borde de la tabla cruzada

La **colocación** indica para qué sirve una columna:

- **Agrupar por (eje)** — una columna por la que agrupa el informe. Nunca se
  agrega, aunque el elemento de origen tenga una agregación predeterminada.
- **Medida** — un valor que se agrega.
- **Elemento de página** — filtra toda la hoja; no se dibuja en la cuadrícula.

El **borde de la tabla cruzada** se aplica a un mapa `CROSSTAB`: ponga una
columna *En la parte superior* para cruzar el informe. Los mapas migrados desde
Discoverer no tienen ningún borde registrado —Discoverer no tenía ese campo—,
por lo que una tabla cruzada migrada se muestra como tabla hasta que defina
uno.

### Columnas solo de consulta

Marque **Solo consulta, no mostrar** para mantener una columna fuera de los
resultados mientras la consulta la sigue pidiendo. Úselo cuando un filtro, una
ordenación o un total necesite una columna que el lector no debe ver.

### Formatos de columna

La **máscara de formato** usa la notación de Oracle (`999,999.00`, `$9,999.00`,
`DD-MON-YYYY`). Se lee por su significado —miles agrupados, dos decimales,
día-mes-año— y después se muestra en el idioma de cada lector, de modo que el
mismo mapa se lee correctamente para todos.

## ¿Qué sigue?

- **[Ejecución de mapas](executing-maps.md)** — Ejecute su mapa y consulte los resultados
- **[Exportación de datos](exporting-data.md)** — Guarde los resultados como Excel o CSV
- **[Uso compartido de mapas](sharing.md)** — Compártalos con otros usuarios

---

**Consulte también:** [Guía del usuario](../user-guide/), [Guía del administrador - Metadatos](../admin-guide/metadata-management.md)
