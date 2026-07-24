# Inspección de Oracle

Detecte automáticamente tablas y vistas de bases de datos Oracle e impórtelas como carpetas de Discoverer Neo.

## ¿Qué es la inspección?

La **inspección** conecta con una base de datos Oracle y lee las definiciones de tablas/vistas (esquema, columnas, tipos de datos) para crear automáticamente carpetas y elementos de Discoverer Neo.

Sin la inspección, tendría que crear manualmente cada carpeta y elemento, lo que resulta tedioso y propenso a errores en esquemas grandes.

## Proceso de inspección

1. Conectar con la base de datos Oracle (a través de un origen de datos)
2. Consultar las vistas del diccionario (USER_TABLES, USER_VIEWS, USER_TAB_COLUMNS)
3. Crear una carpeta para cada tabla/vista
4. Crear un elemento para cada columna
5. Establecer los tipos de datos, las restricciones de clave y los nombres para mostrar

## Ejecución de la inspección

### Paso 1: agregar un origen de datos

Primero, cree un origen de datos Oracle (consulte [Orígenes de datos](data-sources.md)):

1. Panel de administración → **Orígenes de datos**
2. Agregue una conexión de Oracle
3. Pruebe la conectividad
4. Guarde

### Paso 2: inspeccionar las tablas

1. Panel de administración → **Áreas de negocio** → seleccione un área
2. Haga clic en la pestaña **Carpetas**
3. Haga clic en **+ Inspeccionar** o **Importar desde Oracle**
4. Seleccione:
   - **Origen de datos** — Conexión de Oracle
   - **Esquema** — Esquema de base de datos (p. ej., «SALES»)
5. Haga clic en **Descubrir tablas**

El sistema consulta todas las tablas y vistas del esquema.

### Paso 3: seleccionar las tablas/vistas

Aparece una lista con todos los objetos que se pueden descubrir:

1. Marque las casillas junto a las tablas/vistas que desea importar
2. Desmarque las que desea omitir (p. ej., tablas temporales, objetos internos)
3. Haga clic en **Importar**

Discoverer Neo crea carpetas para cada objeto seleccionado.

### Paso 4: verificar la importación

Una vez completada la importación:

1. Actualice la lista de **Carpetas**
2. Verifique que aparecen todas las tablas/vistas esperadas
3. Haga clic en una carpeta para revisar los elementos (columnas)
4. Compruebe los tipos de datos y los nombres para mostrar

## Propiedades de las carpetas importadas

Al importar, cada carpeta recibe:

| Propiedad | Detectado automáticamente |
|----------|---------------|
| **Nombre** | Nombre de la tabla/vista |
| **Tipo** | TABLE o VIEW |
| **Esquema** | Esquema de origen |
| **Nombre de la tabla** | Nombre físico de la tabla |
| **Descripción** | Null (el usuario debería añadirla) |

## Propiedades de los elementos importados

Para cada columna, los elementos reciben:

| Propiedad | Detectado automáticamente |
|----------|---------------|
| **Nombre** | Nombre de la columna |
| **Tipo de datos** | Tipo de datos de Oracle (VARCHAR2 → VARCHAR, NUMBER, DATE, etc.) |
| **Nombre para mostrar** | Nombre de la columna (el usuario debería mejorarlo) |
| **Nombre de columna** | Nombre físico de la columna |
| **Es clave** | Sí, si la columna forma parte de la clave principal |
| **Descripción** | Null (el usuario debería añadirla) |

## Limpieza posterior a la importación

Tras la inspección, mejore los metadatos:

### Añadir descripciones

1. Haga clic en la carpeta → **Editar**
2. Añada una **descripción** que explique la tabla
3. Repita el proceso para los elementos clave
4. Guarde

**Ejemplo:**
- Carpeta: «Tabla maestra de clientes con información de contacto y dirección»
- Elemento CUSTOMER_ID: «Identificador único de cliente, clave principal»
- Elemento CUSTOMER_NAME: «Nombre comercial del cliente»

### Mejorar los nombres para mostrar

1. Haga clic en el elemento → **Editar**
2. Cambie el **nombre para mostrar** por una versión más fácil de usar
3. Ejemplos:
   - CUST_ID → Customer ID
   - SALES_AMOUNT_USD → Sales Amount (USD)
   - CREATE_DT → Creation Date

### Ocultar los elementos innecesarios

Para las columnas internas que los usuarios no deberían utilizar:

1. Haga clic en el elemento → **Editar**
2. Marque **Está oculto**
3. Guarde

Los elementos ocultos no aparecen en el generador de mapas, pero siguen existiendo para las consultas.

### Establecer el orden de clasificación

Organice los elementos para el generador de mapas:

1. Haga clic en la carpeta → **Editar**
2. Reordene los elementos por **orden de presentación**
3. Guarde

## Gestión de la asignación de tipos de datos

Los tipos de datos de Oracle se asignan a tipos genéricos:

| Oracle | Se asigna a | Notas |
|--------|-----------|-------|
| VARCHAR2(n) | VARCHAR | Texto, hasta 4000 caracteres |
| CLOB | VARCHAR | Texto extenso (>4000 caracteres) |
| NUMBER(p,s) | NUMBER | Numérico con precisión |
| DATE | DATE | Solo fecha |
| TIMESTAMP | DATE | Fecha y hora |
| BLOB | VARCHAR | Binario (se trata como texto en Discoverer Neo) |

## Inspección incremental

Inspeccione un esquema varias veces para:

- Añadir tablas recién creadas
- Volver a importar tablas modificadas
- Omitir las tablas ya importadas (el sistema comprueba los duplicados)

**Nota:** volver a importar una tabla existente no actualiza las definiciones de los elementos. Elimine primero la carpeta antigua y luego realice la inspección.

## Gestión de objetos complejos

### Vistas con combinaciones

Las vistas que combinan varias tablas se inspeccionan con normalidad. La carpeta resultante no expone la estructura de la combinación; se trata simplemente de una carpeta con los elementos del conjunto de resultados de la vista.

### Gestión de sinónimos

Los sinónimos de base de datos normalmente no se inspeccionan (el sistema los omite). Si es necesario:
- Cree una vista en lugar de un sinónimo
- Cree manualmente una carpeta que apunte al nombre del sinónimo

### Vistas materializadas

Las vistas materializadas de Oracle se inspeccionan como tablas (están materializadas, por lo que se comportan como tablas).

## Resolución de problemas de inspección

### «No se han encontrado tablas»

**Causas:**
- Nombre de esquema incorrecto o inexistente
- El usuario carece del privilegio SELECT_CATALOG_ROLE
- No hay tablas en el esquema

**Solución:**
1. Verifique el nombre del esquema con el DBA de Oracle
2. Compruebe los privilegios del usuario:
   ```sql
   SELECT * FROM SESSION_PRIVS WHERE PRIVILEGE LIKE '%CATALOG%';
   ```
3. Enumere las tablas disponibles:
   ```sql
   SELECT OWNER, TABLE_NAME FROM DBA_TABLES ORDER BY OWNER;
   ```

### «No se puede conectar con Oracle»

Consulte [Orígenes de datos - Resolución de problemas](data-sources.md#resolución-de-problemas).

### «Tiempo de espera de importación agotado»

**Causa:** esquema grande con muchos objetos

**Solución:**
- Inspeccione esquemas más pequeños por separado
- Póngase en contacto con el administrador para aumentar el tiempo de espera en la configuración del backend

## Automatización

Para automatizar la inspección a gran escala (p. ej., tras implementar un nuevo ERP):

1. Utilice la CLI o la API de la herramienta de migración para crear carpetas de forma masiva
2. Escriba un script que realice la inspección a través de la API:
   ```bash
   curl -X POST http://localhost:3000/api/business-areas/:baId/folders/:folderId/introspect \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"dataSourceId":"...","schema":"SALES"}'
   ```

## Próximos pasos

- **[Gestión de metadatos](metadata-management.md)** — Cree combinaciones entre las tablas inspeccionadas
- **[Orígenes de datos](data-sources.md)** — Gestione las conexiones de base de datos
- **[Creación de mapas](../user-guide/building-maps.md)** — Utilice las tablas importadas en las consultas

---

**Consulte también:** [Guía del administrador](../admin-guide/), [Referencia de la API](../../api/endpoints.md)
