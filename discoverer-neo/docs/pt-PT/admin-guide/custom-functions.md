# Funções Personalizadas

Saiba como definir funções SQL e PLSQL personalizadas para utilizar em campos calculados.

## O Que São as Funções Personalizadas?

As **Funções Personalizadas** permitem-lhe expandir o Discoverer Neo com lógica específica do domínio:

- **Funções SQL** — Expressões simples (p. ex., `UPPER(name)`, `TRUNC(date)`)
- **Funções PLSQL** — Procedimentos armazenados reutilizáveis no Oracle

As funções ficam disponíveis nos campos calculados e nas condições dos mapas.

## Criar uma Função Personalizada

### Passo 1: Adicionar Função

1. Painel de Administração → **Funções Personalizadas**
2. Clique em **+ Criar Função**
3. Introduza:
   - **Nome** — Identificador da função (p. ex., `REVENUE_BAND`)
   - **Tipo** — SQL ou PLSQL
   - **Parâmetros** — Parâmetros de entrada (ver abaixo)
   - **Tipo de Retorno** — VARCHAR, NUMBER, DATE, etc.
   - **Descrição** — Explique a finalidade da função

### Passo 2: Definir o Corpo da Função

Para funções **SQL**:

```sql
CASE
  WHEN revenue > 100000 THEN 'Enterprise'
  WHEN revenue > 50000 THEN 'Mid-Market'
  ELSE 'SMB'
END
```

Para funções **PLSQL** (Oracle):

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

### Passo 3: Definir os Parâmetros

As funções podem aceitar parâmetros:

1. Clique em **+ Adicionar Parâmetro**
2. Introduza:
   - **Nome** — Nome do parâmetro (p. ex., `p_revenue`)
   - **Tipo de Dados** — NUMBER, VARCHAR, DATE, etc.
   - **Obrigatório** — Caixa de verificação

**Exemplo de função com parâmetros:**
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

### Passo 4: Guardar a Função

Clique em **Criar**. A função fica agora disponível nos campos calculados e nas condições.

## Utilizar Funções Personalizadas

### Em Campos Calculados

Depois de definidas, as funções surgem no editor de fórmulas dos campos calculados:

1. Construtor de Mapas → **Adicionar Campo Calculado**
2. Introduza o nome e a fórmula:
   ```sql
   revenue_band(ANNUAL_REVENUE)
   ```
3. A coluna calculada apresenta o resultado da função

### Em Condições

Utilize funções para criar filtros inteligentes:

1. Construtor de Mapas → **Adicionar Condição**
2. Utilize a função no valor:
   ```sql
   discount_rate(CUSTOMER_TYPE, ORDER_AMOUNT) > 0.10
   ```

## Funções SQL vs PLSQL

| Aspeto | SQL | PLSQL |
|--------|-----|-------|
| **Complexidade** | Expressões simples | Lógica complexa |
| **Desempenho** | Rápido (analisado uma vez) | Bom (compilado) |
| **Depuração** | Fácil (visível) | Mais difícil (caixa negra) |
| **Armazenamento** | Armazenado na BD do Discoverer Neo | Criado na BD Oracle |
| **Portabilidade** | Funciona em qualquer BD | Apenas Oracle |

**Utilize SQL para:**
- Transformações simples
- Instruções CASE
- Manipulação de datas/cadeias de carateres
- Lógica portável

**Utilize PLSQL para:**
- Lógica de negócio complexa
- Operações de ciclo
- Funcionalidades específicas do Oracle
- Funções que invocam outros procedimentos armazenados

## Exemplos de Funções

### Exemplo 1: Cálculo de Trimestre (SQL)

```sql
CASE
  WHEN MONTH(sale_date) IN (1, 2, 3) THEN 'Q1'
  WHEN MONTH(sale_date) IN (4, 5, 6) THEN 'Q2'
  WHEN MONTH(sale_date) IN (7, 8, 9) THEN 'Q3'
  ELSE 'Q4'
END
```

**Utilização:**
```sql
calculate_quarter(sale_date)  -- returns Q1, Q2, etc.
```

### Exemplo 2: Classificação de Faixa Etária (PLSQL)

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

### Exemplo 3: Cálculo de Comissão (SQL)

```sql
CASE
  WHEN sales_stage = 'Won' AND revenue > 1000000 THEN revenue * 0.12
  WHEN sales_stage = 'Won' AND revenue > 500000 THEN revenue * 0.10
  WHEN sales_stage = 'Won' THEN revenue * 0.08
  ELSE 0
END
```

## Editar Funções

1. Painel de Administração → **Funções Personalizadas**
2. Clique na função → **Editar**
3. Modifique o nome, os parâmetros ou o corpo
4. Clique em **Guardar**

**Nota:** Alterar os nomes/tipos dos parâmetros pode quebrar campos calculados existentes. Proceda com cuidado.

## Eliminar Funções

1. Clique na função → **Eliminar**
2. Confirme

Os campos calculados que utilizam esta função irão falhar. Remova-os ou atualize-os primeiro.

## Testar Funções

### Testar Através de um Campo Calculado

1. Crie um mapa de teste com um campo calculado que utilize a função
2. Execute o mapa
3. Verifique se a coluna calculada apresenta os valores esperados

### Testar Através de um Procedimento PLSQL (Oracle)

Para funções PLSQL, teste diretamente no Oracle:

```sql
-- Test function directly
SELECT revenue_band(75000) FROM DUAL;
-- Output: Mid-Market

SELECT revenue_band(150000) FROM DUAL;
-- Output: Enterprise
```

## Otimização de Desempenho

- **Indexe as colunas de suporte** — Se a função filtrar por uma coluna (p. ex., `revenue_band(annual_revenue)` utilizando ANNUAL_REVENUE), indexe-a
- **Simplifique a lógica** — As instruções CASE aninhadas e complexas são mais lentas
- **Evite subconsultas** — Não utilize SELECT dentro das funções
- **Utilize a cláusula DETERMINISTIC** (Oracle):
  ```sql
  CREATE FUNCTION revenue_band(p_revenue NUMBER)
  RETURN VARCHAR2 DETERMINISTIC
  ...
  ```

## Permissões PLSQL

Para criar funções PLSQL no Oracle, o utilizador da base de dados do Discoverer Neo precisa de:

```sql
GRANT CREATE PROCEDURE TO eul5_us;
GRANT CREATE FUNCTION TO eul5_us;
```

## Limitações

- **Sem Funções Externas** — Não é possível invocar Python, Java, etc.
- **Um Único Valor de Retorno** — As funções devolvem um valor, não conjuntos de resultados
- **Sem Efeitos Secundários** — As funções não devem fazer INSERT/UPDATE/DELETE (comportamento indefinido)
- **Associação de Parâmetros** — Atualmente, os utilizadores não podem passar valores de parâmetros personalizados às funções; as funções têm de referenciar campos do mapa

## Controlo de Versões

Documente as funções personalizadas:

1. Mantenha um registo da data de criação e do autor da função
2. Mantenha descrições que expliquem a lógica de negócio
3. Anote se a função é utilizada em vários campos calculados
4. Planeie a descontinuação antes de remover funções

## O Que Se Segue?

- **[Criar Mapas](../user-guide/building-maps.md)** — Utilizar funções em campos calculados
- **[Gestão de Metadados](metadata-management.md)** — Organizar funções com áreas de negócio

---

**Consulte Também:** [Guia do Administrador](../admin-guide/), [Referência da API - Funções Personalizadas](../../api/endpoints.md)
