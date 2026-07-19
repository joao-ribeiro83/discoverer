# Custom Functions

Learn how to define custom SQL and PLSQL functions for use in calculated fields.

## What are Custom Functions?

**Custom Functions** allow you to extend Discoverer Neo with domain-specific logic:

- **SQL Functions** — Simple expressions (e.g., `UPPER(name)`, `TRUNC(date)`)
- **PLSQL Functions** — Reusable stored procedures on Oracle

Functions are available in calculated fields and map conditions.

## Creating a Custom Function

### Step 1: Add Function

1. Admin Panel → **Custom Functions**
2. Click **+ Create Function**
3. Enter:
   - **Name** — Function identifier (e.g., `REVENUE_BAND`)
   - **Type** — SQL or PLSQL
   - **Parameters** — Input parameters (see below)
   - **Return Type** — VARCHAR, NUMBER, DATE, etc.
   - **Description** — Explain the function's purpose

### Step 2: Define Function Body

For **SQL** functions:

```sql
CASE
  WHEN revenue > 100000 THEN 'Enterprise'
  WHEN revenue > 50000 THEN 'Mid-Market'
  ELSE 'SMB'
END
```

For **PLSQL** functions (Oracle):

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

### Step 3: Define Parameters

Functions can accept parameters:

1. Click **+ Add Parameter**
2. Enter:
   - **Name** — Parameter name (e.g., `p_revenue`)
   - **Data Type** — NUMBER, VARCHAR, DATE, etc.
   - **Required** — Checkbox

**Example function with parameters:**
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

### Step 4: Save Function

Click **Create**. Function is now available in calculated fields and conditions.

## Using Custom Functions

### In Calculated Fields

Once defined, functions appear in the calculated field formula editor:

1. Map Builder → **Add Calculated Field**
2. Enter name and formula:
   ```sql
   revenue_band(ANNUAL_REVENUE)
   ```
3. The calculated column displays the function result

### In Conditions

Use functions to create smart filters:

1. Map Builder → **Add Condition**
2. Use function in the value:
   ```sql
   discount_rate(CUSTOMER_TYPE, ORDER_AMOUNT) > 0.10
   ```

## SQL vs PLSQL Functions

| Aspect | SQL | PLSQL |
|--------|-----|-------|
| **Complexity** | Simple expressions | Complex logic |
| **Performance** | Fast (parsed once) | Good (compiled) |
| **Debugging** | Easy (visible) | Harder (black box) |
| **Storage** | Stored in Discoverer Neo DB | Created on Oracle DB |
| **Portability** | Works on any DB | Oracle only |

**Use SQL for:**
- Simple transformations
- CASE statements
- Date/string manipulation
- Portable logic

**Use PLSQL for:**
- Complex business logic
- Loop operations
- Oracle-specific features
- Functions calling other stored procedures

## Function Examples

### Example 1: Quarter Calculation (SQL)

```sql
CASE
  WHEN MONTH(sale_date) IN (1, 2, 3) THEN 'Q1'
  WHEN MONTH(sale_date) IN (4, 5, 6) THEN 'Q2'
  WHEN MONTH(sale_date) IN (7, 8, 9) THEN 'Q3'
  ELSE 'Q4'
END
```

**Usage:**
```sql
calculate_quarter(sale_date)  -- returns Q1, Q2, etc.
```

### Example 2: Age Group Classification (PLSQL)

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

### Example 3: Commission Calculation (SQL)

```sql
CASE
  WHEN sales_stage = 'Won' AND revenue > 1000000 THEN revenue * 0.12
  WHEN sales_stage = 'Won' AND revenue > 500000 THEN revenue * 0.10
  WHEN sales_stage = 'Won' THEN revenue * 0.08
  ELSE 0
END
```

## Editing Functions

1. Admin Panel → **Custom Functions**
2. Click function → **Edit**
3. Modify name, parameters, or body
4. Click **Save**

**Note:** Changing parameter names/types may break existing calculated fields. Proceed carefully.

## Deleting Functions

1. Click function → **Delete**
2. Confirm

Calculated fields using this function will fail. Remove or update them first.

## Testing Functions

### Test via Calculated Field

1. Create a test map with a calculated field using the function
2. Run the map
3. Verify calculated column displays expected values

### Test via PLSQL Procedure (Oracle)

For PLSQL functions, test directly in Oracle:

```sql
-- Test function directly
SELECT revenue_band(75000) FROM DUAL;
-- Output: Mid-Market

SELECT revenue_band(150000) FROM DUAL;
-- Output: Enterprise
```

## Performance Optimization

- **Index supporting columns** — If function filters by a column (e.g., `revenue_band(annual_revenue)` using ANNUAL_REVENUE), index it
- **Simplify logic** — Complex nested CASE statements are slower
- **Avoid subqueries** — Don't use SELECT inside functions
- **Use DETERMINISTIC clause** (Oracle):
  ```sql
  CREATE FUNCTION revenue_band(p_revenue NUMBER)
  RETURN VARCHAR2 DETERMINISTIC
  ...
  ```

## PLSQL Permissions

To create PLSQL functions on Oracle, the Discoverer Neo database user needs:

```sql
GRANT CREATE PROCEDURE TO eul5_us;
GRANT CREATE FUNCTION TO eul5_us;
```

## Limitations

- **No External Functions** — Cannot call Python, Java, etc.
- **Single Return Value** — Functions return one value, not result sets
- **No Side Effects** — Functions shouldn't INSERT/UPDATE/DELETE (undefined behavior)
- **Parameter Binding** — Users cannot currently pass custom parameter values to functions; functions must reference map fields

## Version Control

Document custom functions:

1. Keep a log of function creation date and author
2. Maintain descriptions explaining business logic
3. Note if function is used in multiple calculated fields
4. Plan deprecation before removing functions

## What's Next?

- **[Building Maps](../user-guide/building-maps.md)** — Use functions in calculated fields
- **[Metadata Management](metadata-management.md)** — Organize functions with business areas

---

**See Also:** [Admin Guide](../admin-guide/), [API Reference - Custom Functions](../api/endpoints.md)
