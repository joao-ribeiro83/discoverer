# Funciones personalizadas

Aprenda a definir funciones SQL y PLSQL personalizadas para utilizarlas en los campos calculados.

## ¿Qué son las funciones personalizadas?

Las **funciones personalizadas** le permiten ampliar Discoverer Neo con lógica específica del dominio:

- **Funciones SQL** — Expresiones sencillas (p. ej., `UPPER(name)`, `TRUNC(date)`)
- **Funciones PLSQL** — Procedimientos almacenados reutilizables en Oracle

Las funciones están disponibles en los campos calculados y en las condiciones de los mapas.

## Creación de una función personalizada

### Paso 1: agregar una función

1. Panel de administración → **Funciones personalizadas**
2. Haga clic en **+ Crear función**
3. Introduzca:
   - **Nombre** — Identificador de la función (p. ej., `REVENUE_BAND`)
   - **Tipo** — SQL o PLSQL
   - **Parámetros** — Parámetros de entrada (véase a continuación)
   - **Tipo de retorno** — VARCHAR, NUMBER, DATE, etc.
   - **Descripción** — Explique el propósito de la función

### Paso 2: definir el cuerpo de la función

Para las funciones **SQL**:

```sql
CASE
  WHEN revenue > 100000 THEN 'Enterprise'
  WHEN revenue > 50000 THEN 'Mid-Market'
  ELSE 'SMB'
END
```

Para las funciones **PLSQL** (Oracle):

```plsql
CREATE FUNCTION revenue_band(p_revenue NUMBER) RETURN VARCHAR2 IS
BEGIN
  IF p_revenue > 100000 THEN
    RETURN 'Enterprise';
  ELSIF p_revenue > 50000 THEN
    RETURN 'Mid-Market';
  ELSE
    RETURN 'SMB';
  END IF;
END;
/
```

### Paso 3: definir los parámetros

Las funciones pueden aceptar parámetros:

1. Haga clic en **+ Agregar parámetro**
2. Introduzca:
   - **Nombre** — Nombre del parámetro (p. ej., `p_revenue`)
   - **Tipo de datos** — NUMBER, VARCHAR, DATE, etc.
   - **Obligatorio** — Casilla de verificación

**Ejemplo de función con parámetros:**
```sql
FUNCTION discount_rate(p_customer_type VARCHAR2, p_amount NUMBER)
RETURN NUMBER
BEGIN
  CASE p_customer_type
    WHEN 'GOLD' THEN RETURN 0.15
    WHEN 'SILVER' THEN RETURN 0.10
    ELSE RETURN 0.05
  END;
END;
```

### Paso 4: guardar la función

Haga clic en **Crear**. La función ya está disponible en los campos calculados y en las condiciones.

## Uso de las funciones personalizadas

### En los campos calculados

Una vez definidas, las funciones aparecen en el editor de fórmulas de campos calculados:

1. Generador de mapas → **Agregar campo calculado**
2. Introduzca el nombre y la fórmula:
   ```sql
   revenue_band(ANNUAL_REVENUE)
   ```
3. La columna calculada muestra el resultado de la función

### En las condiciones

Utilice funciones para crear filtros inteligentes:

1. Generador de mapas → **Agregar condición**
2. Utilice la función en el valor:
   ```sql
   discount_rate(CUSTOMER_TYPE, ORDER_AMOUNT) > 0.10
   ```

## Funciones SQL frente a PLSQL

| Aspecto | SQL | PLSQL |
|--------|-----|-------|
| **Complejidad** | Expresiones sencillas | Lógica compleja |
| **Rendimiento** | Rápido (se analiza una vez) | Bueno (compilado) |
| **Depuración** | Fácil (visible) | Más difícil (caja negra) |
| **Almacenamiento** | En la base de datos de Discoverer Neo | En la base de datos de Oracle |
| **Portabilidad** | Funciona en cualquier base de datos | Solo Oracle |

**Utilice SQL para:**
- Transformaciones sencillas
- Sentencias CASE
- Manipulación de fechas/cadenas
- Lógica portátil

**Utilice PLSQL para:**
- Lógica de negocio compleja
- Operaciones con bucles
- Características específicas de Oracle
- Funciones que llaman a otros procedimientos almacenados

## Ejemplos de funciones

### Ejemplo 1: cálculo de trimestre (SQL)

```sql
CASE
  WHEN MONTH(sale_date) IN (1, 2, 3) THEN 'Q1'
  WHEN MONTH(sale_date) IN (4, 5, 6) THEN 'Q2'
  WHEN MONTH(sale_date) IN (7, 8, 9) THEN 'Q3'
  ELSE 'Q4'
END
```

**Uso:**
```sql
calculate_quarter(sale_date)  -- returns Q1, Q2, etc.
```

### Ejemplo 2: clasificación por grupo de edad (PLSQL)

```plsql
CREATE FUNCTION age_group(p_birth_date DATE) RETURN VARCHAR2 IS
  v_age NUMBER;
BEGIN
  v_age := TRUNC((SYSDATE - p_birth_date) / 365.25);
  CASE
    WHEN v_age < 18 THEN RETURN 'Minor';
    WHEN v_age < 30 THEN RETURN '18-29';
    WHEN v_age < 50 THEN RETURN '30-49';
    ELSE RETURN '50+';
  END CASE;
END;
/
```

### Ejemplo 3: cálculo de comisiones (SQL)

```sql
CASE
  WHEN sales_stage = 'Won' AND revenue > 1000000 THEN revenue * 0.12
  WHEN sales_stage = 'Won' AND revenue > 500000 THEN revenue * 0.10
  WHEN sales_stage = 'Won' THEN revenue * 0.08
  ELSE 0
END
```

## Edición de funciones

1. Panel de administración → **Funciones personalizadas**
2. Haga clic en la función → **Editar**
3. Modifique el nombre, los parámetros o el cuerpo
4. Haga clic en **Guardar**

**Nota:** cambiar los nombres o tipos de los parámetros puede romper los campos calculados existentes. Proceda con cuidado.

## Eliminación de funciones

1. Haga clic en la función → **Eliminar**
2. Confirme

Los campos calculados que utilizan esta función fallarán. Quítelos o actualícelos primero.

## Prueba de las funciones

### Probar mediante un campo calculado

1. Cree un mapa de prueba con un campo calculado que utilice la función
2. Ejecute el mapa
3. Verifique que la columna calculada muestra los valores esperados

### Probar mediante un procedimiento PLSQL (Oracle)

Para las funciones PLSQL, pruebe directamente en Oracle:

```sql
-- Test function directly
SELECT revenue_band(75000) FROM DUAL;
-- Output: Mid-Market

SELECT revenue_band(150000) FROM DUAL;
-- Output: Enterprise
```

## Optimización del rendimiento

- **Indexe las columnas de apoyo** — Si una función filtra por una columna (p. ej., `revenue_band(annual_revenue)` utiliza ANNUAL_REVENUE), indéxela
- **Simplifique la lógica** — Las sentencias CASE anidadas complejas son más lentas
- **Evite las subconsultas** — No utilice SELECT dentro de las funciones
- **Utilice la cláusula DETERMINISTIC** (Oracle):
  ```sql
  CREATE FUNCTION revenue_band(p_revenue NUMBER)
  RETURN VARCHAR2 DETERMINISTIC
  ...
  ```

## Permisos de PLSQL

Para crear funciones PLSQL en Oracle, el usuario de base de datos de Discoverer Neo necesita:

```sql
GRANT CREATE PROCEDURE TO eul5_us;
GRANT CREATE FUNCTION TO eul5_us;
```

## Limitaciones

- **Sin funciones externas** — No se puede llamar a Python, Java, etc.
- **Un único valor de retorno** — Las funciones devuelven un valor, no conjuntos de resultados
- **Sin efectos secundarios** — Las funciones no deben realizar INSERT/UPDATE/DELETE (comportamiento indefinido)
- **Enlace de parámetros** — Actualmente los usuarios no pueden pasar valores de parámetro personalizados a las funciones; estas deben hacer referencia a los campos del mapa

## Control de versiones

Documente las funciones personalizadas:

1. Mantenga un registro de la fecha de creación y el autor de la función
2. Conserve descripciones que expliquen la lógica de negocio
3. Anote si la función se utiliza en varios campos calculados
4. Planifique el desuso antes de eliminar funciones

## ¿Qué sigue?

- **[Creación de mapas](../user-guide/building-maps.md)** — Utilice funciones en los campos calculados
- **[Gestión de metadatos](metadata-management.md)** — Organice las funciones con las áreas de negocio

---

**Consulte también:** [Guía del administrador](../admin-guide/), [Referencia de la API - Funciones personalizadas](../../api/endpoints.md)
