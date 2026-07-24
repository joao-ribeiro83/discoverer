# Gestión de metadatos

Aprenda a organizar y gestionar la jerarquía de metadatos: áreas de negocio, carpetas, elementos, combinaciones y jerarquías.

## Jerarquía de metadatos

Discoverer Neo organiza los datos mediante una jerarquía:

```
Business Area (e.g., "Sales")
└── Folder (e.g., "CUSTOMERS" table)
    ├── Item (e.g., "CUSTOMER_ID" column)
    ├── Item (e.g., "CUSTOMER_NAME" column)
    └── Item (e.g., "REGION" column)
```

## Áreas de negocio

Un **área de negocio** es una agrupación lógica de datos y consultas relacionados. Ejemplos: Ventas, Finanzas, RR. HH., Marketing.

### Crear un área de negocio

1. Panel de administración → **Áreas de negocio**
2. Haga clic en **+ Crear área de negocio**
3. Introduzca:
   - **Nombre** — Nombre único (obligatorio)
   - **Descripción** — Descripción general opcional
4. Haga clic en **Crear**

El área se crea, pero vacía. A continuación, agregue carpetas y elementos.

### Editar un área de negocio

1. Haga clic en el área de negocio
2. Modifique el **Nombre** y la **Descripción**
3. Haga clic en **Guardar**

### Conceder permisos

Los usuarios necesitan acceso a las áreas de negocio para poder utilizarlas. Consulte [Gestión de usuarios](user-management.md).

### Eliminar un área de negocio

1. Haga clic en **Eliminar** (eliminación temporal, reversible)
2. Confirme

El área archivada y todo su contenido permanecen en la base de datos, pero marcados como inactivos.

## Carpetas

Una **carpeta** representa una tabla o vista de un origen de datos. Las carpetas contienen elementos (columnas).

### Crear una carpeta (manual)

1. Abra el área de negocio → pestaña **Carpetas**
2. Haga clic en **+ Crear carpeta**
3. Introduzca:
   - **Nombre** — Nombre de la carpeta (p. ej., «CUSTOMERS»)
   - **Tipo de carpeta** — TABLE, VIEW, DERIVED, COMPLEX, JOIN o SUMMARY
   - **Origen de datos** — Seleccione un origen Oracle o Postgres
   - **Esquema** — Esquema de base de datos (p. ej., «SALES»)
   - **Nombre de la tabla** — Nombre de la tabla de la base de datos
   - **Descripción** — Notas opcionales
4. Haga clic en **Crear**

### Crear una carpeta (inspección de Oracle)

Importe automáticamente tablas/vistas de Oracle:

1. Abra el área de negocio → pestaña **Carpetas**
2. Haga clic en **Inspeccionar** o **+ Importar desde Oracle**
3. Seleccione:
   - **Origen de datos** — Conexión de Oracle
   - **Esquema** — Esquema en el que buscar
   - **Objetos** — Seleccione las tablas/vistas (lista de casillas de verificación)
4. Haga clic en **Importar**

Las carpetas y los elementos se crean automáticamente con los tipos y las asignaciones de columnas adecuados.

### Tipos de carpeta

| Tipo | Caso de uso |
|------|----------|
| **TABLE** | Tabla física de la base de datos |
| **VIEW** | Vista de la base de datos |
| **DERIVED** | Carpeta personalizada basada en SQL |
| **COMPLEX** | Carpeta de varias tablas con combinaciones |
| **JOIN** | Resultado precombinado de varias tablas |
| **SUMMARY** | Tabla de resumen preagregada |

### Editar una carpeta

1. Haga clic en la carpeta → **Editar**
2. Modifique los metadatos (nombre, descripción, tipo)
3. Haga clic en **Guardar**

**Nota:** cambiar el nombre de la tabla/esquema después de la creación puede romper los mapas existentes. Proceda con cuidado.

### Eliminar una carpeta

1. Haga clic en la carpeta → **Eliminar**
2. Confirme

Los mapas que utilizan esta carpeta quedan rotos. Los usuarios ven errores al ejecutarlos.

## Elementos

Un **elemento** es una columna o un atributo de una carpeta. Los elementos son lo que los usuarios seleccionan en el generador de mapas.

### Crear un elemento (manual)

1. Abra la carpeta → pestaña **Elementos**
2. Haga clic en **+ Agregar elemento**
3. Introduzca:
   - **Nombre** — Nombre del elemento (p. ej., «CUSTOMER_ID»)
   - **Tipo de datos** — VARCHAR, NUMBER, DATE, CLOB, etc.
   - **Nombre para mostrar** — Etiqueta fácil de usar (el valor predeterminado es el nombre)
   - **Nombre de columna** — Columna real de la base de datos
   - **Descripción** — Texto de ayuda para los usuarios
   - **Tipo** — CI (personalizado), CU (usuario), CO (calculado), etc.
   - **Es clave** — Casilla de verificación si se trata de una clave principal/externa
   - **Está oculto** — Casilla de verificación para excluirlo del generador de mapas
   - **Es obligatorio** — Casilla de verificación si siempre debe incluirse
4. Haga clic en **Crear**

### Crear elementos (desde Oracle)

Al inspeccionar una tabla, los elementos se crean automáticamente para todas las columnas.

### Configurar la presentación de un elemento

Para cada elemento, establezca:

- **Nombre para mostrar** — Cómo aparece en el generador de mapas y en los resultados
- **Orden de presentación** — Secuencia en la lista (los números más bajos primero)
- **Máscara de formato** — Formato de número/fecha
  - Fecha: `YYYY-MM-DD`, `MM/DD/YYYY`, etc.
  - Número: `9,999.00`, `$9999`, etc.

### Editar un elemento

1. Haga clic en el elemento → **Editar**
2. Modifique las propiedades
3. Haga clic en **Guardar**

### Ocultar/Mostrar un elemento

Utilice el conmutador **Está oculto** para excluirlo del generador de mapas o incluirlo en él. Resulta útil para:
- Columnas internas que los usuarios no deberían seleccionar
- Columnas reservadas para cálculos
- Campos en desuso

### Eliminar un elemento

1. Haga clic en el elemento → **Eliminar**
2. Confirme

Los mapas que seleccionan este elemento quedan rotos.

## Combinaciones

Una **combinación** define una relación entre dos carpetas.

### Crear una combinación

1. Abra el área de negocio → pestaña **Combinaciones**
2. Haga clic en **+ Crear combinación**
3. Introduzca:
   - **Nombre** — Nombre de la combinación (p. ej., «Customers to Orders»)
   - **Carpeta 1** — Carpeta izquierda
   - **Carpeta 2** — Carpeta derecha
   - **Tipo de combinación** — INNER, LEFT, RIGHT, FULL
   - **Condiciones** — Predicados de combinación (véase a continuación)
4. Haga clic en **Crear**

### Condiciones de combinación

Cada combinación tiene una o varias condiciones que vinculan columnas:

1. Haga clic en **+ Agregar condición**
2. Seleccione:
   - **Elemento 1** — Columna de la carpeta 1
   - **Operador** — = (igual a)
   - **Elemento 2** — Columna de la carpeta 2
3. Añada más condiciones si es necesario (encadenamiento con AND)

**Ejemplo:** combinación de CUSTOMERS con ORDERS:
```
CUSTOMERS.CUSTOMER_ID = ORDERS.CUSTOMER_ID
```

### Tipos de combinación

| Tipo | Resultado |
|------|--------|
| **INNER** | Solo las filas que coinciden en ambas carpetas |
| **LEFT** | Todas las filas de la carpeta 1, con las coincidentes de la carpeta 2 o NULL |
| **RIGHT** | Todas las filas de la carpeta 2, con las coincidentes de la carpeta 1 o NULL |
| **FULL** | Todas las filas de ambas carpetas (con NULL) |

### Consultas de varias tablas

Los usuarios seleccionan elementos de varias carpetas en un mapa. Discoverer Neo aplica automáticamente las combinaciones necesarias.

**Ejemplo:**
```
Map selects:
- CUSTOMERS.CUSTOMER_NAME (folder A)
- ORDERS.ORDER_DATE (folder B)
- ORDERS.AMOUNT (folder B)

Auto-applies: CUSTOMERS-to-ORDERS join
```

### Editar una combinación

1. Haga clic en la combinación → **Editar**
2. Modifique el nombre, el tipo o las condiciones
3. Haga clic en **Guardar**

### Eliminar una combinación

1. Haga clic en la combinación → **Eliminar**
2. Los mapas que seleccionan de ambas carpetas ya no pueden ejecutarse

## Jerarquías

Una **jerarquía** permite la navegación de exploración en profundidad sobre las dimensiones. Ejemplo: Año → Mes → Día.

### Crear una jerarquía

1. Abra el área de negocio → pestaña **Jerarquías**
2. Haga clic en **+ Crear jerarquía**
3. Introduzca:
   - **Nombre** — Nombre de la jerarquía (p. ej., «Time»)
   - **Carpeta** — Carpeta que contiene los elementos de la jerarquía
   - **Descripción** — Notas opcionales
4. Añada niveles:
   - Haga clic en **+ Agregar nivel**
   - Seleccione un **elemento** (debe pertenecer a la carpeta de la jerarquía)
   - Introduzca el **nombre del nivel** (p. ej., «Year»)
   - Establezca el **número de nivel** (1 = superior, 2 = segundo, etc.)
5. Haga clic en **Crear**

### Niveles de jerarquía

Los niveles definen el orden de exploración en profundidad. Ejemplo de jerarquía:

```
1. CALENDAR_YEAR (top level)
2. CALENDAR_QUARTER
3. CALENDAR_MONTH
4. CALENDAR_DATE (detail level)
```

Los usuarios pueden profundizar de año → trimestre → mes → fecha en los informes.

### Editar una jerarquía

1. Haga clic en la jerarquía → **Editar**
2. Modifique el nombre, los niveles o el orden
3. Haga clic en **Guardar**

### Eliminar una jerarquía

1. Haga clic en la jerarquía → **Eliminar**
2. La exploración en profundidad deja de estar disponible para los mapas que utilizan esta jerarquía

## Almacenamiento en caché de metadatos

Los metadatos (áreas de negocio, carpetas, elementos, combinaciones, jerarquías) se almacenan en caché en Redis para mejorar el rendimiento.

- **TTL de la caché:** 5 minutos (predeterminado, configurable)
- **Invalidación:** automática cuando se modifican los metadatos

Si modifica los metadatos directamente en la base de datos (no recomendado), reinicie el backend para borrar la caché.

## Prácticas recomendadas

1. **Utilice nombres descriptivos** — Evite las abreviaturas; los usuarios deben comprender el propósito de las columnas
2. **Proporcione descripciones** — El texto de ayuda facilita a los usuarios la creación de consultas correctas
3. **Organice de forma lógica** — Agrupe los elementos relacionados en carpetas y cree combinaciones para las relaciones habituales
4. **Oculte las columnas innecesarias** — Mantenga limpio el generador de mapas; oculte los elementos internos o en desuso
5. **Pruebe después de los cambios** — Verifique que los mapas existentes siguen funcionando tras editar los metadatos
6. **Documente las jerarquías** — Describa la lógica de exploración en profundidad en las descripciones
7. **Haga una copia de seguridad antes de cambios importantes** — Exporte las definiciones de las áreas de negocio antes de una reestructuración importante

## ¿Qué sigue?

- **[Inspección de Oracle](oracle-introspection.md)** — Detecte automáticamente tablas y columnas
- **[Orígenes de datos](data-sources.md)** — Gestione las conexiones de base de datos
- **[Gestión de usuarios](user-management.md)** — Conceda acceso a las áreas de negocio
- **[Directivas de seguridad](security.md)** — Defina la seguridad de nivel de fila

---

**Consulte también:** [Guía del administrador](../admin-guide/), [Referencia de la API](../../api/endpoints.md)
