# Políticas de Segurança

Saiba como definir políticas de segurança ao nível da linha (RLS) que filtram os dados por utilizador ou função.

## O Que É a Segurança ao Nível da Linha?

A **Segurança ao Nível da Linha (RLS)** filtra automaticamente os resultados das consultas com base no contexto do utilizador, sem exigir alterações aos mapas ou às consultas.

**Exemplo:** Um gestor de uma região de vendas vê apenas os dados da sua região, mesmo que todas as regiões estejam na mesma tabela.

## Como Funciona a RLS

1. **Definir Política:** Criar um predicado de segurança para uma pasta
2. **Contexto do Utilizador:** Associar o utilizador a valores de contexto (p. ex., região = "EMEA")
3. **Execução da Consulta:** O predicado é adicionado automaticamente à cláusula WHERE
4. **Resultados Filtrados:** O utilizador vê apenas as linhas que correspondem ao seu contexto

```sql
-- Base query
SELECT CUSTOMER_ID, SALES_AMOUNT, REGION FROM CUSTOMERS

-- With RLS policy
SELECT CUSTOMER_ID, SALES_AMOUNT, REGION FROM CUSTOMERS
WHERE REGION = NVL2(SYS_CONTEXT('dn_user_context', 'region'),
                     SYS_CONTEXT('dn_user_context', 'region'),
                     REGION)
```

## Criar Políticas de Segurança

### Passo 1: Adicionar Política

1. Painel de Administração → **Área de Negócio** → **Segurança**
2. Clique em **+ Criar Política**
3. Introduza:
   - **Nome** — Identificador da política (p. ex., "Vendas por Região")
   - **Descrição** — Explique o que a política impõe
   - **Tipo de Alvo** — FOLDER (aplica-se a todos os itens da pasta)
   - **Pasta Alvo** — Selecione a pasta a proteger
   - **Ativo** — Alterne para ativar/desativar

### Passo 2: Definir o Predicado

Introduza o **Predicado SQL** — um fragmento da cláusula WHERE anexado às consultas:

```sql
REGION = NVL2(SYS_CONTEXT('dn_user_context', 'region'),
              SYS_CONTEXT('dn_user_context', 'region'),
              REGION)
```

**Decomposição da expressão:**

- `SYS_CONTEXT('dn_user_context', 'region')` — Obtém o valor de contexto de região do utilizador
- `NVL2(...)` — Se o valor de contexto existir, utiliza-o; caso contrário, utiliza REGION (sem filtragem)
- Compara a coluna REGION da pasta com o contexto de região do utilizador

### Passo 3: Atribuir Contexto aos Utilizadores

Os utilizadores precisam de valores de contexto para que as políticas filtrem os dados.

1. Painel de Administração → **Utilizadores** → selecione o utilizador → **Contexto de Segurança**
2. Defina pares chave-valor de contexto:
   - **Chave:** `region` (corresponde ao predicado)
   - **Valor:** `EMEA` (a região deste utilizador)
3. Guarde

Agora, quando este utilizador executar uma consulta, o predicado utiliza o seu contexto de região.

## Valores de Contexto de Segurança

O contexto de segurança é um conjunto de pares chave-valor associados a cada utilizador:

| Chave | Valor | Finalidade |
|-----|-------|---------|
| `region` | EMEA, APAC, AMER | Gestor de região de vendas |
| `department` | SALES, HR, FINANCE | Dados delimitados por departamento |
| `cost_center` | CC-001, CC-002 | Filtragem por centro de custo |
| `employee_id` | EMP-12345 | Dados específicos do funcionário |

**Definir o contexto:**

1. Painel de Administração → **Utilizadores**
2. Clique no utilizador → **Editar**
3. Desloque-se até **Contexto de Segurança**
4. Clique em **+ Adicionar Contexto**
5. Introduza a chave e o valor
6. Guarde

Os utilizadores podem ter vários valores de contexto. Os predicados referenciam o valor de contexto a utilizar.

## Exemplos de Predicados

### Exemplo 1: Filtragem por Região de Vendas

**Pasta:** SALES_DATA
**Política:** Ver apenas as vendas da sua região

```sql
REGION = SYS_CONTEXT('dn_user_context', 'region')
```

**Configuração do Contexto:**
- Utilizador: john@example.com → region = 'EMEA'
- Utilizador: jane@example.com → region = 'AMER'

**Resultado:**
- O John vê: WHERE REGION = 'EMEA'
- A Jane vê: WHERE REGION = 'AMER'

### Exemplo 2: Acesso por Departamento

**Pasta:** EMPLOYEE_DATA
**Política:** Os funcionários veem apenas o seu departamento

```sql
DEPARTMENT = SYS_CONTEXT('dn_user_context', 'department')
```

### Exemplo 3: Acesso de Gestor

**Pasta:** PAYROLL
**Política:** Os gestores veem os dados dos seus subordinados

```sql
MANAGER_ID = SYS_CONTEXT('dn_user_context', 'employee_id')
OR EMPLOYEE_ID = SYS_CONTEXT('dn_user_context', 'employee_id')
```

Isto permite que os gestores vejam os registos dos seus funcionários (correspondência de MANAGER_ID) e o seu próprio registo.

### Exemplo 4: Sem Filtragem para Administradores

**Pasta:** SENSITIVE_DATA
**Política:** Ignorar a filtragem para administradores

```sql
SYS_CONTEXT('dn_user_context', 'is_admin') = 'Y'
OR DATA_OWNER = SYS_CONTEXT('dn_user_context', 'employee_id')
```

Os administradores têm o contexto `is_admin='Y'`; os restantes veem apenas os seus próprios registos.

## Testar Políticas

### Testar Como Utilizador

1. Termine a sessão (ou utilize um navegador em modo de navegação anónima)
2. Inicie sessão como utilizador de teste
3. Execute um mapa que utilize a pasta protegida
4. Verifique se os resultados estão corretamente filtrados

### Verificar o Predicado nos Registos

Os registos de auditoria mostram o SQL executado:

1. Painel de Administração → **Registo de Auditoria**
2. Filtre pela execução do mapa
3. Veja o SQL gerado com o predicado aplicado

## Desativar Políticas

### Desativar Temporariamente

1. Encontre a política → **Editar**
2. Desmarque **Ativo**
3. Guarde

A política deixa de filtrar as consultas.

### Eliminar Permanentemente

1. Encontre a política → **Eliminar**
2. Confirme

A política é removida; as consultas deixam de ser filtradas.

## Considerações de Desempenho

Os predicados de segurança são adicionados a todas as consultas nas pastas protegidas:

**Impacto:**
- Aumenta o tempo de execução (normalmente <10% para colunas bem indexadas)
- As colunas de contexto indexadas têm melhor desempenho
- Listas IN extensas (muitas regiões) tornam as consultas mais lentas

**Otimização:**
1. Indexe as colunas referenciadas nos predicados:
   ```sql
   CREATE INDEX idx_sales_region ON SALES_DATA(REGION);
   ```

2. Utilize predicados simples (igualdade) sempre que possível

3. Monitorize o desempenho das consultas com/sem RLS

## Auditoria de Segurança

Acompanhe as alterações às políticas de segurança:

1. Painel de Administração → **Registo de Auditoria**
2. Filtre por tipo de entidade: SECURITY_POLICY
3. Veja quem criou/modificou/eliminou políticas

## Melhores Práticas

1. **Comece de Forma Simples** — Comece com filtragem por uma única coluna (região, departamento)
2. **Documente as Políticas** — Explique a intenção e os requisitos de manutenção
3. **Teste Exaustivamente** — Verifique se cada utilizador vê apenas os dados adequados
4. **Monitorize o Desempenho** — Os predicados complexos podem afetar a velocidade das consultas
5. **Utilize Chaves Consistentes** — Mantenha os nomes das chaves de contexto consistentes (p. ex., sempre `region`, não `region_code`)
6. **Reveja Regularmente** — Audite as políticas trimestralmente para garantir que continuam adequadas

## Limitações

- **Atribuição Manual de Contexto** — O contexto dos utilizadores é atualmente definido manualmente (sem sincronização automática com LDAP na v0.1)
- **Sem RLS Temporal** — Ainda não existe filtragem baseada no tempo
- **Um Único Predicado por Pasta** — Aplica-se apenas uma política por pasta
- **Sem UPDATE/DELETE ao Nível da Linha** — A RLS só filtra consultas SELECT

## O Que Se Segue?

- **[Gestão de Utilizadores](user-management.md)** — Criar utilizadores e atribuir contexto
- **[Gestão de Metadados](metadata-management.md)** — Organizar pastas
- **[Registo de Auditoria](audit-logging.md)** — Rever eventos de segurança

---

**Consulte Também:** [Guia do Administrador](../admin-guide/), [Referência da API - Segurança](../../api/endpoints.md#security)
